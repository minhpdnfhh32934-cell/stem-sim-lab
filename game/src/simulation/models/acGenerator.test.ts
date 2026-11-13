import { describe, expect, it } from 'vitest';
import { acGeneratorModel as model, peakEmf } from './acGenerator';

const inputs = { frequency: 2, turns: 200, field: 0.2, area: 0.01, periods: 3 };

describe('AC generator', () => {
  it('peaks at NBAω: 200 turns, 0.2 T, 100 cm², 2 Hz → 5.03 V', () => {
    expect(peakEmf(inputs)).toBeCloseTo(200 * 0.2 * 0.01 * 4 * Math.PI, 12);
    expect(peakEmf(inputs)).toBeCloseTo(5.0265, 4);
  });

  it('is minus the rate of change of the flux linkage (Faraday)', () => {
    const state = new Float64Array(model.variables.length);
    model.init(inputs, state);
    const h = 1e-6;
    for (let i = 0; i < 300; i++) {
      model.step(state, 0.001, inputs);
      const before = state[2] ?? NaN;
      const emf = state[3] ?? NaN;
      const probe = new Float64Array(state);
      model.step(probe, h, inputs);
      expect(-((probe[2] ?? NaN) - before) / h).toBeCloseTo(emf, 3);
    }
  });

  it('ends after whole turns with rms = E₀/√2 and peak E₀', () => {
    const state = new Float64Array(model.variables.length);
    model.init(inputs, state);
    let peak = 0;
    for (let i = 0; i < 100000 && !model.isComplete?.(state, inputs); i++) {
      model.step(state, 0.005, inputs);
      peak = Math.max(peak, state[3] ?? 0);
    }
    const p = model.predict!(inputs);
    expect(state[4]).toBeCloseTo(p.rms ?? NaN, 9);
    expect(peak).toBeCloseTo(p.peak ?? NaN, 3); // sampled every 5 ms: within 0.1 %
    expect(state[0]).toBeCloseTo(1.5, 12);
  });
});
