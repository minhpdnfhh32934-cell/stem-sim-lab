import { describe, expect, it } from 'vitest';
import { corrosionModel as model } from './corrosion';

// The rusting tubes: only the order is the experiment's result — no rust without water or without
// air, faster in salt water and in contact with copper, none on a nail zinc protects.

const INPUTS = { tube: 0, days: 7, timeConstant: 10, dayLength: 2 };

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

const rust = (tube: number) => model.predict!({ ...INPUTS, tube }).rust ?? NaN;

describe('conditions for rusting', () => {
  it.each([0.01, 0.37])(
    'rusts in water and air as 1 − e^(−t/τ) over the days (step %s s)',
    (dt) => {
      const end = run(INPUTS, dt);
      expect(end.days).toBeCloseTo(7, 12);
      expect(end.rust).toBeCloseTo(1 - Math.exp(-0.7), 12);
    },
  );

  it('needs both water and air; salt and copper speed it; zinc protects the iron', () => {
    expect(rust(1)).toBe(0); // dry air
    expect(rust(2)).toBe(0); // no air
    expect(rust(3)).toBeGreaterThan(rust(0)); // salt water
    expect(rust(4)).toBeGreaterThan(rust(0)); // copper
    expect(rust(5)).toBe(0); // zinc
    expect(model.predict!({ ...INPUTS, tube: 5 }).zincCorroded).toBeGreaterThan(0);
  });
});
