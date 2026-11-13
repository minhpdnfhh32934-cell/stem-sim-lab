import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const CLOCK = 0;
const SWITCH = 1;
const VOLTAGE = 2;
const CURRENT = 3;
const POWER = 4;
const RESISTANCE = 5;
const ENERGY = 6;
const VOLTAGE1 = 7;
const VOLTAGE2 = 8;
const CURRENT1 = 9;
const CURRENT2 = 10;

/** The `configuration` input: which resistors the switch connects to the supply. */
export const CIRCUIT_SINGLE = 0;
export const CIRCUIT_SERIES = 1;
export const CIRCUIT_PARALLEL = 2;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). `duration` must also exceed `switchTime`.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['voltage', (v) => v >= 0 && v < Infinity, 'finite and at least 0 V'],
  ['resistance1', (r) => r > 0 && r < Infinity, 'finite and above 0 Ω'],
  ['resistance2', (r) => r > 0 && r < Infinity, 'finite and above 0 Ω'],
  ['configuration', (c) => c === 0 || c === 1 || c === 2, '0 (R1), 1 (series) or 2 (parallel)'],
  ['switchTime', (t) => t >= 0 && t < Infinity, 'finite and at least 0 s'],
  ['duration', (t) => t > 0 && t < Infinity, 'finite and above 0 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Circuit input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Circuit input "${id}" must be ${rule}, got ${value}`);
  }
  if (!((inputs.duration ?? NaN) > (inputs.switchTime ?? NaN))) {
    throw new Error('Circuit input "duration" must be later than "switchTime"');
  }
}

/** R_eq (Ω): R1 alone, R1 + R2 in series, or R1·R2/(R1 + R2) in parallel. */
export function equivalentResistance(inputs: Inputs): number {
  const r1 = inputs.resistance1 ?? NaN;
  const r2 = inputs.resistance2 ?? NaN;
  const c = inputs.configuration;
  return c === CIRCUIT_SERIES ? r1 + r2 : c === CIRCUIT_PARALLEL ? (r1 * r2) / (r1 + r2) : r1;
}

/**
 * Writes the meters' readings into `state` for the switch open (all 0) or closed (steady DC),
 * and the energy delivered since it closed, P·(t − t_s).
 */
function derive(state: Float64Array, inputs: Inputs): void {
  const t = state[CLOCK] ?? 0;
  const ts = inputs.switchTime ?? 0;
  const closed = t >= ts;
  const v = closed ? (inputs.voltage ?? 0) : 0;
  const r1 = inputs.resistance1 ?? 1;
  const r2 = inputs.resistance2 ?? 1;
  const req = equivalentResistance(inputs);
  const i = v / req;
  const c = inputs.configuration;
  state[SWITCH] = closed ? 1 : 0;
  state[VOLTAGE] = v;
  state[CURRENT] = i;
  state[POWER] = v * i;
  // V/I as the meters give it; 0 while no current flows (switch open or 0 V), never 0/0.
  state[RESISTANCE] = i > 0 ? v / i : 0;
  state[ENERGY] = closed ? v * i * (t - ts) : 0;
  // Series: one current, the voltage divides as R; parallel: one voltage, the current as 1/R.
  state[VOLTAGE1] = c === CIRCUIT_SERIES ? i * r1 : v;
  state[VOLTAGE2] = c === CIRCUIT_SERIES ? i * r2 : c === CIRCUIT_PARALLEL ? v : 0;
  state[CURRENT1] = c === CIRCUIT_PARALLEL ? v / r1 : i;
  state[CURRENT2] = c === CIRCUIT_PARALLEL ? v / r2 : c === CIRCUIT_SERIES ? i : 0;
}

