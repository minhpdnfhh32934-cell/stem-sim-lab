import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/** The magnetic constant μ0 (T·m/A): CODATA 2018, 1.25663706212 × 10⁻⁶. */
export const MU0 = 1.25663706212e-6;

function need(inputs: Inputs, id: string, accepts: (v: number) => boolean, rule: string): number {
  const value = inputs[id];
  if (value === undefined) throw new Error(`Magnetism input "${id}" is missing`);
  if (!accepts(value)) throw new Error(`Magnetism input "${id}" must be ${rule}, got ${value}`);
  return value;
}

// ---------------------------------------------------------------------------------------------
// A current balance: the force on a wire in a magnet's field

const W_CLOCK = 0;
const W_CURRENT = 1;
const W_FORCE = 2;
const W_READING = 3;
const W_SWITCH = 4;

function balance(inputs: Inputs) {
  const I = need(inputs, 'current', (v) => v >= 0 && v <= 5, '0–5 A');
  const L = need(inputs, 'wireLength', (v) => v > 0 && v <= 0.2, 'above 0, at most 0.2 m');
  const angle = need(inputs, 'angle', (v) => v >= 0 && v <= 180, '0–180°');
  const B = need(inputs, 'fieldStrength', (v) => v > 0 && v <= 1, 'above 0, at most 1 T');
  const g = need(inputs, 'gravity', (v) => v > 0 && v <= 20, 'above 0, at most 20 m/s²');
  const on = need(inputs, 'switchTime', (v) => v >= 0, 'at least 0 s');
  const duration = need(inputs, 'duration', (v) => v > on, 'after the switch closes');
  const sin = Math.sin((angle * Math.PI) / 180);
  return { I, B, L, g, on, duration, sin, force: B * I * L * sin };
}

function weighed(state: Float64Array, b: ReturnType<typeof balance>, t: number) {
  const closed = t >= b.on;
  state[W_CLOCK] = t;
  state[W_CURRENT] = closed ? b.I : 0;
  state[W_FORCE] = closed ? b.force : 0;
  // The wire is pushed up, so the magnet on the pan is pushed down by as much: its reading rises
  // by F/g (kg), the balance settled at once.
  state[W_READING] = closed ? b.force / b.g : 0;
  state[W_SWITCH] = closed ? 1 : 0;
}

/**
 * The force on a current in a magnetic field, with a current balance (KNTT Vật lí 12, bài 15–17)
 * — a simplified teaching model. A straight piece of wire of `wireLength` L (m) carries `current`
 * I (A) through the uniform field B (`fieldStrength`, T, hidden: the student finds it) between a
 * magnet's poles, at `angle` α (°) to it: F = B·I·L·sin α. The magnet stands on an electronic
 * balance; by Newton's third law the wire pushes it down as hard as the field pushes the wire up,
 * so the balance's reading rises by F/g (`gravity` g). The switch closes at `switchTime`. The field
 * is uniform over L and nothing outside it, the leads feel no force and the balance settles at once.
 *
 * Variables: `clock` (s), `current` I (A), `force` F (N), `balanceReading` Δm (kg), `switch` (0/1).
 */
