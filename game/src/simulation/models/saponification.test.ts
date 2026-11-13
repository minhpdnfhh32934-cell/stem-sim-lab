import { describe, expect, it } from 'vitest';
import { saponificationModel as model } from './saponification';

// Saponification worked by hand: 8.9148 g of tristearin is 10.000 mmol; 40 mL of 2 mol/L NaOH is
// 80 mmol, more than the 30 the fat needs, so ξmax = 10 mmol → 30 mmol of sodium stearate,
// 9.1938 g, and 0.9209 g of glycerol.

const INPUTS = {
  fatMass: 8.9148,
  hydroxideVolume: 40,
  hydroxideConcentration: 2,
  heatingTime: 30,
  rateConstant: 0.15,
  minuteLength: 1,
};

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('saponification', () => {
  it.each([0.01, 0.33])(
    'follows ξ = ξmax·(1 − e^(−kt)) with exact stoichiometry (step %s s)',
    (dt) => {
      const end = run(INPUTS, dt);
      const share = 1 - Math.exp(-4.5);
      expect(end.minutes).toBeCloseTo(30, 12);
      expect(end.extent).toBeCloseTo(10 * share, 9);
      expect(end.soap).toBeCloseTo(30 * 0.30646 * share, 9);
      expect(end.glycerol).toBeCloseTo(10 * 0.09209 * share, 9);
      expect(end.hydroxideLeft).toBeCloseTo(80 - 30 * share, 9);
    },
  );

  it('is limited by the hydroxide when there is too little: three NaOH per fat', () => {
    const short = model.predict!({ ...INPUTS, hydroxideVolume: 10, heatingTime: 120 }); // 20 mmol
    expect(short.maximumSoap).toBeCloseTo(20 * 0.30646, 9); // ξmax = 20/3, soap 3ξ
    expect(short.fatLeft ?? 0).toBeGreaterThan(0);
    expect(model.predict!({ ...INPUTS, heatingTime: 120 }).maximumSoap).toBeCloseTo(9.1938, 4);
  });

  it('keeps the mass: fat + NaOH used = soap + glycerol', () => {
    const end = run({ ...INPUTS, heatingTime: 60 }, 0.05);
    const fatUsed = INPUTS.fatMass - (end.fatLeft ?? 0);
    const naohUsed = ((80 - (end.hydroxideLeft ?? 0)) * 40.0) / 1000;
    expect(fatUsed + naohUsed).toBeCloseTo((end.soap ?? 0) + (end.glycerol ?? 0), 2);
  });
});
