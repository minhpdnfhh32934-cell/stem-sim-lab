import { describe, expect, it } from 'vitest';
import { agarDiffusionModel as model, changedPercent, depthMm, ERFINV_HALF } from './agarDiffusion';
import { erf } from './gasSpeeds';

describe('agar diffusion', () => {
  it('puts the colour edge where erfc(x / 2√(Dt)) = ½', () => {
    expect(erf(ERFINV_HALF)).toBeCloseTo(0.5, 12);
    const D = 3.3e-9;
    const x = depthMm(D, 600) / 1000;
    expect(1 - erf(x / (2 * Math.sqrt(D * 600)))).toBeCloseTo(0.5, 12);
  });

  it('goes as √t: four times the time, twice the depth', () => {
    expect(depthMm(3.3e-9, 2400) / depthMm(3.3e-9, 600)).toBeCloseTo(2, 12);
  });

  it('changes a larger share of a smaller cube for the same depth (SA:V = 6/L)', () => {
    expect(changedPercent(1, 1)).toBeCloseTo(100 * (1 - 0.8 ** 3), 12); // 48.8 %
    expect(changedPercent(2, 1)).toBeCloseTo(100 * (1 - 0.9 ** 3), 12);
    expect(changedPercent(1, 6)).toBe(100);
    const p = model.predict!({ soakTime: 600, diffusivity: 3.3e-9, speed: 120 });
    expect(p.small).toBeGreaterThan(p.medium ?? NaN);
    expect(p.medium).toBeGreaterThan(p.large ?? NaN);
  });

  it('ends the run on the predicted values', () => {
    const inputs = { soakTime: 600, diffusivity: 3.3e-9, speed: 120 };
    const state = new Float64Array(model.variables.length);
    model.init(inputs, state);
    for (let i = 0; i < 10000 && !model.isComplete?.(state, inputs); i++)
      model.step(state, 0.02, inputs);
    const p = model.predict!(inputs);
    expect(state[2]).toBeCloseTo(p.depth ?? NaN, 9);
    expect(state[5]).toBeCloseTo(p.large ?? NaN, 9);
  });
});
