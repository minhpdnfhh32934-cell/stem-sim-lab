import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/** The molar gas constant R = N_A·k_B, J/(mol·K): exact since the 2019 SI (CODATA 2018). */
export const GAS_CONSTANT = 8.31446261815324;
/** 0 °C in kelvin. */
const ZERO_CELSIUS = 273.15;

const CONCENTRATION = 0;
const ABSORBANCE = 1;
const LN_ABSORBANCE = 2;
const EXTENT = 3;
const ELAPSED = 4;
const HALF_TIME = 5;
const OBSERVED_RATE = 6;
const LN_RATE_RATIO = 7;
const INVERSE_TEMPERATURE_SHIFT = 8;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). Temperatures are those of liquid water; the
 * other upper limits only keep the arithmetic finite. `endFraction` must stay below ½, so the
 * half-life is always passed before the run ends.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['initialConcentration', (c) => c > 0 && c <= 1, 'above 0 and at most 1 mol/L'],
  ['naoh', (c) => c > 0 && c <= 10, 'above 0 and at most 10 mol/L'],
  ['temperature', (t) => t >= 0 && t <= 100, 'from 0 to 100 °C'],
  ['referenceTemperature', (t) => t >= 0 && t <= 100, 'from 0 to 100 °C'],
  ['referenceRate', (k) => k > 0 && k <= 1e6, 'above 0 and at most 1e6 L/(mol·s)'],
  ['activationEnergy', (e) => e > 0 && e <= 5e5, 'above 0 and at most 5e5 J/mol'],
  ['absorptivity', (e) => e > 0 && e <= 1e9, 'above 0 and at most 1e9 L/(mol·m)'],
  ['pathLength', (l) => l > 0 && l <= 1, 'above 0 and at most 1 m'],
  ['endFraction', (f) => f > 0 && f < 0.5, 'above 0 and below 0.5'],
];
/** Pseudo-first order needs the hydroxide in excess: it changes by < 1 % of itself over a run. */
const MIN_EXCESS = 100;
/**
 * Beyond about A = 1–2 a school colorimeter's reading and Beer–Lambert's straight line both fail
 * (the station's dye dial stops at A₀ = 1); below about A = 0.001 there is nothing left to read.
 */
