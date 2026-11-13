import { describe, expect, it } from 'vitest';
import { tropismModel as model } from './tropism';

const base = { light: 1, bendAngle: 45, bendTime: 7200, duration: 28800, speed: 2880 };
const predict = (condition: number, light = 1) => model.predict!({ ...base, condition, light });

describe('tropism', () => {
  it('bends towards a side light only when the tip sees it (Darwin, Boysen-Jensen)', () => {
    expect(predict(0).bends).toBe(1); // intact
    expect(predict(1).bends).toBe(0); // tip covered
    expect(predict(2).bends).toBe(1); // base covered
    expect(predict(3).bends).toBe(0); // tip removed
    expect(Math.sign(predict(0, -1).angle ?? 0)).toBe(-1); // light from the left: bends left
    expect(predict(0, 0).angle).toBe(0); // light from above: grows straight
  });

  it('turns up when laid on its side in the dark', () => {
    expect(predict(4).angle).toBeGreaterThan(80);
  });

  it('approaches the bend with its time constant', () => {
    const inputs = { ...base, condition: 0 };
    const state = new Float64Array(model.variables.length);
    model.init(inputs, state);
    for (let i = 0; i < 100000 && !model.isComplete?.(state, inputs); i++)
      model.step(state, 0.02, inputs);
    expect(state[2]).toBeCloseTo(45 * (1 - Math.exp(-4)), 9);
    expect(state[3]).toBe(-1); // auxin on the shaded (left) side
  });
});
