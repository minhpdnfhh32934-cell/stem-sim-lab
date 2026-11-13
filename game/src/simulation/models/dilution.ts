import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const VOLUME = 0;
const WATER_ADDED = 1;
const CONCENTRATION = 2;
const AMOUNT = 3;
const ABSORBANCE = 4;
const DILUTION_FACTOR = 5;
const VOLUME_RATIO = 6;

/** mL in a litre: n (mol) = C (mol/L)·V (mL)/1000. */
const ML_PER_L = 1000;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). No stock a lab keeps is above 20 mol/L
 * (concentrated sulfuric acid is about 18 mol/L); the other upper limits only keep the arithmetic
 * finite, the optical ones as in `kinetics.ts`.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['stockConcentration', (c) => c > 0 && c <= 20, 'above 0 and at most 20 mol/L'],
  ['stockVolume', (v) => v > 0 && v <= 1e4, 'above 0 and at most 1e4 mL'],
  ['finalVolume', (v) => v > 0 && v <= 1e4, 'above 0 and at most 1e4 mL'],
  ['fillTime', (t) => t > 0 && t <= 1e4, 'above 0 and at most 1e4 s'],
  ['absorptivity', (e) => e > 0 && e <= 1e9, 'above 0 and at most 1e9 L/(mol·m)'],
  ['pathLength', (l) => l > 0 && l <= 1, 'above 0 and at most 1 m'],
];
/**
 * The colorimeter's linear range, as in `kinetics.ts`: beyond about A = 2 its reading and
 * Beer–Lambert's straight line both fail; below about 0.001 there is nothing left to read.
 */
const MAX_ABSORBANCE = 2;
const MIN_ABSORBANCE = 1e-3;

/** C₂ = C₁·V₁/V₂ (mol/L): the dye's amount C₁·V₁ spread through the final volume. */
const finalConcentration = (inputs: Inputs) =>
  ((inputs.stockConcentration ?? NaN) * (inputs.stockVolume ?? NaN)) / (inputs.finalVolume ?? NaN);

/** ε·l (L/mol): the absorbance per mol/L of dye in the colorimeter's cell (Beer–Lambert). */
const absorbanceSlope = (inputs: Inputs) =>
  (inputs.absorptivity ?? NaN) * (inputs.pathLength ?? NaN);

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Dilution input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Dilution input "${id}" must be ${rule}, got ${value}`);
  }
  const v1 = inputs.stockVolume ?? NaN;
  const v2 = inputs.finalVolume ?? NaN;
  if (!(v2 > v1)) {
    throw new Error(
      `Dilution: the final volume V₂ (${v2} mL) must be larger than the stock volume V₁ ` +
        `(${v1} mL): diluting only adds solvent, so use a larger flask or a smaller pipette`,
    );
  }
  const a = absorbanceSlope(inputs) * finalConcentration(inputs);
  if (!(a <= MAX_ABSORBANCE)) {
    throw new Error(
      `Dilution: the diluted solution's absorbance ${a} is above ${MAX_ABSORBANCE}, outside the ` +
        "colorimeter's and Beer–Lambert's linear range: dilute more",
    );
  }
  if (!(a >= MIN_ABSORBANCE)) {
    throw new Error(
      `Dilution: the diluted solution's absorbance ${a} is below ${MIN_ABSORBANCE}, too faint ` +
        'for a colorimeter to read: use more stock or a smaller flask',
    );
  }
}

/** Values that follow from the volume V (mL) of solution in the flask. */
function derive(state: Float64Array, inputs: Inputs, volume: number): void {
  const v1 = inputs.stockVolume ?? NaN;
  const c = ((inputs.stockConcentration ?? NaN) * v1) / volume;
  state[VOLUME] = volume;
  state[WATER_ADDED] = volume - v1;
  state[CONCENTRATION] = c;
  state[AMOUNT] = (c * volume) / ML_PER_L;
  state[ABSORBANCE] = absorbanceSlope(inputs) * c;
  state[DILUTION_FACTOR] = volume / v1;
  state[VOLUME_RATIO] = v1 / volume;
}

