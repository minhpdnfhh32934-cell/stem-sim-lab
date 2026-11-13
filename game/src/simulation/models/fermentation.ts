import type { SimulationModel } from '../SimulationModel';
import { GAS_CONSTANT } from './osmosis';

type Inputs = Readonly<Record<string, number>>;

/** Molar masses (g/mol) from IUPAC standard atomic weights. */
export const GLUCOSE = 180.156;
export const ETHANOL = 46.069;
const ATMOSPHERE = 101325; // Pa

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['glucose', (g) => g > 0 && g <= 20, 'above 0 and at most 20 g'],
  ['yeast', (y) => y > 0 && y <= 10, 'above 0 and at most 10 g'],
  ['temperature', (t) => t >= 0 && t <= 70, 'from 0 to 70 °C'],
  ['uptake', (u) => u > 0 && u <= 10, 'above 0 and at most 10 g per g per hour'],
  ['halfSaturation', (k) => k > 0 && k <= 20, 'above 0 and at most 20 g'],
  ['duration', (t) => t > 0 && t <= 7200, 'above 0 and at most 7200 s'],
  ['speed', (s) => s > 0 && s <= 1000, 'above 0 and at most 1000 (s per s)'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Fermentation input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Fermentation input "${id}" must be ${rule}, got ${value}`);
  }
}

/**
 * The yeast's activity at T °C relative to 30 °C: doubling every 10 °C (Q₁₀ = 2) while its
 * enzymes hold, and lost above about 45 °C as they denature. Illustrative, not one strain's.
 */
export const activity = (celsius: number) =>
  (2 ** ((celsius - 30) / 10) * (1 + Math.exp(-15 / 3))) / (1 + Math.exp((celsius - 45) / 3));

/** CO₂ volume (mL) of n mol at T °C and one atmosphere: V = nRT/p. */
export const gasVolume = (moles: number, celsius: number) =>
  ((moles * GAS_CONSTANT * (celsius + 273.15)) / ATMOSPHERE) * 1e6;

const TIME = 0;
const ELAPSED = 1;
const GLUCOSE_LEFT = 2;
const CO2 = 3;
const ETHANOL_MADE = 4;
const RATE = 5;
const USED = 6;

/**
 * Alcoholic fermentation by yeast: C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂. `yeast` g of yeast take up
 * glucose at `uptake` g per g per hour at 30 °C, slowing as the sugar runs low (half speed at
 * `halfSaturation` g) and changing with temperature by `activity` (illustrative); `glucose` g are
 * given, for `duration` s (run at `speed`). Each mole of glucose gives exactly two of ethanol and
 * two of CO₂ (stoichiometry); the gas is collected at the flask's temperature and one atmosphere,
 * V = nRT/p. The rates are illustrative; the masses and volumes follow from them exactly.
 *
 * Variables: `time` (s), `elapsed` (s of fermentation), `glucose` (g left), `co2` (mL collected),
 * `ethanol` (g made), `rate` (mL of CO₂ per minute), `used` (% of the glucose).
 */
export const fermentationModel: SimulationModel = {
  id: 'biology.fermentation',
  inputs: ['glucose', 'yeast', 'temperature', 'uptake', 'halfSaturation', 'duration', 'speed'],
  variables: ['time', 'elapsed', 'glucose', 'co2', 'ethanol', 'rate', 'used'],
  predictions: ['co2PerGram', 'ethanolPerGram'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    state[GLUCOSE_LEFT] = inputs.glucose ?? NaN;
  },

  step(state, dt, inputs) {
    const per = inputs.speed ?? NaN;
    const end = (inputs.duration ?? NaN) / per;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const seconds = h * per;
    const vmax =
      ((inputs.uptake ?? NaN) * (inputs.yeast ?? NaN) * activity(inputs.temperature ?? NaN)) / 3600; // g/s
    const k = inputs.halfSaturation ?? NaN;
    // Michaelis–Menten uptake by RK4 over the step's fermentation time.
    const f = (s: number) => -(vmax * s) / (k + s);
    let s = state[GLUCOSE_LEFT] ?? 0;
    const n = Math.max(1, Math.ceil(seconds / 1));
    const dh = seconds / n;
    for (let i = 0; i < n; i++) {
      const k1 = f(s);
      const k2 = f(s + (dh / 2) * k1);
      const k3 = f(s + (dh / 2) * k2);
      const k4 = f(s + dh * k3);
      s = Math.max(0, s + (dh / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
    }
    const given = inputs.glucose ?? NaN;
    const moles = (given - s) / GLUCOSE;
    const t = inputs.temperature ?? NaN;
    state[TIME] = time + h;
    state[ELAPSED] = (time + h) * per;
    state[GLUCOSE_LEFT] = s;
    state[CO2] = gasVolume(2 * moles, t);
    state[ETHANOL_MADE] = 2 * moles * ETHANOL;
    state[RATE] = gasVolume((2 * ((vmax * s) / (k + s))) / GLUCOSE, t) * 60;
    state[USED] = (100 * (given - s)) / given;
    return h;
  },

  isComplete: (state, inputs) =>
    (state[TIME] ?? 0) >= (inputs.duration ?? NaN) / (inputs.speed ?? NaN) - 1e-9,

  predict(inputs) {
    refuseInvalid(inputs);
    // Per gram of glucose used, whatever the rate: the stoichiometry's yield.
    return {
      co2PerGram: gasVolume(2 / GLUCOSE, inputs.temperature ?? NaN),
      ethanolPerGram: (2 * ETHANOL) / GLUCOSE,
    };
  },
};