export const currentBalanceModel: SimulationModel = {
  id: 'magnetism.current-balance',
  inputs: ['current', 'wireLength', 'angle', 'fieldStrength', 'gravity', 'switchTime', 'duration'],
  variables: ['clock', 'current', 'force', 'balanceReading', 'switch'],
  predictions: ['force', 'balanceReading', 'forcePerAmpere', 'field'],

  init(inputs, state) {
    state.fill(0);
    weighed(state, balance(inputs), 0);
  },

  step(state, dt, inputs) {
    const b = balance(inputs);
    const t0 = state[W_CLOCK] ?? 0;
    // Land on the switch, then on the end.
    const t1 = Math.min(t0 + dt, t0 < b.on ? b.on : b.duration);
    weighed(state, b, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[W_CLOCK] ?? 0) >= balance(inputs).duration,

  /** The theory: F = B·I·L·sin α; Δm = F/g; the slope of F against I, B·L·sin α; and B. */
  predict(inputs) {
    const b = balance(inputs);
    return {
      force: b.force,
      balanceReading: b.force / b.g,
      forcePerAmpere: b.B * b.L * b.sin,
      field: b.B,
    };
  },
};

// ---------------------------------------------------------------------------------------------
// Electromagnetic induction: a magnet through a coil

const I_TIME = 0;
const I_POSITION = 1;
const I_LINKAGE = 2;
const I_EMF = 3;
const I_CURRENT = 4;
const I_FIRST = 5;
const I_SECOND = 6;
const I_PEAK = 7;

/** (5/4)^(5/2): where a dipole on a loop's axis gives the largest dΦ/dz, at z = ±a/2. */
const PEAK_FACTOR = 1.25 ** 2.5;

function coil(inputs: Inputs) {
  const v = need(inputs, 'speed', (x) => x > 0 && x <= 5, 'above 0, at most 5 m/s');
  const N = need(inputs, 'turns', (x) => x >= 1 && x <= 5000, '1–5000 turns');
  // Its sign picks the pole that leads: 1 north first, −1 south first.
  const pole =
    need(
      inputs,
      'polarity',
      (x) => x !== 0 && Math.abs(x) <= 1,
      '1 (north pole first) or −1 (south pole first)',
    ) > 0
      ? 1
      : -1;
  const a = need(inputs, 'coilRadius', (x) => x > 0 && x <= 0.2, 'above 0, at most 0.2 m');
  const m = need(inputs, 'magnetMoment', (x) => x > 0 && x <= 100, 'above 0, at most 100 A·m²');
  const z0 = need(inputs, 'startDistance', (x) => x > a, 'farther than the coil’s radius');
  const R = need(inputs, 'circuitResistance', (x) => x > 0, 'above 0 Ω');
  const lapse = need(inputs, 'timeLapse', (x) => x > 0, 'above 0');
  const duration = (2 * z0) / v;
  const k = 0.5 * MU0 * m * a * a * pole; // Φ = k/(z² + a²)^(3/2), per turn
  const flux = (z: number) => k / (z * z + a * a) ** 1.5;
  // e = −N·dΦ/dt = −N·v·dΦ/dz = 3·N·v·k·z/(z² + a²)^(5/2)
  const emf = (z: number) => (3 * N * v * k * z) / (z * z + a * a) ** 2.5;
  const peak = (3 * MU0 * m * N * v) / (4 * a * a * PEAK_FACTOR);
  return { v, N, a, z0, R, lapse, duration, flux, emf, peak };
}

function moved(state: Float64Array, c: ReturnType<typeof coil>, t: number) {
  const z = -c.z0 + c.v * t;
  const e = c.emf(z);
  state[I_TIME] = t;
  state[I_POSITION] = z;
  state[I_LINKAGE] = c.N * c.flux(z);
  state[I_EMF] = e;
  state[I_CURRENT] = e / c.R;
}

/**
 * Electromagnetic induction: a bar magnet through a coil (KNTT Vật lí 12, bài 16–18) — a simplified
 * teaching model. A magnet of moment m (`magnetMoment`, A·m², illustrative), taken as a point
 * dipole, moves at constant `speed` v (m/s) along the axis of a coil of `turns` N and radius a
 * (`coilRadius`, m), from `startDistance` z0 before its centre to z0 past it, north pole first
 * (`polarity` > 0) or south pole first (< 0). The flux through each turn is the dipole's exact flux,
 * Φ = μ0·m·a²/(2·(z² + a²)^(3/2)) (turns all at the coil's centre); e = −N·dΦ/dt: a pulse of one
 * sign as the magnet comes in (flux rising: Lenz), of the other as it leaves, each peaking at
 * |z| = a/2 with |e| = 3·μ0·m·N·v/(4·a²·(5/4)^(5/2)) — proportional to N and to v. The current
 * through the galvanometer is e/R (`circuitResistance`, coil and meter; the coil's self-inductance
 * neglected). Time is slowed (`timeLapse` < 1); the two peaks are caught exactly.
 *
 * Variables: `labTime` (s), `magnetPosition` z (m), `fluxLinkage` N·Φ (Wb), `emf` e (V),
 * `current` (A), `firstPeak` and `secondPeak` (V: the pulses' peaks, signed, 0 until passed),
 * `peakEmf` (V: the larger size seen so far).
 */
export const inductionModel: SimulationModel = {
  id: 'magnetism.induction',
  inputs: [
    'speed',
    'turns',
    'polarity',
    'coilRadius',
    'magnetMoment',
    'startDistance',
    'circuitResistance',
    'timeLapse',
  ],
  variables: [
    'labTime',
    'magnetPosition',
    'fluxLinkage',
    'emf',
    'current',
    'firstPeak',
    'secondPeak',
    'peakEmf',
  ],
  predictions: ['peakEmf', 'firstPeak', 'secondPeak', 'peakPerSpeed', 'fluxLinkage'],

  init(inputs, state) {
    state.fill(0);
    moved(state, coil(inputs), 0);
    state[I_PEAK] = Math.abs(state[I_EMF] ?? 0);
  },

  step(state, dt, inputs) {
    const c = coil(inputs);
    const time = state[I_TIME] ?? 0;
    if (!(time < c.duration)) return 0;
    const next = Math.min(time + c.lapse * dt, c.duration);
    // The pulses peak where the magnet is a/2 from the centre: caught exactly when passed.
    for (const [z, slot] of [
      [-c.a / 2, I_FIRST],
      [c.a / 2, I_SECOND],
    ] as const) {
      const at = (z + c.z0) / c.v;
      if (time < at && next >= at) state[slot] = c.emf(z);
    }
    moved(state, c, next);
    state[I_PEAK] = Math.max(
      state[I_PEAK] ?? 0,
      Math.abs(state[I_EMF] ?? 0),
      Math.abs(state[I_FIRST] ?? 0),
      Math.abs(state[I_SECOND] ?? 0),
    );
    return (next - time) / c.lapse;
  },

  isComplete: (state, inputs) => (state[I_TIME] ?? 0) >= coil(inputs).duration,

  /**
   * The theory: the peak size 3·μ0·m·N·v/(4·a²·(5/4)^(5/2)); the first and second peaks with their
   * signs (−, then + for north pole first); the slope of the peak against v; and N·Φ with the magnet
   * at the coil's centre, μ0·m·N/(2a).
   */
  predict(inputs) {
    const c = coil(inputs);
    const sign = Math.sign(c.emf(c.a / 2));
    return {
      peakEmf: c.peak,
      firstPeak: -sign * c.peak,
      secondPeak: sign * c.peak,
      peakPerSpeed: c.peak / c.v,
      fluxLinkage: c.N * c.flux(0),
    };
  },
};
