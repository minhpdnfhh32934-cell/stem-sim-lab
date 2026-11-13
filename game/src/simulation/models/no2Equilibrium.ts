import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TIME = 0;
const TEMPERATURE = 1;
const VOLUME = 2;
const NO2 = 3;
const N2O4 = 4;
const CONCENTRATION = 5;
const DISSOCIATION = 6;
const PRESSURE = 7;
const QUOTIENT = 8;

const R = 8.314462618; // J/(mol·K), exact in the 2019 SI
const P_STANDARD = 1e5; // Pa: the standard pressure, 1 bar
const KELVIN = 273.15;
/**
 * N₂O₄(g) ⇌ 2NO₂(g) at 298.15 K from the standard tables (NBS/NIST: ΔfH° NO₂ 33.18, N₂O₄ 9.16;
 * ΔfG° NO₂ 51.31, N₂O₄ 97.89 kJ/mol): ΔrH° = +57.20 kJ/mol (endothermic), ΔrG° = +4.73 kJ/mol,
 * so Kp(298.15 K) = e^(−ΔrG°/RT) = 0.148 (bar).
 */
const DELTA_H = 57_200;
const DELTA_G = 4_730;
const T_REF = 298.15;

/** Kp (bar) at T (K) by the van 't Hoff equation, ΔrH° taken as constant. */
export function kp(kelvin: number): number {
  return Math.exp(-DELTA_G / (R * T_REF) - (DELTA_H / R) * (1 / kelvin - 1 / T_REF));
}

/**
 * The equilibrium mixture of `total` mol (counted as N₂O₄) in `volume` m³ at `kelvin`: x mol
 * dissociated, from 4RT·x² + Kp·p°·V·x − Kp·p°·V·n₀ = 0 (Kp = p(NO₂)²/(p(N₂O₄)·p°), ideal gases),
 * its positive root, written so it does not cancel.
 */
export function dissociated(total: number, volume: number, kelvin: number): number {
  const b = kp(kelvin) * P_STANDARD * volume;
  const a = 4 * R * kelvin;
  return (2 * b * total) / (b + Math.sqrt(b * b + 4 * a * b * total));
}

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['amount', (n) => n > 0 && n <= 0.01, 'above 0 and at most 0.01 mol'],
  ['startVolume', (v) => v >= 5 && v <= 200, 'from 5 to 200 mL'],
  ['endVolume', (v) => v >= 5 && v <= 200, 'from 5 to 200 mL'],
  ['startTemperature', (t) => t >= -10 && t <= 100, 'from −10 to 100 °C'],
  ['endTemperature', (t) => t >= -10 && t <= 100, 'from −10 to 100 °C'],
  ['timeConstant', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
  ['runTime', (t) => t > 0 && t <= 600, 'above 0 and at most 600 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`NO₂ equilibrium input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`NO₂ equilibrium input "${id}" must be ${rule}, got ${value}`);
  }
}

/** Fills the state's derived slots from x (mol dissociated), T (°C) and V (mL). */
function derive(state: Float64Array, x: number, celsius: number, mL: number, total: number): void {
  const kelvin = celsius + KELVIN;
  const volume = mL * 1e-6;
  const no2 = 2 * x;
  const n2o4 = total - x;
  state[TEMPERATURE] = celsius;
  state[VOLUME] = mL;
  state[NO2] = no2 * 1000;
  state[N2O4] = n2o4 * 1000;
  state[CONCENTRATION] = (no2 / volume) * 1e-3; // mol/L
  state[DISSOCIATION] = (100 * x) / total;
  state[PRESSURE] = ((no2 + n2o4) * R * kelvin) / volume / 1000; // kPa
  const p = (n: number) => (n * R * kelvin) / volume;
  state[QUOTIENT] = p(no2) ** 2 / (p(n2o4) * P_STANDARD) / kp(kelvin);
}

