import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const VOLUME = 0;
const SATURATION = 1;
const PRODUCT = 2;
const AMOUNT = 3;
const MASS = 4;
const PERCENT = 5;
const SLOTS = 6;

/** A sparingly soluble salt CationₐAnion_b and how it looks when it comes out of solution. */
export interface Precipitate {
  readonly formula: string;
  readonly name: string;
  /** Its colour as a school lab describes it, and an sRGB colour for drawing it (views only). */
  readonly colour: string;
  readonly rgb: number;
  readonly cation: string;
  readonly a: number;
  readonly anion: string;
  readonly b: number;
  /** Solubility product at 25 °C, (mol/L)^(a + b). */
  readonly ksp: number;
  /** g/mol, from the IUPAC standard atomic weights (abridged, 2021). */
  readonly molarMass: number;
}

/**
 * The finite registry of precipitates the station can form: never an arbitrary combination.
 * Ksp at 25 °C from the CRC Handbook of Chemistry and Physics, 84th ed. (2004), "Solubility
 * Product Constants", except Cu(OH)₂, which that table does not list: 2.2·10⁻²⁰ (Dean's
 * Analytical Chemistry Handbook, Patnaik, 2nd ed.; other tables give 1–5·10⁻²⁰, a spread that
 * changes no result shown here). The colours are those school qualitative analysis teaches.
 * Hydroxides are gels of variable water content: their mass here is that of the formula.
 */
export const PRECIPITATES: readonly Precipitate[] = [
  {
    formula: 'AgCl',
    name: 'silver chloride',
    colour: 'white',
    rgb: 0xf2f2ee,
    cation: 'Ag+',
    a: 1,
    anion: 'Cl-',
    b: 1,
    ksp: 1.77e-10,
    molarMass: 143.32,
  },
  {
    formula: 'AgBr',
    name: 'silver bromide',
    colour: 'cream',
    rgb: 0xefe5c2,
    cation: 'Ag+',
    a: 1,
    anion: 'Br-',
    b: 1,
    ksp: 5.35e-13,
    molarMass: 187.77,
  },
  {
    formula: 'AgI',
    name: 'silver iodide',
    colour: 'yellow',
    rgb: 0xecd96a,
    cation: 'Ag+',
    a: 1,
    anion: 'I-',
    b: 1,
    ksp: 8.52e-17,
    molarMass: 234.77,
  },
  {
    formula: 'BaSO4',
    name: 'barium sulfate',
    colour: 'white',
    rgb: 0xf6f6f4,
    cation: 'Ba2+',
    a: 1,
    anion: 'SO4 2-',
    b: 1,
    ksp: 1.08e-10,
    molarMass: 233.38,
  },
  {
    formula: 'Ag2SO4',
    name: 'silver sulfate',
    colour: 'white',
    rgb: 0xf3f3f1,
    cation: 'Ag+',
    a: 2,
    anion: 'SO4 2-',
    b: 1,
    ksp: 1.2e-5,
    molarMass: 311.79,
  },
  {
    formula: 'Cu(OH)2',
    name: 'copper(II) hydroxide',
    colour: 'pale blue',
    rgb: 0x78b4dc,
    cation: 'Cu2+',
    a: 1,
    anion: 'OH-',
    b: 2,
    ksp: 2.2e-20,
    molarMass: 97.56,
  },
  {
    formula: 'Fe(OH)3',
    name: 'iron(III) hydroxide',
    colour: 'red-brown',
    rgb: 0x9a4a1c,
    cation: 'Fe3+',
    a: 1,
    anion: 'OH-',
    b: 3,
    ksp: 2.79e-39,
    molarMass: 106.87,
  },
];

/** A solution on the rack: its ions per formula unit and, if coloured, its colour (views only). */
export interface Solution {
  readonly formula: string;
  readonly name: string;
  readonly ions: Readonly<Record<string, number>>;
  /** sRGB of the solution at the station's 0.02 mol/L in a boiling tube; null: colourless. */
  readonly rgb: number | null;
}

/** The test solutions, by their `sample` code. Water is the blank: it holds no ions to test. */
export const SAMPLES: readonly Solution[] = [
  { formula: 'NaCl', name: 'sodium chloride', ions: { 'Na+': 1, 'Cl-': 1 }, rgb: null },
  { formula: 'KBr', name: 'potassium bromide', ions: { 'K+': 1, 'Br-': 1 }, rgb: null },
  { formula: 'KI', name: 'potassium iodide', ions: { 'K+': 1, 'I-': 1 }, rgb: null },
  { formula: 'Na2SO4', name: 'sodium sulfate', ions: { 'Na+': 2, 'SO4 2-': 1 }, rgb: null },
  {
    formula: 'CuSO4',
    name: 'copper(II) sulfate',
    ions: { 'Cu2+': 1, 'SO4 2-': 1 },
    rgb: 0xd2e8f6,
  },
  { formula: 'FeCl3', name: 'iron(III) chloride', ions: { 'Fe3+': 1, 'Cl-': 3 }, rgb: 0xf2e09a },
  { formula: 'H2O', name: 'deionised water (blank)', ions: {}, rgb: null },
];

