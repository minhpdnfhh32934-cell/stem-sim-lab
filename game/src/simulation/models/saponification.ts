import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const MINUTES = 0;
const EXTENT = 1;
const SOAP = 2;
const GLYCEROL = 3;
const FAT_LEFT = 4;
const HYDROXIDE_LEFT = 5;

/**
 * Molar masses (g/mol) from the IUPAC standard atomic weights: glyceryl tristearate C₅₇H₁₁₀O₆
 * 891.48, sodium stearate C₁₇H₃₅COONa 306.46, glycerol C₃H₈O₃ 92.09.
 */
export const MOLAR_MASS = { fat: 891.48, soap: 306.46, glycerol: 92.09 } as const;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['fatMass', (m) => m > 0 && m <= 50, 'above 0 and at most 50 g'],
  ['hydroxideVolume', (v) => v > 0 && v <= 200, 'above 0 and at most 200 mL'],
  ['hydroxideConcentration', (c) => c > 0 && c <= 6, 'above 0 and at most 6 mol/L'],
  ['heatingTime', (t) => t > 0 && t <= 120, 'above 0 and at most 120 min'],
  ['rateConstant', (k) => k > 0 && k <= 10, 'above 0 and at most 10 per min'],
  ['minuteLength', (s) => s > 0 && s <= 10, 'above 0 and at most 10 s a minute'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Saponification input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Saponification input "${id}" must be ${rule}, got ${value}`);
  }
}

/** The fat (mmol), the hydroxide (mmol), and the most that can react, ξmax = min(n_fat, n_OH/3). */
function amounts(inputs: Inputs): [number, number, number] {
  const fat = ((inputs.fatMass ?? NaN) / MOLAR_MASS.fat) * 1000;
  const hydroxide = (inputs.hydroxideVolume ?? NaN) * (inputs.hydroxideConcentration ?? NaN);
  return [fat, hydroxide, Math.min(fat, hydroxide / 3)];
}

function derive(state: Float64Array, minutes: number, inputs: Inputs): void {
  const [fat, hydroxide, most] = amounts(inputs);
  const extent = most * (1 - Math.exp(-(inputs.rateConstant ?? NaN) * minutes));
  state[MINUTES] = minutes;
  state[EXTENT] = extent;
  state[SOAP] = (3 * extent * MOLAR_MASS.soap) / 1000;
  state[GLYCEROL] = (extent * MOLAR_MASS.glycerol) / 1000;
  state[FAT_LEFT] = ((fat - extent) * MOLAR_MASS.fat) / 1000;
  state[HYDROXIDE_LEFT] = hydroxide - 3 * extent;
}

/**
 * Making soap — the saponification of a fat: a simplified teaching model. `fatMass` g of
 * glyceryl tristearate is boiled with `hydroxideVolume` mL of sodium hydroxide solution at
 * `hydroxideConcentration` mol/L for `heatingTime` minutes (each shown in `minuteLength` s):
 * C₃H₅(OOCC₁₇H₃₅)₃ + 3NaOH → 3C₁₇H₃₅COONa + C₃H₅(OH)₃. The stoichiometry is exact: the extent ξ
 * cannot pass min(n_fat, n_NaOH/3). How fast it gets there is a stated teaching assumption: a
 * first-order approach, ξ = ξmax·(1 − e^(−k·t)) with `rateConstant` k (per minute) for a boiling,
 * stirred mixture — not a measured rate (a real one depends on the fat, the solvent and the
 * stirring). Soap is weighed as dry sodium stearate after salting out (taken as complete).
 *
 * Variables: `minutes` heated, `extent` ξ (mmol), `soap` and `glycerol` formed (g), `fatLeft`
 * (g) and `hydroxideLeft` (mmol).
 */
export const saponificationModel: SimulationModel = {
  id: 'chemistry.saponification',
  inputs: [
    'fatMass',
    'hydroxideVolume',
    'hydroxideConcentration',
    'heatingTime',
    'rateConstant',
    'minuteLength',
  ],
  variables: ['minutes', 'extent', 'soap', 'glycerol', 'fatLeft', 'hydroxideLeft'],
  predictions: ['soap', 'glycerol', 'fatLeft', 'hydroxideLeft', 'maximumSoap', 'yield'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, 0, inputs);
  },

  step(state, dt, inputs) {
    const end = inputs.heatingTime ?? NaN;
    const minutes = state[MINUTES] ?? 0;
    if (!(minutes < end)) return 0;
    const per = inputs.minuteLength ?? NaN;
    const m = Math.min(dt / per, end - minutes);
    derive(state, minutes + m, inputs);
    return m * per;
  },

  isComplete: (state, inputs) => (state[MINUTES] ?? 0) >= (inputs.heatingTime ?? NaN),

  /** The masses at the end of heating, the soap complete reaction would give, and the yield (%). */
  predict(inputs) {
    refuseInvalid(inputs);
    const state = new Float64Array(6);
    derive(state, inputs.heatingTime ?? NaN, inputs);
    const [, , most] = amounts(inputs);
    const maximum = (3 * most * MOLAR_MASS.soap) / 1000;
    return {
      soap: state[SOAP] ?? NaN,
      glycerol: state[GLYCEROL] ?? NaN,
      fatLeft: state[FAT_LEFT] ?? NaN,
      hydroxideLeft: state[HYDROXIDE_LEFT] ?? NaN,
      maximumSoap: maximum,
      yield: (100 * (state[SOAP] ?? NaN)) / maximum,
    };
  },
};
