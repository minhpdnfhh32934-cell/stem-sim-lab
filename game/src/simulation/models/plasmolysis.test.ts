import { describe, expect, it } from 'vitest';
import { plasmolysisModel as model, settledVolume, solutePotential } from './plasmolysis';

const base = {
  cellSap: 0.4,
  nonOsmotic: 0.2,
  temperature: 20,
  halfTime: 60,
  soakTime: 600,
  speed: 100,
};

describe('plasmolysis', () => {
  it('stays turgid in water and in a solution weaker than the sap', () => {
    expect(settledVolume({ ...base, concentration: 0 })).toBe(1);
    expect(settledVolume({ ...base, concentration: 0.3 })).toBe(1);
  });

  it('shrinks by Boyle–van ’t Hoff: twice the sap’s strength → b + (1 − b)/2', () => {
    expect(settledVolume({ ...base, concentration: 0.8 })).toBeCloseTo(0.2 + 0.8 / 2, 12);
  });

  it('gives −cRT: 0.4 mol/L at 20 °C is about −0.975 MPa', () => {
    expect(solutePotential(0.4, 20)).toBeCloseTo(-(400 * 8.314462618 * 293.15) / 1e6, 9);
    expect(solutePotential(0.4, 20)).toBeCloseTo(-0.975, 3);
  });

  it('approaches the settled volume with the half-time', () => {
    const inputs = { ...base, concentration: 0.8 };
    const state = new Float64Array(model.variables.length);
    model.init(inputs, state);
    expect(state[2]).toBe(100);
    for (let i = 0; i < 100000 && !model.isComplete?.(state, inputs); i++)
      model.step(state, 0.02, inputs);
    expect(state[2]).toBeCloseTo(model.predict!(inputs).volume ?? NaN, 9);
    // After ten half-times it is within 0.1 % of settled.
    expect(Math.abs((state[2] ?? 0) - 60)).toBeLessThan(0.05);
  });
});
