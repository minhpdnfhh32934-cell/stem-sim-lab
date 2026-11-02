import { describe, expect, it } from 'vitest';
import { EngineRunner } from '@/core/sim/runner';
import { IS, InclineEngine, inclineInput } from './engine';
import { accelFor, forces, segments, stateAt } from './model';
import { checkMisses, sliderSweep } from '../testing';
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

describe('incline cross-checks (#112)', () => {
  // Inputs where the DOPRI5 check missed the end of the track (the body passes it, then would
  // stop): it reported the stop (1,644 s; 0,136 s) instead of the end (1,158 s; 0,0777 s).
  it.each([
    ['newtonLaws: passes the end before stopping', newtonLaws, { mu: 1.4, v0: 16, length: 12 }],
    ['inclinedPlane: just passes the top', inclinedPlane, { v0: 0.9, s0: 4.95 }],
    // Grazing the end: above it only for ~3 ms (10 µm), between two of the step's samples.
    ['inclinedPlane: grazes the top by 10 µm', inclinedPlane, { v0: 0.9, s0: 4.9386849 }],
    // Stops exactly at the end (t = 2 s, s = 4 m): the peak sits at the end ± 1 ulp, a graze of
    // round-off size that must not count as reaching the end (review of PR #118).
    [
      'newtonLaws: stops exactly at the end',
      newtonLaws,
      { g: 10, mu: 0.2, F: 0, v0: 4, length: 4 },
    ],
    [
      'inclinedPlane (θ = 0): stops exactly at the end',
      inclinedPlane,
      { theta: 0, g: 10, muS: 0.2, muK: 0.2, F: 0, v0: 4, s0: 0, length: 4 },
    ],
    [
      'newtonLaws: the end 0,1 mm before the stop',
      newtonLaws,
      { mu: 1.4, v0: 16, length: 16 ** 2 / (2 * ((1.4 * 5 * 9.81 - 20) / 5)) - 1e-4 },
    ],
  ] as const)('%s', (_name, scene, p) => {
    const params = { ...scene.defaults, ...p };
    expect(scene.solve(params, 'vi').answers.some((a) => a.check !== undefined)).toBe(true);
    expect(checkMisses(scene, params)).toEqual([]);
  });

  // Stops exactly at an edge where rounding leaves the edge equation's discriminant a little
  // above 0 (review of PR #118, round 2): the closed form said "reaches the end" at
  // 1,99999997 s, the check "stops" at 2 s.
  it.each([
    ['newtonLaws m 0,2', newtonLaws, { m: 0.2, mu: 0.3, F: 0, v0: 6, length: 6, g: 10 }],
    ['newtonLaws m 0,1', newtonLaws, { m: 0.1, mu: 0.3, F: 0, v0: 6, length: 6, g: 10 }],
    ['newtonLaws m 0,4', newtonLaws, { m: 0.4, mu: 0.3, F: 0, v0: 6, length: 6, g: 10 }],
    ['newtonLaws m 0,8', newtonLaws, { m: 0.8, mu: 0.3, F: 0, v0: 6, length: 6, g: 10 }],
    ['newtonLaws v0 12, L 24', newtonLaws, { m: 0.2, mu: 0.3, F: 0, v0: 12, length: 24, g: 10 }],
    ['newtonLaws v0 18, L 54', newtonLaws, { m: 0.2, mu: 0.3, F: 0, v0: 18, length: 54, g: 10 }],
    [
      'inclinedPlane θ = 0, stops at the foot',
      inclinedPlane,
      { theta: 0, m: 71.61, muS: 0.85, muK: 0.72, F: 0, length: 36.6, s0: 36, v0: -14.4, g: 4 },
    ],
  ] as const)('%s: a stop exactly at the edge is a stop', (_name, scene, p) => {
    const params = { ...scene.defaults, ...p };
    const time = scene.solve(params, 'vi').answers.find((a) => a.id === 'time_end');
    expect(time?.label.vi).toContain('dừng lại');
    expect(checkMisses(scene, params)).toEqual([]);
  });

  it('every exact tie on a level track (stop distance = track length) is a stop that checks', () => {
    // Random sweeps never land on a tie: build them. F = 0 on a level track: d = v0² / (2 μ g).
    const misses: unknown[] = [];
    let ties = 0;
    for (const g of [9.8, 9.81, 10])
      for (const mu of [0.1, 0.2, 0.3, 0.45, 0.6, 0.85, 1.4])
        for (const v0 of [1, 2, 3.5, 4, 6, 9.9, 12, 18])
          for (const m of [0.1, 0.2, 0.4, 0.8, 5]) {
            const length = (v0 * v0) / (2 * mu * g);
            if (length < 0.5 || length > 200) continue;
            ties++;
            const p = { ...newtonLaws.defaults, g, mu, v0, m, F: 0, length };
            const miss = checkMisses(newtonLaws, p);
            const time = newtonLaws.solve(p, 'vi').answers.find((a) => a.id === 'time_end');
            if (miss.length > 0 || !time?.label.vi.includes('dừng lại')) misses.push({ p, miss });
          }
    expect(ties).toBeGreaterThan(300);
    expect(misses).toEqual([]);
  });

  it.each([
    ['newtonLaws', newtonLaws],
    ['inclinedPlane', inclinedPlane],
  ] as const)('%s: every check agrees over a slider sweep', (_name, scene) => {
    const sets = sliderSweep(scene, 600, 112);
    const misses = sets
      .map((p) => ({ p, miss: checkMisses(scene, p) }))
      .filter((r) => r.miss.length > 0);
    expect(misses).toEqual([]);
    // The sweep really checks: most sets carry a check (a check that went missing would pass).
    const checked = sets.filter((p) =>
      scene.solve(p, 'vi').answers.some((a) => a.check !== undefined),
    ).length;
    expect(checked).toBeGreaterThan(sets.length / 4);
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

describe('a block that starts on an edge and moves outward', () => {
  const run = (p: Record<string, number>, seconds: number) => {
    const e = new InclineEngine();
    e.reset(p);
    const s = new Float64Array(6);
    let sMin = Infinity;
    let sMax = -Infinity;
    for (let i = 0; i < seconds * 240; i++) {
      e.step();
      e.readState(s);
      sMin = Math.min(sMin, s[IS.s] ?? 0);
      sMax = Math.max(sMax, s[IS.s] ?? 0);
    }
    return { sMin, sMax, off: s[IS.off] ?? 0 };
  };
  const plane = { ...inclinedPlane.defaults };

  it('at the foot, sliding down: leaves at once instead of passing through the foot', () => {
    const p = { ...plane, s0: 0, v0: 0 };
    const segs = segments(inclineInput(p));
    expect(segs[0]?.end).toBe('bottom');
    expect(segs[0]?.t1).toBe(0);
    const r = run(p, 3);
    expect(r.sMin).toBeGreaterThanOrEqual(0);
    expect(r.off).toBe(1);
    expect(inclinedPlane.validate?.(p).length).toBeGreaterThan(0);
  });

  it('at the top, thrown upward: leaves at once instead of rising above the top', () => {
    const p = { ...plane, s0: 5, v0: 2 };
    const segs = segments(inclineInput(p));
    expect(segs[0]?.end).toBe('top');
    expect(segs[0]?.t1).toBe(0);
    const r = run(p, 2);
    expect(r.sMax).toBeLessThanOrEqual(5);
    expect(r.off).toBe(1);
    expect(inclinedPlane.validate?.(p).length).toBeGreaterThan(0);
  });

  it('on the road, pushed backwards from the start: rejected, and the engine never goes behind it', () => {
    const p = { ...newtonLaws.defaults, v0: -5 };
    expect(newtonLaws.validate?.(p).length).toBeGreaterThan(0);
    const r = run(newtonLaws.engineParams?.(p) ?? p, 3);
    expect(r.sMin).toBeGreaterThanOrEqual(0);
  });

  it('released at the top and sliding down is still a normal start', () => {
    expect(inclinedPlane.validate?.(plane)).toEqual([]);
    expect(newtonLaws.validate?.(newtonLaws.defaults)).toEqual([]);
  });
});