/**
 * Le Chatelier's principle with nitrogen dioxide: a simplified teaching model. A sealed gas
 * syringe holds `amount` mol of nitrogen dioxide, counted as N₂O₄ (n₀), at equilibrium
 * N₂O₄ ⇌ 2NO₂ at `startTemperature` and `startVolume`. At t = 0 the syringe is moved to a bath
 * at `endTemperature` and its plunger set to `endVolume`, both at once (a stated simplification:
 * the gas takes the bath's temperature at once). The amounts then relax towards the new
 * equilibrium, x(t) = x_eq + (x₀ − x_eq)·e^(−t/τ), τ (`timeConstant`) a stated teaching value
 * (the real reaction is far faster; the gas's warming sets the real pace). Squeezing the gas
 * makes it darker at once (the same NO₂ in less volume), then paler as it shifts to N₂O₄;
 * warming makes it browner (the dissociation is endothermic). Ideal gases; ΔrH° constant
 * (van 't Hoff). Exact at every step.
 *
 * Variables: `time` (s), `temperature` (°C), `volume` (mL), `no2` and `n2o4` (mmol),
 * `no2Concentration` [NO₂] (mol/L, what the colour shows), `dissociation` α (% of N₂O₄
 * dissociated), `pressure` (kPa), `quotient` Q/Kp (1 at equilibrium).
 */
export const no2EquilibriumModel: SimulationModel = {
  id: 'chemistry.no2-equilibrium',
  inputs: [
    'amount',
    'startVolume',
    'endVolume',
    'startTemperature',
    'endTemperature',
    'timeConstant',
    'runTime',
  ],
  variables: [
    'time',
    'temperature',
    'volume',
    'no2',
    'n2o4',
    'no2Concentration',
    'dissociation',
    'pressure',
    'quotient',
  ],
  predictions: [
    'no2',
    'n2o4',
    'no2Concentration',
    'dissociation',
    'pressure',
    'kp',
    'startNo2Concentration',
    'startDissociation',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const total = inputs.amount ?? NaN;
    const t0 = inputs.startTemperature ?? NaN;
    const v0 = inputs.startVolume ?? NaN;
    derive(state, dissociated(total, v0 * 1e-6, t0 + KELVIN), t0, v0, total);
  },

  step(state, dt, inputs) {
    const end = inputs.runTime ?? NaN;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    const total = inputs.amount ?? NaN;
    const x0 = dissociated(
      total,
      (inputs.startVolume ?? NaN) * 1e-6,
      (inputs.startTemperature ?? NaN) + KELVIN,
    );
    const t1 = inputs.endTemperature ?? NaN;
    const v1 = inputs.endVolume ?? NaN;
    const xEq = dissociated(total, v1 * 1e-6, t1 + KELVIN);
    state[TIME] = t;
    derive(state, xEq + (x0 - xEq) * Math.exp(-t / (inputs.timeConstant ?? NaN)), t1, v1, total);
    return h;
  },

  isComplete: (state, inputs) => (state[TIME] ?? 0) >= (inputs.runTime ?? NaN),

  /** The equilibria before and after: the end one (as the run tends to it), and [NO₂] and α before. */
  predict(inputs) {
    refuseInvalid(inputs);
    const total = inputs.amount ?? NaN;
    const after = new Float64Array(9);
    const t1 = inputs.endTemperature ?? NaN;
    const v1 = inputs.endVolume ?? NaN;
    derive(after, dissociated(total, v1 * 1e-6, t1 + KELVIN), t1, v1, total);
    const before = new Float64Array(9);
    const t0 = inputs.startTemperature ?? NaN;
    const v0 = inputs.startVolume ?? NaN;
    derive(before, dissociated(total, v0 * 1e-6, t0 + KELVIN), t0, v0, total);
    return {
      no2: after[NO2] ?? NaN,
      n2o4: after[N2O4] ?? NaN,
      no2Concentration: after[CONCENTRATION] ?? NaN,
      dissociation: after[DISSOCIATION] ?? NaN,
      pressure: after[PRESSURE] ?? NaN,
      kp: kp(t1 + KELVIN),
      startNo2Concentration: before[CONCENTRATION] ?? NaN,
      startDissociation: before[DISSOCIATION] ?? NaN,
    };
  },
};
