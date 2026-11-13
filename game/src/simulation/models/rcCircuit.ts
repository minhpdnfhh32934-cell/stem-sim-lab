import type { SimulationModel } from '../SimulationModel';

/** How long each half of the run lasts, in time constants: charged for 5τ, then discharged for 5τ. */
const HALF = 5;
/** 1 − 1/e: the share of the supply a charging capacitor reaches in one time constant. */
const ONE_TAU = 1 - Math.exp(-1);

// State slots.
const CLOCK = 0;
const VOLTAGE = 1; // across the capacitor, U_C (V)
const CURRENT = 2; // through the resistor (A), + while charging
const CHARGE = 3; // on the capacitor, q = C·U_C (C)
const TAU_SEEN = 4; // when U_C first reached (1 − 1/e)·E while charging (s), 0 until it has
const SWITCH = 5; // 1 charging, −1 discharging

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['supply', (e) => e > 0 && e <= 30, 'above 0 and at most 30 V'],
  ['resistance', (r) => r > 0 && r <= 1e6, 'above 0 and at most 1 MΩ'],
  ['capacitance', (c) => c > 0 && c <= 0.1, 'above 0 and at most 0.1 F'],
];

function circuit(inputs: Readonly<Record<string, number>>) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`RC circuit input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`RC circuit input "${id}" must be ${rule}, got ${value}`);
  }
  const E = inputs.supply ?? NaN;
  const R = inputs.resistance ?? NaN;
  const C = inputs.capacitance ?? NaN;
  const tau = R * C;
  if (tau > 20)
    throw new Error(
      `RC circuit: τ = RC = ${tau.toFixed(1)} s is too long to watch; choose a smaller R or C`,
    );
  return { E, R, C, tau, half: HALF * tau, end: 2 * HALF * tau };
}

type Rc = ReturnType<typeof circuit>;

function derive(state: Float64Array, c: Rc, t: number): void {
  const charging = t < c.half;
  const top = c.E * (1 - Math.exp(-HALF)); // what it reached when the switch was turned over
  const u = charging ? c.E * (1 - Math.exp(-t / c.tau)) : top * Math.exp(-(t - c.half) / c.tau);
  state[CLOCK] = t;
  state[VOLTAGE] = u;
  state[CURRENT] = charging ? (c.E - u) / c.R : -u / c.R;
  state[CHARGE] = c.C * u;
  state[TAU_SEEN] = t >= c.tau ? c.tau : 0; // U_C = (1 − 1/e)·E exactly at t = τ
  state[SWITCH] = charging ? 1 : -1;
}

/**
 * Charging and discharging a capacitor through a resistor — a simplified teaching model (KNTT Vật
 * lí 11, bài 21). An ideal `supply` E (V) charges a `capacitance` C (F) through a `resistance` R
 * (Ω): U_C = E·(1 − e^(−t/τ)), τ = R·C, the current (E − U_C)/R falling from E/R. After 5τ the
 * switch is turned over and C discharges through the same R: U_C = U_5τ·e^(−(t − 5τ)/τ), the
 * current reversed. The capacitor reaches (1 − 1/e) ≈ 63 % of E one time constant after the start,
 * and falls to 37 % of its start one τ into the discharge. A time constant longer than 20 s is
 * refused (too long to watch). In closed form in time.
 *
 * Variables: `clock` t (s), `voltage` U_C (V), `current` I (A), `charge` q (C),
 * `timeConstantSeen` (s: τ once U_C has reached 63 % of E, 0 before), `switchPosition` (±1).
 */
export const rcCircuitModel: SimulationModel = {
  id: 'electric.rc-circuit',
  inputs: ['supply', 'resistance', 'capacitance'],
  variables: ['clock', 'voltage', 'current', 'charge', 'timeConstantSeen', 'switchPosition'],
  predictions: ['timeConstant', 'peakCurrent', 'fullCharge', 'oneTauVoltage', 'halfTime'],

  init(inputs, state) {
    state.fill(0);
    derive(state, circuit(inputs), 0);
  },

  step(state, dt, inputs) {
    const c = circuit(inputs);
    const t0 = state[CLOCK] ?? 0;
    // Land exactly on the switch-over, so U_C's peak is sampled.
    const t1 = t0 < c.half ? Math.min(t0 + dt, c.half) : Math.min(t0 + dt, c.end);
    derive(state, c, t1 === c.half ? c.half - 1e-12 : t1);
    state[CLOCK] = t1;
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= circuit(inputs).end,

  /**
   * The theory: τ = R·C; the first current E/R; the full charge C·E; U_C one τ into charging,
   * (1 − 1/e)·E; and the half-time τ·ln 2 (to half of E, charging).
   */
  predict(inputs) {
    const c = circuit(inputs);
    return {
      timeConstant: c.tau,
      peakCurrent: c.E / c.R,
      fullCharge: c.C * c.E,
      oneTauVoltage: ONE_TAU * c.E,
      halfTime: c.tau * Math.LN2,
    };
  },
};
