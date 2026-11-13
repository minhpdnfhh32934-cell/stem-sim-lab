import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['age', (a) => a >= 10 && a <= 80, 'from 10 to 80 years'],
  ['restingRate', (r) => r >= 40 && r <= 100, 'from 40 to 100 beats/min'],
  ['intensity', (i) => i >= 0 && i <= 100, 'from 0 to 100 %'],
  ['exercise', (t) => t > 0 && t <= 1800, 'above 0 and at most 1800 s'],
  ['recovery', (t) => t > 0 && t <= 1800, 'above 0 and at most 1800 s'],
  ['riseTime', (t) => t > 0 && t <= 300, 'above 0 and at most 300 s'],
  ['fallTime', (t) => t > 0 && t <= 300, 'above 0 and at most 300 s'],
  ['strokeVolume', (v) => v > 0 && v <= 200, 'above 0 and at most 200 mL'],
  ['speed', (s) => s > 0 && s <= 200, 'above 0 and at most 200 (s per s)'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Heart rate input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Heart rate input "${id}" must be ${rule}, got ${value}`);
  }
}

/** The age-predicted maximum heart rate (beats/min): 208 − 0.7 × age (Tanaka et al., 2001). */
export const maxRate = (age: number) => 208 - 0.7 * age;

/** The exercise's steady rate (Karvonen): rest + intensity × (max − rest), intensity in %. */
export const targetRate = (inputs: Inputs) => {
  const rest = inputs.restingRate ?? NaN;
  return rest + ((inputs.intensity ?? NaN) / 100) * (maxRate(inputs.age ?? NaN) - rest);
};

/** The heart rate t s after the exercise starts: up towards the target, then back down to rest. */
export function rateAt(inputs: Inputs, t: number): number {
  const rest = inputs.restingRate ?? NaN;
  const target = targetRate(inputs);
  const te = inputs.exercise ?? NaN;
  const up = (s: number) => target - (target - rest) * Math.exp(-s / (inputs.riseTime ?? NaN));
  if (t <= te) return up(t);
  return rest + (up(te) - rest) * Math.exp(-(t - te) / (inputs.fallTime ?? NaN));
}

const TIME = 0;
const ELAPSED = 1;
const RATE = 2;
const OUTPUT = 3;
const EXERCISING = 4;

function at(state: Float64Array, inputs: Inputs, t: number): void {
  const rate = rateAt(inputs, t);
  state[ELAPSED] = t;
  state[RATE] = rate;
  state[OUTPUT] = (rate * (inputs.strokeVolume ?? NaN)) / 1000;
  state[EXERCISING] = t <= (inputs.exercise ?? NaN) ? 1 : 0;
}

/**
 * Heart rate during exercise and recovery: a person of `age` years with a resting rate
 * `restingRate` exercises for `exercise` s at `intensity` % of their heart-rate reserve, then rests
 * for `recovery` s. The rate climbs towards the Karvonen target rest + intensity·(max − rest), the
 * maximum from Tanaka's 208 − 0.7·age, with the time constant `riseTime`, and falls back with
 * `fallTime`; cardiac output = rate × `strokeVolume`. The formulas are the published ones; the
 * time constants and the fixed stroke volume are illustrative (it rises with exercise in fact).
 *
 * Variables: `time` (s), `elapsed` (s of the session), `rate` (beats/min), `output` (L/min),
 * `exercising` (1 while exercising).
 */
export const heartRateModel: SimulationModel = {
  id: 'biology.heart-rate',
  inputs: [
    'age',
    'restingRate',
    'intensity',
    'exercise',
    'recovery',
    'riseTime',
    'fallTime',
    'strokeVolume',
    'speed',
  ],
  variables: ['time', 'elapsed', 'rate', 'output', 'exercising'],
  predictions: ['maxRate', 'peakRate', 'finalRate', 'peakOutput'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    at(state, inputs, 0);
  },

  step(state, dt, inputs) {
    const per = inputs.speed ?? NaN;
    const end = ((inputs.exercise ?? NaN) + (inputs.recovery ?? NaN)) / per;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    state[TIME] = time + h;
    at(state, inputs, (time + h) * per);
    return h;
  },

  isComplete: (state, inputs) =>
    (state[TIME] ?? 0) >=
    ((inputs.exercise ?? NaN) + (inputs.recovery ?? NaN)) / (inputs.speed ?? NaN) - 1e-9,

  predict(inputs) {
    refuseInvalid(inputs);
    const peak = rateAt(inputs, inputs.exercise ?? NaN);
    return {
      maxRate: maxRate(inputs.age ?? NaN),
      peakRate: peak,
      finalRate: rateAt(inputs, (inputs.exercise ?? NaN) + (inputs.recovery ?? NaN)),
      peakOutput: (peak * (inputs.strokeVolume ?? NaN)) / 1000,
    };
  },
};
