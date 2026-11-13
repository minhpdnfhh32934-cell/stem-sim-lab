import { describe, expect, it } from 'vitest';
import { electrolysisModel as model } from './electrolysis';

// Faraday's laws worked by hand: 0.50 A for 20 min carry Q = 600 C; copper deposited
// m = 600 × 63.546 / (2 × 96 485.332 123 31) = 0.197 581 6… g.

const INPUTS = { current: 0.5, duration: 1200, timeLapse: 60 };

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

const M = (600 * 63.546) / (2 * 96485.33212331);

describe('electrolysis of copper sulfate', () => {
  it.each([0.01, 0.37])(
    'plates m = Q·M/(2F) on the cathode, the anode losing as much (step %s s)',
    (dt) => {
      const end = run(INPUTS, dt);
      expect(end.time).toBeCloseTo(1200, 9);
      expect(end.charge).toBeCloseTo(600, 9);
      expect(end.cathodeGain).toBeCloseTo(M, 12);
      expect(end.anodeLoss).toBeCloseTo(end.cathodeGain ?? NaN, 15);
      expect(M).toBeCloseTo(0.19758, 5);
    },
  );

  it('is proportional to the charge: twice the current or twice the time, twice the copper', () => {
    const m = (i: number, t: number) =>
      model.predict!({ ...INPUTS, current: i, duration: t }).mass ?? NaN;
    expect(m(1, 1200) / m(0.5, 1200)).toBeCloseTo(2, 12);
    expect(m(0.5, 2400) / m(0.5, 1200)).toBeCloseTo(2, 12);
    expect(model.predict!(INPUTS).electrons).toBeCloseTo((600 / 96485.33212331) * 1000, 12);
  });

  it('takes the run’s time compressed by the time lapse', () => {
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    expect(model.step(state, 1, INPUTS)).toBeCloseTo(1, 12);
    expect(state[0]).toBeCloseTo(60, 12);
  });
});
