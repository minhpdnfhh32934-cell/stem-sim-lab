import type { SimulationModel } from '../SimulationModel';

// State slots.
const CLOCK = 0;
const PROBE = 1; // the probe's distance r from Q1, along the axis away from Q2 (m)
const FIELD = 2; // the field there along that axis, E (V/m): positive away from Q1
const FIELD_ONE = 3; // at the dialled distance r0: Q1's own field (V/m)
const FIELD_TWO = 4; // Q2's there (V/m)
const FIELD_SUM = 5; // their sum E (V/m)
const FORCE = 6; // the force on the test charge there, F = q·E (N)

/** Coulomb's constant 1/(4πε0) (N·m²/C²), from ε0 (CODATA 2018). */
export const COULOMB_K = 1 / (4 * Math.PI * 8.8541878128e-12);

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['charge', (q) => q !== 0 && Math.abs(q) <= 1e-6, 'not zero and at most 1 µC either way'],
  ['secondCharge', (q) => Math.abs(q) <= 1e-6, 'at most 1 µC either way (0: none)'],
  ['separation', (d) => d > 0 && d <= 1, 'above 0 and at most 1 m'],
  ['probeDistance', (r) => r >= 0.01 && r <= 0.5, 'from 1 to 50 cm'],
  ['testCharge', (q) => q !== 0 && Math.abs(q) <= 1e-6, 'not zero and at most 1 µC either way'],
  ['scanFrom', (r) => r > 0 && r <= 0.5, 'above 0 and at most 0.5 m'],
  ['scanTo', (r) => r > 0 && r <= 0.5, 'above 0 and at most 0.5 m'],
  ['scanTime', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
];

function charges(inputs: Readonly<Record<string, number>>) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Point charges input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Point charges input "${id}" must be ${rule}, got ${value}`);
  }
  const from = inputs.scanFrom ?? NaN;
  const to = inputs.scanTo ?? NaN;
  if (!(from < to)) throw new Error('Point charges: the scan must run outwards (from < to)');
  return {
    q1: inputs.charge ?? NaN,
    q2: inputs.secondCharge ?? NaN,
    d: inputs.separation ?? NaN,
    r0: inputs.probeDistance ?? NaN,
    q: inputs.testCharge ?? NaN,
    from,
    to,
    time: inputs.scanTime ?? NaN,
  };
}

type Charges = ReturnType<typeof charges>;

/** Q1's and Q2's fields r from Q1 on the axis, away from Q2 (V/m, positive outwards). */
function fieldsAt(s: Charges, r: number): [number, number] {
  return [(COULOMB_K * s.q1) / r ** 2, (COULOMB_K * s.q2) / (r + s.d) ** 2];
}

/**
 * The field (V/m) of Q1 at the origin and Q2 `separation` d along −x, at (x, y) in their plane:
 * for the renderer's field lines. Undefined at a charge.
 */
export function chargeField(
  inputs: Readonly<Record<string, number>>,
): (x: number, y: number, out: [number, number]) => void {
  const s = charges(inputs);
  return (x, y, out) => {
    out[0] = 0;
    out[1] = 0;
    for (const [q, cx] of [
      [s.q1, 0],
      [s.q2, -s.d],
    ] as const) {
      if (q === 0) continue;
      const dx = x - cx;
      const r2 = dx * dx + y * y;
      const e = (COULOMB_K * q) / (r2 * Math.sqrt(r2));
      out[0] += e * dx;
      out[1] += e * y;
    }
  };
}

function derive(state: Float64Array, s: Charges, t: number): void {
  const r = s.from + ((s.to - s.from) * t) / s.time;
  const [e1, e2] = fieldsAt(s, r);
  const [f1, f2] = fieldsAt(s, s.r0);
  state[CLOCK] = t;
  state[PROBE] = r;
  state[FIELD] = e1 + e2;
  state[FIELD_ONE] = f1;
  state[FIELD_TWO] = f2;
  state[FIELD_SUM] = f1 + f2;
  state[FORCE] = s.q * (f1 + f2);
}

/**
 * The electric field of one or two point charges — a simulation (KNTT Vật lí 11, bài 16–18). Q1
 * (`charge`) and Q2 (`secondCharge`, 0 for none) `separation` d apart in vacuum (air: εr ≈ 1). On
 * the axis through them, outside Q1 at r from it (away from Q2), each gives E = k·Q/r², along the
 * axis, and the field is their sum (superposition); a test charge q there feels F = q·E
 * (Coulomb's law). The run: a probe goes from `scanFrom` to `scanTo` along that axis in
 * `scanTime` s, reading E. In closed form; ideal point charges, nothing else nearby.
 *
 * Variables: `clock` t (s), `probe` r (m), `field` E (V/m), and at `probeDistance` r0:
 * `fieldOne`, `fieldTwo`, `fieldSum` (V/m) and `force` F (N).
 */
export const pointChargesModel: SimulationModel = {
  id: 'electric.point-charges',
  inputs: [
    'charge',
    'secondCharge',
    'separation',
    'probeDistance',
    'testCharge',
    'scanFrom',
    'scanTo',
    'scanTime',
  ],
  variables: ['clock', 'probe', 'field', 'fieldOne', 'fieldTwo', 'fieldSum', 'force'],
  predictions: ['fieldOne', 'fieldTwo', 'fieldSum', 'force'],

  init(inputs, state) {
    state.fill(0);
    derive(state, charges(inputs), 0);
  },

  step(state, dt, inputs) {
    const s = charges(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, s.time);
    derive(state, s, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= (inputs.scanTime ?? NaN),

  /** The theory at r0: k·Q1/r0², k·Q2/(r0 + d)², their sum and q·E. */
  predict(inputs) {
    const s = charges(inputs);
    const [f1, f2] = fieldsAt(s, s.r0);
    return { fieldOne: f1, fieldTwo: f2, fieldSum: f1 + f2, force: s.q * (f1 + f2) };
  },
};
