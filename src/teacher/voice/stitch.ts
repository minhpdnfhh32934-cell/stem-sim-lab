/**
 * Joins the on-device voice's chunks into speech that sounds like one teacher (pure functions on
 * Float32Array, no audio device): every chunk at the same sample rate and the same loudness
 * (voiced RMS, with a peak limit so nothing clips), its own leading and trailing silence trimmed,
 * short fades at its edges (no clicks), the planned pause after it, and — when the model cannot
 * change its own pace — the role's speaking rate by a time stretch that keeps the pitch (WSOLA).
 */
import type { Pcm } from './audio';

/** MMS-TTS speaks at 16 kHz; every chunk is brought to this rate. */
export const VOICE_SAMPLE_RATE = 16000;
/** Loudness every chunk is brought to: RMS of its voiced frames, dBFS. */
export const TARGET_RMS_DB = -20;
/** Highest sample after the gain (−1 dBFS): the gain is lowered rather than clip. */
export const PEAK_LIMIT = 0.891;
/** Silence kept before and after the speech of a chunk when trimming (consonant onsets, tails). */
export const TRIM_MARGIN_MS = 30;
/** Frames this far below the loudest frame of a chunk count as silence. */
export const SILENCE_DB = -40;
export const FADE_IN_MS = 8;
export const FADE_OUT_MS = 12;

const FRAME_MS = 10;
/** The gain never boosts or cuts more than this (a near-silent chunk is not blown up). */
const MAX_GAIN_DB = 18;

export function toDb(x: number): number {
  return x > 1e-6 ? 20 * Math.log10(x) : -120;
}

export function fromDb(db: number): number {
  return 10 ** (db / 20);
}

export function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (const v of samples) {
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  return peak;
}

export function rmsOf(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const v of samples) sum += v * v;
  return Math.sqrt(sum / samples.length);
}

export function hasNonFinite(samples: Float32Array): boolean {
  for (const v of samples) if (!Number.isFinite(v)) return true;
  return false;
}

/** Share of samples at or above `threshold` in absolute value (0.99 ≈ clipped). */
export function clippingShare(samples: Float32Array, threshold = 0.99): number {
  if (samples.length === 0) return 0;
  let n = 0;
  for (const v of samples) if (Math.abs(v) >= threshold) n++;
  return n / samples.length;
}

/** RMS of each 10 ms frame. */
function frameRms(samples: Float32Array, sampleRate: number): number[] {
  const frame = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += frame) out.push(rmsOf(samples.subarray(i, i + frame)));
  return out;
}

/** RMS over the frames that are speech (within `SILENCE_DB` of the loudest frame). */
export function voicedRms(samples: Float32Array, sampleRate: number): number {
  const frames = frameRms(samples, sampleRate);
  const loudest = Math.max(0, ...frames);
  if (loudest <= 0) return 0;
  const gate = loudest * fromDb(SILENCE_DB);
  const voiced = frames.filter((f) => f >= gate);
  return Math.sqrt(voiced.reduce((s, f) => s + f * f, 0) / voiced.length);
}

/** Where speech starts and ends (sample indices, end exclusive); null when all is silence. */
function speechBounds(samples: Float32Array, sampleRate: number): [number, number] | null {
  const frames = frameRms(samples, sampleRate);
  const loudest = Math.max(0, ...frames);
  if (loudest < 1e-4) return null;
  const gate = loudest * fromDb(SILENCE_DB);
  const first = frames.findIndex((f) => f >= gate);
  let last = frames.length - 1;
  while (last > first && (frames[last] ?? 0) < gate) last--;
  const frame = Math.round((sampleRate * FRAME_MS) / 1000);
  return [first * frame, Math.min(samples.length, (last + 1) * frame)];
}

export function leadingSilenceMs(samples: Float32Array, sampleRate: number): number {
  const b = speechBounds(samples, sampleRate);
  return b ? (b[0] / sampleRate) * 1000 : (samples.length / sampleRate) * 1000;
}

export function trailingSilenceMs(samples: Float32Array, sampleRate: number): number {
  const b = speechBounds(samples, sampleRate);
  return b ? ((samples.length - b[1]) / sampleRate) * 1000 : (samples.length / sampleRate) * 1000;
}

/** Cuts the silence before and after the speech, keeping `marginMs` of it on each side. */
export function trimSilence(
  samples: Float32Array,
  sampleRate: number,
  marginMs = TRIM_MARGIN_MS,
): Float32Array {
  const b = speechBounds(samples, sampleRate);
  if (!b) return new Float32Array(0);
  const margin = Math.round((sampleRate * marginMs) / 1000);
  return samples.slice(Math.max(0, b[0] - margin), Math.min(samples.length, b[1] + margin));
}

/** Linear resampling (the voices give 16 or 24 kHz; quality is ample for speech at these rates). */
export function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to || samples.length === 0) return samples.slice();
  const length = Math.max(1, Math.round((samples.length * to) / from));
  const out = new Float32Array(length);
  const step = from / to;
  for (let i = 0; i < length; i++) {
    const x = i * step;
    const k = Math.floor(x);
    const t = x - k;
    const a = samples[Math.min(k, samples.length - 1)] ?? 0;
    const b = samples[Math.min(k + 1, samples.length - 1)] ?? 0;
    out[i] = a + (b - a) * t;
  }
  return out;
}

/**
 * One gain for the whole chunk so its voiced RMS reaches `targetDb`, lowered when the peak would
 * pass `peakLimit` (no clipping, no compressor: the voice's own dynamics are kept).
 */
