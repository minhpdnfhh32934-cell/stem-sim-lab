import { impulseResponse } from './synth';
import {
  bar,
  barSeconds,
  hz,
  MENU_PIECE,
  type Mood,
  type Note,
  type Piece,
  pieceBars,
  pieceFor,
  silenceAfter,
} from './score';

/** Seconds of music scheduled ahead of the clock (a frame's hitch never gaps it). */
const AHEAD_S = 1.2;
/** Seconds one mood takes to fade into the other. */
const CROSSFADE_S = 4;
/** The music's room: a long, soft hall (s), and how much of it is heard. */
const HALL_S = 3.6;
const HALL_WET = 0.38;
/**
 * Each mood's level (the music bus sets the player's volume on top). Phú (2026-11-05): the first
 * levels (0.55, 0.32) were hard to hear.
 */
const LEVEL: Readonly<Record<Mood, number>> = { menu: 1.1, lab: 0.9 };

interface Playing {
  mood: Mood;
  gain: GainNode;
  /** The piece playing, or null in the silence between two. */
  piece: Piece | null;
  pad: BiquadFilterNode;
  /** The next bar to write, and when it starts (s, the context's clock); in a silence, its end. */
  index: number;
  start: number;
  /** How many pieces this mood has begun (the bells differ each time). */
  plays: number;
}

/**
 * Plays the score (score.ts) on the Web Audio clock: the menu's piece on the menu; in the labs the
 * piece for the time played there, then a silence, then the piece for the time played by then.
 * Each mood into its own gain, through a shared hall and an echo for the bells, into the music
 * bus; a change of mood fades the old one out while the new one begins. Scheduled a little ahead
 * from `update` (a bar at a time: a few nodes every few seconds, nothing per frame).
 */
export class Music {
  private readonly input: GainNode;
  private readonly echo: DelayNode;
  private playing: Playing | null = null;
  private readonly notes: Note[] = [];
  /** Seconds the lab music's clock has run (the time played in the world, this visit). */
  private labSeconds = 0;
  private lastClock = 0;

  constructor(
    private readonly ctx: AudioContext,
    out: AudioNode,
  ) {
    this.input = ctx.createGain();
    const hall = ctx.createConvolver();
    const [left, right] = impulseResponse(HALL_S, ctx.sampleRate, 7);
    const impulse = ctx.createBuffer(2, left.length, ctx.sampleRate);
    impulse.copyToChannel(left, 0);
    impulse.copyToChannel(right, 1);
    hall.buffer = impulse;
    const wet = ctx.createGain();
    wet.gain.value = HALL_WET;
    this.input.connect(out);
    this.input.connect(hall).connect(wet).connect(out);
    // The bells' echo: a dotted-eighth repeat, darker each time.
    this.echo = ctx.createDelay(2);
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    this.echo.connect(tone).connect(feedback).connect(this.echo);
    tone.connect(this.input);
    this.lastClock = ctx.currentTime;
  }

  /** For the debug panel: the mood and its piece (— in a silence). */
  get status(): string {
    const p = this.playing;
    return p ? `${p.mood}:${p.piece?.id ?? '—'}` : 'none';
  }

  /** The mood playing (null: none). */
  get playingMood(): Mood | null {
    return this.playing?.mood ?? null;
  }

