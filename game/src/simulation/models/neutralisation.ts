import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TIME = 0;
const TEMPERATURE = 1;
const HEAT = 2;
const WATER = 3;

/**
 * The enthalpy of neutralisation of a strong acid by a strong base in dilute solution, J per mol
 * of water formed: H⁺(aq) + OH⁻(aq) → H₂O(l), ΔH = −57.1 kJ/mol at 25 °C (the textbook value;
 * tables give −55.8 to −57.3 kJ/mol by concentration and method). The same for HCl, HNO₃ with
 * NaOH, KOH: the reaction is always H⁺ + OH⁻.
 */
export const NEUTRALISATION_J_PER_MOL = 57_100;
/** The mixture taken as water: 1.00 g/mL and 4.18 J/(g·K). */
const DENSITY = 1;
const SPECIFIC_HEAT = 4.18;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['acidVolume', (v) => v > 0 && v <= 200, 'above 0 and at most 200 mL'],
  ['baseVolume', (v) => v > 0 && v <= 200, 'above 0 and at most 200 mL'],
  ['concentration', (c) => c > 0 && c <= 2, 'above 0 and at most 2 mol/L'],
  ['startTemperature', (t) => t >= 5 && t <= 35, 'from 5 to 35 °C'],
  ['timeConstant', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
  ['readTime', (t) => t > 0 && t <= 600, 'above 0 and at most 600 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Neutralisation input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Neutralisation input "${id}" must be ${rule}, got ${value}`);
  }
}

/** Water formed (mol): the smaller of the acid's H⁺ and the base's OH⁻, both at concentration c. */
const waterFormed = (inputs: Inputs) =>
  (Math.min(inputs.acidVolume ?? NaN, inputs.baseVolume ?? NaN) * (inputs.concentration ?? NaN)) /
  1000;
/** The mixture's mass (g). */
const mixtureMass = (inputs: Inputs) =>
  DENSITY * ((inputs.acidVolume ?? NaN) + (inputs.baseVolume ?? NaN));

/**
 * The enthalpy of neutralisation in a polystyrene cup: a simplified teaching model. `acidVolume`
 * mL of hydrochloric acid and `baseVolume` mL of sodium hydroxide, both at `concentration` mol/L
 * and `startTemperature` °C, are mixed at t = 0. The water formed is set by the reagent that runs
 * out, n = c·min(V_a, V_b); the heat it gives out, q = n·57.1 kJ/mol, warms the whole mixture,
 * taken as water (1.00 g/mL, 4.18 J/(g·K)): ΔT = q/(m·c). The cup is taken as a perfect
 * insulator whose own heat capacity is negligible (a real cup loses a little heat, so a real ΔT
 * comes out lower); the thermometer follows the mixture with a time constant τ (`timeConstant`,
 * stirring and the bulb: a stated teaching value), T(t) = T₀ + ΔT·(1 − e^(−t/τ)), exact at every
 * step. The run ends at `readTime`.
 *
 * Variables: `time` since mixing (s), `temperature` (°C), `heat` given out so far (J), `water`
 * formed (mmol, all at once on mixing).
 */
export const neutralisationModel: SimulationModel = {
  id: 'chemistry.neutralisation',
  inputs: [
    'acidVolume',
    'baseVolume',
    'concentration',
    'startTemperature',
    'timeConstant',
    'readTime',
  ],
  variables: ['time', 'temperature', 'heat', 'water'],
  predictions: [
    'water',
    'heat',
    'temperatureRise',
    'finalTemperature',
    'enthalpy',
    'equivalenceVolume',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    state[TEMPERATURE] = inputs.startTemperature ?? NaN;
    state[WATER] = waterFormed(inputs) * 1000;
  },

  step(state, dt, inputs) {
    const end = inputs.readTime ?? NaN;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    const rise =
      (waterFormed(inputs) * NEUTRALISATION_J_PER_MOL) / (mixtureMass(inputs) * SPECIFIC_HEAT);
    const share = 1 - Math.exp(-t / (inputs.timeConstant ?? NaN));
    state[TIME] = t;
    state[TEMPERATURE] = (inputs.startTemperature ?? NaN) + rise * share;
    state[HEAT] = mixtureMass(inputs) * SPECIFIC_HEAT * rise * share;
    return h;
  },

  isComplete: (state, inputs) => (state[TIME] ?? 0) >= (inputs.readTime ?? NaN),

  /**
   * The theory: n, q, ΔT and the final temperature at the end of the read (the thermometer's
   * lag included: ΔT·(1 − e^(−t_read/τ))); the enthalpy −q/n of the full ΔT, −57.1 kJ/mol; the
   * base volume that exactly neutralises the acid (V_a: both at one concentration).
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const n = waterFormed(inputs);
    const m = mixtureMass(inputs);
    const rise = (n * NEUTRALISATION_J_PER_MOL) / (m * SPECIFIC_HEAT);
    const read = rise * (1 - Math.exp(-(inputs.readTime ?? NaN) / (inputs.timeConstant ?? NaN)));
    return {
      water: n * 1000,
      heat: m * SPECIFIC_HEAT * read,
      temperatureRise: read,
      finalTemperature: (inputs.startTemperature ?? NaN) + read,
      enthalpy: -NEUTRALISATION_J_PER_MOL / 1000,
      equivalenceVolume: inputs.acidVolume ?? NaN,
    };
  },
};
