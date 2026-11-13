import type { SimulationModel } from '../SimulationModel';
import { seedBits } from './genetics';

type Inputs = Readonly<Record<string, number>>;

const TIME = 0;
const COUNTS = 1; // in the last whole interval
const RATE = 2; // the last interval's counts / Δt (1/s)
const TOTAL = 3;
const INTERVALS = 4;
const HALF_LIFE = 5; // fitted from the intervals so far (s), 0 until two can be fitted
// Least-squares sums of ln(counts − background) against the interval's middle.
const SUM_N = 6;
const SUM_X = 7;
const SUM_Y = 8;
const SUM_XY = 9;
const SUM_XX = 10;

/** The largest mean count per interval sampled (exp(−μ) stays a normal double). */
const MAX_MEAN = 700;

function need(inputs: Inputs, id: string, accepts: (v: number) => boolean, rule: string): number {
  const value = inputs[id];
  if (value === undefined) throw new Error(`Decay counter input "${id}" is missing`);
  if (!accepts(value)) throw new Error(`Decay counter input "${id}" must be ${rule}, got ${value}`);
  return value;
}

function counter(inputs: Inputs) {
  const half = need(inputs, 'halfLife', (v) => v > 0 && v <= 1e6, 'above 0 s');
  const R0 = need(inputs, 'initialRate', (v) => v > 0 && v <= 1000, 'above 0, at most 1000 /s');
  const B = need(inputs, 'background', (v) => v >= 0 && v <= 10, '0–10 /s');
  const dt = need(inputs, 'countInterval', (v) => v > 0 && v <= 600, 'above 0 s, at most 10 min');
  const duration = need(
    inputs,
    'duration',
    (v) => v >= 2 * dt && v <= 7200,
    'two intervals to 2 h',
  );
  // The count number picks the seed; a dial between two numbers gives the nearer one.
  const draw = Math.round(need(inputs, 'draw', (v) => v >= 0 && v <= 1e6, '0 or more'));
  const lapse = need(inputs, 'timeLapse', (v) => v > 0, 'above 0');
  if ((R0 + B) * dt > MAX_MEAN)
    throw new Error(
      `Decay counter: about ${((R0 + B) * dt).toFixed(0)} counts per interval are more than this counter samples; take a shorter interval`,
    );
  const lambda = Math.LN2 / half;
  const intervals = Math.floor(duration / dt + 1e-9);
  return { half, R0, B, dt, draw, lapse, lambda, end: intervals * dt };
}

/** The mean count in [t, t + Δt]: R0/λ·(e^(−λt) − e^(−λ(t + Δt))) + B·Δt. */
function meanCount(c: ReturnType<typeof counter>, t: number): number {
  return (
    (c.R0 / c.lambda) * (Math.exp(-c.lambda * t) - Math.exp(-c.lambda * (t + c.dt))) + c.B * c.dt
  );
}

/** A Poisson count of mean μ from one uniform u in [0, 1), by inversion of its distribution. */
export function poisson(mean: number, u: number): number {
  let k = 0;
  let p = Math.exp(-mean);
  let F = p;
  while (u > F && p > 0) {
    k++;
    p *= mean / k;
    F += p;
  }
  return k;
}

/**
 * Radioactive decay with a Geiger counter — a simulation (KNTT Vật lí 12, bài 23; no source is used
 * in a school: decision D4 of the Phase T contract). A source of `halfLife` T½ (s) gives the
 * counter R0·e^(−λt) counts per second at first `initialRate` R0 (λ = ln 2/T½), over a `background`
 * B (1/s, illustrative). The counter counts for successive `countInterval`s Δt over `duration`;
 * each count is random, Poisson with the interval's mean R0/λ·(e^(−λt) − e^(−λ(t + Δt))) + B·Δt,
 * drawn from the `draw`'s seed (`seedBits`): the same draw gives the same counts, another draw
 * another set, as a real counter would. After each interval the half-life is fitted from the
 * counts so far, a least-squares line through ln(N − B·Δt) against the interval's middle (intervals
 * where N ≤ B·Δt are left out); T½ = −ln 2/slope. Dead time and the source's geometry are left
 * out. Time is compressed (`timeLapse`).
 *
 * Variables: `labTime` (s), `counts` N in the last whole interval, `countRate` N/Δt (1/s),
 * `totalCounts`, `intervals` counted, `halfLifeSeen` (s, 0 until fitted), and the fit's sums.
 */
export const decayCounterModel: SimulationModel = {
  id: 'nuclear.decay-counter',
  inputs: [
    'halfLife',
    'initialRate',
    'background',
    'countInterval',
    'duration',
    'draw',
    'timeLapse',
  ],
  variables: [
    'labTime',
    'counts',
    'countRate',
    'totalCounts',
    'intervals',
    'halfLifeSeen',
    'fitPoints',
    'fitSumX',
    'fitSumY',
    'fitSumXY',
    'fitSumXX',
  ],
  predictions: ['halfLife', 'decayConstant', 'firstCount', 'backgroundCount', 'halfLifeSeen'],

  init(inputs, state) {
    counter(inputs);
    state.fill(0);
  },

  step(state, dt, inputs) {
    const c = counter(inputs);
    const time = state[TIME] ?? 0;
    if (!(time < c.end)) return 0;
    const next = Math.min(time + c.lapse * dt, c.end);
    // Every interval that ends inside this step is counted.
    let k = state[INTERVALS] ?? 0;
    while ((k + 1) * c.dt <= next + 1e-9) {
      const start = k * c.dt;
      const n = poisson(meanCount(c, start), seedBits(c.draw, k) / 4294967296);
      state[COUNTS] = n;
      state[RATE] = n / c.dt;
      state[TOTAL] = (state[TOTAL] ?? 0) + n;
      const net = n - c.B * c.dt;
      if (net > 0) {
        const x = start + c.dt / 2;
        const y = Math.log(net);
        state[SUM_N] = (state[SUM_N] ?? 0) + 1;
        state[SUM_X] = (state[SUM_X] ?? 0) + x;
        state[SUM_Y] = (state[SUM_Y] ?? 0) + y;
        state[SUM_XY] = (state[SUM_XY] ?? 0) + x * y;
        state[SUM_XX] = (state[SUM_XX] ?? 0) + x * x;
      }
      k++;
    }
    state[INTERVALS] = k;
    state[HALF_LIFE] = fittedHalfLife(state);
    state[TIME] = next;
    return (next - time) / c.lapse;
  },

  isComplete: (state, inputs) => (state[TIME] ?? 0) >= counter(inputs).end,

  /**
   * The theory: T½ and λ; the first interval's mean count and the background's per interval;
   * `halfLifeSeen`, the half-life the fit would give from mean counts (T½ itself).
   */
  predict(inputs) {
    const c = counter(inputs);
    return {
      halfLife: c.half,
      decayConstant: c.lambda,
      firstCount: meanCount(c, 0),
      backgroundCount: c.B * c.dt,
      halfLifeSeen: c.half,
    };
  },
};

function fittedHalfLife(state: Float64Array): number {
  const n = state[SUM_N] ?? 0;
  if (n < 2) return 0;
  const sx = state[SUM_X] ?? 0;
  const sy = state[SUM_Y] ?? 0;
  const denominator = n * (state[SUM_XX] ?? 0) - sx * sx;
  if (!(denominator > 0)) return 0;
  const slope = (n * (state[SUM_XY] ?? 0) - sx * sy) / denominator;
  return slope < 0 ? -Math.LN2 / slope : 0; // a count that does not fall has no half-life
}
