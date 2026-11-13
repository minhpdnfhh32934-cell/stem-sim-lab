import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const SUBSTRATE = 0;
const OXYGEN = 1;
const CONVERSION = 2;
const RATE = 3;
const WINDOW_OXYGEN = 4;
const WINDOW_RATE = 5;
const CLOCK = 6;
const ACTIVITY = 7;
const INVERSE_SUBSTRATE = 8;
const INVERSE_WINDOW_RATE = 9;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). Temperatures are those of liquid water; the
 * lower widths keep exp() finite over 0–100 °C and pH 0–14. Neat H₂O₂ is about 42 mol/L
 * (1.44 g/mL ÷ 34.01 g/mol), so no solution is above 40 mol/L.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['substrate', (s) => s > 0 && s <= 40, 'above 0 and at most 40 mol/L'],
  ['temperature', (t) => t >= 0 && t <= 100, 'from 0 to 100 °C'],
  ['pH', (p) => p >= 0 && p <= 14, 'from 0 to 14'],
  ['enzymeVolume', (e) => e > 0 && e <= 1e6, 'above 0 and at most 1e6 mL'],
  ['km', (k) => k > 0 && k <= 1e3, 'above 0 and at most 1000 mol/L'],
  ['specificActivity', (a) => a > 0 && a <= 1e6, 'above 0 and at most 1e6 mol/(L·s) per mL'],
  ['q10', (q) => q > 1 && q <= 10, 'above 1 and at most 10'],
  ['meltTemperature', (t) => t >= 0 && t <= 100, 'from 0 to 100 °C'],
  ['meltWidth', (w) => w >= 0.5 && w <= 20, 'from 0.5 to 20 °C'],
  ['optimumPH', (p) => p >= 0 && p <= 14, 'from 0 to 14'],
  ['pHWidth', (w) => w >= 0.5 && w <= 14, 'from 0.5 to 14'],
  ['mixtureVolume', (v) => v > 0 && v <= 1e6, 'above 0 and at most 1e6 mL'],
  ['molarVolume', (v) => v > 0 && v <= 1e3, 'above 0 and at most 1000 L/mol'],
  ['window', (t) => t > 0 && t <= 1e6, 'above 0 and at most 1e6 s'],
  ['collectionTime', (t) => t > 0 && t <= 1e6, 'above 0 and at most 1e6 s'],
];

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Enzyme input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Enzyme input "${id}" must be ${rule}, got ${value}`);
  }
  if (!(optimumShare(inputs) < 1)) {
    throw new Error(
      'Enzyme inputs have no temperature optimum: meltWidth·ln(q10) must be below 10',
    );
  }
  if (!((inputs.enzymeVolume ?? NaN) <= (inputs.mixtureVolume ?? NaN))) {
    throw new Error('Enzyme input "enzymeVolume" must be at most "mixtureVolume", its part');
  }
  if ((inputs.collectionTime ?? NaN) < (inputs.window ?? NaN)) {
    throw new Error('Enzyme input "collectionTime" must be at least "window"');
  }
  const v0 = initialRateOf(inputs);
  if (!(v0 > 0 && 1 / v0 < Infinity)) {
    throw new Error(`Enzyme activity underflows to ${v0} mol/(L·s): the rate would be 0`);
  }
}

/** s = w·ln(Q₁₀)/10: at the optimum the share of unfolded enzyme, 1/(1 + e^(−(T − Tm)/w)). */
const optimumShare = (inputs: Inputs) =>
  ((inputs.meltWidth ?? NaN) * Math.log(inputs.q10 ?? NaN)) / 10;

/** The temperature (°C) where g(T) peaks: Tm + w·ln(s/(1 − s)). */
export function optimumTemperature(inputs: Inputs): number {
  const s = optimumShare(inputs);
  return (inputs.meltTemperature ?? NaN) + (inputs.meltWidth ?? NaN) * Math.log(s / (1 - s));
}

/** g(T) = Q₁₀^((T − Tm)/10) / (1 + e^((T − Tm)/w)): the speed-up times the folded share. */
function unscaledTemperature(inputs: Inputs, t: number): number {
  const d = t - (inputs.meltTemperature ?? NaN);
  return (inputs.q10 ?? NaN) ** (d / 10) / (1 + Math.exp(d / (inputs.meltWidth ?? NaN)));
}

/** f_T = g(T)/g(T_opt): 1 at the optimum, below it on both sides. */
export const temperatureFactor = (inputs: Inputs): number =>
  unscaledTemperature(inputs, inputs.temperature ?? NaN) /
  unscaledTemperature(inputs, optimumTemperature(inputs));

/** f_pH = exp(−(pH − pH_opt)²/(2σ²)): 1 at the optimum pH. */
export function pHFactor(inputs: Inputs): number {
  const d = (inputs.pH ?? NaN) - (inputs.optimumPH ?? NaN);
  const sigma = inputs.pHWidth ?? NaN;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

/** V_max = a·E·f_T·f_pH (mol/(L·s)). */
export const vmaxOf = (inputs: Inputs): number =>
  (inputs.specificActivity ?? NaN) *
  (inputs.enzymeVolume ?? NaN) *
  temperatureFactor(inputs) *
  pHFactor(inputs);

/** v₀ = V_max·S₀/(K_m + S₀). */
const initialRateOf = (inputs: Inputs) => {
  const s0 = inputs.substrate ?? NaN;
  return (vmaxOf(inputs) * s0) / ((inputs.km ?? NaN) + s0);
};

/**
 * The substrate left after `time` s from `from` mol/L: the root S of the integrated
 * Michaelis–Menten law K_m·ln(S₀/S) + S₀ − S = V_max·t, exact up to rounding. Newton's method on
 * δ = ln(S/S₀): h(δ) = −K_m·δ − S₀·(e^δ − 1) − V_max·t is concave and decreasing, and h(0) ≤ 0, so
 * from δ = 0 the iterates fall monotonically onto the root, quadratically near it; expm1 keeps the
 * digits of a tiny step. The law is autonomous, so stepping by t₁ then t₂ gives the S of t₁ + t₂:
 * no step-size error beyond rounding.
 */
export function substrateAfter(from: number, time: number, vmax: number, km: number): number {
  if (!(from > 0) || time <= 0) return from;
  const target = vmax * time;
  let delta = 0;
  for (let i = 0; i < 100; i++) {
    const grown = Math.expm1(delta);
    const step = (-km * delta - from * grown - target) / (km + from * (1 + grown));
    delta += step;
    if (Math.abs(step) <= 1e-15 * Math.abs(delta)) break;
  }
  return from * Math.exp(delta);
}

/** O₂ collected (mL) once S₀ − S mol/L is broken down: ½·(S₀ − S)·V_mix·V_m (mmol × mL/mmol). */
const oxygenOf = (inputs: Inputs, broken: number) =>
  0.5 * broken * (inputs.mixtureVolume ?? NaN) * (inputs.molarVolume ?? NaN);

/** Values that follow from S and the clock. Before the window ends its readings run with it. */
function derive(state: Float64Array, inputs: Inputs, vmax: number): void {
  const s0 = inputs.substrate ?? NaN;
  const km = inputs.km ?? NaN;
  const s = state[SUBSTRATE] ?? NaN;
  const clock = state[CLOCK] ?? 0;
  const oxygen = oxygenOf(inputs, s0 - s);
  const rate = (vmax * s) / (km + s);
  state[OXYGEN] = oxygen;
  state[CONVERSION] = (100 * (s0 - s)) / s0;
  state[RATE] = rate;
  if (clock <= (inputs.window ?? NaN)) {
    state[WINDOW_OXYGEN] = oxygen;
    // The mean rate so far; at t = 0 its limit, the rate itself.
    const mean = clock > 0 ? (s0 - s) / clock : rate;
    state[WINDOW_RATE] = mean;
    state[INVERSE_WINDOW_RATE] = 1 / mean;
  }
}

/**
 * Enzyme activity, a simplified TEACHING model — not a laboratory-grade description of any real
 * enzyme: catalase breaking down hydrogen peroxide, 2 H₂O₂ → 2 H₂O + O₂, the oxygen collected in
 * a gas syringe. Chemistry's units (CLAUDE.md) and the lab's °C: concentrations in mol/L, volumes
 * in mL, rates in mol/(L·s), temperature in °C, time in s.
 *
 * Rate law (Michaelis–Menten): v = −dS/dt = V_max·S/(K_m + S), with V_max = a·E·f_T·f_pH — the
 * specific activity a (`specificActivity`, mol/(L·s) per mL of extract, at the optimum), the extract added E (mL), and two
 * stated factors:
 * - f_T = g(T)/g(T_opt), g(T) = Q₁₀^((T − Tm)/10)/(1 + e^((T − Tm)/w)): the rate rises by Q₁₀ per
 *   10 °C (the biologist's rule of thumb) times the share still folded in a two-state, reversible
 *   unfolding equilibrium centred on Tm with width w. Its maximum, T_opt = Tm + w·ln(s/(1 − s)),
 *   s = w·ln(Q₁₀)/10, exists for s < 1. Real heat denaturation is irreversible and grows with
 *   time; here it is instantaneous and depends on T alone.
 * - f_pH = exp(−(pH − pH_opt)²/(2σ²)): an empirical bell curve, not a model of ionisation.
 * Neither factor changes K_m; there is no inhibition by the product or by peroxide, no O₂ kept
 * dissolved, and the gas is collected at once at the molar volume V_m (an ideal gas at the
 * syringe's temperature and pressure). The constants are content inputs; their values and
 * sources are stated where the experiment defines them.
 *
 * Integration is exact: each step solves the integrated law (`substrateAfter`), so the step size
 * moves where samples fall, never the curve. The model keeps its own clock: the step that reaches
 * the end of the reading window (`window`, s) or of the collection (`collectionTime`, s) stops on
 * it and returns the time that took; the run ends at the collection's end.
 *
 * Variables: `substrate` S (mol/L), `oxygen` O₂ collected (mL), `conversion` (S₀ − S)/S₀ (%),
 * `rate` v (mol/(L·s)), `windowOxygen` the O₂ read at the end of the window (mL) and
 * `windowRate` the mean rate over it (mol/(L·s)) — both running until the window ends, then
 * frozen — `clock` (s), `activity` f_T·f_pH (relative activity, 1 at both optima),
 * `inverseSubstrate` 1/S₀ (L/mol) and `inverseWindowRate` 1/v̄ (L·s/mol), the inverse of the
 * window's mean rate, frozen with it: a Lineweaver–Burk point from the run's own reading, not
 * from v₀, the model's value, which would fit the line exactly.
 */
export const enzymeModel: SimulationModel = {
  id: 'biology.enzyme-kinetics',
  inputs: DOMAIN.map(([id]) => id),
  variables: [
    'substrate',
    'oxygen',
    'conversion',
    'rate',
    'windowOxygen',
    'windowRate',
    'clock',
    'activity',
    'inverseSubstrate',
    'inverseWindowRate',
  ],
  predictions: [
    'vmax',
    'initialRate',
    'inverseInitialRate',
    'halfTime',
    'windowOxygen',
    'windowRate',
    'inverseWindowRate',
    'finalOxygen',
    'finalConversion',
    'maxOxygen',
    'temperatureFactor',
    'pHFactor',
    'activityFactor',
    'optimumTemperature',
    'lineweaverSlope',
    'lineweaverIntercept',
    'firstOrderConstant',
    'ratePerEnzyme',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const s0 = inputs.substrate ?? NaN;
    state[SUBSTRATE] = s0;
    state[ACTIVITY] = temperatureFactor(inputs) * pHFactor(inputs);
    state[INVERSE_SUBSTRATE] = 1 / s0;
    derive(state, inputs, vmaxOf(inputs));
  },

  step(state, dt, inputs) {
    const clock = state[CLOCK] ?? 0;
    const window = inputs.window ?? NaN;
    const end = inputs.collectionTime ?? NaN;
    const boundary = clock < window ? window : end;
    if (!(clock < end)) return 0; // the collection is over
    const reached = dt >= boundary - clock;
    const advanced = reached ? boundary - clock : dt;
    const vmax = vmaxOf(inputs);
    state[SUBSTRATE] = substrateAfter(state[SUBSTRATE] ?? NaN, advanced, vmax, inputs.km ?? NaN);
    state[CLOCK] = reached ? boundary : clock + advanced;
    derive(state, inputs, vmax);
    return advanced;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= (inputs.collectionTime ?? NaN),

  /**
   * The theory, in closed form or from the same exact law: V_max, v₀ and 1/v₀; the half time
   * t½ = (S₀/2 + K_m·ln 2)/V_max; S at the window's end and the collection's end, and the O₂,
   * mean rate (and its inverse) and conversion they give; the O₂ of full conversion; the factors and T_opt; the
   * Lineweaver–Burk line 1/v₀ = (K_m/V_max)·(1/S₀) + 1/V_max (slope, intercept), V_max/K_m (the
   * first-order rate constant at low S, 1/slope) and v₀/E, the slope of v₀ against E.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const s0 = inputs.substrate ?? NaN;
    const km = inputs.km ?? NaN;
    const window = inputs.window ?? NaN;
    const vmax = vmaxOf(inputs);
    const v0 = initialRateOf(inputs);
    const atWindow = substrateAfter(s0, window, vmax, km);
    const atEnd = substrateAfter(s0, inputs.collectionTime ?? NaN, vmax, km);
    const fT = temperatureFactor(inputs);
    const fPH = pHFactor(inputs);
    return {
      vmax,
      initialRate: v0,
      inverseInitialRate: 1 / v0,
      halfTime: (s0 / 2 + km * Math.LN2) / vmax,
      windowOxygen: oxygenOf(inputs, s0 - atWindow),
      windowRate: (s0 - atWindow) / window,
      inverseWindowRate: window / (s0 - atWindow),
      finalOxygen: oxygenOf(inputs, s0 - atEnd),
      finalConversion: (100 * (s0 - atEnd)) / s0,
      maxOxygen: oxygenOf(inputs, s0),
      temperatureFactor: fT,
      pHFactor: fPH,
      activityFactor: fT * fPH,
      optimumTemperature: optimumTemperature(inputs),
      lineweaverSlope: km / vmax,
      lineweaverIntercept: 1 / vmax,
      firstOrderConstant: vmax / km,
      ratePerEnzyme: v0 / (inputs.enzymeVolume ?? NaN),
    };
  },
};
