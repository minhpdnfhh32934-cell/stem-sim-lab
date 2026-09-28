import { describe, expect, it } from 'vitest';
import { EngineRunner } from '@/core/sim/runner';
import { IS, InclineEngine, inclineInput } from './engine';
import { accelFor, forces, segments, stateAt } from './model';
import { inclinedPlane, newtonLaws, numericEnd } from './scenes';

const deg = (d: number) => (d * Math.PI) / 180;
const g = 9.81;

describe('incline model', () => {
  it("Newton's 2nd law on a horizontal floor with an inclined pull", () => {
    const q = inclineInput({
      m: 5,
      F: 20,
      beta: deg(30),
      muS: 0.2,
      muK: 0.2,
      g,
      theta: 0,
      length: 20,
    });
    const f = forces(q);
    expect(f.N).toBeCloseTo(5 * g - 20 * 0.5, 12);
    const a = accelFor(q, 0);
    expect(a.regime).toBe('up');
    expect(a.a).toBeCloseTo((20 * Math.cos(deg(30)) - 0.2 * (5 * g - 10)) / 5, 12);
  });

  it('block sliding down a 30° incline: a = g(sin θ − μ cos θ), v = √(2aL)', () => {
    const q = inclineInput({
      m: 2,
      theta: deg(30),
      muS: 0.25,
      muK: 0.2,
      s0: 5,
      v0: 0,
      length: 5,
      g,
    });
    const aExp = g * (Math.sin(deg(30)) - 0.2 * Math.cos(deg(30)));
    const [seg] = segments(q);
    expect(seg!.a).toBeCloseTo(-aExp, 12);
    expect(seg!.end).toBe('bottom');
    expect(seg!.t1).toBeCloseTo(Math.sqrt((2 * 5) / aExp), 12);
    const n = numericEnd(q)!;
    expect(n.t).toBeCloseTo(seg!.t1, 9);
    expect(Math.abs(n.v)).toBeCloseTo(Math.sqrt(2 * aExp * 5), 9);
  });

  it('stays at rest when tan θ ≤ μs', () => {
    const q = inclineInput({ m: 1, theta: deg(10), muS: 0.25, muK: 0.2, s0: 2, length: 5, g });
    expect(accelFor(q, 0).regime).toBe('static');
    expect(accelFor(q, 0).friction).toBeCloseTo(g * Math.sin(deg(10)), 12);
  });

  it('stick–slip: thrown up a gentle slope, it stops and stays', () => {
    const q = inclineInput({
      m: 1,
      theta: deg(10),
      muS: 0.25,
      muK: 0.2,
      s0: 0.5,
      v0: 3,
      length: 50,
      g,
    });
    const segs = segments(q);
    expect(segs[0]!.end).toBe('rest');
    expect(segs[1]!.regime).toBe('static');
    const tStop = segs[0]!.t1;
    expect(stateAt(segs, tStop + 5).v).toBe(0);
  });

  it('on a steep slope the block slides back after stopping', () => {
    const q = inclineInput({
      m: 1,
      theta: deg(40),
      muS: 0.3,
      muK: 0.2,
      s0: 1,
      v0: 4,
      length: 50,
      g,
    });
    const segs = segments(q);
    expect(segs[0]!.end).toBe('rest');
    expect(segs[1]!.regime).toBe('down');
  });
});

describe('incline engine', () => {
  it('matches the exact piecewise solution', () => {
    const params = {
      m: 1,
      theta: deg(40),
      muS: 0.3,
      muK: 0.2,
      s0: 1,
      v0: 4,
      length: 50,
      g,
      tEnd: 3,
    };
    const e = new InclineEngine();
    e.reset(params);
    const r = new EngineRunner(e, 1000);
    for (let i = 0; i < 1000 && !e.finished(); i++) r.frame(1 / 60, 1);
    const st = new Float64Array(6);
    e.readState(st);
    const exact = stateAt(segments(inclineInput(params)), e.time());
    expect(st[IS.s]).toBeCloseTo(exact.s, 9);
    expect(st[IS.v]).toBeCloseTo(exact.v, 9);
  });
});

describe('incline scenes', () => {
  it('default scenes solve and their checks agree', () => {
    for (const sc of [newtonLaws, inclinedPlane]) {
      const sol = sc.solve(sc.defaults, 'vi');
      expect(sol.answers.length).toBeGreaterThanOrEqual(3);
      for (const a of sol.answers)
        if (a.check !== undefined) expect(a.check).toBeCloseTo(a.value, 8);
    }
  });

  it('rejects a force that would lift the block off', () => {
    expect(
      newtonLaws.validate!({ m: 1, F: 50, beta: deg(80), mu: 0.1, g, v0: 0, length: 10 }),
    ).toHaveLength(1);
  });
});
