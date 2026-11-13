import { describe, expect, it } from 'vitest';
import { photogateSpeedModel as model } from './photogateSpeed';

// Measuring speed with photogates: the model's beam times against s = ½·a·t², a = (5/7)·g·sin α,
// worked out by hand here (not through the model's own predict), at any step size.

const INPUTS = {
  angle: 10,
  gravity: 9.81,
  ballDiameter: 0.02,
  gateA: 0.3,
  gateB: 0.8,
  railLength: 1,
};

/** Runs the model to its end in steps of dt; returns its final state by variable. */
function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('photogate speed', () => {
  it('runs in the experiment runtime to completion: its state finite at every step', () => {
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    for (let i = 0; i < 1e5 && !model.isComplete?.(state, INPUTS); i++) {
      model.step(state, 0.0005, INPUTS);
      expect([...state].every(Number.isFinite), `step ${i}`).toBe(true);
    }
  });

  // By hand: a = 5/7 · 9.81 · sin 10° = 7.007 14 · 0.173 648 = 1.216 78 m/s²; t(s) = √(2s/a).
  const a = (5 / 7) * 9.81 * Math.sin((10 * Math.PI) / 180);
  const t = (s: number) => Math.sqrt((2 * s) / a);

  it('rolls with a = (5/7)·g·sin α', () => {
    expect(a).toBeCloseTo(1.21678, 5);
    expect(model.predict?.(INPUTS).acceleration).toBeCloseTo(a, 12);
  });

  it.each([0.001, 0.01, 0.037])(
    'times each beam and the gap between them exactly (step %s s)',
    (dt) => {
      const end = run(INPUTS, dt);
      expect(end.blockedA).toBeCloseTo(t(0.31) - t(0.29), 12); // ≈ 0.0234 s
      expect(end.blockedB).toBeCloseTo(t(0.81) - t(0.79), 12);
      expect(end.timeAB).toBeCloseTo(t(0.79) - t(0.29), 12);
      expect(end.speedA).toBeCloseTo(0.02 / (t(0.31) - t(0.29)), 10);
      expect(end.averageSpeed).toBeCloseTo(0.5 / (t(0.79) - t(0.29)), 10);
      expect(end.passed).toBe(1);
      expect(end.clock).toBeCloseTo(t(0.81), 12); // it ends as the ball leaves gate B's beam
      expect(end.distance).toBeCloseTo(0.81, 12);
    },
  );

  it('gives at each gate nearly the speed the ball has there, v = √(2·a·x)', () => {
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.speedA).toBeCloseTo(0.8547, 3);
    expect(p.centreSpeedA).toBeCloseTo(Math.sqrt(2 * a * 0.3), 12);
    // d/Δt is the mean over the ball's width: within 0.1 % of the centre's speed at 2 cm.
    expect(Math.abs((p.speedA ?? 0) / (p.centreSpeedA ?? 1) - 1)).toBeLessThan(1e-3);
    expect((p.speedB ?? 0) / (p.centreSpeedB ?? 1)).toBeCloseTo(1, 3);
    // Faster at B; the average between them lies between the two.
    expect(p.speedB).toBeGreaterThan(p.speedA ?? Infinity);
    expect(p.averageSpeed).toBeGreaterThan(p.speedA ?? Infinity);
    expect(p.averageSpeed).toBeLessThan(p.speedB ?? 0);
  });

  it('agrees with its own theory at the run’s end', () => {
    const end = run(INPUTS, 0.004);
    const p = model.predict?.(INPUTS) ?? {};
    for (const key of [
      'blockedA',
      'blockedB',
      'timeAB',
      'speedA',
      'speedB',
      'averageSpeed',
    ] as const) {
      expect(end[key]).toBeCloseTo(p[key] ?? NaN, 12);
    }
  });

  it('marks each beam blocked only while the ball is in it', () => {
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    const at = (v: string) => state[model.variables.indexOf(v)] ?? NaN;
    model.step(state, (t(0.29) + t(0.31)) / 2, INPUTS); // the centre between the beam's edges
    expect([at('gateABlocked'), at('gateBBlocked')]).toEqual([1, 0]);
    expect(at('blockedA')).toBe(0); // not left yet (a run's state is always finite)
    model.step(state, t(0.5) - at('clock'), INPUTS);
    expect([at('gateABlocked'), at('gateBBlocked')]).toEqual([0, 0]);
    expect(at('blockedA')).toBeGreaterThan(0);
  });

  it('puts (d/Δt_B)² on v² = 2·a·x against gate B’s distance: slope 2a', () => {
    const points = [0.5, 0.6, 0.7, 0.8, 0.9].map((x) => [
      x,
      run({ ...INPUTS, gateB: x }, 0.01).speedBSquared ?? NaN,
    ]);
    const slope = ((points[4]?.[1] ?? 0) - (points[0]?.[1] ?? 0)) / 0.4;
    expect(slope / (2 * a)).toBeCloseTo(1, 3); // d/Δt is not quite the centre's speed: within 0.1 %
    expect(model.predict?.(INPUTS).twiceAcceleration).toBeCloseTo(2 * a, 12);
  });

  it('refuses a rail it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, angle: 0 }, state)).toThrow(/angle/);
    expect(() => model.init({ ...INPUTS, gateB: 0.31 }, state)).toThrow(/Gate B/);
    expect(() => model.init({ ...INPUTS, railLength: 0.7 }, state)).toThrow(/rail/);
    expect(() => model.init({ ...INPUTS, gateA: 0.005 }, state)).toThrow(/Gate A/);
  });
});
