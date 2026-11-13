import type { SimulationModel } from '../SimulationModel';
import { GAS_CONSTANT } from './osmosis';

type Inputs = Readonly<Record<string, number>>;

const IMMERSION = 0;
const READING = 1;
const POTENTIAL = 2;
const PH = 3;
const HYDROGEN = 4;
const IONIZATION = 5;
const LOG_C = 6;

/** The Faraday constant F = N_A·e, C/mol: exact in the 2019 SI. */
const FARADAY = 96485.33212331;
/** 0 °C in kelvin, by definition. */
const ZERO_CELSIUS = 273.15;
/** The pH at which an ideal combination glass electrode gives 0 mV (its internal buffer's). */
const ISO_PH = 7;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). Concentrations stop at 1 mol/L: activities are
 * taken as concentrations, already ~10 % off in H⁺ at 0.1 mol/L, so the bound keeps the arithmetic
 * meaningful, not the model accurate. pKa from −10 to 30 spans every acid and base water can tell
 * apart and the stand-ins for complete reaction (see `phModel`); Kw spans liquid water.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['pKa', (p) => p >= -10 && p <= 30, 'from −10 to 30'],
  ['baseFraction', (n) => n >= 0 && n <= 1, 'from 0 to 1'],
  ['concentration', (c) => c > 0 && c <= 1, 'above 0 and at most 1 mol/L'],
  ['kw', (k) => k >= 1e-16 && k <= 1e-12, 'from 1e-16 to 1e-12 (mol/L)²'],
  ['temperature', (t) => t >= 0 && t <= 100, 'from 0 to 100 °C'],
  ['timeConstant', (t) => t > 0 && t <= 1e4, 'above 0 and at most 1e4 s'],
  ['readTime', (t) => t > 0 && t <= 1e5, 'above 0 and at most 1e5 s'],
  ['startPH', (p) => p >= 0 && p <= 14, 'from 0 to 14'],
];

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`pH input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`pH input "${id}" must be ${rule}, got ${value}`);
  }
}

/**
 * lg [H⁺] of a pair at total concentration C, made up with a fraction n as its base form: the one
 * root of the charge balance h − Kw/h + C·(n·h − (1 − n)·Ka)/(Ka + h) = 0, which rises strictly
 * with h, so bisection on lg h between −20 and 1 (every root the domain allows lies inside) finds
 * it to the last bit. The term n·h − (1 − n)·Ka is n − Ka/(Ka + h) times Ka + h, written so a
 * neutral salt (n = 1, Ka ≫ h) does not subtract two numbers near C.
 */
function lgHydrogen(c: number, ka: number, n: number, kw: number): number {
  let lo = -20;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (mid <= lo || mid >= hi) break;
    const h = 10 ** mid;
    if (h - kw / h + (c * (n * h - (1 - n) * ka)) / (ka + h) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The equilibrium pH of a sample (inputs `pKa`, `baseFraction`, `concentration`, `kw`), exact for
 * the ideal model: no √(Ka·C) or Henderson–Hasselbalch shortcut. A missing input reads as NaN.
 */
export function solutionPH(inputs: Inputs): number {
  return -lgHydrogen(
    inputs.concentration ?? NaN,
    10 ** -(inputs.pKa ?? NaN),
    inputs.baseFraction ?? NaN,
    inputs.kw ?? NaN,
  );
}

/** The Nernst slope ln10·R·T/F of the glass electrode, in V per pH unit. */
const nernstSlope = (inputs: Inputs) =>
  (Math.LN10 * GAS_CONSTANT * ((inputs.temperature ?? NaN) + ZERO_CELSIUS)) / FARADAY;

/**
 * The textbook approximation of pH against lg C for the pair's kind, as [slope, intercept]: a
 * strong acid (pKa ≤ 0, stronger than H₃O⁺) fully dissociated, a strong base (pKa ≥ pKw) fully
 * reacted, a weak acid or base by [H⁺] or [OH⁻] = √(K·C), a mixture by Henderson–Hasselbalch, a
 * neutral salt or water at pKw/2. It depends on the pair and form only, never on C.
 */
function limitLaw(pKa: number, n: number, kw: number): readonly [number, number] {
  const pKw = -Math.log10(kw);
  if (pKa <= 0) return n < 1 ? [-1, 0 - Math.log10(1 - n)] : [0, pKw / 2];
  if (pKa >= pKw) return n > 0 ? [1, pKw + Math.log10(n)] : [0, pKw / 2];
  if (n === 0) return [-0.5, pKa / 2];
  if (n === 1) return [0.5, (pKw + pKa) / 2];
  return [0, pKa + Math.log10(n / (1 - n))];
}

/** Values that follow from the meter's reading: the electrode potential, [H⁺] and α. */
function derive(state: Float64Array, reading: number, inputs: Inputs): void {
  const h = 10 ** -reading;
  state[READING] = reading;
  state[POTENTIAL] = 1000 * nernstSlope(inputs) * (ISO_PH - reading);
  state[HYDROGEN] = h;
  state[IONIZATION] = (100 * Math.abs(h - (inputs.kw ?? NaN) / h)) / (inputs.concentration ?? NaN);
}

/**
 * Measuring the pH of a sample with a glass-electrode pH meter: a simplified teaching model, not a
 * lab-grade one. Chemistry's units (CLAUDE.md): concentrations in mol/L, pH without a unit, the
 * potential in mV, temperature in °C, time in s.
 *
 * The sample is one conjugate acid–base pair (HA/A⁻ or BH⁺/B) of total concentration C, made up
 * with a fraction n as its base form (with Na⁺ or Cl⁻ as the spectator ion): n = 0 is the acid form
 * (HCl, CH₃COOH, NH₄Cl), n = 1 the base form (NaCl, CH₃COONa, NH₃, NaOH), n = ½ a 1 : 1 mixture.
 * Every such sample obeys one charge balance, [H⁺] + n·C = C·Ka/(Ka + [H⁺]) + Kw/[H⁺], whatever
 * the charges of the pair, solved exactly (`solutionPH`): the equilibrium is instant and ideal
 * (activities are concentrations). A strong acid is a pair with pKa far below 0: HCl's is about
 * −6 (estimates run from −5.9 to −7; any pKa below about −2 gives the same pH to 1e-6 here). A
 * strong base is a base form that takes protons from water completely: for NaOH that is a pKa far
 * above 14, and 20 stands for "complete" (not a measured constant: OH⁻'s own pair is water's).
 * Their acid forms make the neutral samples: NaCl, and water itself for NaOH's pair.
 *
 * The meter: the glass electrode's potential is E = S·(7 − pH_e) (Nernst slope S = ln10·R·T/F,
 * 59.16 mV at 25 °C; 0 mV at pH 7 for an ideal combination electrode) and the meter, taken as
 * perfectly calibrated, reads pH_e = 7 − E/S. pH_e follows the solution's pH as a first-order
 * response, pH_e = pH + (pH₀ − pH)·e^(−t/τ), from `startPH` pH₀ (the electrode rinsed in distilled
 * water); τ (`timeConstant`) is a stated teaching value, the same for every sample, where a real
 * electrode is slower in dilute samples. Each step applies that exact solution over its time, so
 * the step size changes where samples fall, never the reading; the run ends at `readTime`, the
 * last step taking only the time it needs.
 *
 * Variables: `immersionTime` (s since the electrode dipped), `reading` pH_e (the meter, pH),
 * `potential` E (mV), `pH` (the solution's equilibrium pH, which an indicator shows),
 * `hydrogenIon` [H⁺] = 10^(−reading) (mol/L), `ionization` α = 100·|[H⁺] − [OH⁻]|/C (%), the part
 * of the solute that has given a proton to water or taken one from it (dissociation of an acid,
 * protonation of a base, hydrolysis of a salt), and `logConcentration` lg(C/(mol/L)). [H⁺] and α
 * are worked out from the unrounded reading, as a student would from the meter.
 */
export const phModel: SimulationModel = {
  id: 'acid-base.ph-measurement',
  inputs: [
    'pKa',
    'baseFraction',
    'concentration',
    'kw',
    'temperature',
    'timeConstant',
    'readTime',
    'startPH',
  ],
  variables: [
    'immersionTime',
    'reading',
    'potential',
    'pH',
    'hydrogenIon',
    'ionization',
    'logConcentration',
  ],
  predictions: [
    'pH',
    'hydrogenIon',
    'hydroxideIon',
    'ionization',
    'potential',
    'nernstSlope',
    'finalReading',
    'responseTime',
    'limitSlope',
    'limitIntercept',
    'approximatePH',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    state[PH] = solutionPH(inputs);
    state[LOG_C] = Math.log10(inputs.concentration ?? NaN);
    derive(state, inputs.startPH ?? NaN, inputs);
  },

  step(state, dt, inputs) {
    const end = inputs.readTime ?? NaN;
    const time = state[IMMERSION] ?? 0;
    if (!(time < end)) return 0; // the reading is taken: nothing more happens
    const reached = time + dt >= end;
    const h = reached ? end - time : dt;
    const pH = state[PH] ?? NaN;
    state[IMMERSION] = reached ? end : time + h;
    derive(
      state,
      pH + ((state[READING] ?? NaN) - pH) * Math.exp(-h / (inputs.timeConstant ?? NaN)),
      inputs,
    );
    return h;
  },

  isComplete: (state, inputs) => (state[IMMERSION] ?? 0) >= (inputs.readTime ?? NaN),

  /**
   * The theory, in closed form or from the exact charge balance: the solution's pH, [H⁺], [OH⁻],
   * α (100·|n − Ka/(Ka + [H⁺])|), the electrode potential at that pH (mV) and the Nernst slope
   * (mV per pH); the reading at `readTime`, pH + (pH₀ − pH)·e^(−t_read/τ), and the 95 % response
   * time τ·ln 20; and the textbook line of pH against lg C for this pair and form
   * (`limitSlope`, `limitIntercept`) with its value at this C, `approximatePH`.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const c = inputs.concentration ?? NaN;
    const n = inputs.baseFraction ?? NaN;
    const kw = inputs.kw ?? NaN;
    const ka = 10 ** -(inputs.pKa ?? NaN);
    const pH = solutionPH(inputs);
    const h = 10 ** -pH;
    const tau = inputs.timeConstant ?? NaN;
    const [limitSlope, limitIntercept] = limitLaw(inputs.pKa ?? NaN, n, kw);
    return {
      pH,
      hydrogenIon: h,
      hydroxideIon: kw / h,
      ionization: (100 * Math.abs(n * h - (1 - n) * ka)) / (ka + h),
      potential: 1000 * nernstSlope(inputs) * (ISO_PH - pH),
      nernstSlope: 1000 * nernstSlope(inputs),
      finalReading: pH + ((inputs.startPH ?? NaN) - pH) * Math.exp(-(inputs.readTime ?? NaN) / tau),
      responseTime: tau * Math.log(20),
      limitSlope,
      limitIntercept,
      approximatePH: limitSlope * Math.log10(c) + limitIntercept,
    };
  },
};
