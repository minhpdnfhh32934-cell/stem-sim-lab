import { describe, expect, it } from 'vitest';
import { heartRateModel as model, maxRate, rateAt, targetRate } from './heartRate';

const inputs = {
  age: 16,
  restingRate: 70,
  intensity: 70,
  exercise: 180,
  recovery: 120,
  riseTime: 30,
  fallTime: 45,
  strokeVolume: 70,
  speed: 30,
};

describe('heart rate', () => {
  it('uses Tanaka’s maximum and Karvonen’s target', () => {
    expect(maxRate(20)).toBe(194);
    expect(maxRate(16)).toBeCloseTo(196.8, 12);
    expect(targetRate(inputs)).toBeCloseTo(70 + 0.7 * (196.8 - 70), 12);
  });

  it('rises towards the target, 63 % of the way after one time constant', () => {
    const target = targetRate(inputs);
    expect(rateAt(inputs, 0)).toBe(70);
    expect((rateAt(inputs, 30) - 70) / (target - 70)).toBeCloseTo(1 - Math.exp(-1), 12);
  });

  it('recovers towards rest after the exercise, continuously', () => {
    expect(rateAt(inputs, 180 + 1e-9)).toBeCloseTo(rateAt(inputs, 180), 6);
    const after = rateAt(inputs, 180 + 45);
    expect((after - 70) / (rateAt(inputs, 180) - 70)).toBeCloseTo(Math.exp(-1), 12);
  });

  it('ends on the predicted values, with cardiac output = rate × stroke volume', () => {
    const state = new Float64Array(model.variables.length);
    model.init(inputs, state);
    let peak = 0;
    for (let i = 0; i < 100000 && !model.isComplete?.(state, inputs); i++) {
      model.step(state, 0.02, inputs);
      peak = Math.max(peak, state[2] ?? 0);
    }
    const p = model.predict!(inputs);
    expect(peak).toBeCloseTo(p.peakRate ?? NaN, 6);
    expect(state[2]).toBeCloseTo(p.finalRate ?? NaN, 9);
    expect(state[3]).toBeCloseTo(((state[2] ?? 0) * 70) / 1000, 12);
  });
});