export function normalizeLoudness(
  samples: Float32Array,
  sampleRate: number,
  targetDb = TARGET_RMS_DB,
  peakLimit = PEAK_LIMIT,
): { samples: Float32Array; gain: number } {
  const level = voicedRms(samples, sampleRate);
  const peak = peakOf(samples);
  if (level <= 0 || peak <= 0) return { samples: samples.slice(), gain: 1 };
  const wanted = Math.min(
    fromDb(MAX_GAIN_DB),
    Math.max(fromDb(-MAX_GAIN_DB), fromDb(targetDb) / level),
  );
  const gain = Math.min(wanted, peakLimit / peak);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = (samples[i] ?? 0) * gain;
  return { samples: out, gain };
}

/** Raised-cosine fades at both edges: the chunk starts and ends at zero (no click). */
export function applyFades(
  samples: Float32Array,
  sampleRate: number,
  inMs = FADE_IN_MS,
  outMs = FADE_OUT_MS,
): Float32Array {
  const out = samples.slice();
  const fin = Math.min(out.length, Math.round((sampleRate * inMs) / 1000));
  const fout = Math.min(out.length, Math.round((sampleRate * outMs) / 1000));
  for (let i = 0; i < fin; i++) out[i] = (out[i] ?? 0) * 0.5 * (1 - Math.cos((Math.PI * i) / fin));
  for (let i = 0; i < fout; i++) {
    const k = out.length - 1 - i;
    out[k] = (out[k] ?? 0) * 0.5 * (1 - Math.cos((Math.PI * i) / fout));
  }
  return out;
}

export function silence(ms: number, sampleRate: number): Float32Array {
  return new Float32Array(Math.max(0, Math.round((sampleRate * ms) / 1000)));
}

export function concat(parts: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * Changes the pace without changing the pitch (WSOLA: 30 ms Hann frames at 50 % overlap, each
 * taken within ±8 ms of where it should be so its waveform continues the previous one).
 * `rate` above 1 is faster (shorter), below 1 slower.
 */
export function timeStretch(input: Float32Array, rate: number, sampleRate: number): Float32Array {
  if (!(rate > 0) || Math.abs(rate - 1) < 0.005 || input.length === 0) return input.slice();
  const n = Math.max(64, Math.round(sampleRate * 0.03) & ~1);
  const hs = n / 2;
  const ha = hs * rate;
  const tol = Math.round(sampleRate * 0.008);
  const outLength = Math.round(input.length / rate);
  const out = new Float32Array(outLength + n);
  const norm = new Float32Array(outLength + n);
  const window = new Float32Array(n);
  for (let j = 0; j < n; j++) window[j] = 0.5 * (1 - Math.cos((2 * Math.PI * j) / n));
  const at = (i: number) => (i >= 0 && i < input.length ? (input[i] ?? 0) : 0);
  /** How well the frame at `candidate` continues the waveform at `natural`. */
  const similarity = (candidate: number, natural: number) => {
    let score = 0;
    for (let j = 0; j < hs; j += 2) score += at(candidate + j) * at(natural + j);
    return score;
  };
  /** The best start among `from…to` in steps of `step` (never before the input). */
  const best = (from: number, to: number, step: number, natural: number, start: number) => {
    let pos = start;
    let score = -Infinity;
    for (let c = Math.max(0, from); c <= to; c += step) {
      const s = similarity(c, natural);
      if (s > score) {
        score = s;
        pos = c;
      }
    }
    return pos;
  };
  let prev = 0;
  for (let k = 0; k * hs < outLength; k++) {
    let pos = 0;
    if (k > 0) {
      const nominal = Math.round(k * ha);
      const natural = prev + hs;
      // Coarse to fine: every 4th sample over ±8 ms, then each sample around the best one.
      const coarse = best(nominal - tol, nominal + tol, 4, natural, Math.max(0, nominal));
      pos = best(coarse - 3, coarse + 3, 1, natural, coarse);
    }
    const o = k * hs;
    for (let j = 0; j < n; j++) {
      const w = window[j] ?? 0;
      out[o + j] = (out[o + j] ?? 0) + w * at(pos + j);
      norm[o + j] = (norm[o + j] ?? 0) + w;
    }
    prev = pos;
  }
  const result = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const w = norm[i] ?? 0;
    result[i] = w > 1e-6 ? (out[i] ?? 0) / w : 0;
  }
  return result;
}

export interface ShapeOptions {
  /** Speaking rate still to apply (1 when the model already spoke at the role's pace). */
  rate: number;
  /** Silence after the chunk, milliseconds (the plan's pause). */
  pauseMs: number;
}

/**
 * One chunk as it is heard: 16 kHz, silence trimmed, the role's pace, the common loudness,
 * faded edges, then the planned pause. Broken samples (NaN, ±∞) become silence.
 */
export function shapeChunk(pcm: Pcm, opts: ShapeOptions): Pcm {
  const sr = VOICE_SAMPLE_RATE;
  let s = resample(pcm.samples, pcm.sampleRate, sr);
  if (hasNonFinite(s)) s = s.map((v) => (Number.isFinite(v) ? v : 0));
  s = trimSilence(s, sr);
  s = timeStretch(s, opts.rate, sr);
  s = normalizeLoudness(s, sr).samples;
  s = applyFades(s, sr);
  return { samples: concat([s, silence(opts.pauseMs, sr)]), sampleRate: sr };
}