  /** The mood to play (null: none); a change fades from the one playing. */
  set mood(mood: Mood | null) {
    if ((this.playing?.mood ?? null) === mood) return;
    const t = this.ctx.currentTime;
    if (this.playing) {
      const { gain } = this.playing;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + CROSSFADE_S);
      setTimeout(() => gain.disconnect(), (CROSSFADE_S + 6) * 1000); // its last notes rung out
      this.playing = null;
    }
    if (!mood) return;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(LEVEL[mood], t + CROSSFADE_S);
    gain.connect(this.input);
    const pad = this.ctx.createBiquadFilter();
    pad.type = 'lowpass';
    pad.Q.value = 0.4;
    pad.connect(gain);
    this.playing = { mood, gain, pad, piece: null, index: 0, start: t + 0.1, plays: 0 };
    this.begin(this.playing, t + 0.1);
  }

  /** Writes the bars that start before the clock plus AHEAD_S; between pieces, waits. */
  update(): void {
    const now = this.ctx.currentTime;
    const p = this.playing;
    if (p?.mood === 'lab') this.labSeconds += Math.max(0, now - this.lastClock);
    this.lastClock = now;
    if (!p) return;
    if (p.start < now - 0.5) p.start = now + 0.05; // the clock ran on without us (a hidden tab)
    while (p.start < now + AHEAD_S) {
      const piece = p.piece;
      if (!piece) {
        this.begin(p, p.start); // the silence is over
        continue;
      }
      if (p.index >= pieceBars(piece)) {
        p.piece = null;
        p.start += silenceAfter(p.mood, p.plays);
        continue;
      }
      for (const note of bar(piece, p.index, p.plays, this.notes)) {
        this.play(p, note, p.start + note.at);
      }
      p.start += barSeconds(piece);
      p.index++;
    }
  }

  /** Starts the mood's next piece at `at`: the menu's, or the labs' for the time played. */
  private begin(p: Playing, at: number): void {
    const piece = p.mood === 'menu' ? MENU_PIECE : pieceFor(this.labSeconds);
    p.piece = piece;
    p.index = 0;
    p.start = at;
    p.plays++;
    p.pad.frequency.setValueAtTime(piece.cutoff, at);
    this.echo.delayTime.setValueAtTime((barSeconds(piece) / 4) * 0.75, at); // a dotted eighth
  }

  private play(p: Playing, note: Note, at: number): void {
    if (note.voice === 'pad') this.pad(p, note, at);
    else if (note.voice === 'bass') this.bass(p, note, at);
    else if (note.voice === 'keys') this.keys(p, note, at);
    else this.bell(p, note, at);
  }

  /** Two saws a few cents apart, through the piece's dark filter: in slowly, out slowly. */
  private pad(p: Playing, note: Note, at: number): void {
    const { ctx } = this;
    const env = ctx.createGain();
    const end = at + note.seconds;
    const peak = 0.05 * note.velocity;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 2.2);
    env.gain.setValueAtTime(peak, end - 1);
    env.gain.linearRampToValueAtTime(0, end + 2.5);
    env.connect(p.pad);
    for (const cents of [-7, 6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = hz(note.midi);
      osc.detune.value = cents;
      osc.connect(env);
      osc.start(at);
      osc.stop(end + 2.6);
      osc.onended = () => {
        osc.disconnect();
        env.disconnect(); // the second call does nothing
      };
    }
  }

  /** A round sine under the chord, with its octave so that small speakers carry it. */
  private bass(p: Playing, note: Note, at: number): void {
    const { ctx } = this;
    const env = ctx.createGain();
    const end = at + note.seconds;
    const peak = 0.15 * note.velocity;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 1.2);
    env.gain.setValueAtTime(peak, end - 0.8);
    env.gain.linearRampToValueAtTime(0, end + 1.5);
    env.connect(p.gain);
    for (const [ratio, level] of [
      [1, 1],
      [2, 0.25],
    ] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz(note.midi) * ratio;
      g.gain.value = level;
      osc.connect(g).connect(env);
      osc.start(at);
      osc.stop(end + 1.6);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
        env.disconnect();
      };
    }
  }

  /**
   * The theme's voice: soft keys, felt more than struck — a sine and its quieter octave and
   * twelfth, a quick touch, a long fade, the bright part fading first.
   */
  private keys(p: Playing, note: Note, at: number): void {
    const { ctx } = this;
    const env = ctx.createGain();
    const ring = Math.max(note.seconds, 1.2) + 1.6;
    const peak = 0.11 * note.velocity;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.012);
    env.gain.exponentialRampToValueAtTime(peak * 0.35, at + 0.5);
    env.gain.exponentialRampToValueAtTime(0.0001, at + ring);
    env.connect(p.gain);
    const partials: readonly [number, number, number][] = [
      // ratio, level, seconds its level lasts
      [1, 1, ring],
      [2, 0.3, ring * 0.5],
      [3, 0.08, 0.4],
    ];
    for (const [ratio, level, seconds] of partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz(note.midi) * ratio;
      g.gain.setValueAtTime(level, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
      osc.connect(g).connect(env);
      osc.start(at);
      osc.stop(at + ring + 0.05);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
        env.disconnect();
      };
    }
  }

  /** A soft glass bell: its note and a quiet octave, struck and fading, into the echo too. */
  private bell(p: Playing, note: Note, at: number): void {
    const { ctx } = this;
    const env = ctx.createGain();
    const peak = 0.06 * note.velocity;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + note.seconds);
    env.connect(p.gain);
    env.connect(this.echo);
    const partials: readonly [number, number][] = [
      [1, 1],
      [2.0, 0.22],
      [3.01, 0.06],
    ];
    for (const [ratio, level] of partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz(note.midi) * ratio;
      g.gain.value = level;
      osc.connect(g).connect(env);
      osc.start(at);
      osc.stop(at + note.seconds + 0.05);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
        env.disconnect();
      };
    }
  }
}
