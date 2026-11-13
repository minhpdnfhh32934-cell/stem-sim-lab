import type { SimulationModel } from '../SimulationModel';

/** How finely the last full drive period is searched for the mass's largest excursion. */
const SEARCH = 400;

// State slots.
const CLOCK = 0;
const DISPLACEMENT = 1; // the mass from its rest position (m), + up
const DRIVER = 2; // the spring's top, driven by the motor (m)
const AMPLITUDE = 3; // the largest |x| over the last full drive period (m)
const STEADY = 4; // the steady amplitude A(f) of the theory (m)
const RATIO = 5; // amplitude / drive amplitude

interface Oscillator {
  readonly w0: number;
  readonly zeta: number;
  readonly w: number;
  readonly a: number;
  readonly duration: number;
  /** The steady state: amplitude and phase lag; the transient's constants. */
  readonly A: number;
  readonly phi: number;
  readonly wd: number;
  readonly c1: number;
  readonly c2: number;
}

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['mass', (m) => m > 0 && m <= 10, 'above 0 and at most 10 kg'],
  ['stiffness', (k) => k > 0 && k <= 1e4, 'above 0 and at most 1e4 N/m'],
  ['dampingRatio', (z) => z > 0 && z < 1, 'above 0 and below 1 (under-damped)'],
  ['driveFrequency', (f) => f > 0 && f <= 20, 'above 0 and at most 20 Hz'],
  ['driveAmplitude', (a) => a > 0 && a <= 0.05, 'above 0 and at most 0.05 m'],
  ['duration', (t) => t > 0 && t <= 120, 'above 0 and at most 120 s'],
];

function oscillator(inputs: Readonly<Record<string, number>>): Oscillator {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Resonance input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Resonance input "${id}" must be ${rule}, got ${value}`);
  }
  const w0 = Math.sqrt((inputs.stiffness ?? NaN) / (inputs.mass ?? NaN));
  const zeta = inputs.dampingRatio ?? NaN;
  const w = 2 * Math.PI * (inputs.driveFrequency ?? NaN);
  const a = inputs.driveAmplitude ?? NaN;
  const A = (w0 * w0 * a) / Math.hypot(w0 * w0 - w * w, 2 * zeta * w0 * w);
  const phi = Math.atan2(2 * zeta * w0 * w, w0 * w0 - w * w);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  // From rest at its rest position: x(0) = 0, x'(0) = 0.
  const c1 = -A * Math.cos(phi);
  const c2 = (zeta * w0 * c1 - A * w * Math.sin(phi)) / wd;
  return { w0, zeta, w, a, duration: inputs.duration ?? NaN, A, phi, wd, c1, c2 };
}

/** The mass's displacement at t: the steady response plus the decaying free one, in closed form. */
function displacementAt(o: Oscillator, t: number): number {
  const free =
    Math.exp(-o.zeta * o.w0 * t) * (o.c1 * Math.cos(o.wd * t) + o.c2 * Math.sin(o.wd * t));
  return o.A * Math.cos(o.w * t - o.phi) + free;
}

/** The largest |x| over the drive period that ends at t (0 before a whole period has passed). */
function amplitudeBefore(o: Oscillator, t: number): number {
  const period = (2 * Math.PI) / o.w;
  if (t < period) return 0;
  let largest = 0;
  for (let i = 0; i <= SEARCH; i++) {
    largest = Math.max(largest, Math.abs(displacementAt(o, t - (period * i) / SEARCH)));
  }
  return largest;
}

function derive(state: Float64Array, o: Oscillator, t: number, measure: boolean): void {
  state[CLOCK] = t;
  state[DISPLACEMENT] = displacementAt(o, t);
  state[DRIVER] = o.a * Math.cos(o.w * t);
  if (measure) {
    const amplitude = amplitudeBefore(o, t);
    state[AMPLITUDE] = amplitude;
    state[RATIO] = amplitude / o.a;
  }
  state[STEADY] = o.A;
}

/**
 * Forced oscillation and resonance — a simplified teaching model (KNTT Vật lí 11, bài 6). A `mass`
 * m (kg) hangs on a spring of `stiffness` k (N/m) whose top a motor moves up and down as
 * a·cos(2π·f·t) (`driveAmplitude` a in m, `driveFrequency` f in Hz); a damping vane gives viscous
 * damping of ratio ζ (`dampingRatio`, illustrative). With x the mass from its rest position:
 * x'' + 2ζω0·x' + ω0²·x = ω0²·a·cos ωt, ω0 = √(k/m). Released at rest, its motion is in closed
 * form: the steady response A·cos(ωt − φ), A = ω0²·a/√((ω0² − ω²)² + (2ζω0ω)²), plus the free
 * oscillation that dies away as e^(−ζω0·t). A is largest near f0 = ω0/2π, and the lighter the
 * damping the higher and sharper the peak: resonance.
 *
 * The amplitude measured: the largest |x| over the last whole drive period, searched at 400 points
 * of the closed form — what the motion shows, so after a short run it still holds some of the free
 * oscillation; by the run's end (`duration`) it has died away. Gravity only shifts the rest
 * position. Spring massless and linear, the motor unaffected by the mass.
 *
 * Variables: `clock` t (s), `displacement` x and `driver` (m), `amplitude` (m, over the last whole
 * period; measured only at the run's end, 0 before), `steadyAmplitude` A (m), `amplitudeRatio`
 * amplitude/a.
 */
export const resonanceModel: SimulationModel = {
  id: 'oscillations.resonance',
  inputs: ['mass', 'stiffness', 'dampingRatio', 'driveFrequency', 'driveAmplitude', 'duration'],
  variables: ['clock', 'displacement', 'driver', 'amplitude', 'steadyAmplitude', 'amplitudeRatio'],
  predictions: [
    'steadyAmplitude',
    'amplitudeRatio',
    'naturalFrequency',
    'phaseLag',
    'peakFrequency',
  ],

  init(inputs, state) {
    state.fill(0);
    derive(state, oscillator(inputs), 0, false);
  },

  step(state, dt, inputs) {
    const o = oscillator(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, o.duration);
    // The search over a period costs 400 evaluations: only where it is read, at the end.
    derive(state, o, t1, t1 >= o.duration);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= (inputs.duration ?? NaN),

  /**
   * The theory: the steady amplitude A and A/a; the natural frequency f0 = ω0/2π; the phase lag φ
   * (°); and the frequency of the largest A, f0·√(1 − 2ζ²) (for ζ < 1/√2).
   */
  predict(inputs) {
    const o = oscillator(inputs);
    return {
      steadyAmplitude: o.A,
      amplitudeRatio: o.A / o.a,
      naturalFrequency: o.w0 / (2 * Math.PI),
      phaseLag: (o.phi * 180) / Math.PI,
      peakFrequency: (o.w0 * Math.sqrt(Math.max(0, 1 - 2 * o.zeta * o.zeta))) / (2 * Math.PI),
    };
  },
};
