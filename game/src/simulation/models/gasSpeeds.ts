import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TIME = 0;
const SPEED = 1;
const DENSITY = 2;
const SHARE = 3;
const PEAK = 4;
const MEAN = 5;
const RMS = 6;
const PEAK_DENSITY = 7;

const R = 8.314462618; // J/(mol·K)

/** The gases, with their molar masses (kg/mol) from the IUPAC standard atomic weights. */
export const GASES = [
  { formula: 'He', name: 'helium', molarMass: 0.0040026 },
  { formula: 'N₂', name: 'nitrogen', molarMass: 0.028014 },
  { formula: 'O₂', name: 'oxygen', molarMass: 0.031998 },
  { formula: 'CO₂', name: 'carbon dioxide', molarMass: 0.044009 },
] as const;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'gas',
    (k) => Number.isInteger(k) && k >= 0 && k < GASES.length,
    `a code from 0 to ${GASES.length - 1}`,
  ],
  ['temperature', (t) => t >= 10 && t <= 5000, 'from 10 to 5000 K'],
  [
    'particles',
    (n) => Number.isInteger(n) && n >= 10 && n <= 10000,
    'a whole number from 10 to 10000',
  ],
  ['scanTime', (t) => t > 0 && t <= 120, 'above 0 and at most 120 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Gas speeds input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Gas speeds input "${id}" must be ${rule}, got ${value}`);
  }
}

/**
 * The error function to double precision: its Maclaurin series below 2.5 (every term added, the
 * sum alternating), 1 − erfc by Lentz's continued fraction above.
 */
export function erf(x: number): number {
  if (x < 0) return -erf(-x);
  if (x < 2.5) {
    let term = x;
    let sum = x;
    for (let n = 1; n < 200; n++) {
      term *= (-x * x) / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    return (2 / Math.sqrt(Math.PI)) * sum;
  }
  // erfc(x) = e^(−x²)/√π · 1/(x + 1/2/(x + 1/(x + 3/2/(x + …)))) by Lentz's method.
  const tiny = 1e-300;
  let f = x;
  let c = x;
  let d = 0;
  for (let n = 1; n < 300; n++) {
    const a = n / 2;
    d = x + a * d;
    d = d === 0 ? tiny : 1 / d;
    c = x + a / c;
    if (c === 0) c = tiny;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return 1 - Math.exp(-x * x) / (Math.sqrt(Math.PI) * f);
}

/** The most probable speed √(2RT/M) (m/s). */
export const mostProbableSpeed = (molarMass: number, kelvin: number) =>
  Math.sqrt((2 * R * kelvin) / molarMass);

/** The Maxwell–Boltzmann density of speeds f(v) (s/m) and its cumulative share F(v). */
export function speedDensity(v: number, molarMass: number, kelvin: number): number {
  const vp = mostProbableSpeed(molarMass, kelvin);
  const x = v / vp;
  return ((4 / Math.sqrt(Math.PI)) * (x * x) * Math.exp(-x * x)) / vp;
}
export function speedShare(v: number, molarMass: number, kelvin: number): number {
  const x = v / mostProbableSpeed(molarMass, kelvin);
  return erf(x) - (2 / Math.sqrt(Math.PI)) * x * Math.exp(-x * x);
}

/**
 * `count` speeds that sample the distribution evenly: the quantiles at (i + ½)/count, each found
 * by bisection on F to machine precision (deterministic: the same set every time). Into `out`.
 */
export function quantileSpeeds(
  count: number,
  molarMass: number,
  kelvin: number,
  out: Float64Array,
): void {
  const vp = mostProbableSpeed(molarMass, kelvin);
  for (let i = 0; i < count; i++) {
    const p = (i + 0.5) / count;
    let lo = 0;
    let hi = 10 * vp;
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2;
      if (speedShare(mid, molarMass, kelvin) < p) lo = mid;
      else hi = mid;
    }
    out[i] = (lo + hi) / 2;
  }
}

/**
 * Speeds of gas molecules — the Maxwell–Boltzmann distribution: a teaching model of an ideal gas
 * at equilibrium. A gas (`gas`) at `temperature` K: its molecules' speeds follow
 * f(v) = 4π·(M/2πRT)^(3/2)·v²·e^(−Mv²/2RT). The run scans speed from 0 to 3·v_p over `scanTime`
 * s, reading f(v) and the share F(v) slower than v; the peak it passes is the most probable
 * speed. A set of `particles` molecules (the box's) samples the distribution by its quantiles;
 * their mean and root-mean-square speeds are worked out from the set, as from a measurement.
 * Ideal gas, no interactions; quantum effects (light gases near 10 K) are left out.
 *
 * Variables: `time` (s), `speed` scanned (m/s), `density` f(v) (s/km: per km/s, for its scale),
 * `share` F(v) (%), `peakSpeed` the speed of the highest f so far (m/s), `meanSpeed` and
 * `rmsSpeed` of the set (m/s), `peakDensity` the highest f so far (s/km).
 */
export const gasSpeedsModel: SimulationModel = {
  id: 'chemistry.gas-speeds',
  inputs: ['gas', 'temperature', 'particles', 'scanTime'],
  variables: [
    'time',
    'speed',
    'density',
    'share',
    'peakSpeed',
    'meanSpeed',
    'rmsSpeed',
    'peakDensity',
  ],
  predictions: ['mostProbable', 'mean', 'rms', 'fastShare'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const M = GASES[inputs.gas ?? NaN]?.molarMass ?? NaN;
    const T = inputs.temperature ?? NaN;
    const n = inputs.particles ?? NaN;
    const speeds = new Float64Array(n);
    quantileSpeeds(n, M, T, speeds);
    let sum = 0;
    let squares = 0;
    for (const v of speeds) {
      sum += v;
      squares += v * v;
    }
    state[MEAN] = sum / n;
    state[RMS] = Math.sqrt(squares / n);
  },

  step(state, dt, inputs) {
    const end = inputs.scanTime ?? NaN;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    const M = GASES[inputs.gas ?? NaN]?.molarMass ?? NaN;
    const T = inputs.temperature ?? NaN;
    const v = (3 * mostProbableSpeed(M, T) * t) / end;
    const f = speedDensity(v, M, T) * 1000;
    if (f >= (state[PEAK_DENSITY] ?? 0)) {
      state[PEAK_DENSITY] = f;
      state[PEAK] = v;
    }
    state[TIME] = t;
    state[SPEED] = v;
    state[DENSITY] = f;
    state[SHARE] = 100 * speedShare(v, M, T);
    return h;
  },

  isComplete: (state, inputs) => (state[TIME] ?? 0) >= (inputs.scanTime ?? NaN),

  /** v_p = √(2RT/M), v̄ = √(8RT/πM), v_rms = √(3RT/M), and the share faster than 1000 m/s (%). */
  predict(inputs) {
    refuseInvalid(inputs);
    const M = GASES[inputs.gas ?? NaN]?.molarMass ?? NaN;
    const T = inputs.temperature ?? NaN;
    return {
      mostProbable: mostProbableSpeed(M, T),
      mean: Math.sqrt((8 * R * T) / (Math.PI * M)),
      rms: Math.sqrt((3 * R * T) / M),
      fastShare: 100 * (1 - speedShare(1000, M, T)),
    };
  },
};
