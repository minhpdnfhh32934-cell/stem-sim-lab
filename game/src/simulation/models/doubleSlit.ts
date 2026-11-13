import type { SimulationModel } from '../SimulationModel';

// State slots.
const CLOCK = 0;
const SENSOR = 1; // the light sensor's position across the screen from the centre (m)
const INTENSITY = 2; // relative intensity there, I/I0
const SPACING = 3; // the fringe spacing i = λ·D/a (m)
const TEN = 4; // the width of 10 fringes, 10·i (m)
const WAVELENGTH = 5; // λ worked back from the fringes, i·a/D (m)

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['wavelength', (l) => l >= 3.8e-7 && l <= 7.8e-7, 'from 380 to 780 nm (visible light)'],
  ['slitSeparation', (a) => a > 0 && a <= 0.005, 'above 0 and at most 5 mm'],
  ['slitWidth', (b) => b > 0 && b <= 0.001, 'above 0 and at most 1 mm'],
  ['screenDistance', (d) => d > 0 && d <= 5, 'above 0 and at most 5 m'],
  ['scanSpan', (s) => s > 0 && s <= 0.2, 'above 0 and at most 0.2 m'],
  ['scanTime', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
];

function slits(inputs: Readonly<Record<string, number>>) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Double slit input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Double slit input "${id}" must be ${rule}, got ${value}`);
  }
  const a = inputs.slitSeparation ?? NaN;
  const b = inputs.slitWidth ?? NaN;
  if (!(b < a)) throw new Error('Double slit: each slit must be narrower than their separation');
  return {
    lambda: inputs.wavelength ?? NaN,
    a,
    b,
    D: inputs.screenDistance ?? NaN,
    span: inputs.scanSpan ?? NaN,
    time: inputs.scanTime ?? NaN,
  };
}

type Slits = ReturnType<typeof slits>;

/** Relative intensity at y on the screen: two-slit fringes under one slit's diffraction envelope. */
export function fringeIntensity(s: Slits, y: number): number {
  const phase = (Math.PI * s.a * y) / (s.lambda * s.D);
  const spread = (Math.PI * s.b * y) / (s.lambda * s.D);
  const envelope = spread === 0 ? 1 : (Math.sin(spread) / spread) ** 2;
  return Math.cos(phase) ** 2 * envelope;
}

/** The pattern for these inputs (validated), for the renderer: I/I0 at y (m). */
export function doubleSlitPattern(inputs: Readonly<Record<string, number>>): (y: number) => number {
  const s = slits(inputs);
  return (y) => fringeIntensity(s, y);
}

function derive(state: Float64Array, s: Slits, t: number): void {
  const y = -s.span / 2 + (s.span * t) / s.time;
  const i = (s.lambda * s.D) / s.a;
  state[CLOCK] = t;
  state[SENSOR] = y;
  state[INTENSITY] = fringeIntensity(s, y);
  state[SPACING] = i;
  state[TEN] = 10 * i;
  state[WAVELENGTH] = (i * s.a) / s.D;
}

/**
 * Young's double slit with a laser — a simplified teaching model (KNTT Vật lí 11, bài 12). Light
 * of `wavelength` λ (m) passes two slits `slitSeparation` a apart, each `slitWidth` b wide, onto a
 * screen `screenDistance` D away. Far-field (Fraunhofer) and small angles: the bright fringes are
 * i = λ·D/a apart, and the intensity across the screen is I/I0 = cos²(π·a·y/(λD)) ×
 * [sin(π·b·y/(λD))/(π·b·y/(λD))]². The run: a light sensor crosses the screen, `scanSpan` m centred
 * on the central fringe, in `scanTime` s, reading the intensity where it is. In closed form.
 * Monochromatic coherent light, ideal slits, a flat screen.
 *
 * Variables: `clock` t (s), `sensor` y (m), `intensity` I/I0, `fringeSpacing` i (m), `tenFringes`
 * 10·i (m), `wavelengthFromFringes` i·a/D (m).
 */
export const doubleSlitModel: SimulationModel = {
  id: 'optics.double-slit',
  inputs: ['wavelength', 'slitSeparation', 'slitWidth', 'screenDistance', 'scanSpan', 'scanTime'],
  variables: [
    'clock',
    'sensor',
    'intensity',
    'fringeSpacing',
    'tenFringes',
    'wavelengthFromFringes',
  ],
  predictions: ['fringeSpacing', 'tenFringes', 'wavelengthFromFringes', 'spacingSlope'],

  init(inputs, state) {
    state.fill(0);
    derive(state, slits(inputs), 0);
  },

  step(state, dt, inputs) {
    const s = slits(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, s.time);
    derive(state, s, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= (inputs.scanTime ?? NaN),

  /** The theory: i = λD/a, 10·i, λ, and the slope λ/a of i against D. */
  predict(inputs) {
    const s = slits(inputs);
    const i = (s.lambda * s.D) / s.a;
    return {
      fringeSpacing: i,
      tenFringes: 10 * i,
      wavelengthFromFringes: s.lambda,
      spacingSlope: s.lambda / s.a,
    };
  },
};
