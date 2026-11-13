import '../ui/chat.css';
import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import type { Signal } from '../../multiplayer/protocol';
import { voiceMix } from '../../multiplayer/voiceMix';
import { listen } from '../BrowserInput';
import { el } from '../ui/dom';
import type { LanRooms } from './LanRooms';

/** A voice heard louder than this (RMS of the signal) shows the speaker's name. */
const SPEAKING_RMS = 0.01;
/** The name stays this long (s) after the voice dropped (no flicker between words). */
const SPEAKING_HOLD_S = 0.4;
/** How fast a voice follows its gain and side as the players move (s). */
const SMOOTH_S = 0.08;

/** One call: this game and one other player of the room, their audio straight between them. */
interface Call {
  readonly pc: RTCPeerConnection;
  /** Candidates that came before the other side's description. */
  readonly early: RTCIceCandidateInit[];
  /** Their voice: kept playing (muted) so Chrome feeds it to the mix, then gain, side, out. */
  audio: HTMLAudioElement | null;
  source: MediaStreamAudioSourceNode | null;
  readonly gain: GainNode;
  readonly pan: StereoPannerNode;
  readonly analyser: AnalyserNode;
  /** Seconds their name still shows as speaking. */
  speaking: number;
  /** The gain and side last set (set again only when they change). */
  setGain: number;
  setPan: number;
}

type MicState = 'off' | 'asking' | 'on' | 'none';

/**
 * Voice in a LAN room (Phú 2026-11-12): held V talks (push to talk), heard by the players near
 * (proximity, as in Minecraft's voice chat: `voiceMix`), from their side. The audio goes straight
 * between the browsers (WebRTC, no server for it: on a LAN, no STUN or TURN), set up through the
 * room server (`signal`). The microphone is asked once, on entering a room (a browser shows real
 * LAN addresses to a page that has it); refused or missing, the player still hears the others.
 * The page must be a secure one (localhost, https, the desktop app): over http://<LAN IP> the
 * browser gives no microphone, and the player is told so.
 */
