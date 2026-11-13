import { describe, expect, it } from 'vitest';
import { leverModel as model } from './lever';

// The lever balance: the moments worked out by hand, level when they are equal, on the stop of the
// larger moment otherwise, the same at any runtime step, the balance line, the refusals.

const INPUTS = {
  mass1: 0.1,
  distance1: 0.15,
  mass2: 0.05,
  distance2: 0.3,
  gravity: 9.81,
  barInertia: 0.01,
  damping: 0.02,
  stopAngle: 10,
  duration: 4,
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

describe('lever balance', () => {
  it('balances level when m1·g·d1 = m2·g·d2: 100 g at 15 cm against 50 g at 30 cm', () => {
    const end = run(INPUTS, 0.01);
    expect(end.moment1).toBeCloseTo(0.1 * 9.81 * 0.15, 12); // 0.147 15 N·m
    expect(end.moment2).toBeCloseTo(0.05 * 9.81 * 0.3, 12);
    expect(end.netMoment).toBeCloseTo(0, 12);
    expect(end.tilt).toBe(0);
    expect(end.atStop).toBe(0);
  });

  it.each([
    [0.25, -1], // M2 smaller: the left end goes down
    [0.2, -1],
  ])('with the right mass at %s m it rests on the left stop', (d2, side) => {
    const end = run({ ...INPUTS, distance2: d2 }, 0.01);
    expect(end.atStop).toBe(side);
    expect(end.tilt).toBeCloseTo(-10, 12);
    expect(model.predict?.({ ...INPUTS, distance2: d2 }).restingSide).toBe(side);
  });

  it('rests on the right stop when the right moment is larger', () => {
    const end = run({ ...INPUTS, mass2: 0.1 }, 0.01);
    expect(end.atStop).toBe(1);
    expect(end.tilt).toBeCloseTo(10, 12);
  });

  it('runs the same at any runtime step (its own fixed sub-step)', () => {
    const inputs = { ...INPUTS, distance2: 0.25, duration: 0.3 }; // stopped mid-swing
    const a = run(inputs, 0.01);
    const b = run(inputs, 0.025);
    expect(a.tilt).toBeCloseTo(b.tilt ?? NaN, 6);
    expect(Math.abs(a.tilt ?? 0)).toBeGreaterThan(0);
    expect(Math.abs(a.tilt ?? 0)).toBeLessThan(10);
  });

  it('puts M2 − M1 on a line against d2: slope m2·g, zero at d2 = m1·d1/m2', () => {
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.weightRight).toBeCloseTo(0.05 * 9.81, 12);
    expect(p.momentLeft).toBeCloseTo(-0.1 * 9.81 * 0.15, 12);
    for (const d2 of [0.1, 0.2, 0.3]) {
      const q = model.predict?.({ ...INPUTS, distance2: d2 }) ?? {};
      expect(q.netMoment).toBeCloseTo((p.weightRight ?? 0) * d2 + (p.momentLeft ?? 0), 12);
    }
  });

  it('refuses what it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, distance2: 0.4 }, state)).toThrow(/distance2/);
    expect(() => model.init({ ...INPUTS, mass1: 0 }, state)).toThrow(/mass1/);
  });
});
