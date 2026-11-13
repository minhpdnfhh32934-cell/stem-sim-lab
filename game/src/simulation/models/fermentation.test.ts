import { describe, expect, it } from 'vitest';
import { activity, ETHANOL, fermentationModel as model, gasVolume, GLUCOSE } from './fermentation';

const inputs = {
  glucose: 5,
  yeast: 2,
  temperature: 35,
  uptake: 1,
  halfSaturation: 0.5,
  duration: 1200,
  speed: 120,
};

function run(over: Partial<typeof inputs> = {}) {
  const i = { ...inputs, ...over };
  const state = new Float64Array(model.variables.length);
  model.init(i, state);
  for (let k = 0; k < 100000 && !model.isComplete?.(state, i); k++) model.step(state, 0.02, i);
  return state;
}

describe('fermentation', () => {
  it('turns one mole of glucose into two of ethanol and two of CO₂', () => {
    const s = run();
    const used = 5 - (s[2] ?? NaN);
    expect(s[4]).toBeCloseTo(((2 * used) / GLUCOSE) * ETHANOL, 12);
    expect(s[3]).toBeCloseTo(gasVolume((2 * used) / GLUCOSE, 35), 9);
    // 1 mol of gas at 0 °C and 1 atm is 22.41 L.
    expect(gasVolume(1, 0)).toBeCloseTo(22413.97, 1);
  });

  it('ferments faster when warm, until the enzymes denature', () => {
    expect(activity(30)).toBeCloseTo(1, 12);
    expect(activity(20)).toBeCloseTo(0.5, 2);
    expect(activity(55)).toBeLessThan(activity(40));
    expect(run({ temperature: 35 })[3]).toBeGreaterThan(run({ temperature: 20 })[3] ?? NaN);
    expect(run({ temperature: 60 })[3]).toBeLessThan(run({ temperature: 35 })[3] ?? NaN);
  });

  it('never uses more glucose than it was given', () => {
    const s = run({ glucose: 0.5, yeast: 10, duration: 7200, speed: 1000 });
    expect(s[2]).toBeGreaterThanOrEqual(0);
    expect(s[6]).toBeLessThanOrEqual(100);
    expect(s[6]).toBeGreaterThan(99);
  });

  it('agrees with the per-gram prediction', () => {
    const s = run();
    const p = model.predict!(inputs);
    const used = 5 - (s[2] ?? NaN);
    expect(s[3]).toBeCloseTo((p.co2PerGram ?? NaN) * used, 9);
  });
});
