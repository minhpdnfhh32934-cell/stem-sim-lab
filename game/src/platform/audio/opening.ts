import { Logger } from '../../core/Logger';
import { loadMuted, loadVolumes } from '../../persistence/settings';
import { createBrowserStorage } from '../storage';
import { impulseResponse } from './synth';

/** The opening's moments (s), as AppIntro and styles.css (`.app-intro-*`) draw them. */
const RINGS = 0.1; // the rings start spinning in, settled by ~1.9 s
const FLIGHT = 1.05; // the ball leaves…
const LANDING = 2.2; // …and lands on the trajectory's top (its flight is 1.15 s)
const FLARE = 2.95; // the light reaches the name's first letter, the next 0.07 s later
const FLARE_STEP = 0.07;
/** The chord rings until here (s), into the menu. */
const CHORD_END = 6.5;
/** With reduced motion (no flight to follow): from just before the landing. */
const STILL_FROM = LANDING - 0.1;
/** Its loudness at full master and music volume, and the hall it is heard in. */
const LEVEL = 1;
const HALL_S = 2.4;
const HALL_WET = 0.35;
/** How long (ms) a browser may take to start a context it lets play; past it the opening is silent. */
const START_WAIT_MS = 600;

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** One sound of the opening: a sweep of air or tone, a struck bell, a held pad voice. */
export type OpeningPart =
  | {
      kind: 'air' | 'glide';
      at: number;
      end: number;
      lowHz: number;
      highHz: number;
      peak: number;
    }
  | { kind: 'bell'; at: number; hz: number; peak: number; ring: number }
  | { kind: 'pad'; at: number; end: number; hz: number; peak: number };

/**
 * SimLab's opening sound (Phú, 2026-11-14), in the menu music's key (D major) and on the
 * opening's picture: air rising as the rings spin in, a swish and a glide up with the ball's
 * flight, a bell where it lands with the menu's first chord (Dmaj9) under it, and a run of small
 * bells as the light sweeps across the name, ringing on into the menu.
 */
export const OPENING: readonly OpeningPart[] = [
  { kind: 'air', at: RINGS, end: 1.9, lowHz: 300, highHz: 2200, peak: 0.22 },
  { kind: 'air', at: FLIGHT, end: LANDING + 0.05, lowHz: 700, highHz: 3500, peak: 0.14 },
  { kind: 'glide', at: FLIGHT, end: LANDING, lowHz: midi(69), highHz: midi(86), peak: 0.035 },
  { kind: 'bell', at: LANDING, hz: midi(86), peak: 0.26, ring: 2.6 },
  { kind: 'bell', at: LANDING, hz: midi(74), peak: 0.12, ring: 3 },
  ...[38, 50, 57, 61, 64, 66].map((note): OpeningPart => ({
    kind: 'pad',
    at: LANDING,
    end: CHORD_END,
    hz: midi(note),
    peak: 0.04,
  })),
  ...[81, 83, 86, 88, 90, 93].map((note, i): OpeningPart => ({
    kind: 'bell',
    at: FLARE + i * FLARE_STEP,
    hz: midi(note),
    peak: 0.07,
    ring: 1.2,
  })),
];

/** The bell's partials (a struck bar's), their share and how long each rings (× the bell's ring). */
const PARTIALS = [
  [1, 1, 1],
  [2.76, 0.35, 0.45],
  [5.4, 0.12, 0.2],
] as const;

/**
 * Puts the opening on a context's clock: what sounds `from` s into it starts at `t0`, into `out`.
 * Parts before `from` are left out.
 */
