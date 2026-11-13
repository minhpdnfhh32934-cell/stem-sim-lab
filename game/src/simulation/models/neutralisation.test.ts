import { describe, expect, it } from 'vitest';
import { neutralisationModel as model } from './neutralisation';

// The neutralisation calorimeter against numbers worked out by hand: 50 mL of 1.0 mol/L HCl with
// 50 mL of 1.0 mol/L NaOH form 0.050 mol of water, giving 0.050 × 57 100 = 2855 J to 100 g of
// mixture: ΔT = 2855 / (100 × 4.18) = 6.830 143 5 °C.

const INPUTS = {
  acidVolume: 50,
  baseVolume: 50,
  concentration: 1,
  startTemperature: 20,
  timeConstant: 3,
  readTime: 30,
};

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

const RISE = 2855 / 418;
const LAG = 1 - Math.exp(-10); // 30 s at τ = 3 s

describe('neutralisation calorimeter', () => {
  it.each([0.01, 0.07])('warms by ΔT = n·57.1 kJ/mol ÷ (m·c), read through τ (step %s s)', (dt) => {
    const end = run(INPUTS, dt);
    expect(end.time).toBeCloseTo(30, 12);
    expect(end.water).toBeCloseTo(50, 12);
    expect(end.temperature).toBeCloseTo(20 + RISE * LAG, 10);
    expect(end.heat).toBeCloseTo(2855 * LAG, 8);
  });

  it('is limited by the reagent that runs out; past equivalence, extra base only dilutes', () => {
    const rise = (v: number) =>
      model.predict!({ ...INPUTS, baseVolume: v, readTime: 600 }).temperatureRise ?? NaN;
    // 25 mL of base: 0.025 mol in 75 g → 1427.5 / 313.5; 75 mL: 0.050 mol in 125 g → 2855 / 522.5.
    expect(rise(25)).toBeCloseTo(1427.5 / 313.5, 9);
    expect(rise(50)).toBeCloseTo(RISE, 9);
    expect(rise(75)).toBeCloseTo(2855 / 522.5, 9);
    expect(rise(50)).toBeGreaterThan(rise(25));
    expect(rise(50)).toBeGreaterThan(rise(75));
  });

  it('predicts −57.1 kJ/mol whatever the volumes, and doubles ΔT with the concentration', () => {
    const p1 = model.predict!(INPUTS);
    const p2 = model.predict!({ ...INPUTS, concentration: 2 });
    expect(p1.enthalpy).toBe(-57.1);
    expect(p2.enthalpy).toBe(-57.1);
    expect((p2.temperatureRise ?? NaN) / (p1.temperatureRise ?? NaN)).toBeCloseTo(2, 12);
    expect(p1.equivalenceVolume).toBe(50);
  });

  it('refuses inputs outside its domain, with the reason', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, concentration: 0 }, state)).toThrow(/concentration/);
    expect(() => model.init({ ...INPUTS, startTemperature: NaN }, state)).toThrow(
      /startTemperature/,
    );
  });
});