/** The test reagents, by their `reagent` code: all colourless. */
export const REAGENTS: readonly Solution[] = [
  { formula: 'AgNO3', name: 'silver nitrate', ions: { 'Ag+': 1, 'NO3-': 1 }, rgb: null },
  { formula: 'Ba(NO3)2', name: 'barium nitrate', ions: { 'Ba2+': 1, 'NO3-': 2 }, rgb: null },
  { formula: 'NaOH', name: 'sodium hydroxide', ions: { 'Na+': 1, 'OH-': 1 }, rgb: null },
];

/**
 * The reaction registry, [sample][reagent] → index in `PRECIPITATES`, or −1 where no sparingly
 * soluble salt can form: every other ion pair of these solutions is soluble (salts of Na⁺, K⁺
 * and NO₃⁻; BaCl₂, BaBr₂, BaI₂; CuSO₄, FeCl₃). No sample is reduced or oxidised by a reagent
 * (iron(II), which silver ions oxidise, is left out for that reason). Ag₂SO₄ is the one salt
 * soluble enough for Ksp to decide: at the station's concentrations it never forms.
 */
export const REACTIONS: readonly (readonly number[])[] = [
  [0, -1, -1], // NaCl: AgCl
  [1, -1, -1], // KBr: AgBr
  [2, -1, -1], // KI: AgI
  [4, 3, -1], // Na2SO4: Ag2SO4 (only above its Ksp), BaSO4
  [4, 3, 5], // CuSO4: Ag2SO4 (only above its Ksp), BaSO4, Cu(OH)2
  [0, -1, 6], // FeCl3: AgCl, Fe(OH)3
  [-1, -1, -1], // water: nothing
];

/** One registered reaction, with the stoichiometry the run needs. */
interface Pair {
  /** Its `product` code: the precipitate's index + 1 (0 is "no precipitate"). */
  readonly code: number;
  readonly precipitate: Precipitate;
  /** Ions of the precipitating kind per formula unit of the sample and of the reagent. */
  readonly kS: number;
  readonly kR: number;
  /** Coefficients of the sample's ion and of the reagent's ion in the precipitate's formula. */
  readonly s: number;
  readonly r: number;
  readonly lnKsp: number;
}

/** The registry checked and resolved once, when the module loads. */
const PAIRS: readonly (readonly (Pair | null)[])[] = REACTIONS.map((row, i) =>
  row.map((index, j) => {
    if (index < 0) return null;
    const p = PRECIPITATES[index];
    const sample = SAMPLES[i];
    const reagent = REAGENTS[j];
    if (!p || !sample || !reagent)
      throw new Error(`Precipitation registry: bad entry [${i}][${j}]`);
    const sampleCation = sample.ions[p.cation] !== undefined;
    const [sampleIon, reagentIon, s, r] = sampleCation
      ? [p.cation, p.anion, p.a, p.b]
      : [p.anion, p.cation, p.b, p.a];
    const kS = sample.ions[sampleIon];
    const kR = reagent.ions[reagentIon];
    if (kS === undefined || kR === undefined) {
      throw new Error(`Precipitation registry: ${p.formula} cannot form from [${i}][${j}]`);
    }
    return { code: index + 1, precipitate: p, kS, kR, s, r, lnKsp: Math.log(p.ksp) };
  }),
);

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). Concentrations stop at 0.1 mol/L: the model
 * takes activities as concentrations, which is fair only for dilute solutions. The volumes keep
 * sample and reagent inside a boiling tube.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['sample', (k) => Number.isInteger(k) && k >= 0 && k < SAMPLES.length, codes(SAMPLES)],
  ['reagent', (k) => Number.isInteger(k) && k >= 0 && k < REAGENTS.length, codes(REAGENTS)],
  ['sampleVolume', (v) => v > 0 && v <= 20, 'above 0 and at most 20 mL'],
  ['sampleConcentration', (c) => c > 0 && c <= 0.1, 'above 0 and at most 0.1 mol/L'],
  ['reagentConcentration', (c) => c > 0 && c <= 0.1, 'above 0 and at most 0.1 mol/L'],
  ['reagentVolume', (v) => v > 0 && v <= 30, 'above 0 and at most 30 mL'],
  ['flowRate', (q) => q > 0 && q <= 5, 'above 0 and at most 5 mL/s'],
];

