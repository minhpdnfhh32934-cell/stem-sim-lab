import type { SimulationModel } from '../SimulationModel';

/** The speed of sound in dry air at 0 °C (m/s), and its rise with temperature, v = v0·√(1 + t/273.15). */
const V0 = 331.3;
/** How sharp a resonance is (illustrative): the loudness 1/√(cos² + δ²), normalised to 1 at a peak. */
const SHARPNESS = 0.05;

// State slots.
const CLOCK = 0;
const COLUMN = 1; // the air column's length above the water (m)
const LOUDNESS = 2; // relative loudness, 1 at a resonance
const FIRST = 3; // the first resonance's column length L1 (m), 0 until passed
const SECOND = 4; // the second's L2 (m), 0 until passed
const WAVELENGTH = 5; // 2(L2 − L1) (m), 0 until both are known
const SPEED = 6; // f·λ (m/s), 0 until both are known

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['frequency', (f) => f >= 100 && f <= 2000, 'from 100 to 2000 Hz'],
  ['temperature', (t) => t >= -20 && t <= 50, 'from −20 to 50 °C'],
  ['tubeRadius', (r) => r > 0 && r <= 0.05, 'above 0 and at most 0.05 m'],
  ['tubeLength', (l) => l > 0 && l <= 2, 'above 0 and at most 2 m'],
  ['startColumn', (l) => l >= 0 && l <= 0.5, 'from 0 to 0.5 m'],
  ['lowerSpeed', (v) => v > 0 && v <= 1, 'above 0 and at most 1 m/s'],
];

function tube(inputs: Readonly<Record<string, number>>) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Resonance tube input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Resonance tube input "${id}" must be ${rule}, got ${value}`);
  }
  const f = inputs.frequency ?? NaN;
  const v = V0 * Math.sqrt(1 + (inputs.temperature ?? NaN) / 273.15);
  const lambda = v / f;
  const e = 0.6 * (inputs.tubeRadius ?? NaN);
  const l1 = lambda / 4 - e;
  const l2 = (3 * lambda) / 4 - e;
  const start = inputs.startColumn ?? NaN;
  const length = inputs.tubeLength ?? NaN;
  const speed = inputs.lowerSpeed ?? NaN;
  if (!(start < l1))
    throw new Error('Resonance tube: the column must start shorter than the first resonance');
  const stop = l2 + lambda / 8; // past the second resonance, before a third
  if (!(stop <= length)) {
    throw new Error(
      `Resonance tube: the second resonance (${l2.toFixed(3)} m) does not fit in the ${length} m tube; ` +
        'choose a higher frequency',
    );
  }
  return { f, v, lambda, e, l1, l2, start, speed, end: (stop - start) / speed };
}

type Tube = ReturnType<typeof tube>;

/** Relative loudness with a column of l: peaks where l + e is an odd number of quarter-wavelengths. */
function loudness(t: Tube, l: number): number {
  const c = Math.cos((2 * Math.PI * (l + t.e)) / t.lambda);
  return SHARPNESS / Math.hypot(c, SHARPNESS);
}

function derive(state: Float64Array, t: Tube, time: number): void {
  const l = t.start + t.speed * time;
  state[CLOCK] = time;
  state[COLUMN] = l;
  state[LOUDNESS] = loudness(t, l);
  // Each resonance recorded exactly where it lies once the column has passed it.
  state[FIRST] = l >= t.l1 ? t.l1 : 0;
  state[SECOND] = l >= t.l2 ? t.l2 : 0;
  const both = l >= t.l2;
  state[WAVELENGTH] = both ? 2 * (t.l2 - t.l1) : 0;
  state[SPEED] = both ? t.f * 2 * (t.l2 - t.l1) : 0;
}

/**
 * The speed of sound with a resonance tube — a simplified teaching model (KNTT Vật lí 11, bài 15).
 * A tuning fork of `frequency` f sounds over a glass tube of `tubeRadius` r whose water level is
 * lowered at `lowerSpeed`, lengthening the air column above it from `startColumn`. The column,
 * closed by the water and open at the top, resonates when its length plus the end correction
 * e = 0.6·r is an odd number of quarter-wavelengths: L1 = λ/4 − e, L2 = 3λ/4 − e, so
 * λ = 2(L2 − L1) and v = f·λ, whatever e is. The speed of sound in dry air at `temperature` t (°C)
 * is v = 331.3·√(1 + t/273.15) m/s. The loudness against the column is a resonance curve,
 * δ/√(cos²(2π(l + e)/λ) + δ²), δ = 0.05 (illustrative sharpness). The run lowers the water until
 * the column is λ/8 past L2; a tube too short for L2 is refused. In closed form in time.
 *
 * Variables: `clock` t (s), `column` l (m), `loudness`, `firstResonance` L1 and `secondResonance`
 * L2 (m, 0 until passed), `wavelength` 2(L2 − L1) and `speedOfSound` f·λ (0 until both are known).
 */
export const resonanceTubeModel: SimulationModel = {
  id: 'waves.resonance-tube',
  inputs: ['frequency', 'temperature', 'tubeRadius', 'tubeLength', 'startColumn', 'lowerSpeed'],
  variables: [
    'clock',
    'column',
    'loudness',
    'firstResonance',
    'secondResonance',
    'wavelength',
    'speedOfSound',
  ],
  predictions: ['firstResonance', 'secondResonance', 'wavelength', 'speedOfSound', 'endCorrection'],

  init(inputs, state) {
    state.fill(0);
    derive(state, tube(inputs), 0);
  },

  step(state, dt, inputs) {
    const t = tube(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, t.end);
    derive(state, t, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= tube(inputs).end - 1e-12,

  /** The theory: L1, L2, λ = v/f, v = 331.3·√(1 + t/273.15), and e = 0.6·r. */
  predict(inputs) {
    const t = tube(inputs);
    return {
      firstResonance: t.l1,
      secondResonance: t.l2,
      wavelength: t.lambda,
      speedOfSound: t.v,
      endCorrection: t.e,
    };
  },
};
