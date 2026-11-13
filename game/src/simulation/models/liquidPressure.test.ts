import { describe, expect, it } from 'vitest';
import { liquidPressureModel as model } from './liquidPressure';

// Pressure in a liquid: p = p0 + ρ·g·h worked out by hand, the manometer's Δh = (ρ/ρ_m)·h, the
// probe lowered at its speed, the line against depth, the refusals.

const INPUTS = {
  liquid: 0,
  depth: 0.2,
  gravity: 9.81,
  airPressure: 101325,
  manometerDensity: 998.2,
  lowerSpeed: 0.05,
  holdTime: 1,
};

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) {
    model.step(state, dt, inputs);
    expect([...state].every(Number.isFinite)).toBe(true);
  }
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('liquid pressure', () => {
  it('gives ρ·g·h at 20 cm of water: 998.2 · 9.81 · 0.2 = 1958.5 Pa, the manometer 20 cm apart', () => {
    const end = run(INPUTS, 0.01);
    expect(end.probeDepth).toBeCloseTo(0.2, 12);
    expect(end.gaugePressure).toBeCloseTo(1958.4684, 4);
    expect(end.pressure).toBeCloseTo(101325 + 1958.4684, 4);
    expect(end.manometerDifference).toBeCloseTo(0.2, 12); // water against water
    expect(end.clock).toBeCloseTo(0.2 / 0.05 + 1, 12);
  });

  it.each([
    [1, 1197.2],
    [2, 789.3],
  ])('liquid %s: Δh = (ρ/ρ_m)·h with ρ = %s kg/m³', (liquid, rho) => {
    const end = run({ ...INPUTS, liquid }, 0.02);
    expect(end.manometerDifference).toBeCloseTo((rho / 998.2) * 0.2, 12);
    expect(model.predict?.({ ...INPUTS, liquid }).weightDensity).toBeCloseTo(rho * 9.81, 9);
  });

  it('lowers the probe at its speed, the pressure growing with its depth', () => {
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    const at = (v: string) => state[model.variables.indexOf(v)] ?? NaN;
    model.step(state, 1.5, INPUTS);
    expect(at('probeDepth')).toBeCloseTo(0.075, 12);
    expect(at('gaugePressure')).toBeCloseTo(998.2 * 9.81 * 0.075, 9);
  });

  it('puts the gauge pressure on a line through the origin against depth, slope ρ·g', () => {
    const p = (h: number) => model.predict?.({ ...INPUTS, depth: h }).gaugePressure ?? NaN;
    expect((p(0.25) - p(0.05)) / 0.2).toBeCloseTo(998.2 * 9.81, 6);
    expect(p(0.1) / 0.1).toBeCloseTo(998.2 * 9.81, 6);
  });

  it('refuses what it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, liquid: 3 }, state)).toThrow(/liquid/);
    expect(() => model.init({ ...INPUTS, depth: 0.5 }, state)).toThrow(/depth/);
  });
});
