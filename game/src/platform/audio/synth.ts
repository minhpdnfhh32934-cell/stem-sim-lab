import type { NoiseLayer, Synth, ToneLayer } from './bank';

/**
 * Sounds made in code (Phase S: beeps, clicks, the air of a room), rendered once into samples
 * from their recipe in the sound bank — pure and deterministic (seeded noise), so they are tested
 * without a sound card and sound the same on every machine.
 */

/** A small fast seeded generator (mulberry32): uniform in [-1, 1). */
function noiseSource(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** A biquad filter (RBJ's cookbook), run sample by sample. */
function biquad(type: 'lowpass' | 'highpass' | 'bandpass', hz: number, q: number, rate: number) {
  const w = (2 * Math.PI * Math.min(hz, rate * 0.45)) / rate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  let b0: number, b1: number, b2: number;
  if (type === 'lowpass') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = b0;
  } else if (type === 'highpass') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = b0;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  return (x: number) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

/** The envelope's level at sample `i` of a layer `len` samples long. */
function envelope(i: number, len: number, attack: number, release: number): number {
  const a = attack > 0 ? Math.min(1, i / attack) : 1;
  const r = release > 0 ? Math.min(1, (len - i) / release) : 1;
  return Math.max(0, Math.min(a, r));
}

function wave(shape: ToneLayer['tone'], phase: number): number {
  const p = phase - Math.floor(phase);
  switch (shape) {
    case 'sine':
      return Math.sin(p * 2 * Math.PI);
    case 'triangle':
      return 1 - 4 * Math.abs(p - 0.5);
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'sawtooth':
      return 2 * p - 1;
  }
}

function addTone(out: Float32Array, layer: ToneLayer, rate: number, seconds: number): void {
  const start = Math.round(layer.at * rate);
  const len = Math.min(out.length - start, Math.round((layer.for ?? seconds - layer.at) * rate));
  const attack = layer.attack * rate;
  const release = layer.release * rate;
  const to = layer.toHz ?? layer.hz;
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const hz = layer.hz * Math.pow(to / layer.hz, i / Math.max(1, len - 1));
    phase += hz / rate;
    const k = start + i;
    out[k] =
      (out[k] ?? 0) + wave(layer.tone, phase) * layer.gain * envelope(i, len, attack, release);
  }
}

function addNoise(
  out: Float32Array,
  layer: NoiseLayer,
  rate: number,
  seconds: number,
  seed: number,
): void {
  const start = Math.round(layer.at * rate);
  const len = Math.min(out.length - start, Math.round((layer.for ?? seconds - layer.at) * rate));
  const attack = layer.attack * rate;
  const release = layer.release * rate;
  const white = noiseSource(seed);
  const filter = layer.filter
    ? biquad(layer.filter.type, layer.filter.hz, layer.filter.q, rate)
    : (x: number) => x;
  // Pink: Paul Kellet's economy filter; brown: integrated white, leaking back to zero.
  let p0 = 0,
    p1 = 0,
    p2 = 0,
    brown = 0;
  for (let i = 0; i < len; i++) {
    const w = white();
    let x = w;
    if (layer.noise === 'pink') {
      p0 = 0.99765 * p0 + w * 0.099046;
      p1 = 0.963 * p1 + w * 0.2965164;
      p2 = 0.57 * p2 + w * 1.0526913;
      x = (p0 + p1 + p2 + w * 0.1848) * 0.25;
    } else if (layer.noise === 'brown') {
      brown = (brown + 0.02 * w) * 0.998;
      x = brown * 1.5;
    }
    let level = layer.gain * envelope(i, len, attack, release);
    if (layer.wobble) {
      const t = i / rate;
      level *= 1 - layer.wobble.depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * layer.wobble.hz * t));
    }
    const k = start + i;
    out[k] = (out[k] ?? 0) + filter(x) * level;
  }
}

/** Crossfade at a loop's seam (s): its end flows into its start without a click. */
const SEAM_S = 0.25;

/** A recipe's samples (mono, `rate` Hz), its noise from `seed`. A loop's end meets its start. */
export function renderSynth(synth: Synth, rate: number, seed = 1): Float32Array<ArrayBuffer> {
  const n = Math.max(1, Math.round(synth.seconds * rate));
  const seam = synth.loop ? Math.min(Math.round(SEAM_S * rate), n) : 0;
  const total = synth.seconds + seam / rate;
  const raw = new Float32Array(n + seam);
  synth.layers.forEach((layer, i) => {
    // A loop's layers run the whole length and on into the seam.
    const span = synth.loop ? { ...layer, at: 0, for: total, attack: 0, release: 0 } : layer;
    if ('tone' in span) addTone(raw, span, rate, total);
    else addNoise(raw, span, rate, total, seed * 7919 + i);
  });
  const out = raw.subarray(0, n);
  for (let i = 0; i < seam; i++) {
    const k = i / seam;
    out[i] = (out[i] ?? 0) * k + (raw[n + i] ?? 0) * (1 - k);
  }
  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, out[i] ?? 0));
  return out;
}

/**
 * A room's reverb (two channels): decaying noise that falls 60 dB in `rt60` s, its highs fading
 * first as in a real room, after a short delay (the first reflections).
 */
type Samples = Float32Array<ArrayBuffer>;

export function impulseResponse(rt60: number, rate: number, seed = 1): [Samples, Samples] {
  const n = Math.round((rt60 * 1.1 + 0.01) * rate);
  const delay = Math.round(0.01 * rate);
  const channels: [Samples, Samples] = [new Float32Array(n), new Float32Array(n)];
  channels.forEach((out, c) => {
    const white = noiseSource(seed * 31 + c);
    const soften = biquad('lowpass', 6000, 0.707, rate);
    for (let i = delay; i < n; i++) {
      const t = (i - delay) / rate;
      out[i] = soften(white()) * Math.exp((-6.907755 * t) / rt60); // e^-6.9 = 10^-3: -60 dB
    }
  });
  return channels;
}

/**
 * The reverberation time (s) of a box-shaped room by Sabine's formula, RT60 = 0.161 V / (α S),
 * with an average absorption α of 0.2 (hard lab surfaces, some furniture): an estimate for the
 * reverb, not a measurement.
 */
export function roomRt60(width: number, height: number, depth: number): number {
  const volume = width * height * depth;
  const surface = 2 * (width * height + width * depth + height * depth);
  return Math.max(0.2, Math.min(2.5, (0.161 * volume) / (0.2 * surface)));
}
