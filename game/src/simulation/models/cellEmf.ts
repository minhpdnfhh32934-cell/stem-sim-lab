import type { SimulationModel } from '../SimulationModel';

/**
 * The cells on the board, as [E (V), r (Ω)]: a new 1.5 V cell, a used one, a pack of two new ones.
 * Illustrative values in the range measured for AA alkaline cells (a fresh one some 0.1–0.3 Ω,
 * rising as it is used), not one brand's; the student finds r from the readings. Indexed by `cell`.
 */
export const CELLS: readonly (readonly [number, number])[] = [
  [1.5, 0.3],
  [1.5, 1.2],
  [3, 0.6],
];

// State slots.
const CLOCK = 0;
const SWITCH = 1; // 0 open, 1 closed
const VOLTAGE = 2; // across the cell's terminals, U (V)
const CURRENT = 3; // I (A)
const POWER = 4; // into the rheostat, U·I (W)

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['cell', (c) => c === 0 || c === 1 || c === 2, '0, 1 or 2 (the cells on the board)'],
  ['rheostat', (r) => r > 0 && r <= 100, 'above 0 and at most 100 Ω'],
  ['switchTime', (t) => t >= 0 && t <= 10, 'from 0 to 10 s'],
  ['duration', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
];

function cell(inputs: Readonly<Record<string, number>>) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`EMF input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`EMF input "${id}" must be ${rule}, got ${value}`);
  }
  const [E, r] = CELLS[inputs.cell ?? NaN] ?? [NaN, NaN];
  const R = inputs.rheostat ?? NaN;
  return { E, r, R, on: inputs.switchTime ?? NaN, end: inputs.duration ?? NaN, I: E / (R + r) };
}

type Cell = ReturnType<typeof cell>;

function derive(state: Float64Array, c: Cell, t: number): void {
  const closed = t >= c.on;
  const I = closed ? c.I : 0;
  const U = c.E - I * c.r; // open: the voltmeter reads E itself
  state[CLOCK] = t;
  state[SWITCH] = closed ? 1 : 0;
  state[VOLTAGE] = U;
  state[CURRENT] = I;
  state[POWER] = U * I;
}

/**
 * EMF and internal resistance of a cell — a simplified teaching model (KNTT Vật lí 11, bài 26). A
 * `cell` of EMF E and internal resistance r (`CELLS`; r is what the student works out) drives a
 * `rheostat` R through a switch and an ammeter, a voltmeter across the cell's terminals. Open, the
 * voltmeter reads E; closed at `switchTime`, I = E/(R + r) and U = E − I·r: the terminal voltage
 * falls in proportion to the current. Runs at several R lie on U = E − r·I, a straight line of
 * slope −r crossing the U axis at E. The run ends at `duration`. Ideal meters, leads without
 * resistance, the cell's E and r constant over the run.
 *
 * Variables: `clock` t (s), `switch` (0 or 1), `voltage` U (V), `current` I (A), `power` U·I (W).
 */
export const cellEmfModel: SimulationModel = {
  id: 'electric.cell-emf',
  inputs: ['cell', 'rheostat', 'switchTime', 'duration'],
  variables: ['clock', 'switch', 'voltage', 'current', 'power'],
  predictions: ['voltage', 'current', 'power', 'emf', 'negativeInternalResistance'],

  init(inputs, state) {
    state.fill(0);
    derive(state, cell(inputs), 0);
  },

  step(state, dt, inputs) {
    const c = cell(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, c.end);
    derive(state, c, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= (inputs.duration ?? NaN),

  /** The theory with the switch closed: U, I, U·I; E (the line's intercept) and −r (its slope). */
  predict(inputs) {
    const c = cell(inputs);
    const U = c.E - c.I * c.r;
    return { voltage: U, current: c.I, power: U * c.I, emf: c.E, negativeInternalResistance: -c.r };
  },
};
