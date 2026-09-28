import { describe, expect, it } from 'vitest';
import { EngineRunner } from '@/core/sim/runner';
import { accel1D, advance1D } from '../common/coulomb1d';
import { PU, PulleyEngine, pulleyInput, reduce, tension } from './engine';
import { numericTravel, pulley } from './scenes';

const g = 9.81;

describe('pulley systems', () => {
  it('Atwood machine: a = (m2 − m1)g/(m1 + m2), T = 2 m1 m2 g/(m1 + m2)', () => {
    const q = pulleyInput({ config: 0, m1: 2, m2: 3, g });
    const a = accel1D(reduce(q), 0).a;
    expect(a).toBeCloseTo(g / 5, 12);
    expect(tension(q, a)).toBeCloseTo((2 * 2 * 3 * g) / 5, 12);
  });

  it('block on a table: a = (m2 − μ m1) g/(m1 + m2)', () => {
    const q = pulleyInput({ config: 1, m1: 2, m2: 1, muS: 0.25, muK: 0.2, g });
    expect(accel1D(reduce(q), 0).a).toBeCloseTo(((1 - 0.2 * 2) * g) / 3, 12);
  });

  it('stays at rest when m2 g ≤ μs m1 g', () => {
    const q = pulleyInput({ config: 1, m1: 5, m2: 1, muS: 0.3, muK: 0.2, g });
    expect(accel1D(reduce(q), 0).regime).toBe('static');
  });

  it('incline: m1 pulled up a 30° slope by a heavier hanging m2', () => {
    const q = pulleyInput({ config: 2, m1: 1, m2: 2, theta: Math.PI / 6, muS: 0.1, muK: 0.1, g });
    const expected = (2 * g - g * 0.5 - 0.1 * g * Math.cos(Math.PI / 6)) / 3;
    expect(accel1D(reduce(q), 0).a).toBeCloseTo(expected, 12);
  });

  it('travel time matches Dormand–Prince', () => {
    const q = pulleyInput({ config: 0, m1: 1, m2: 1.5, travel: 1.2, g });
    const a = accel1D(reduce(q), 0).a;
    expect(numericTravel(q)!.t).toBeCloseTo(Math.sqrt((2 * 1.2) / a), 9);
  });

  it('advance1D lands exactly on the limit', () => {
    const r = advance1D({ M: 1, D: 2, Fs: 0, Fk: 0 }, 0.99, 0.5, 0.1, -1, 1);
    expect(r.hitLimit).toBe(true);
    expect(r.s).toBeCloseTo(1, 12);
  });
});

describe('pulley engine and scene', () => {
  it('engine reaches the floor at the analytic time', () => {
    const params = { config: 0, m1: 1, m2: 1.5, travel: 1.2, g };
    const e = new PulleyEngine();
    e.reset(params);
    const run = new EngineRunner(e, 1000);
    for (let i = 0; i < 1000 && !e.finished(); i++) run.frame(1 / 60, 1);
    const st = new Float64Array(6);
    e.readState(st);
    expect(st[PU.s]).toBeCloseTo(1.2, 10);
    const a = (0.5 * g) / 2.5;
    expect(st[PU.v]).toBeCloseTo(Math.sqrt(2 * a * 1.2), 9);
  });

  it('default scene solution agrees with its checks', () => {
    const sol = pulley.solve(pulley.defaults, 'vi');
    for (const a of sol.answers) if (a.check !== undefined) expect(a.check).toBeCloseTo(a.value, 8);
  });
});
