import type { SimulationModel } from '../SimulationModel';

const DEG = Math.PI / 180;

// State slots.
const CLOCK = 0;
const OFFSET = 1; // how far the ring is from the board's centre mark (m)
const READING1 = 2; // what each spring balance reads (N)
const READING2 = 3;
const READING3 = 4;
const RESULTANT = 5; // |F1 + F2| from the parallelogram rule (N)
const RESULTANT_ANGLE = 6; // the resultant's direction from F1 (°)
const RESULTANT_SQUARED = 7; // F3², the third balance's reading squared, at rest (N²)
const COS_ANGLE = 8; // cos α (no unit)

interface Forces {
  readonly f1: number;
  readonly f2: number;
  readonly alpha: number;
  readonly k: number;
  readonly omega: number;
  readonly u0: number;
  readonly duration: number;
  /** The resultant's size and direction from F1 (rad), and each balance's direction (rad). */
  readonly r: number;
  readonly theta: number;
  readonly directions: readonly [number, number, number];
}

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['force1', (f) => f > 0 && f <= 10, 'above 0 and at most 10 N (the balances’ range)'],
  ['force2', (f) => f > 0 && f <= 10, 'above 0 and at most 10 N (the balances’ range)'],
  ['angle', (a) => a > 0 && a < 180, 'between 0 and 180°'],
  ['stiffness', (k) => k > 0 && k <= 1e4, 'above 0 and at most 1e4 N/m'],
  ['settleFrequency', (w) => w > 0 && w <= 1e3, 'above 0 and at most 1e3 rad/s'],
  ['startOffset', (u) => u >= 0 && u <= 0.05, 'from 0 to 0.05 m'],
  ['duration', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
];

function forces(inputs: Readonly<Record<string, number>>): Forces {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Concurrent forces input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Concurrent forces input "${id}" must be ${rule}, got ${value}`);
  }
  const f1 = inputs.force1 ?? NaN;
  const f2 = inputs.force2 ?? NaN;
  const alpha = (inputs.angle ?? NaN) * DEG;
  const x = f1 + f2 * Math.cos(alpha);
  const y = f2 * Math.sin(alpha);
  const r = Math.hypot(x, y);
  if (r > 10) {
    throw new Error(
      `Concurrent forces: the resultant ${r.toFixed(2)} N is past the third balance's 10 N; ` +
        'choose smaller forces or a wider angle',
    );
  }
  const theta = Math.atan2(y, x);
  return {
    f1,
    f2,
    alpha,
    k: inputs.stiffness ?? NaN,
    omega: inputs.settleFrequency ?? NaN,
    u0: inputs.startOffset ?? NaN,
    duration: inputs.duration ?? NaN,
    r,
    theta,
    directions: [0, alpha, theta + Math.PI],
  };
}

/** The ring's offset after t s: critically damped from u0, released at rest, u0·(1 + ωt)·e^(−ωt). */
const offsetAt = (f: Forces, t: number) => f.u0 * (1 + f.omega * t) * Math.exp(-f.omega * t);

/** Writes the state at time t (closed form: the step size never changes it). */
function derive(state: Float64Array, f: Forces, t: number): void {
  const u = offsetAt(f, t);
  state[CLOCK] = t;
  state[OFFSET] = u;
  // The ring starts pulled towards balance 3 and settles back: each balance's spring is stretched
  // by the ring's offset along its own direction, so its reading is its force at rest plus k·u·cos.
  const towards = f.directions[2];
  const at = [f.f1, f.f2, f.r];
  [READING1, READING2, READING3].forEach((slot, i) => {
    const direction = f.directions[i] ?? 0;
    state[slot] = (at[i] ?? NaN) - f.k * u * Math.cos(direction - towards);
  });
  state[RESULTANT] = f.r;
  state[RESULTANT_ANGLE] = f.theta / DEG;
  state[RESULTANT_SQUARED] = (state[READING3] ?? NaN) ** 2;
  state[COS_ANGLE] = Math.cos(f.alpha);
}

/**
 * Composition of two concurrent forces on a force board — a simplified teaching model (KNTT Vật
 * lí 10, bài 13). Two spring balances pull a light ring with `force1` F1 and `force2` F2 (N) at an
 * `angle` α (°) to each other; a third balance pulls it the opposite way to their resultant, so the
 * ring rests on the board's centre mark. At rest the third balance reads the resultant's size,
 * F3 = R = √(F1² + F2² + 2·F1·F2·cos α) (the parallelogram rule), and points opposite to it, θ from
 * F1 with tan θ = F2·sin α/(F1 + F2·cos α).
 *
 * The run: the ring, let go `startOffset` m off the mark towards balance 3, settles back critically
 * damped, u(t) = u0·(1 + ωt)·e^(−ωt) (`settleFrequency` ω, illustrative: the balances' springs,
 * `stiffness` k in N/m each, against the ring and string's small mass, with friction on the board);
 * while it moves each balance reads its force at rest minus k·u·cos(its direction − balance 3's).
 * The settling is one stated simplification (an isotropic, critically damped return); the
 * readings at rest are exact. The state is in closed form in time, so a step never changes it. The
 * run ends after `duration` s. Strings and ring weightless, the board frictionless at rest, the
 * balances ideal springs. A resultant past the third balance's 10 N is refused.
 *
 * Variables: `clock` t (s), `offset` u (m), `reading1`, `reading2`, `reading3` (N), `resultant` R
 * and `resultantAngle` θ (° from F1), `resultantSquared` F3² (N²), `cosAngle` cos α.
 */
export const concurrentForcesModel: SimulationModel = {
  id: 'statics.concurrent-forces',
  inputs: ['force1', 'force2', 'angle', 'stiffness', 'settleFrequency', 'startOffset', 'duration'],
  variables: [
    'clock',
    'offset',
    'reading1',
    'reading2',
    'reading3',
    'resultant',
    'resultantAngle',
    'resultantSquared',
    'cosAngle',
  ],
  predictions: [
    'resultant',
    'resultantAngle',
    'resultantSquared',
    'cosAngle',
    'squaresSum',
    'productTwice',
  ],

  init(inputs, state) {
    state.fill(0);
    derive(state, forces(inputs), 0);
  },

  step(state, dt, inputs) {
    const f = forces(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, f.duration);
    derive(state, f, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= (inputs.duration ?? NaN),

  /**
   * The theory: R and θ by the parallelogram rule, R², cos α; and for R² against cos α at fixed F1
   * and F2, the line's intercept F1² + F2² (`squaresSum`) and slope 2·F1·F2 (`productTwice`).
   */
  predict(inputs) {
    const f = forces(inputs);
    return {
      resultant: f.r,
      resultantAngle: f.theta / DEG,
      resultantSquared: f.r * f.r,
      cosAngle: Math.cos(f.alpha),
      squaresSum: f.f1 * f.f1 + f.f2 * f.f2,
      productTwice: 2 * f.f1 * f.f2,
    };
  },
};
