import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['frequency', (f) => f > 0 && f <= 10, 'above 0 and at most 10 Hz'],
  ['turns', (n) => Number.isInteger(n) && n >= 1 && n <= 2000, 'a whole number from 1 to 2000'],
  ['field', (b) => b > 0 && b <= 2, 'above 0 and at most 2 T'],
  ['area', (a) => a > 0 && a <= 0.1, 'above 0 and at most 0.1 m²'],
  ['periods', (p) => Number.isInteger(p) && p >= 1 && p <= 20, 'a whole number from 1 to 20'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`AC generator input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`AC generator input "${id}" must be ${rule}, got ${value}`);
  }
}

/** The peak emf E₀ = NBAω (V). */
export const peakEmf = (inputs: Inputs) =>
  (inputs.turns ?? NaN) *
  (inputs.field ?? NaN) *
  (inputs.area ?? NaN) *
  2 *
  Math.PI *
  (inputs.frequency ?? NaN);

const TIME = 0;
const ANGLE = 1;
const LINKAGE = 2;
const EMF = 3;
const RMS = 4;

function at(state: Float64Array, inputs: Inputs, t: number): void {
  const w = 2 * Math.PI * (inputs.frequency ?? NaN);
  const e0 = peakEmf(inputs);
  const nba = (inputs.turns ?? NaN) * (inputs.field ?? NaN) * (inputs.area ?? NaN);
  state[TIME] = t;
  state[ANGLE] = ((w * t * 180) / Math.PI) % 360;
  state[LINKAGE] = nba * Math.cos(w * t);
  state[EMF] = e0 * Math.sin(w * t);
  // The rms so far, from the exact mean of sin² over [0, t]: ½ − sin(2ωt)/(4ωt).
  state[RMS] = t > 0 ? e0 * Math.sqrt(0.5 - Math.sin(2 * w * t) / (4 * w * t)) : 0;
}

/**
 * The AC generator: a coil of `turns` turns and area `area` turns `frequency` times a second in a
 * uniform magnetic field `field`. Its flux linkage NΦ = NBA cos ωt changes, and Faraday's law gives
 * the emf ε = −d(NΦ)/dt = NBAω sin ωt: an alternating voltage of peak NBAω and frequency f, rms
 * E₀/√2 over whole turns. The coil starts face-on to the field (flux greatest, emf zero). Exact,
 * for `periods` turns.
 *
 * Variables: `time` (s), `angle` (° of the coil from face-on), `linkage` (NΦ, Wb), `emf` (V),
 * `rms` (V, over the run so far).
 */
export const acGeneratorModel: SimulationModel = {
  id: 'physics.ac-generator',
  inputs: ['frequency', 'turns', 'field', 'area', 'periods'],
  variables: ['time', 'angle', 'linkage', 'emf', 'rms'],
  predictions: ['peak', 'rms', 'linkage'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    at(state, inputs, 0);
  },

  step(state, dt, inputs) {
    const end = (inputs.periods ?? NaN) / (inputs.frequency ?? NaN);
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    at(state, inputs, time + h);
    return h;
  },

  isComplete: (state, inputs) =>
    (state[TIME] ?? 0) >= (inputs.periods ?? NaN) / (inputs.frequency ?? NaN) - 1e-12,

  predict(inputs) {
    refuseInvalid(inputs);
    const e0 = peakEmf(inputs);
    return {
      peak: e0,
      rms: e0 / Math.SQRT2,
      linkage: (inputs.turns ?? NaN) * (inputs.field ?? NaN) * (inputs.area ?? NaN),
    };
  },
};
