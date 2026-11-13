import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TIME = 0;
const REACTANT = 1;
const PRODUCT = 2;
const RATE = 3;
const CONVERSION = 4;
const SHARE = 5;

const R = 8.314462618;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['temperature', (t) => t >= 200 && t <= 600, 'from 200 to 600 K'],
  ['activationEnergy', (e) => e > 0 && e <= 200, 'above 0 and at most 200 kJ/mol'],
  ['concentration', (c) => c > 0 && c <= 2, 'above 0 and at most 2 mol/L'],
  ['preExponential', (a) => a > 0 && a <= 1e15, 'above 0 and at most 1e15 L/(mol·s)'],
  ['runTime', (t) => t > 0 && t <= 3600, 'above 0 and at most 3600 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Collision theory input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Collision theory input "${id}" must be ${rule}, got ${value}`);
  }
}

/** The share of collisions with at least Ea along the line of centres, e^(−Ea/RT). */
export const energeticShare = (kilojoules: number, kelvin: number) =>
  Math.exp((-kilojoules * 1000) / (R * kelvin));

/** The rate constant k = A·e^(−Ea/RT) (L/(mol·s)). */
const rateConstant = (inputs: Inputs) =>
  (inputs.preExponential ?? NaN) *
  energeticShare(inputs.activationEnergy ?? NaN, inputs.temperature ?? NaN);

function derive(state: Float64Array, t: number, inputs: Inputs): void {
  const c0 = inputs.concentration ?? NaN;
  const k = rateConstant(inputs);
  const c = c0 / (1 + k * c0 * t); // A + B → P with [A] = [B] = c: dc/dt = −k·c²
  state[TIME] = t;
  state[REACTANT] = c;
  state[PRODUCT] = c0 - c;
  state[RATE] = k * c * c;
  state[CONVERSION] = (100 * (c0 - c)) / c0;
  state[SHARE] = 100 * energeticShare(inputs.activationEnergy ?? NaN, inputs.temperature ?? NaN);
}

/**
 * Collision theory and the Arrhenius equation: a teaching model of a second-order reaction
 * A + B → P in solution, both at `concentration` c₀ mol/L. Molecules react only when they collide
 * with at least the activation energy Ea along their line of centres; the share of collisions
 * that do is e^(−Ea/RT) (exact for that simple collision model), and the rate constant is
 * k = A·e^(−Ea/RT). The rate is k·[A][B]; with equal amounts [A](t) = c₀/(1 + k·c₀·t), exactly.
 * The pre-exponential factor A (`preExponential`, the rate of collisions with a suitable
 * orientation) is a stated teaching value — the comparisons it makes are exact: the energetic
 * share, how a 10 K rise or a doubled concentration changes the rate.
 *
 * Variables: `time` (s), `reactant` [A] and `product` [P] (mol/L), `rate` (mol/(L·s)),
 * `conversion` (% of A used), `energeticShare` e^(−Ea/RT) (%).
 */
export const collisionTheoryModel: SimulationModel = {
  id: 'chemistry.collision-theory',
  inputs: ['temperature', 'activationEnergy', 'concentration', 'preExponential', 'runTime'],
  variables: ['time', 'reactant', 'product', 'rate', 'conversion', 'energeticShare'],
  predictions: ['rateConstant', 'energeticShare', 'initialRate', 'halfLife', 'conversion'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, 0, inputs);
  },

  step(state, dt, inputs) {
    const end = inputs.runTime ?? NaN;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    derive(state, time + h, inputs);
    return h;
  },

  isComplete: (state, inputs) => (state[TIME] ?? 0) >= (inputs.runTime ?? NaN),

  /** k, the energetic share, the initial rate k·c₀², the half-life 1/(k·c₀) and the conversion at the end. */
  predict(inputs) {
    refuseInvalid(inputs);
    const c0 = inputs.concentration ?? NaN;
    const k = rateConstant(inputs);
    const state = new Float64Array(6);
    derive(state, inputs.runTime ?? NaN, inputs);
    return {
      rateConstant: k,
      energeticShare:
        100 * energeticShare(inputs.activationEnergy ?? NaN, inputs.temperature ?? NaN),
      initialRate: k * c0 * c0,
      halfLife: 1 / (k * c0),
      conversion: state[CONVERSION] ?? NaN,
    };
  },
};
