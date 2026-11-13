import { describe, expect, it } from 'vitest';
import { soundFrequencyModel as model, soundSignal } from './soundFrequency';

// The oscilloscope's reading of a tuning fork: T = 1/f, the divisions it spans, the signal the
// screen draws, the refusal of a period longer than the screen.

const INPUTS = { frequency: 440, timeBase: 0.0005, signalAmplitude: 2, ringTime: 3, duration: 2 };

describe('sound frequency', () => {
  it('spans T/time base divisions: 440 Hz at 0.5 ms/div is 4.545 divisions, T = 2.273 ms', () => {
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.period).toBeCloseTo(1 / 440, 12);
    expect(p.divisions).toBeCloseTo(1 / 440 / 0.0005, 12); // 4.545 45…
    expect(p.divisions).toBeCloseTo(4.54545, 5);
  });

  it('draws a pure tone dying away: zero every half period, its envelope e^(−t/τ)', () => {
    const T = 1 / 440;
    expect(soundSignal(INPUTS, 0)).toBe(0);
    expect(Math.abs(soundSignal(INPUTS, T / 2))).toBeLessThan(1e-9);
    expect(soundSignal(INPUTS, T / 4)).toBeCloseTo(2 * Math.exp(-T / 4 / 3), 12);
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    while (!model.isComplete?.(state, INPUTS)) model.step(state, 0.01, INPUTS);
    expect(state[1]).toBeCloseTo(2 * Math.exp(-2 / 3), 12);
    expect(state[4]).toBe(440);
  });

  it('refuses a period longer than the screen’s 10 divisions', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, frequency: 256, timeBase: 0.0002 }, state)).toThrow(
      /slower time base/,
    );
    expect(() => model.init({ ...INPUTS, frequency: 10 }, state)).toThrow(/frequency/);
  });
});
