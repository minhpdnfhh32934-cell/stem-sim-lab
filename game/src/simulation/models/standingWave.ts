import type { SimulationModel } from '../SimulationModel';

// State slots.
const CLOCK = 0;
const FREQUENCY = 1; // the generator's frequency (Hz)
const AMPLITUDE = 2; // the string's largest swing, at an antinode (m)
const RESONANT = 3; // f_n = n·v/(2L) (Hz)
const SPEED = 4; // v = 2L·f_n/n (m/s)
const WAVELENGTH = 5; // λ_n = 2L/n (m)

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['hangingMass', (m) => m > 0 && m <= 2, 'above 0 and at most 2 kg'],
  ['loops', (n) => Number.isInteger(n) && n >= 1 && n <= 8, 'a whole number from 1 to 8'],
  ['stringLength', (l) => l > 0 && l <= 3, 'above 0 and at most 3 m'],
  ['linearDensity', (u) => u > 0 && u <= 0.1, 'above 0 and at most 0.1 kg/m'],
  ['gravity', (g) => g > 0 && g <= 30, 'above 0 and at most 30 m/s²'],
  ['driveAmplitude', (a) => a > 0 && a <= 0.005, 'above 0 and at most 5 mm'],
  ['dampingRatio', (z) => z > 0 && z < 0.5, 'above 0 and below 0.5'],
  ['sweepTime', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
  ['holdTime', (t) => t >= 0 && t <= 60, 'from 0 to 60 s'],
];

function string(inputs: Readonly<Record<string, number>>) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Standing wave input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Standing wave input "${id}" must be ${rule}, got ${value}`);
  }
  const tension = (inputs.hangingMass ?? NaN) * (inputs.gravity ?? NaN);
  const v = Math.sqrt(tension / (inputs.linearDensity ?? NaN));
  const L = inputs.stringLength ?? NaN;
  const n = inputs.loops ?? NaN;
  const sweep = inputs.sweepTime ?? NaN;
  return {
    v,
    L,
    n,
    fn: (n * v) / (2 * L),
    a: inputs.driveAmplitude ?? NaN,
    zeta: inputs.dampingRatio ?? NaN,
    sweep,
    end: sweep + (inputs.holdTime ?? NaN),
  };
}

type Str = ReturnType<typeof string>;

/** The generator's frequency at t: raised from 60 % of f_n to f_n over the sweep, then held. */
const frequencyAt = (s: Str, t: number) => s.fn * (0.6 + 0.4 * Math.min(t / s.sweep, 1));

function derive(state: Float64Array, s: Str, t: number): void {
  const f = frequencyAt(s, t);
  const r = f / s.fn;
  state[CLOCK] = t;
  state[FREQUENCY] = f;
  state[AMPLITUDE] = s.a / Math.hypot(1 - r * r, 2 * s.zeta * r);
  state[RESONANT] = s.fn;
  state[SPEED] = (2 * s.L * s.fn) / s.n;
  state[WAVELENGTH] = (2 * s.L) / s.n;
}

/**
 * Standing waves on a string — a simplified teaching model (KNTT Vật lí 11, bài 13). A string of
 * `linearDensity` μ (kg/m) runs `stringLength` L (m) from a vibration generator over a pulley, a
 * `hangingMass` m giving it the tension T = m·g (`gravity` g). Waves travel along it at
 * v = √(T/μ); with both ends fixed, it stands with n loops when L = n·λ/2, at f_n = n·v/(2L).
 *
 * The run: the generator's frequency is raised steadily from 60 % of f_n (for the dialled number of
 * `loops` n) to f_n over `sweepTime` s and held `holdTime` s, as the student turns its knob until n
 * loops stand still and large. The swing at an antinode is the n-th mode's steady response to the
 * generator's `driveAmplitude` a, a/√((1 − r²)² + (2ζr)²), r = f/f_n (`dampingRatio` ζ,
 * illustrative); the other modes are left out. In closed form in time. A uniform, perfectly
 * flexible string, the generator's end a node, tension unchanged by the swing.
 *
 * Variables: `clock` t (s), `frequency` f (Hz), `amplitude` (m), `resonantFrequency` f_n (Hz),
 * `waveSpeed` v = 2L·f_n/n (m/s), `wavelength` λ_n = 2L/n (m).
 */
export const standingWaveModel: SimulationModel = {
  id: 'waves.standing-string',
  inputs: [
    'hangingMass',
    'loops',
    'stringLength',
    'linearDensity',
    'gravity',
    'driveAmplitude',
    'dampingRatio',
    'sweepTime',
    'holdTime',
  ],
  variables: ['clock', 'frequency', 'amplitude', 'resonantFrequency', 'waveSpeed', 'wavelength'],
  predictions: ['resonantFrequency', 'waveSpeed', 'wavelength', 'frequencyPerLoop'],

  init(inputs, state) {
    state.fill(0);
    derive(state, string(inputs), 0);
  },

  step(state, dt, inputs) {
    const s = string(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, s.end);
    derive(state, s, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= string(inputs).end - 1e-12,

  /** The theory: f_n = n·v/(2L), v = √(T/μ), λ_n = 2L/n, and the slope v/(2L) of f_n against n. */
  predict(inputs) {
    const s = string(inputs);
    return {
      resonantFrequency: s.fn,
      waveSpeed: s.v,
      wavelength: (2 * s.L) / s.n,
      frequencyPerLoop: s.v / (2 * s.L),
    };
  },
};
