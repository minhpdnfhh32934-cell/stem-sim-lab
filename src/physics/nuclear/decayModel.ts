import { CURIE_BQ, type Isotope } from './data';

/**
 * Bài 23: N = N₀·2^(−t/T) = N₀e^(−λt) (23.1, 23.3), λ = ln2/T, H = λN (23.2), 1 Ci = 3,7·10¹⁰ Bq.
 * The random-decay picture is an illustration with a fixed seed, never a measurement.
 */

const SECONDS = { second: 1, day: 86400, year: 365.25 * 86400 } as const;
export type TimeUnit = keyof typeof SECONDS;
/** Half-life of a Bảng 23.2 isotope in seconds (a year is 365,25 days). */
export const halfLifeSeconds = (i: Isotope) => i.half_life * SECONDS[i.unit];
export const toSeconds = (v: number, unit: TimeUnit) => v * SECONDS[unit];
export const fromSeconds = (s: number, unit: TimeUnit) => s / SECONDS[unit];

/** Share of nuclei left after t: 2^(−t/T). */
export const remaining = (t: number, T: number) => 2 ** (-t / T);
/** λ = ln2/T (s⁻¹). */
export const lambdaOf = (T: number) => Math.LN2 / T;
/** H = λN (Bq). */
export const activity = (N: number, T: number) => lambdaOf(T) * N;
export const toCurie = (bq: number) => bq / CURIE_BQ;

/** Time after which only the share `left` is left: t = T·log₂(1/left). */
export const timeToLeft = (left: number, T: number) => T * Math.log2(1 / left);
/** Half-life from the share left after t (question, tr. 108): T = t·ln2/ln(1/left). */
export const halfLifeFrom = (left: number, t: number) => (t * Math.LN2) / Math.log(1 / left);

/** Small deterministic generator (mulberry32): the illustration is the same on every run. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random decay of `n0` nuclei of half-life T, step by step: in each step every nucleus left decays
 * with probability 1 − 2^(−dt/T). Returns the number left at each of `steps` + 1 times.
 */
export function randomDecay(n0: number, T: number, dt: number, steps: number, seed = 23) {
  const rnd = seeded(seed);
  const p = 1 - remaining(dt, T);
  const left = [n0];
  let now = n0;
  for (let k = 0; k < steps; k++) {
    let decayed = 0;
    for (let i = 0; i < now; i++) if (rnd() < p) decayed++;
    now -= decayed;
    left.push(now);
  }
  return left;
}

/** Dose at distance d₂ from a point source given the dose at d₁ (the book: twice as far, a quarter). */
export const doseAt = (dose1: number, d1: number, d2: number) => dose1 * (d1 / d2) ** 2;
