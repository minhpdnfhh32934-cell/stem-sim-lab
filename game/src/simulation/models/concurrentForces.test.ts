import { describe, expect, it } from 'vitest';
import { concurrentForcesModel as model } from './concurrentForces';

// Composition of concurrent forces: the third balance's reading at rest against the parallelogram
// rule worked out by hand, its direction, R² against cos α, the settling, the refusals.

const INPUTS = {
  force1: 3,
  force2: 4,
  angle: 90,
  stiffness: 50,
  settleFrequency: 20,
  startOffset: 0.01,
  duration: 3,
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

describe('concurrent forces', () => {
  it('reads the resultant on the third balance at rest: 3 N and 4 N at 90° make 5 N at 53.13°', () => {
    const end = run(INPUTS, 0.01);
    expect(end.reading3).toBeCloseTo(5, 9);
    expect(end.reading1).toBeCloseTo(3, 9);
    expect(end.reading2).toBeCloseTo(4, 9);
    expect(end.resultantAngle).toBeCloseTo((Math.atan2(4, 3) * 180) / Math.PI, 9); // 53.130°
    expect(end.offset).toBeLessThan(1e-12);
  });

  it.each([
    [2, 2, 60, Math.sqrt(12)], // √(4 + 4 + 8·½)
    [3, 3, 120, 3], // an equilateral triangle of forces
    [2, 3, 150, Math.sqrt(4 + 9 + 12 * Math.cos((150 * Math.PI) / 180))],
  ])('F1 %s N, F2 %s N at %s°: R by the parallelogram rule', (f1, f2, angle, r) => {
    const p = model.predict?.({ ...INPUTS, force1: f1, force2: f2, angle }) ?? {};
    expect(p.resultant).toBeCloseTo(r, 12);
    expect(run({ ...INPUTS, force1: f1, force2: f2, angle }, 0.02).reading3).toBeCloseTo(r, 9);
  });

  it('puts F3² on a line against cos α: intercept F1² + F2², slope 2·F1·F2', () => {
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.squaresSum).toBe(25);
    expect(p.productTwice).toBe(24);
    for (const angle of [30, 60, 120, 150]) {
      const end = run({ ...INPUTS, angle }, 0.05);
      expect(end.resultantSquared).toBeCloseTo(25 + 24 * (end.cosAngle ?? NaN), 9);
    }
  });

  it('settles from its offset critically damped, the readings with it; any step gives the same state', () => {
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    const at = (v: string) => state[model.variables.indexOf(v)] ?? NaN;
    expect(at('offset')).toBeCloseTo(0.01, 12);
    expect(at('reading3')).toBeCloseTo(5 - 50 * 0.01, 12); // pulled towards it: slacker by k·u
    model.step(state, 0.05, INPUTS);
    const u = 0.01 * (1 + 20 * 0.05) * Math.exp(-20 * 0.05);
    expect(at('offset')).toBeCloseTo(u, 12);
    const other = new Float64Array(model.variables.length);
    model.init(INPUTS, other);
    for (let i = 0; i < 5; i++) model.step(other, 0.01, INPUTS);
    expect(other[model.variables.indexOf('offset')]).toBeCloseTo(u, 12);
  });

  it('refuses what it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, angle: 0 }, state)).toThrow(/angle/);
    expect(() => model.init({ ...INPUTS, force1: 12 }, state)).toThrow(/force1/);
    expect(() => model.init({ ...INPUTS, force1: 6, force2: 6, angle: 30 }, state)).toThrow(/10 N/);
  });
});