/**
 * Diluting a stock solution in a volumetric flask, and reading the result in a colorimeter: a
 * simplified teaching model. Chemistry's units (CLAUDE.md): volumes in mL, concentrations in
 * mol/L, so the amount n = C·V/1000 is in mol; ε in L/(mol·m), the cell's path l in m (as
 * `kinetics.ts`), time in s.
 *
 * A volumetric pipette delivers V₁ of the stock (concentration C₁) into the flask and solvent is
 * added up to the mark, V₂. Solvent adds volume, not solute, so the amount n = C₁·V₁ stays the same
 * (conservation of the solute): C₂·V₂ = C₁·V₁, C₂ = C₁·V₁/V₂, the dilution factor is V₂/V₁. The
 * solvent flows in at the steady rate (V₂ − V₁)/t_fill (`fillTime`, the same for every flask) and
 * the solution is taken as mixed at every moment, so at a volume V the concentration is C₁·V₁/V:
 * it falls as 1/V. In the lab the flask is stoppered and inverted to mix only once it is at the
 * mark; neither the rate nor when it is mixed changes C₂ — a dilution has no kinetics. The solvent
 * added is V − V₁, volumes taken as additive (very nearly so in dilute solution); C₂ does not rest
 * on that, as the flask is filled to its mark whatever the volume does on mixing.
 *
 * The colorimeter then reads a sample in a cell of path l: by Beer–Lambert A = ε·l·C, the solvent
 * absorbing nothing. `absorbance` is that ideal value for the mixed solution at every moment; the
 * colorimeter reads it once, at the end, and a run whose A₂ the colorimeter cannot read (above 2 or
 * below 0.001, as `kinetics.ts`) is refused with its reason, as are a final volume not larger than
 * V₁ and inputs outside the domain — never clamped. The volume rises linearly with time, so each
 * step is exact; the last step lands on the mark, taking only the time it needs.
 *
 * Variables: `volume` V of solution in the flask (mL), `waterAdded` V − V₁ (mL), `concentration`
 * C = C₁·V₁/V (mol/L), `amount` C·V/1000 of solute (mol; constant), `absorbance` ε·l·C,
 * `dilutionFactor` V/V₁ and `volumeRatio` V₁/V, the fraction of the solution that is stock.
 */
export const dilutionModel: SimulationModel = {
  id: 'chemistry.dilution',
  inputs: DOMAIN.map(([id]) => id),
  variables: [
    'volume',
    'waterAdded',
    'concentration',
    'amount',
    'absorbance',
    'dilutionFactor',
    'volumeRatio',
  ],
  predictions: [
    'finalConcentration',
    'absorbance',
    'dilutionFactor',
    'volumeRatio',
    'waterAdded',
    'amount',
    'stockConcentration',
    'absorbanceSlope',
    'finalVolume',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, inputs, inputs.stockVolume ?? NaN);
  },

  step(state, dt, inputs) {
    const volume = state[VOLUME] ?? NaN;
    const v1 = inputs.stockVolume ?? NaN;
    const v2 = inputs.finalVolume ?? NaN;
    if (!(volume < v2)) return 0; // at the mark: nothing more is added
    const rate = (v2 - v1) / (inputs.fillTime ?? NaN);
    const reached = rate * dt >= v2 - volume;
    derive(state, inputs, reached ? v2 : volume + rate * dt);
    return reached ? (v2 - volume) / rate : dt;
  },

  isComplete: (state, inputs) => (state[VOLUME] ?? 0) >= (inputs.finalVolume ?? NaN),

  /**
   * Driven by the volume V (mL) of solution in the flask, as the player adds water in a physical
   * lab: the same `derive` as a step, so at V₂ the state is the theory's. `fillTime` is not used.
   * V is refused below V₁ (less than the stock the flask holds) and past the mark V₂ (filling past
   * it is not modelled); the run ends exactly at the mark.
   */
  driven: {
    variable: 'volume',
    set(state, inputs, volume) {
      const v1 = inputs.stockVolume ?? NaN;
      const v2 = inputs.finalVolume ?? NaN;
      if (!(volume >= v1 && volume <= v2)) {
        throw new Error(`Dilution: V = ${volume} mL is outside V₁…V₂ (${v1}–${v2} mL)`);
      }
      derive(state, inputs, volume);
      return volume === v2;
    },
  },

  /**
   * The theory, in closed form: C₂ = C₁·V₁/V₂, its absorbance ε·l·C₂, the dilution factor V₂/V₁
   * and its inverse V₁/V₂, the solvent added V₂ − V₁, the amount C₁·V₁/1000 (mol), and for the
   * analyses the slopes of C₂ against V₁/V₂ (C₁) and of A against C₂ (ε·l); V₂, the flask's mark.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const c1 = inputs.stockConcentration ?? NaN;
    const v1 = inputs.stockVolume ?? NaN;
    const v2 = inputs.finalVolume ?? NaN;
    const c2 = finalConcentration(inputs);
    return {
      finalConcentration: c2,
      absorbance: absorbanceSlope(inputs) * c2,
      dilutionFactor: v2 / v1,
      volumeRatio: v1 / v2,
      waterAdded: v2 - v1,
      amount: (c1 * v1) / ML_PER_L,
      stockConcentration: c1,
      absorbanceSlope: absorbanceSlope(inputs),
      finalVolume: v2,
    };
  },
};