export function scheduleOpening(
  ctx: BaseAudioContext,
  out: AudioNode,
  t0: number,
  from: number,
): void {
  const at = (s: number) => t0 + s - from;
  for (const part of OPENING) {
    if (part.at < from) continue;
    const start = at(part.at);
    const gain = ctx.createGain();
    gain.connect(out);
    if (part.kind === 'bell') {
      for (const [ratio, share, ring] of PARTIALS) {
        const tone = ctx.createOscillator();
        const env = ctx.createGain();
        const stop = start + part.ring * ring;
        tone.frequency.value = part.hz * ratio;
        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(part.peak * share, start + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0001, stop);
        tone.connect(env).connect(gain);
        tone.start(start);
        tone.stop(stop + 0.05);
      }
      continue;
    }
    const end = at(part.end);
    if (part.kind === 'pad') {
      // Two triangles a few cents apart, softened: the menu's pad.
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 1400;
      tone.connect(gain);
      for (const cents of [-4, 4]) {
        const voice = ctx.createOscillator();
        voice.type = 'triangle';
        voice.frequency.value = part.hz;
        voice.detune.value = cents;
        voice.connect(tone);
        voice.start(start);
        voice.stop(end + 0.05);
      }
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(part.peak / 2, start + 0.5);
      gain.gain.setValueAtTime(part.peak / 2, end - 2.5);
      gain.gain.linearRampToValueAtTime(0, end);
      continue;
    }
    // A sweep: up in pitch over its time, swelling to two thirds of it, gone at its end.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(part.peak, start + (end - start) * 0.66);
    gain.gain.linearRampToValueAtTime(0, end);
    let pitch: AudioParam;
    if (part.kind === 'air') {
      const noise = ctx.createBuffer(1, Math.ceil((end - start) * ctx.sampleRate), ctx.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 1.5;
      source.connect(band).connect(gain);
      source.start(start);
      pitch = band.frequency;
    } else {
      const tone = ctx.createOscillator();
      tone.connect(gain);
      tone.start(start);
      tone.stop(end + 0.05);
      pitch = tone.frequency;
    }
    pitch.setValueAtTime(part.lowHz, start);
    pitch.exponentialRampToValueAtTime(part.highHz, end);
  }
}

/** The opening playing: `fade` takes it away (the opening skipped). */
export interface OpeningSound {
  fade(): void;
  /** The player's master and music volumes (0–100) changed while it plays (its own context). */
  volume(master: number, music: number, muted: boolean): void;
}

/**
 * Plays the opening from its start (or, `still`, from the landing) when the browser lets a page
 * make sound before a click — the desktop app does (`--autoplay-policy`); a browser tab usually
 * does not, and then it stays silent. At the player's master and music volumes; muted, nothing.
 */
export function playOpening(still: boolean): OpeningSound | null {
  if (typeof AudioContext === 'undefined') return null;
  const { storage } = createBrowserStorage();
  const log = Logger.create('warn').child('opening');
  const volumes = loadVolumes(storage, log);
  const level = loadMuted(storage, log) ? 0 : (LEVEL * volumes.master * volumes.music) / 1e4;
  if (level <= 0) return null;
  const policy = (
    navigator as { getAutoplayPolicy?: (type: string) => string }
  ).getAutoplayPolicy?.('audiocontext');
  if (policy === 'disallowed') return null;

  const ctx = new AudioContext();
  const asked = performance.now();
  const out = ctx.createGain();
  out.gain.value = level;
  let begun = false;
  let closed = false;
  const close = (afterS: number) =>
    window.setTimeout(() => {
      if (closed) return;
      closed = true;
      void ctx.close();
    }, afterS * 1000);
  const begin = () => {
    if (begun || closed || ctx.state !== 'running') return;
    begun = true;
    const [left, right] = impulseResponse(HALL_S, ctx.sampleRate, 5);
    const hall = ctx.createConvolver();
    hall.buffer = ctx.createBuffer(2, left.length, ctx.sampleRate);
    hall.buffer.copyToChannel(left, 0);
    hall.buffer.copyToChannel(right, 1);
    const wet = ctx.createGain();
    wet.gain.value = HALL_WET;
    out.connect(ctx.destination);
    out.connect(hall).connect(wet).connect(ctx.destination);
    // A context that took a moment to start: on the picture's time, what has passed left out.
    const from = (still ? STILL_FROM : 0) + (performance.now() - asked) / 1000;
    scheduleOpening(ctx, out, ctx.currentTime + 0.05, from);
    close(CHORD_END - from + HALL_S + 0.5);
  };
  ctx.onstatechange = begin;
  begin();
  window.setTimeout(() => {
    if (!begun) close(0); // not let to play: silent, its context freed
  }, START_WAIT_MS);
  let faded = false;
  return {
    fade: () => {
      if (closed) return;
      faded = true;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      close(1);
    },
    volume: (master, music, muted) => {
      if (closed || faded) return;
      out.gain.setTargetAtTime(muted ? 0 : (LEVEL * master * music) / 1e4, ctx.currentTime, 0.05);
    },
  };
}
