import { Disposables } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { AUDIO_BUSES, type AudioBus } from '../../persistence/settings';
import rawBank from '../../content/sounds.json';
import { type Bank, parseBank, type Sound } from './bank';
import { type SoundOut, SoundCues } from './cues';
import { Music } from './music';
import { impulseResponse, renderSynth } from './synth';

export { SoundSettings } from './SoundSettings';

/** Most sounds at once; past it a new one is left out (a pour of clinks never floods). */
const MAX_VOICES = 32;
/** How long (s) one room's air fades into the next's. */
const FADE_S = 1.2;
/** The share of a sound in the world sent to the room's reverb. */
const REVERB_SEND = 0.22;

/**
 * The game's sound (Phase S), on the Web Audio API: the only code that makes any. The sound bank
 * (`content/sounds.json`) says what each sound is; `SoundCues` says when and where. Mixer: five
 * buses (master, music, effects, room, interface) at the settings' volumes; sounds of the world
 * are heard from where they are (HRTF) and in the room's reverb; the room's air loops and fades
 * into the next room's; the music (music.ts) plays the menu's mood on the menu and the labs' in
 * the world, through a pause too. Starts at the player's first click or key (browsers allow no
 * sound before one); the world's sounds stop while the game is paused, all of it while the window
 * is hidden. Per frame only the listener follows the eye (and the music writes a bar ahead now
 * and then).
 */