const MAX_ABSORBANCE = 2;
const MIN_ABSORBANCE = 1e-3;

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Kinetics input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Kinetics input "${id}" must be ${rule}, got ${value}`);
  }
  const c0 = inputs.initialConcentration ?? NaN;
  const oh = inputs.naoh ?? NaN;
  if (!(oh >= MIN_EXCESS * c0)) {
    throw new Error(
      `Kinetics: NaOH (${oh} mol/L) must be at least ${MIN_EXCESS}× the dye (${c0} mol/L) ` +
        'for the reaction to be pseudo-first order',
    );
  }
  const a0 = initialAbsorbance(inputs);
  if (!(a0 <= MAX_ABSORBANCE)) {
    throw new Error(
      `Kinetics: the starting absorbance ${a0} is above ${MAX_ABSORBANCE}, ` +
        "outside the colorimeter's and Beer–Lambert's linear range: dilute the dye",
    );
  }
  // Also keeps A and ln A finite: the trace never falls below f·A₀.
  const end = a0 * (inputs.endFraction ?? NaN);
  if (!(end >= MIN_ABSORBANCE)) {
    throw new Error(
      `Kinetics: the absorbance at the end, ${end}, is below ${MIN_ABSORBANCE}, too faint for ` +
        'a colorimeter to read: use more dye or end the run earlier',
    );
  }
}

/** A₀ = ε·l·c₀ (Beer–Lambert). */
const initialAbsorbance = (inputs: Inputs) =>
  (inputs.absorptivity ?? NaN) * (inputs.pathLength ?? NaN) * (inputs.initialConcentration ?? NaN);

/** Eₐ/R (K): the Arrhenius temperature, the slope of ln k against −1/T. */
const activationTemperature = (inputs: Inputs) => (inputs.activationEnergy ?? NaN) / GAS_CONSTANT;

/** 1/T_ref − 1/T (1/K), with both temperatures in kelvin. */
const inverseTemperatureShift = (inputs: Inputs) =>
  1 / ((inputs.referenceTemperature ?? NaN) + ZERO_CELSIUS) -
  1 / ((inputs.temperature ?? NaN) + ZERO_CELSIUS);

/** k(T) = k_ref·exp((Eₐ/R)·(1/T_ref − 1/T)), L/(mol·s): Arrhenius, from the reference rate. */
export const secondOrderRate = (inputs: Inputs) =>
  (inputs.referenceRate ?? NaN) *
  Math.exp(activationTemperature(inputs) * inverseTemperatureShift(inputs));

/** k′ = k(T)·[OH⁻]₀ (1/s), the pseudo-first-order rate constant of the dye. */
const pseudoRate = (inputs: Inputs) => secondOrderRate(inputs) * (inputs.naoh ?? NaN);

/** The time the run lasts, t_end = ln(1/f)/k′: the dye has faded to `endFraction` f of c₀. */
const endTime = (inputs: Inputs) => -Math.log(inputs.endFraction ?? NaN) / pseudoRate(inputs);

/** Values that follow from the dye's concentration c and the time t since mixing. */
function derive(state: Float64Array, inputs: Inputs, c: number, t: number): void {
  const c0 = inputs.initialConcentration ?? NaN;
  const a0 = initialAbsorbance(inputs);
  const a = a0 * (c / c0);
  state[CONCENTRATION] = c;
  state[ABSORBANCE] = a;
  state[LN_ABSORBANCE] = Math.log(a);
  state[EXTENT] = 1 - c / c0;
  state[ELAPSED] = t;
  // From the absorbance trace itself: the two-point slope of ln A, −(ln A − ln A₀)/t.
  const observed = t > 0 ? Math.log(a0 / a) / t : 0;
  state[OBSERVED_RATE] = observed;
  state[LN_RATE_RATIO] =
    observed > 0 ? Math.log(observed / ((inputs.naoh ?? NaN) * (inputs.referenceRate ?? NaN))) : 0;
  state[INVERSE_TEMPERATURE_SHIFT] = inverseTemperatureShift(inputs);
}

/**
 * A simplified teaching model of reaction rate: crystal violet (CV⁺, violet) fading in excess
 * sodium hydroxide, CV⁺ + OH⁻ → CVOH (colourless), followed by a colorimeter at about 590 nm. Not
 * lab-grade: its constants are approximate literature values, and a real run also depends on the
 * ionic strength, the dye's purity and the colorimeter. Chemistry's units (CLAUDE.md):
 * concentrations in mol/L, temperatures entered in °C (kelvin inside), time in s, the path length
 * in m and the molar absorptivity in L/(mol·m); absorbance and ln A have no unit.
 *
 * Rate law: −d[CV⁺]/dt = k·[CV⁺]·[OH⁻], first order in each. With [OH⁻] at least 100× the dye it
 * stays constant within 1 %, and is taken as constant: −d[CV⁺]/dt = k′·[CV⁺], k′ = k·[OH⁻]₀
 * (pseudo-first order), so c(t) = c₀·e^(−k′t) and ln A = ln A₀ − k′t, a straight line of slope
 * −k′; the half-life ln 2/k′ does not depend on c₀. Beer–Lambert: A = ε·l·c, the product CVOH and
 * the solution absorbing nothing. Arrhenius: k(T) = k_ref·exp((Eₐ/R)(1/T_ref − 1/T)), the
 * pre-exponential factor taken as independent of T.
 *
 * The concentration comes in closed form from the time since mixing, so the step size changes
 * where samples fall, never the curve. The run ends by itself when the dye has faded to
 * `endFraction` of c₀; the last step takes only the time it needs. Inputs outside the model's
 * domain, an [OH⁻] less than 100× c₀, A₀ above 2 or an
 * end absorbance f·A₀ below 0.001 are refused with the reason, never clamped.
 *
 * Variables: `concentration` c of the dye (mol/L), `absorbance` A, `lnAbsorbance` ln A, `extent`
 * 1 − c/c₀ (the fraction of the dye that has reacted), `elapsed` t (s, the model's own clock),
 * `halfTime` (s; 0 until A falls to A₀/2, then the time it did: interpolated on ln A within the
 * step, exact for an exponential), `observedRate` ln(A₀/A)/t (1/s; 0 at t = 0, never 0/0) — the
 * k′ the trace gives — `lnRateRatio` ln(k_obs/k_ref), k_obs = observedRate/[OH⁻] (0 at t = 0), and
 * `inverseTemperatureShift` 1/T_ref − 1/T (1/K), the two Arrhenius axes.
 */
export const kineticsModel: SimulationModel = {
  id: 'chemistry.first-order-kinetics',
  inputs: DOMAIN.map(([id]) => id),
  variables: [
    'concentration',
    'absorbance',
    'lnAbsorbance',
    'extent',
    'elapsed',
    'halfTime',
    'observedRate',
    'lnRateRatio',
    'inverseTemperatureShift',
  ],
  predictions: [
    'rateConstant',
    'secondOrderRate',
    'halfLife',
    'endTime',
    'initialAbsorbance',
    'finalAbsorbance',
    'finalConcentration',
    'activationTemperature',
    'lnRateRatio',
    'inverseTemperatureShift',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, inputs, inputs.initialConcentration ?? NaN, 0);
  },

  step(state, dt, inputs) {
    const t = state[ELAPSED] ?? 0;
    const end = endTime(inputs);
    if (!(t < end)) return 0; // faded to the end fraction: the run is over
    const reached = dt >= end - t;
    const next = reached ? end : t + dt;
    const c0 = inputs.initialConcentration ?? NaN;
    const before = state[ABSORBANCE] ?? NaN;
    // At the end exactly f·c₀, not e^(−k′·t_end)·c₀ with its rounding.
    derive(
      state,
      inputs,
      reached ? c0 * (inputs.endFraction ?? NaN) : c0 * Math.exp(-pseudoRate(inputs) * next),
      next,
    );
    const after = state[ABSORBANCE] ?? NaN;
    const half = initialAbsorbance(inputs) / 2;
    if (state[HALF_TIME] === 0 && after <= half) {
      state[HALF_TIME] = t + ((next - t) * Math.log(before / half)) / Math.log(before / after);
    }
    return next - t;
  },

  isComplete: (state, inputs) => (state[ELAPSED] ?? 0) >= endTime(inputs),

  /**
   * The theory, in closed form: k′ = k(T)·[OH⁻]₀ and k(T) (Arrhenius), t½ = ln 2/k′, the run's
   * length ln(1/f)/k′, A₀ = ε·l·c₀, the end values f·A₀ and f·c₀, Eₐ/R (the slope of
   * ln(k/k_ref) against 1/T_ref − 1/T), and those two Arrhenius values for this temperature.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const f = inputs.endFraction ?? NaN;
    const k = pseudoRate(inputs);
    const a0 = initialAbsorbance(inputs);
    return {
      rateConstant: k,
      secondOrderRate: secondOrderRate(inputs),
      halfLife: Math.LN2 / k,
      endTime: endTime(inputs),
      initialAbsorbance: a0,
      finalAbsorbance: f * a0,
      finalConcentration: f * (inputs.initialConcentration ?? NaN),
      activationTemperature: activationTemperature(inputs),
      lnRateRatio: activationTemperature(inputs) * inverseTemperatureShift(inputs),
      inverseTemperatureShift: inverseTemperatureShift(inputs),
    };
  },
};