function codes(list: readonly Solution[]): string {
  return `a code from 0 to ${list.length - 1} (${list.map((x) => x.formula).join(', ')})`;
}

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Precipitation input "${id}" is missing`);
    if (!accepts(value)) {
      throw new Error(`Precipitation input "${id}" must be ${rule}, got ${value}`);
    }
  }
}

const pairOf = (inputs: Inputs): Pair | null =>
  PAIRS[inputs.sample ?? NaN]?.[inputs.reagent ?? NaN] ?? null;

/**
 * h(w) = ln(Q/Ksp) of the ions left in solution, u = e^w formula units (mmol) short of
 * precipitating all of the limiting ion: [L] = cL·u/V, [O] = (excess + cO·u)/V. It rises with w.
 */
function saturationLog(
  w: number,
  cL: number,
  cO: number,
  excess: number,
  lnV: number,
  lnK: number,
) {
  const lnOther =
    excess > 0 ? Math.log(excess) + Math.log1p((cO * Math.exp(w)) / excess) : Math.log(cO) + w;
  return cL * (Math.log(cL) + w - lnV) + cO * (lnOther - lnV) - lnK;
}

/**
 * The amount precipitated (mmol of formula units) once Q > Ksp: the root of
 * [S]^s·[R]^r = Ksp, solved for what stays dissolved of the limiting ion so that a remainder of
 * 1e-15 of it keeps its digits. Bisection on ln u between a bound where Q < Ksp and full
 * dissolution; fixed and deterministic, it stops when the interval reaches double precision.
 */
function precipitated(pair: Pair, nS: number, nR: number, volume: number): number {
  const xiS = nS / pair.s;
  const xiR = nR / pair.r;
  const sampleLimits = xiS <= xiR;
  const uMax = sampleLimits ? xiS : xiR;
  const cL = sampleLimits ? pair.s : pair.r;
  const cO = sampleLimits ? pair.r : pair.s;
  const nOther = sampleLimits ? nR : nS;
  // The other ion left over when all of the limiting one is in the salt; ≥ 0 but for rounding.
  const excess = Math.max(0, nOther - cO * uMax);
  const lnV = Math.log(volume);
  // h(w) ≤ cL·(ln cL + w − ln V) + cO·(ln n_other − ln V) − ln Ksp, so h(lo) ≤ −cL < 0.
  let lo = (pair.lnKsp - cO * (Math.log(nOther) - lnV)) / cL - Math.log(cL) + lnV - 1;
  let hi = Math.log(uMax); // h(hi) = ln(Q₀/Ksp) > 0
  for (let i = 0; i < 400; i++) {
    const mid = 0.5 * (lo + hi);
    if (!(mid > lo && mid < hi)) break;
    if (saturationLog(mid, cL, cO, excess, lnV, pair.lnKsp) > 0) hi = mid;
    else lo = mid;
  }
  return uMax - Math.exp(0.5 * (lo + hi));
}

/** The mixture after `volume` mL of reagent, at equilibrium: written into `state`, nothing made. */
function derive(state: Float64Array, volume: number, inputs: Inputs): void {
  state[VOLUME] = volume;
  state[SATURATION] = 0;
  state[PRODUCT] = 0;
  state[AMOUNT] = 0;
  state[MASS] = 0;
  state[PERCENT] = 0;
  const pair = pairOf(inputs);
  const vs = inputs.sampleVolume ?? NaN;
  const nS = pair ? pair.kS * (inputs.sampleConcentration ?? NaN) * vs : 0; // mmol
  const nR = pair ? pair.kR * (inputs.reagentConcentration ?? NaN) * volume : 0;
  if (!pair || !(nS > 0 && nR > 0)) return; // no salt can form, or no reagent yet: Q = 0
  const total = vs + volume; // mL; mmol/mL is mol/L
  const lnQ = pair.s * Math.log(nS / total) + pair.r * Math.log(nR / total);
  if (!(lnQ > pair.lnKsp)) {
    state[SATURATION] = Math.exp(lnQ - pair.lnKsp); // unsaturated: nothing comes out
    return;
  }
  const n = precipitated(pair, nS, nR, total);
  state[SATURATION] = 1; // a solid in equilibrium with its solution: Q = Ksp
  state[PRODUCT] = pair.code;
  state[AMOUNT] = n;
  state[MASS] = (n * pair.precipitate.molarMass) / 1000;
  state[PERCENT] = (100 * pair.s * n) / nS;
}

/**
 * Precipitation tests for ions — a simplified teaching model of qualitative analysis, from a
 * finite registry (`REACTIONS`), never an arbitrary combination. Wet-lab units (CLAUDE.md):
 * volumes in mL, concentrations in mol/L, amounts in mmol, mass in g, time in s.
 *
 * A volume `sampleVolume` of the test solution (`sample`, concentration `sampleConcentration`)
 * stands in a tube; `reagentVolume` of the test reagent (`reagent`, `reagentConcentration`) runs
 * in at `flowRate` (mL/s) while the tube is swirled. At every volume V added the mixture is taken
 * as mixed and at equilibrium (no supersaturation, no slow nucleation), with activities equal to
 * concentrations and volumes adding. The pair's salt S_sR_r (sample ion S, reagent ion R) forms
 * only once the ion product of the mixed solution, Q = [S]^s·[R]^r with every ion still
 * dissolved, exceeds Ksp; it then precipitates until the ions left satisfy [S]^s·[R]^r = Ksp
 * (`precipitated`), so the state at each V is exact and the step size changes only where samples
 * fall. A pair with no salt in the registry forms nothing. Water's own H⁺/OH⁻, the metal ions'
 * hydrolysis (acidic Fe³⁺), basic salts, complexes and ion pairs are left out. Ideal activities
 * matter only near a salt's solubility, here Ag₂SO₄: with Davies activity coefficients its Q/Ksp
 * is about 3× lower (our estimate), so above ~0.03 mol/L sulfate the ideal model can show
 * Ag₂SO₄ where a real tube stays clear; the station's 0.02 mol/L keeps both below 1.
 *
 * Variables: `volumeAdded` V (mL); `saturation` Ω = Q/Ksp of the ions in solution (1 while solid
 * is present, 0 where no salt can form); `product`, the precipitate's code (index in
 * `PRECIPITATES` + 1; 0 none); `precipitateAmount` n (mmol of formula units), `precipitateMass`
 * n·M (g) and `precipitatedPercent`, the share of the sample's precipitating ion in the solid (%).
 */
export const precipitationModel: SimulationModel = {
  id: 'chemistry.precipitation',
  inputs: [
    'sample',
    'reagent',
    'sampleVolume',
    'sampleConcentration',
    'reagentConcentration',
    'reagentVolume',
    'flowRate',
  ],
  variables: [
    'volumeAdded',
    'saturation',
    'product',
    'precipitateAmount',
    'precipitateMass',
    'precipitatedPercent',
  ],
  predictions: [
    'product',
    'saturation',
    'amount',
    'mass',
    'precipitatedPercent',
    'equivalenceVolume',
    'amountSlope',
    'amountIntercept',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, 0, inputs);
  },

  step(state, dt, inputs) {
    const end = inputs.reagentVolume ?? NaN;
    const flow = inputs.flowRate ?? NaN;
    const volume = state[VOLUME] ?? 0;
    if (!(volume < end)) return 0; // all the reagent is in
    const reached = volume + flow * dt >= end;
    derive(state, reached ? end : volume + flow * dt, inputs);
    return reached ? (end - volume) / flow : dt;
  },

  isComplete: (state, inputs) => (state[VOLUME] ?? 0) >= (inputs.reagentVolume ?? NaN),

  /**
   * The theory, in closed form or by the same equilibrium at V = `reagentVolume`: the product's
   * code, Ω, n, m and the percent precipitated then; the equivalence volume, the reagent that
   * holds exactly the salt's share of R for all of the sample's S, (r/s)·k_S·c_s·V_s/(k_R·c_r)
   * (0 where no salt can form); and, for n against V_s at these settings, the line of complete
   * precipitation of the limiting ion: slope k_S·c_s/s and intercept 0 while the sample's ion
   * limits, slope 0 and intercept k_R·c_r·V_r/r while the reagent's does, both 0 with no
   * precipitate. The run's points fall below that line only by what Ksp leaves dissolved.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const pair = pairOf(inputs);
    const state = new Float64Array(SLOTS);
    derive(state, inputs.reagentVolume ?? NaN, inputs);
    const cs = inputs.sampleConcentration ?? NaN;
    const cr = inputs.reagentConcentration ?? NaN;
    const nS = pair ? pair.kS * cs * (inputs.sampleVolume ?? NaN) : 0;
    const nR = pair ? pair.kR * cr * (inputs.reagentVolume ?? NaN) : 0;
    const formed = (state[AMOUNT] ?? 0) > 0;
    const sampleLimits = pair !== null && nS / pair.s <= nR / pair.r;
    return {
      product: state[PRODUCT] ?? NaN,
      saturation: state[SATURATION] ?? NaN,
      amount: state[AMOUNT] ?? NaN,
      mass: state[MASS] ?? NaN,
      precipitatedPercent: state[PERCENT] ?? NaN,
      equivalenceVolume: pair && nS > 0 ? (pair.r * nS) / (pair.s * pair.kR * cr) : 0,
      amountSlope: pair && formed && sampleLimits ? (pair.kS * cs) / pair.s : 0,
      amountIntercept: pair && formed && !sampleLimits ? nR / pair.r : 0,
    };
  },
};
