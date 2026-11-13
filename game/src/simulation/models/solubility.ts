import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const LAB_TIME = 0;
const CONCENTRATION = 1;
const DISSOLVED = 2;
const UNDISSOLVED = 3;
const SATURATION = 4;
const SOLUBILITY = 5;

/** The reference table's temperature columns, °C. */
export const TABLE_TEMPERATURES: readonly number[] = [
  0, 10, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100,
];

/**
 * Solubility in water as printed in the CRC Handbook of Chemistry and Physics, 91st ed. (2010),
 * "Aqueous Solubility of Inorganic Compounds at Various Temperatures", pp. 8-112 to 8-117: the
 * mass percent of solute 100·w₂ = 100·m₂/(m₁ + m₂) of the solution saturated with the stable
 * solid, at each of TABLE_TEMPERATURES. The handbook cites Söhnel and Novotný, Densities of
 * Aqueous Solutions of Inorganic Substances (1985) for KNO₃ and the IUPAC Solubility Data Series
 * vol. 47 (1991) for NaCl and KCl. Indexed by the `solute` input.
 */
export const SOLUTES: readonly {
  readonly formula: string;
  readonly massPercent: readonly number[];
}[] = [
  {
    formula: 'KNO₃',
    massPercent: [12.0, 17.6, 24.2, 27.7, 31.3, 38.6, 45.7, 52.2, 58.0, 63.0, 67.3, 70.8],
  },
  {
    formula: 'NaCl',
    massPercent: [
      26.28, 26.32, 26.41, 26.45, 26.52, 26.67, 26.84, 27.03, 27.25, 27.5, 27.78, 28.05,
    ],
  },
  {
    formula: 'KCl',
    massPercent: [
      21.74, 23.61, 25.39, 26.22, 27.04, 28.59, 30.04, 31.4, 32.66, 33.86, 34.99, 36.05,
    ],
  },
];

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). Temperatures stay inside the table (liquid
 * water at 1 atm); the other upper limits only keep the arithmetic finite.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['solute', (s) => s === 0 || s === 1 || s === 2, '0 (KNO₃), 1 (NaCl) or 2 (KCl)'],
  ['temperature', (t) => t >= 0 && t <= 100, 'from 0 to 100 °C, the reference table’s range'],
  ['soluteMass', (m) => m > 0 && m <= 1e4, 'above 0 and at most 1e4 g'],
  ['waterMass', (m) => m > 0 && m <= 1e4, 'above 0 and at most 1e4 g'],
  ['timeConstant', (t) => t > 0 && t <= 1e6, 'above 0 and at most 1e6 s'],
  ['stirTime', (t) => t > 0 && t <= 1e6, 'above 0 and at most 1e6 s'],
  ['timeLapse', (k) => k >= 1 && k <= 1e4, 'from 1 to 1e4'],
];

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Solubility input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Solubility input "${id}" must be ${rule}, got ${value}`);
  }
}

/**
 * The solubility S (g of solute per 100 g of water) of solute `solute` at `temperature` °C: the
 * table's mass percent w, interpolated linearly between its columns (exact at them), converted as
 * the handbook does, S = 100·w/(100 − w). NaN outside the table.
 */
export function solubilityAt(solute: number, temperature: number): number {
  const w = SOLUTES[solute]?.massPercent;
  if (!w || !(temperature >= 0 && temperature <= 100)) return NaN;
  let i = 1;
  while (i < TABLE_TEMPERATURES.length - 1 && temperature > (TABLE_TEMPERATURES[i] ?? NaN)) i++;
  const t0 = TABLE_TEMPERATURES[i - 1] ?? NaN;
  const t1 = TABLE_TEMPERATURES[i] ?? NaN;
  const f = (temperature - t0) / (t1 - t0);
  const percent = (w[i - 1] ?? NaN) * (1 - f) + (w[i] ?? NaN) * f; // w0 at f = 0, w1 at f = 1
  return (100 * percent) / (100 - percent);
}

/** The most solute the water dissolves at the run's temperature, S·m_w/100 (g). */
const saturationMassOf = (inputs: Inputs) =>
  (solubilityAt(inputs.solute ?? NaN, inputs.temperature ?? NaN) * (inputs.waterMass ?? NaN)) / 100;

/** Values that follow from the mass dissolved d (g). */
function derive(state: Float64Array, dissolved: number, inputs: Inputs): void {
  const s = solubilityAt(inputs.solute ?? NaN, inputs.temperature ?? NaN);
  const concentration = (100 * dissolved) / (inputs.waterMass ?? NaN);
  state[DISSOLVED] = dissolved;
  state[UNDISSOLVED] = (inputs.soluteMass ?? NaN) - dissolved; // +0, never −0, once all is gone
  state[CONCENTRATION] = concentration;
  state[SATURATION] = (100 * concentration) / s;
  state[SOLUBILITY] = s;
}

/**
 * Dissolving a weighed solid in water held at a set temperature, until it is all dissolved or the
 * solution is saturated with solid left over: a simplified teaching model. Units as a chemistry
 * lab uses them: masses in g, temperature in °C, concentration and solubility in g of solute per
 * 100 g of water (the solubility's usual school unit), time in s.
 *
 * Equilibrium (reference data): the solubility S at the temperature is the CRC Handbook's (see
 * `SOLUTES`), linearly interpolated between its columns, which every dial preset lies on. A
 * solution in contact with solid can hold at most m_sat = S·m_w/100 of it (m_w: the water).
 *
 * Kinetics (illustrative): the stirred solid dissolves by the Noyes–Whitney law with a constant
 * surface, dd/dt = (m_sat − d)/τ: the rate falls as the solution nears saturation. From d(0) = 0,
 * d(t) = m_sat·(1 − e^(−t/τ)) while solid remains. If m < m_sat the last crystal goes at
 * t_all = −τ·ln(1 − m/m_sat) and the run ends there; otherwise the solution approaches saturation
 * and the run ends after `stirTime`, with m − d left undissolved. τ (`timeConstant`) is one stated
 * teaching value for every solute and temperature: real dissolving speeds up with temperature
 * (faster diffusion), stirring and smaller crystals, and slows as the crystals shrink.
 *
 * Assumed: the hot plate holds the temperature (the heat taken in or given out on dissolving is
 * supplied or removed), no water evaporates, and the solid is the table's stable phase with no
 * supersaturation. Each step advances d by the exact solution over its lab time and lands exactly
 * on t_all and on `stirTime`, so the step size changes where samples fall, never the curve.
 * Time is compressed: `timeLapse` lab seconds per run second; `labTime` is the stirring time.
 *
 * Variables: `labTime` (s of stirring), `concentration` 100·d/m_w (g/100 g), `dissolved` d (g),
 * `undissolved` m − d (g), `saturation` 100·concentration/S (%), `solubility` S (g/100 g).
 */
export const solubilityModel: SimulationModel = {
  id: 'chemistry.solubility',
  inputs: [
    'solute',
    'temperature',
    'soluteMass',
    'waterMass',
    'timeConstant',
    'stirTime',
    'timeLapse',
  ],
  variables: ['labTime', 'concentration', 'dissolved', 'undissolved', 'saturation', 'solubility'],
  predictions: [
    'solubility',
    'saturationMass',
    'finalDissolved',
    'finalResidue',
    'finalConcentration',
    'finalSaturation',
    'residueSlope',
    'residueIntercept',
    'timeConstant',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, 0, inputs);
  },

  step(state, dt, inputs) {
    const stir = inputs.stirTime ?? NaN;
    const lapse = inputs.timeLapse ?? NaN;
    const mass = inputs.soluteMass ?? NaN;
    const tau = inputs.timeConstant ?? NaN;
    const time = state[LAB_TIME] ?? 0;
    const d = state[DISSOLVED] ?? 0;
    if (!(time < stir && d < mass)) return 0; // all dissolved, or the stirring is over
    const saturation = saturationMassOf(inputs);
    const full = lapse * dt;
    const left = stir - time;
    let h = Math.min(full, left);
    // The last crystal dissolves within this step: stop exactly there.
    const toAll = mass < saturation ? tau * Math.log((saturation - d) / (saturation - mass)) : NaN;
    const gone = toAll <= h;
    if (gone) h = toAll;
    state[LAB_TIME] = !gone && h === left ? stir : time + h;
    derive(state, gone ? mass : saturation - (saturation - d) * Math.exp(-h / tau), inputs);
    return h === full ? dt : h / lapse;
  },

  isComplete: (state, inputs) =>
    (state[LAB_TIME] ?? 0) >= (inputs.stirTime ?? NaN) ||
    (state[DISSOLVED] ?? 0) >= (inputs.soluteMass ?? NaN),

  /**
   * The theory, in closed form: S from the table; m_sat = S·m_w/100; after the stirring, the mass
   * dissolved min(m, m_sat·(1 − e^(−t_stir/τ))), the residue m minus it, the concentration and
   * the degree of saturation; and, for the residue against the mass added at one solute and
   * temperature, the line of the runs that leave solid: slope 1 (every gram more stays solid),
   * intercept −m_sat·(1 − e^(−t_stir/τ)), so it crosses 0 g at about m_sat; and τ.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const solubility = solubilityAt(inputs.solute ?? NaN, inputs.temperature ?? NaN);
    const saturationMass = saturationMassOf(inputs);
    const mass = inputs.soluteMass ?? NaN;
    const reached =
      saturationMass * (1 - Math.exp(-(inputs.stirTime ?? NaN) / (inputs.timeConstant ?? NaN)));
    const dissolved = Math.min(mass, reached);
    const concentration = (100 * dissolved) / (inputs.waterMass ?? NaN);
    return {
      solubility,
      saturationMass,
      finalDissolved: dissolved,
      finalResidue: mass - dissolved,
      finalConcentration: concentration,
      finalSaturation: (100 * concentration) / solubility,
      residueSlope: 1,
      residueIntercept: -reached,
      timeConstant: inputs.timeConstant ?? NaN,
    };
  },
};
