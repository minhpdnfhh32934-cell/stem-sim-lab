import { describe, expect, it } from 'vitest';
import { displacementPotential, halogensModel as model } from './halogens';

// The halogens' reactivity worked by hand: chlorine (E° 1.358 V) displaces bromide and iodide,
// bromine (1.087 V) only iodide, iodine (0.536 V) neither. 5 mL of 0.02 mol/L halogen water
// holds 0.1 mmol of X₂; 2 mL of 0.1 mol/L halide holds 0.2 mmol of Y⁻, enough for 0.1 mmol Y₂.

const INPUTS = {
  halogen: 0,
  halide: 1,
  halogenConcentration: 0.02,
  halideConcentration: 0.1,
  sampleVolume: 2,
  reagentVolume: 5,
  flowRate: 0.5,
};

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('halogen displacement', () => {
  it('goes only down the group: a halogen displaces those below it', () => {
    const goes = (x: number, y: number) => displacementPotential(x, y) > 0;
    expect([goes(0, 1), goes(0, 2), goes(1, 2)]).toEqual([true, true, true]);
    expect([goes(1, 0), goes(2, 0), goes(2, 1), goes(0, 0)]).toEqual([false, false, false, false]);
    expect(displacementPotential(0, 2)).toBeCloseTo(1.35827 - 0.5355, 12);
  });

  it.each([0.01, 0.3])('chlorine water into bromide forms bromine, 0.1 mmol (step %s s)', (dt) => {
    const end = run(INPUTS, dt);
    expect(end.volumeAdded).toBeCloseTo(5, 12);
    expect(end.formed).toBeCloseTo(0.1, 12);
    expect(end.halogenLeft).toBeCloseTo(0, 12);
    expect(end.product).toBe(1);
  });

  it('is limited by the halide when the halogen is in excess; nothing forms the wrong way round', () => {
    const excess = model.predict!({ ...INPUTS, halideConcentration: 0.05 }); // 0.1 mmol Br⁻
    expect(excess.formed).toBeCloseTo(0.05, 12);
    expect(excess.halogenLeft).toBeCloseTo(0.05, 12);
    const none = model.predict!({ ...INPUTS, halogen: 2, halide: 0 });
    expect(none.formed).toBe(0);
    expect(none.product).toBe(-1);
    expect(none.halogenLeft).toBeCloseTo(0.1, 12);
  });
});
