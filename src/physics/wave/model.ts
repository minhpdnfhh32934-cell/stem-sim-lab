/**
 * Standing wave on a string clamped at both ends (x = 0 and x = L), formed by two waves of
 * equal amplitude A travelling in opposite directions; the reflected wave is inverted, so
 * x = 0 is a node:
 *   y₁ = A cos(ωt − kx),  y₂ = −A cos(ωt + kx),  y = y₁ + y₂ = 2A sin(kx) sin(ωt).
 * A is the amplitude of EACH component wave; an antinode swings with 2A.
 * Sources: SGK Vật lí 11 (Sóng dừng); Halliday–Resnick–Walker ch. 16.
 */
export interface Wave {
  /** Amplitude of each travelling wave (m). */
  A: number;
  /** Wave number k = 2π/λ (rad/m). */
  k: number;
  /** Angular frequency ω = 2πf (rad/s). */
  omega: number;
}

/** Speed of a transverse wave on a string: v = √(T/μ). */
export const waveSpeed = (tension: number, muL: number) => Math.sqrt(tension / muL);
export const wavelength = (v: number, f: number) => v / f;
/** n-th resonance of a string fixed at both ends: L = nλ/2 ⇒ f_n = n·v/(2L). */
export const harmonicFrequency = (n: number, v: number, L: number) => (n * v) / (2 * L);
/** Speed needed for n half wavelengths at frequency f: v = 2Lf/n. */
export const speedForHarmonic = (n: number, f: number, L: number) => (2 * L * f) / n;
/** Number of half wavelengths m = 2Lf/v; a standing wave needs a whole m. */
export const harmonicRatio = (L: number, f: number, v: number) => (2 * L * f) / v;

/**
 * m counts as whole only within computer round-off, |m − round(m)| ≤ 1e-9·max(1, m):
 * a real mismatch is reported, never rounded away (trap 5 of the 0.8.0 plan).
 */
export const isWhole = (m: number) => Math.abs(m - Math.round(m)) <= 1e-9 * Math.max(1, m);

export interface Resonance {
  n: number;
  f: number;
}

/** Resonances just below and above a frequency that fits no whole m (n ≥ 1). */
export function nearestResonances(L: number, f: number, v: number) {
  const m = harmonicRatio(L, f, v);
  const lo = Math.floor(m);
  const at = (n: number): Resonance => ({ n, f: harmonicFrequency(n, v, L) });
  return { m, below: lo >= 1 ? at(lo) : null, above: at(Math.max(1, Math.ceil(m))) };
}

export const incident = (w: Wave, x: number, t: number) => w.A * Math.cos(w.omega * t - w.k * x);
export const reflected = (w: Wave, x: number, t: number) => -w.A * Math.cos(w.omega * t + w.k * x);
export const standing = (w: Wave, x: number, t: number) =>
  2 * w.A * Math.sin(w.k * x) * Math.sin(w.omega * t);

/** Nodes x = jλ/2 (j = 0 … n), clamped ends included. */
export const nodes = (L: number, n: number) => Array.from({ length: n + 1 }, (_, j) => (j * L) / n);
/** Antinodes x = (2j + 1)λ/4 (j = 0 … n − 1). */
export const antinodes = (L: number, n: number) =>
  Array.from({ length: n }, (_, j) => ((2 * j + 1) * L) / (2 * n));