/**
 * A DC circuit board — a simplified teaching model, not a lab-grade one. An ideal supply of EMF
 * `voltage` V (V; no internal resistance) feeds, through a switch and an ideal ammeter (no
 * resistance) in series, a network of ohmic resistors chosen by `configuration`: R1 alone (0),
 * R1 + R2 in series (1) or R1 ∥ R2 in parallel (2), `resistance1`, `resistance2` in Ω. An ideal
 * voltmeter (infinite resistance) reads the voltage across the network, which with an ideal supply
 * and ammeter is V itself. The resistors keep their resistance: no heating changes them (ohmic,
 * constant R) and the leads have none.
 *
 * The switch is open until `switchTime` t_s (s) and closed from then on; the run lasts `duration`
 * (s). No transient is modelled: a resistor board's stray inductance (order 1 µH) and capacitance
 * (order 10 pF; assumed typical orders, not measured) settle it in L/R or R·C — for R_eq from
 * 16.5 Ω to 2 kΩ at most 1 µH / 16.5 Ω ≈ 60 ns and 2 kΩ · 10 pF = 20 ns — far below the 1 ms step,
 * so the current is its steady value I = V/R_eq from the instant the switch closes. A step that
 * would pass t_s or the end is shortened to stop exactly there.
 *
 * Variables: `clock` t (s), `switch` (0 open, 1 closed), `voltage` V across the network (V),
 * `current` I through the ammeter (A), `power` P = V·I (W), `resistance` V/I (Ω; 0 while no
 * current flows), `energy` delivered since the switch closed, E = P·(t − t_s) (J), and each
 * resistor's `voltage1`/`voltage2` (V) and `current1`/`current2` (A); R2's are 0 when it is not
 * connected.
 */
export const circuitModel: SimulationModel = {
  id: 'electric.dc-circuit',
  inputs: ['voltage', 'resistance1', 'resistance2', 'configuration', 'switchTime', 'duration'],
  variables: [
    'clock',
    'switch',
    'voltage',
    'current',
    'power',
    'resistance',
    'energy',
    'voltage1',
    'voltage2',
    'current1',
    'current2',
  ],
  predictions: [
    'equivalentResistance',
    'voltage',
    'current',
    'power',
    'energy',
    'voltage1',
    'voltage2',
    'current1',
    'current2',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    const t = state[CLOCK] ?? 0;
    const ts = inputs.switchTime ?? 0;
    const end = inputs.duration ?? 0;
    // Stop exactly at the switch closing, then exactly at the end.
    const stop = t < ts ? ts : end;
    const h = Math.min(dt, Math.max(0, stop - t));
    const next = t + h >= stop - 1e-12 ? stop : t + h;
    state[CLOCK] = next;
    derive(state, inputs);
    return next - t; // the time actually advanced, a snap onto `stop` included
  },

  isComplete(state, inputs) {
    return (state[CLOCK] ?? 0) >= (inputs.duration ?? 0);
  },

  /**
   * The theory, from Ohm's law V = I·R for each resistor and Kirchhoff's laws: R_eq = R1,
   * R1 + R2 (series: one current) or R1·R2/(R1 + R2) (parallel: one voltage); I = V/R_eq,
   * P = V·I = V²/R_eq, the energy over the closed time E = P·(duration − t_s), and each
   * resistor's voltage and current (series V1 = I·R1, V2 = I·R2; parallel I1 = V/R1, I2 = V/R2).
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const v = inputs.voltage ?? NaN;
    const r1 = inputs.resistance1 ?? NaN;
    const r2 = inputs.resistance2 ?? NaN;
    const req = equivalentResistance(inputs);
    const i = v / req;
    const c = inputs.configuration;
    const series = c === CIRCUIT_SERIES;
    const parallel = c === CIRCUIT_PARALLEL;
    return {
      equivalentResistance: req,
      voltage: v,
      current: i,
      power: (v * v) / req,
      energy: ((v * v) / req) * ((inputs.duration ?? NaN) - (inputs.switchTime ?? NaN)),
      voltage1: series ? i * r1 : v,
      voltage2: series ? i * r2 : parallel ? v : 0,
      current1: parallel ? v / r1 : i,
      current2: parallel ? v / r2 : series ? i : 0,
    };
  },
};