export class VoiceChat implements GameSystem {
  readonly id = 'voice-chat';
  private readonly root = el('div', 'voice hidden');
  private readonly self = el('div', 'voice-self');
  private readonly speakers = el('div', 'voice-speakers');
  private readonly subscriptions = new Disposables();
  private readonly calls = new Map<string, Call>();
  /** Set-up from players heard before the microphone was settled. */
  private readonly waiting: { from: string; signal: Signal }[] = [];
  private mic: MediaStream | null = null;
  private micState: MicState = 'off';
  /** Why there is no microphone ('' if there is one or none was asked yet). */
  private micProblem = '';
  private context: AudioContext | null = null;
  private held = false;
  /** Whether the microphone's track is on now (it is switched only when this changes). */
  private sending = false;
  private readonly samples = new Float32Array(256);
  /** Who is heard speaking changed: the names are written again. */
  private speakersChanged = false;
  private shownTalking = false;
  private readonly listener = { x: 0, z: 0, yaw: 0 };
  private readonly speaker = { x: 0, z: 0 };
  private readonly mix = { gain: 0, pan: 0 };

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly rooms: LanRooms,
  ) {}

  /** For the debug panel and tests: the calls and whether each is connected. */
  get state(): string {
    const calls = [...this.calls].map(([id, c]) => `${id} ${c.pc.connectionState}`).join(', ');
    return `mic ${this.micState}${this.held ? ' talking' : ''} · ${calls || 'no calls'}`;
  }

  init(): void {
    this.root.append(this.self, this.speakers);
    this.parent.append(this.root);
    this.rooms.onSignal((from, signal) => {
      if (this.micState === 'off' || this.micState === 'asking')
        this.waiting.push({ from, signal });
      else void this.heard(from, signal);
    });
    const s = this.subscriptions;
    const talkKey = (event: KeyboardEvent, down: boolean) => {
      if (!this.game.config.input.bindings.talk.includes(event.code)) return;
      const target = event.target;
      if (down && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement))
        return; // typing a V in the chat
      if (event.repeat) return;
      this.held = down;
    };
    listen(s, window, 'keydown', (event) => talkKey(event, true));
    listen(s, window, 'keyup', (event) => talkKey(event, false));
    listen(s, window, 'blur', () => (this.held = false));
    // A browser starts sound only after the player clicked or pressed a key.
    const wake = () => void this.context?.resume().catch(() => undefined);
    listen(s, window, 'pointerdown', wake);
    listen(s, window, 'keydown', wake);
    s.add(this.game.events.subscribe('LanguageChanged', () => this.drawSelf()));
  }

  update(dt: number): void {
    const { peers, state } = this.game;
    if (!peers.room || peers.you === null) {
      if (this.micState !== 'off' || this.calls.size > 0) this.hangUp();
      return;
    }
    if (this.micState === 'off') void this.askMic();
    if (this.micState === 'asking') return;

    // A call with each player of the room; the one who came first (the lower number) offers.
    const you = order(peers.you);
    for (const player of peers.players) {
      if (!this.calls.has(player.id) && you < order(player.id)) void this.call(player.id);
    }
    for (const id of this.calls.keys()) {
      if (!peers.players.some((p) => p.id === id)) this.close(id);
    }

    const playing = state.session.phase === 'playing' && !state.session.paused;
    const talking = this.held && playing;
    if (talking !== this.sending && this.mic) {
      this.sending = talking;
      for (const track of this.mic.getAudioTracks()) track.enabled = talking;
    }

    const { volumes, muted } = this.game;
    const volume = muted ? 0 : (volumes.master / 100) * (volumes.voice / 100);
    const p = state.player.position;
    this.listener.x = p[0];
    this.listener.z = p[2];
    this.listener.yaw = state.player.yaw;
    const now = this.context?.currentTime ?? 0;
    for (const player of peers.players) {
      const call = this.calls.get(player.id);
      if (!call) continue;
      const body = player.body;
      if (body) {
        this.speaker.x = body[0];
        this.speaker.z = body[2];
      }
      const mix = voiceMix(this.listener, playing && body ? this.speaker : null, this.mix);
      const gain = mix.gain * volume;
      if (Math.abs(gain - call.setGain) > 0.005) {
        call.setGain = gain;
        call.gain.gain.setTargetAtTime(gain, now, SMOOTH_S);
      }
      if (Math.abs(mix.pan - call.setPan) > 0.01) {
        call.setPan = mix.pan;
        call.pan.pan.setTargetAtTime(mix.pan, now, SMOOTH_S);
      }
      const was = call.speaking > 0;
      if (call.source) {
        call.analyser.getFloatTimeDomainData(this.samples);
        let sum = 0;
        for (let i = 0; i < this.samples.length; i++) {
          const v = this.samples[i] ?? 0;
          sum += v * v;
        }
        if (Math.sqrt(sum / this.samples.length) > SPEAKING_RMS) call.speaking = SPEAKING_HOLD_S;
        else call.speaking = Math.max(0, call.speaking - dt);
      }
      if (was !== call.speaking > 0) this.speakersChanged = true;
    }
    this.root.classList.toggle('hidden', !playing);
    if (this.speakersChanged) {
      this.speakersChanged = false;
      const names = peers.players
        .filter((player) => (this.calls.get(player.id)?.speaking ?? 0) > 0)
        .map((player) => player.name)
        .join(', ');
      this.speakers.textContent = names ? '🔊 ' + names : '';
    }
    if (talking !== this.shownTalking) {
      this.shownTalking = talking;
      this.root.classList.toggle('talking', talking);
      this.drawSelf();
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.rooms.onSignal(null);
    this.hangUp();
    void this.context?.close().catch(() => undefined);
    this.root.remove();
  }

  private drawSelf(talking = this.shownTalking): void {
    const t = this.game.texts;
    const key = this.game.config.input.bindings.talk[0]?.replace(/^Key/, '') ?? 'V';
    const text =
      this.micState === 'none'
        ? this.micProblem
        : talking
          ? t.ui('voice.talking', '🎙 Talking…')
          : t.ui('voice.hold', 'Hold {key} to talk', { key });
    if (this.self.textContent !== text) this.self.textContent = text;
  }

  /** The microphone, once per room: echo and noise taken out by the browser; silent until V. */
  private async askMic(): Promise<void> {
    const t = this.game.texts;
    this.micState = 'asking';
    this.context ??= new AudioContext();
    if (!window.isSecureContext || !('mediaDevices' in navigator)) {
      this.noMic(
        t.ui(
          'voice.insecure',
          'No microphone on this page (open the game on this computer or in the app to talk). You still hear the others.',
        ),
      );
      return;
    }
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!this.game.peers.room) {
        for (const track of mic.getTracks()) track.stop();
        this.micState = 'off';
        return;
      }
      for (const track of mic.getAudioTracks()) track.enabled = false;
      this.sending = false;
      this.mic = mic;
      this.micState = 'on';
      this.micProblem = '';
    } catch {
      this.noMic(
        t.ui('voice.denied', 'No microphone (refused or missing). You still hear the others.'),
      );
      return;
    }
    this.drawSelf();
    this.settled();
  }

  private noMic(reason: string): void {
    this.micState = 'none';
    this.micProblem = reason;
    this.drawSelf();
    this.settled();
  }

  /** The microphone settled: the set-up heard meanwhile is taken up now. */
  private settled(): void {
    for (const { from, signal } of this.waiting.splice(0)) void this.heard(from, signal);
  }

  private open(id: string): Call {
    const existing = this.calls.get(id);
    if (existing) return existing;
    const context = (this.context ??= new AudioContext());
    // A LAN: the browsers reach each other directly, no STUN or TURN server.
    const pc = new RTCPeerConnection({ iceServers: [] });
    const gain = context.createGain();
    gain.gain.value = 0;
    const pan = context.createStereoPanner();
    const analyser = context.createAnalyser();
    analyser.fftSize = this.samples.length;
    gain.connect(pan).connect(context.destination);
    const call: Call = {
      pc,
      early: [],
      audio: null,
      source: null,
      gain,
      pan,
      analyser,
      speaking: 0,
      setGain: 0,
      setPan: 0,
    };
    this.calls.set(id, call);
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate?.candidate) return;
      this.rooms.signal(id, {
        k: 'ice',
        candidate: candidate.candidate,
        mid: candidate.sdpMid,
        index: candidate.sdpMLineIndex,
      });
    };
    pc.ontrack = ({ streams, track }) => {
      const stream = streams[0] ?? new MediaStream([track]);
      // Chrome mixes a call's audio into Web Audio only while a media element plays it.
      const audio = new Audio();
      audio.muted = true;
      audio.srcObject = stream;
      void audio.play().catch(() => undefined);
      call.audio = audio;
      call.source?.disconnect();
      call.source = context.createMediaStreamSource(stream);
      call.source.connect(gain);
      call.source.connect(analyser);
    };
    return call;
  }

  /** This game offers the call (it came to the room first). */
  private async call(id: string): Promise<void> {
    const { pc } = this.open(id);
    const track = this.mic?.getAudioTracks()[0];
    pc.addTransceiver(track ?? 'audio', { direction: 'sendrecv' });
    try {
      await pc.setLocalDescription(await pc.createOffer());
      if (pc.localDescription) this.rooms.signal(id, { k: 'offer', sdp: pc.localDescription.sdp });
    } catch (error) {
      this.game.log.warn('Voice: the call could not be offered', String(error));
    }
  }

  private async heard(from: string, signal: Signal): Promise<void> {
    if (!this.game.peers.players.some((p) => p.id === from)) return;
    try {
      if (signal.k === 'ice') {
        const call = this.calls.get(from);
        if (!call) return;
        const candidate = {
          candidate: signal.candidate,
          sdpMid: signal.mid,
          sdpMLineIndex: signal.index,
        };
        if (call.pc.remoteDescription) await call.pc.addIceCandidate(candidate);
        else call.early.push(candidate);
      } else if (signal.k === 'offer') {
        const call = this.open(from);
        await call.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        const track = this.mic?.getAudioTracks()[0] ?? null;
        for (const transceiver of call.pc.getTransceivers()) {
          transceiver.direction = 'sendrecv';
          await transceiver.sender.replaceTrack(track);
        }
        await call.pc.setLocalDescription(await call.pc.createAnswer());
        const sdp = call.pc.localDescription?.sdp;
        if (sdp) this.rooms.signal(from, { k: 'answer', sdp });
        await this.early(call);
      } else {
        const call = this.calls.get(from);
        if (!call || call.pc.signalingState !== 'have-local-offer') return;
        await call.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        await this.early(call);
      }
    } catch (error) {
      this.game.log.warn('Voice: a call set-up failed', String(error));
    }
  }

  private async early(call: Call): Promise<void> {
    for (const candidate of call.early.splice(0)) await call.pc.addIceCandidate(candidate);
  }

  private close(id: string): void {
    const call = this.calls.get(id);
    if (!call) return;
    this.calls.delete(id);
    call.pc.close();
    call.source?.disconnect();
    call.gain.disconnect();
    call.pan.disconnect();
    if (call.audio) call.audio.srcObject = null;
    this.speakersChanged = true;
  }

  /** Out of the room: every call ended, the microphone given back. */
  private hangUp(): void {
    for (const id of [...this.calls.keys()]) this.close(id);
    for (const track of this.mic?.getTracks() ?? []) track.stop();
    this.mic = null;
    this.micState = 'off';
    this.micProblem = '';
    this.waiting.length = 0;
    this.sending = false;
    this.shownTalking = false;
    this.speakers.textContent = '';
    this.root.classList.add('hidden');
  }
}

/** A player's place in the room: their id's number (`p7` → 7), so both sides agree who offers. */
function order(id: string): number {
  return Number(id.replace(/\D/g, '')) || 0;
}
