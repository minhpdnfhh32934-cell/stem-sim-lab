import type { SimulationModel } from '../SimulationModel';

// State slots.
const CLOCK = 0;
const PROBE = 1; // the probe's position along S1S2 from its midpoint (m)
const AMPLITUDE = 2; // the water's amplitude there, A/A0 (one source alone: 1)
const MAXIMA = 3; // the maxima (lines of strong vibration) crossing S1S2 between the sources
const SPAN = 4; // the distance from the first of them to the last (m)
const SPACING = 5; // between two neighbours, L/(n − 1) (m)
const WAVELENGTH = 6; // λ worked back from them, 2·spacing (m)
const SPEED = 7; // v = λ·f (m/s)

/** Gravity (m/s²) and water at 20 °C: surface tension (N/m) and density (kg/m³), CRC Handbook. */
const G = 9.81;
const SIGMA = 0.0728;
const RHO = 998;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['frequency', (f) => f >= 5 && f <= 50, 'from 5 to 50 Hz'],
  ['sourceSeparation', (d) => d >= 0.01 && d <= 0.2, 'from 1 to 20 cm'],
  ['depth', (h) => h >= 0.002 && h <= 0.05, 'from 2 to 50 mm'],
  ['scanTime', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
];

/**
 * The wavenumber k (rad/m) of water waves of angular frequency ω (rad/s) on water `depth` h deep:
 * the root of ω² = (g·k + (σ/ρ)·k³)·tanh(k·h), the dispersion of capillary–gravity waves (Lamb,
 * Hydrodynamics §267). The right side grows with k: bisection, to the last bit.
 */
export function rippleWavenumber(omega: number, depth: number): number {
  const excess = (k: number) =>
    (G * k + (SIGMA / RHO) * k ** 3) * Math.tanh(k * depth) - omega ** 2;
  let lo = 0;
  let hi = 1;
  while (excess(hi) < 0) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > hi * 1e-15; i++) {
    const mid = (lo + hi) / 2;
    if (excess(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function tank(inputs: Readonly<Record<string, number>>) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Ripple tank input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Ripple tank input "${id}" must be ${rule}, got ${value}`);
  }
  const f = inputs.frequency ?? NaN;
  const d = inputs.sourceSeparation ?? NaN;
  const omega = 2 * Math.PI * f;
  const k = rippleWavenumber(omega, inputs.depth ?? NaN);
  const lambda = (2 * Math.PI) / k;
  if (!(d > lambda)) {
    throw new Error(
      'Ripple tank: the sources must be more than one wavelength apart for maxima between them',
    );
  }
  // Maxima where the paths differ by m·λ: at x = m·λ/2 from the midpoint, strictly between them.
  const m = Math.ceil(d / lambda) - 1;
  return { f, d, k, omega, lambda, m, time: inputs.scanTime ?? NaN };
}

type Tank = ReturnType<typeof tank>;

/** The waves for these inputs (validated), for the renderer: k (rad/m), ω (rad/s), λ (m). */
export function rippleWaves(inputs: Readonly<Record<string, number>>) {
  const { k, omega, lambda } = tank(inputs);
  return { k, omega, lambda };
}

function derive(state: Float64Array, s: Tank, t: number): void {
  const x = -s.d / 2 + (s.d * t) / s.time;
  const span = s.m * s.lambda;
  state[CLOCK] = t;
  state[PROBE] = x;
  // Two equal waves whose paths differ by 2x: A = 2·A0·|cos(k·x)|.
  state[AMPLITUDE] = 2 * Math.abs(Math.cos(s.k * x));
  state[MAXIMA] = 2 * s.m + 1;
  state[SPAN] = span;
  state[SPACING] = span / (2 * s.m);
  state[WAVELENGTH] = (2 * span) / (2 * s.m);
  state[SPEED] = ((2 * span) / (2 * s.m)) * s.f;
}

/**
 * Interference of water waves in a ripple tank — a simplified teaching model (KNTT Vật lí 11, bài
 * 12). Two dippers `sourceSeparation` d apart, driven together at `frequency` f, make circular
 * waves on water `depth` h deep. Their wavelength comes from the capillary–gravity dispersion
 * relation (`rippleWavenumber`), so the speed v = λ·f changes with f and h. Along the line S1S2
 * the two paths differ by 2x: the water vibrates most where that is a whole number of
 * wavelengths, x = m·λ/2, and stays still half way between. The run: a probe crosses S1S2 in
 * `scanTime` s, reading the amplitude A/A0 = 2·|cos(k·x)| where it is. In closed form. Equal
 * sources, no damping, no reflection from the tank's sides, small waves.
 *
 * Variables: `clock` t (s), `probe` x (m), `amplitude` A/A0, `maxima` n, `maximaSpan` L (m),
 * `maximaSpacing` L/(n − 1) (m), `wavelengthFromMaxima` (m), `waveSpeed` v (m/s).
 */
export const rippleTankModel: SimulationModel = {
  id: 'waves.ripple-tank',
  inputs: ['frequency', 'sourceSeparation', 'depth', 'scanTime'],
  variables: [
    'clock',
    'probe',
    'amplitude',
    'maxima',
    'maximaSpan',
    'maximaSpacing',
    'wavelengthFromMaxima',
    'waveSpeed',
  ],
  predictions: ['maxima', 'maximaSpan', 'maximaSpacing', 'wavelengthFromMaxima', 'waveSpeed'],

  init(inputs, state) {
    state.fill(0);
    derive(state, tank(inputs), 0);
  },

  step(state, dt, inputs) {
    const s = tank(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, s.time);
    derive(state, s, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= (inputs.scanTime ?? NaN),

  /** The theory: n = 2m + 1 maxima, L = m·λ, spacing λ/2, λ and v = λ·f from the dispersion. */
  predict(inputs) {
    const s = tank(inputs);
    return {
      maxima: 2 * s.m + 1,
      maximaSpan: s.m * s.lambda,
      maximaSpacing: s.lambda / 2,
      wavelengthFromMaxima: s.lambda,
      waveSpeed: s.lambda * s.f,
    };
  },
};
