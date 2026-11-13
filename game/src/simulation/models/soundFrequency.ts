import type { SimulationModel } from '../SimulationModel';

// State slots.
const CLOCK = 0;
const ENVELOPE = 1; // the microphone's signal amplitude (V), dying away as the fork rings down
const PERIOD = 2; // one period of the sound (s)
const DIVISIONS = 3; // how many screen divisions one period spans at the time base
const FREQUENCY = 4; // 1/T (Hz)

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['frequency', (f) => f >= 20 && f <= 2e4, 'from 20 Hz to 20 kHz (what is heard)'],
  ['timeBase', (b) => b > 0 && b <= 0.01, 'above 0 and at most 10 ms per division'],
  ['signalAmplitude', (v) => v > 0 && v <= 10, 'above 0 and at most 10 V'],
  ['ringTime', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
  ['duration', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
];

function fork(inputs: Readonly<Record<string, number>>) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Sound frequency input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Sound frequency input "${id}" must be ${rule}, got ${value}`);
  }
  const f = inputs.frequency ?? NaN;
  const base = inputs.timeBase ?? NaN;
  if (1 / f > 10 * base) {
    throw new Error(
      `Sound frequency: one period (${(1000 / f).toFixed(2)} ms) is longer than the screen's ` +
        `10 divisions at ${base * 1000} ms per division; choose a slower time base`,
    );
  }
  return {
    f,
    base,
    v0: inputs.signalAmplitude ?? NaN,
    tau: inputs.ringTime ?? NaN,
    duration: inputs.duration ?? NaN,
  };
}

type Fork = ReturnType<typeof fork>;

function derive(state: Float64Array, k: Fork, t: number): void {
  state[CLOCK] = t;
  state[ENVELOPE] = k.v0 * Math.exp(-t / k.tau);
  state[PERIOD] = 1 / k.f;
  state[DIVISIONS] = 1 / (k.f * k.base);
  state[FREQUENCY] = k.f;
}

/**
 * The microphone's signal at time t (V): the struck fork's tone, v0·e^(−t/τ)·sin(2π·f·t). What the
 * oscilloscope draws — the screen shows this function over its 10 divisions of the time base.
 */
export function soundSignal(inputs: Readonly<Record<string, number>>, t: number): number {
  const k = fork(inputs);
  return k.v0 * Math.exp(-t / k.tau) * Math.sin(2 * Math.PI * k.f * t);
}

/**
 * Measuring the frequency of a sound with an oscilloscope — a simplified teaching model (KNTT Vật
 * lí 11, bài 10). A tuning fork of `frequency` f (Hz) is struck by a microphone joined to an
 * oscilloscope whose `timeBase` (s per division) spreads time across its 10 divisions. The
 * microphone's signal is v0·e^(−t/τ)·sin(2πft) (`signalAmplitude` v0 in V, `ringTime` τ in s,
 * illustrative): a pure tone dying away. One period T = 1/f spans T/time base divisions on the
 * screen: counting them gives T, and f = 1/T. A period longer than the screen is refused.
 *
 * The run: the fork rings for `duration` s; the state is in closed form (the time series is the
 * envelope: the tone itself is far faster than any sample). The microphone and the oscilloscope
 * are ideal (no delay, no distortion); the fork's pitch does not change as it rings down.
 *
 * Variables: `clock` t (s), `envelope` (V), `period` T (s), `divisions` per period, `frequency` (Hz).
 */
export const soundFrequencyModel: SimulationModel = {
  id: 'waves.sound-frequency',
  inputs: ['frequency', 'timeBase', 'signalAmplitude', 'ringTime', 'duration'],
  variables: ['clock', 'envelope', 'period', 'divisions', 'frequency'],
  predictions: ['period', 'divisions', 'frequency'],

  init(inputs, state) {
    state.fill(0);
    derive(state, fork(inputs), 0);
  },

  step(state, dt, inputs) {
    const k = fork(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, k.duration);
    derive(state, k, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= (inputs.duration ?? NaN),

  /** The theory: T = 1/f, the divisions it spans, f. */
  predict(inputs) {
    const k = fork(inputs);
    return { period: 1 / k.f, divisions: 1 / (k.f * k.base), frequency: k.f };
  },
};