export class AudioView implements GameSystem, SoundOut {
  readonly id = 'audio-engine';
  private readonly bank: Bank | null;
  private readonly sounds = new Map<string, Sound>();
  private readonly cues: SoundCues | null;
  private readonly subscriptions = new Disposables();
  private ctx: AudioContext | null = null;
  private buses: Record<AudioBus, GainNode> | null = null;
  private reverb: ConvolverNode | null = null;
  private music: Music | null = null;
  private send: GainNode | null = null;
  private readonly takes = new Map<string, AudioBuffer[] | 'loading' | 'failed'>();
  private readonly lastTake = new Map<string, number>();
  private readonly reverbs = new Map<string, AudioBuffer>();
  private air: { id: string; source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wanted: { roomId: string; ambience: string | null; rt60: number } | null = null;
  private voices = 0;
  private played = 0;
  private lastSound = '—';
  private paused = false;
  private readonly unlock = () => this.start();
  private readonly onClick = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button, [role="button"], label.menu-option, select')) this.cues?.click();
  };
  private readonly onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  };

  constructor(private readonly game: Game) {
    const parsed = parseBank(rawBank);
    if ('problems' in parsed) {
      game.log.error(`Sound bank: ${parsed.problems}; the game stays silent`);
      this.bank = null;
      this.cues = null;
      return;
    }
    this.bank = parsed.bank;
    for (const sound of parsed.bank.sounds) this.sounds.set(sound.id, sound);
    this.cues = new SoundCues(game, parsed.bank, this);
  }

  init(): void {
    if (!this.cues) return;
    this.cues.attach(this.subscriptions);
    const { events } = this.game;
    this.subscriptions.add(events.subscribe('AudioSettingsChanged', () => this.mix()));
    this.subscriptions.add(
      events.subscribe('PauseChanged', ({ paused }) => {
        this.paused = paused;
        this.mix();
      }),
    );
    for (const type of ['pointerdown', 'keydown'] as const) {
      document.addEventListener(type, this.unlock, { capture: true });
    }
    document.addEventListener('click', this.onClick, { capture: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    // Loaded at the first click or key (AudioLoader): the page has had its gesture, the sound may start.
    this.start();
  }

  /** For the debug panel: the voices playing, the sounds started, the last one. */
  get status(): string {
    const state = this.ctx ? this.ctx.state : 'waiting for a click';
    const air = this.air?.id ?? 'no air';
    const music = this.music?.status ?? 'none';
    return `${state}, ${this.voices} playing, ${this.played} started, last ${this.lastSound}, ${air} · music ${music}`;
  }

  update(dt = 1 / 60): void {
    this.cues?.update(dt);
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.music) {
      // The menu's music on the menu, the labs' in the world; a load keeps what plays.
      const { phase } = this.game.state.session;
      if (phase === 'menu') this.music.mood = 'menu';
      else if (phase === 'playing') this.music.mood = 'lab';
      this.music.update();
    }
    const p = this.game.state.player;
    const look = p.pitch + p.glance;
    const l = ctx.listener;
    const cp = Math.cos(look);
    const sp = Math.sin(look);
    // The view's convention: yaw 0 looks along −z, pitch up is positive.
    l.positionX.value = p.position[0];
    l.positionY.value = p.position[1] + p.eyeHeight;
    l.positionZ.value = p.position[2];
    l.forwardX.value = -Math.sin(p.yaw) * cp;
    l.forwardY.value = sp;
    l.forwardZ.value = -Math.cos(p.yaw) * cp;
    l.upX.value = Math.sin(p.yaw) * sp;
    l.upY.value = cp;
    l.upZ.value = Math.cos(p.yaw) * sp;
  }

  play(soundId: string, at: Vec3 | null, delay = 0, gain = 1): void {
    const ctx = this.ctx;
    const buses = this.buses;
    const sound = this.sounds.get(soundId);
    if (!ctx || !buses || !sound || ctx.state !== 'running') return;
    if (sound.bus !== 'interface' && (this.paused || this.game.state.session.phase !== 'playing')) {
      return;
    }
    const takes = this.buffersOf(sound);
    if (!takes || this.voices >= MAX_VOICES) return;
    if (sound.positional && at && this.beyond(at, sound.distance[1])) return;
    // A take at random, never the one just heard (when there are two or more).
    const last = this.lastTake.get(sound.id) ?? -1;
    let take = Math.floor(Math.random() * takes.length);
    if (takes.length > 1 && take === last) take = (take + 1) % takes.length;
    this.lastTake.set(sound.id, take);
    const source = ctx.createBufferSource();
    source.buffer = takes[take] ?? null;
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * sound.pitch;
    const level = ctx.createGain();
    level.gain.value = sound.volume * gain;
    source.connect(level);
    let panner: PannerNode | null = null;
    if (sound.positional && at) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = sound.distance[0];
      panner.maxDistance = sound.distance[1];
      panner.positionX.value = at[0];
      panner.positionY.value = at[1];
      panner.positionZ.value = at[2];
      level.connect(panner);
      panner.connect(buses[sound.bus]);
      if (this.send) panner.connect(this.send);
    } else {
      level.connect(buses[sound.bus]);
    }
    this.voices++;
    this.played++;
    this.lastSound = sound.id;
    source.onended = () => {
      this.voices--;
      source.disconnect();
      level.disconnect();
      panner?.disconnect();
    };
    source.start(ctx.currentTime + delay);
  }

  room(roomId: string, ambience: string | null, rt60: number): void {
    this.wanted = { roomId, ambience, rt60 };
    const ctx = this.ctx;
    if (!ctx || !this.buses || !this.reverb) return;
    if (roomId) {
      let impulse = this.reverbs.get(roomId);
      if (!impulse) {
        const [left, right] = impulseResponse(rt60, ctx.sampleRate);
        impulse = ctx.createBuffer(2, left.length, ctx.sampleRate);
        impulse.copyToChannel(left, 0);
        impulse.copyToChannel(right, 1);
        this.reverbs.set(roomId, impulse);
      }
      // shortcut: the reverb switches at once at a doorway (no crossfade between two convolvers);
      // crossfade them if the change is heard.
      this.reverb.buffer = impulse;
    }
    if (this.air?.id === ambience) return;
    const t = ctx.currentTime;
    if (this.air) {
      const { source, gain } = this.air;
      gain.gain.setTargetAtTime(0, t, FADE_S / 3);
      source.stop(t + FADE_S * 2);
      this.air = null;
    }
    const sound = ambience ? this.sounds.get(ambience) : undefined;
    const takes = sound ? this.buffersOf(sound) : null;
    if (!sound || !takes?.[0]) return; // a recorded loop still loading: started when it arrives
    const source = ctx.createBufferSource();
    source.buffer = takes[0];
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(sound.volume, t, FADE_S / 3);
    source.connect(gain).connect(this.buses[sound.bus]);
    source.start(t, Math.random() * takes[0].duration);
    this.air = { id: sound.id, source, gain };
  }

  dispose(): void {
    this.subscriptions.dispose();
    for (const type of ['pointerdown', 'keydown'] as const) {
      document.removeEventListener(type, this.unlock, { capture: true });
    }
    document.removeEventListener('click', this.onClick, { capture: true });
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.ctx?.close();
    this.ctx = null;
  }

  /** The engine, made at the first click or key (and resumed, if the browser held it back). */
  private start(): void {
    if (!this.bank) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const buses = { master } as Record<AudioBus, GainNode>;
    for (const bus of AUDIO_BUSES) {
      if (bus === 'master') continue;
      buses[bus] = ctx.createGain();
      buses[bus].connect(master);
    }
    this.buses = buses;
    this.reverb = ctx.createConvolver();
    this.reverb.connect(buses.effects);
    this.send = ctx.createGain();
    this.send.gain.value = REVERB_SEND;
    this.send.connect(this.reverb);
    this.music = new Music(ctx, buses.music);
    this.mix();
    ctx.onstatechange = () => {
      if (ctx.state === 'running' && this.wanted) {
        const { roomId, ambience, rt60 } = this.wanted;
        this.room(roomId, ambience, rt60);
      }
    };
  }

  /** The buses at the settings' volumes; the world's sounds silent while paused. */
  private mix(): void {
    const buses = this.buses;
    const ctx = this.ctx;
    if (!buses || !ctx) return;
    const { volumes, muted } = this.game;
    for (const bus of AUDIO_BUSES) {
      const world = bus === 'effects' || bus === 'room';
      const level = muted || (world && this.paused) ? 0 : volumes[bus] / 100;
      buses[bus].gain.setTargetAtTime(level, ctx.currentTime, 0.05);
    }
  }

  /** Whether a point is past a sound's reach from the ear (it is not played at all). */
  private beyond(at: Vec3, max: number): boolean {
    const p = this.game.state.player;
    const dy = at[1] - p.position[1] - p.eyeHeight;
    return Math.hypot(at[0] - p.position[0], dy, at[2] - p.position[2]) > max;
  }

  /** A sound's takes, made or loaded on first need (null until they are there). */
  private buffersOf(sound: Sound): AudioBuffer[] | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const known = this.takes.get(sound.id);
    if (Array.isArray(known)) return known;
    if (known) return null;
    if (sound.synth) {
      const samples = renderSynth(sound.synth, ctx.sampleRate, this.sounds.size + sound.id.length);
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.takes.set(sound.id, [buffer]);
      return [buffer];
    }
    this.takes.set(sound.id, 'loading');
    const base = import.meta.env.BASE_URL;
    Promise.all(
      (sound.files ?? []).map(async (file) => {
        const response = await fetch(`${base}audio/${file}`);
        if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
        return ctx.decodeAudioData(await response.arrayBuffer());
      }),
    ).then(
      (buffers) => {
        this.takes.set(sound.id, buffers);
        if (this.wanted?.ambience === sound.id) {
          const { roomId, ambience, rt60 } = this.wanted;
          this.room(roomId, ambience, rt60);
        }
      },
      (error: unknown) => {
        this.takes.set(sound.id, 'failed');
        this.game.log.warn(`Sound "${sound.id}" could not be loaded: ${String(error)}`);
      },
    );
    return null;
  }
}
