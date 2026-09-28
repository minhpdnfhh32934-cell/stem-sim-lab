import { describe, expect, it } from 'vitest';
import { EngineRunner, isRunnerError } from '@/core/sim/runner';
import { projectile } from './analytic';
import { PS, ProjectileEngine } from './engine';
import { freeFall, horizontalProjectile, numericCheck, obliqueProjectile } from './scenes';

const deg = (d: number) => (d * Math.PI) / 180;

describe('projectile — closed form', () => {
  it('textbook horizontal throw: h = 45 m, v0 = 10 m/s, g = 10 → t = 3 s, L = 30 m', () => {
    const r = projectile({ v0: 10, angle: 0, h0: 45, g: 10 });
    expect(r.flightTime).toBeCloseTo(3, 12);
    expect(r.range).toBeCloseTo(30, 12);
    expect(r.impactSpeed).toBeCloseTo(Math.sqrt(100 + 900), 12);
  });

  it('free fall from 20 m with g = 10 → t = 2 s, v = 20 m/s', () => {
    const r = projectile({ v0: 0, angle: -Math.PI / 2, h0: 20, g: 10 });
    expect(r.flightTime).toBeCloseTo(2, 12);
    expect(r.impactSpeed).toBeCloseTo(20, 12);
  });

  it('ground-level launch: range = v0² sin 2α / g and 45° is optimal', () => {
    const g = 9.81;
    const r45 = projectile({ v0: 20, angle: deg(45), h0: 0, g });
    expect(r45.range).toBeCloseTo((20 * 20) / g, 10);
    const r30 = projectile({ v0: 20, angle: deg(30), h0: 0, g });
    const r60 = projectile({ v0: 20, angle: deg(60), h0: 0, g });
    expect(r30.range).toBeCloseTo(r60.range, 10); // complementary angles
    expect(r45.range).toBeGreaterThan(r30.range);
  });

  it.each([
    [15, 30, 20],
    [25, 60, 0],
    [8, -20, 30],
    [0, 0, 12],
  ])('matches Dormand–Prince integration (v0=%d, α=%d°, h0=%d)', (v0, a, h0) => {
    const inp = { v0, angle: deg(a), h0, g: 9.81 };
    const r = projectile(inp);
    const n = numericCheck(inp);
    expect(n.flightTime).toBeCloseTo(r.flightTime, 9);
    expect(n.range).toBeCloseTo(r.range, 8);
    expect(n.maxHeight).toBeCloseTo(r.maxHeight, 8);
    expect(n.impactSpeed).toBeCloseTo(r.impactSpeed, 8);
  });
});

describe('projectile engine', () => {
  it('lands exactly where the analytic solution says (not just within Δt)', () => {
    const p = { v0: 15, angle: deg(30), h0: 20, g: 9.81 };
    const engine = new ProjectileEngine();
    engine.reset(p);
    const runner = new EngineRunner(engine, 1000);
    let f;
    for (let i = 0; i < 400 && !engine.finished(); i++) f = runner.frame(1 / 60, 1);
    if (!f || isRunnerError(f)) throw new Error('no frame');
    const r = projectile(p);
    expect(engine.finished()).toBe(true);
    expect(engine.time()).toBeCloseTo(r.flightTime, 10);
    expect(f.curr[PS.x]).toBeCloseTo(r.range, 9);
    expect(f.curr[PS.y]).toBe(0);
    expect(f.stats.maxRelDrift).toBeLessThan(1e-12);
  });

  it('dragging marks an intervention and throwing keeps the drag velocity', () => {
    const engine = new ProjectileEngine();
    engine.reset({ v0: 0, angle: 0, h0: 5, g: 9.81 });
    expect(engine.input({ kind: 'dragStart', body: 0, x: 0, y: 5 })).toBe(true);
    for (let i = 0; i < 60; i++) {
      engine.input({ kind: 'dragMove', x: i * 0.05, y: 5 });
      engine.step();
    }
    engine.input({ kind: 'dragEnd' });
    const s = new Float64Array(7);
    engine.readState(s);
    expect(s[PS.vx]).toBeGreaterThan(1); // moving right with the pointer
    expect(s[PS.y]).toBeGreaterThan(4.5); // held up while dragged
  });
});

describe('projectile scenes', () => {
  it('each scene produces a solution whose answers agree with the numeric check', () => {
    for (const scene of [obliqueProjectile, horizontalProjectile, freeFall]) {
      const sol = scene.solve(scene.defaults, 'vi');
      expect(sol.answers.length).toBeGreaterThan(1);
      for (const a of sol.answers) {
        if (a.check === undefined) continue;
        expect(Math.abs(a.value - a.check)).toBeLessThan(1e-7 * Math.max(1, Math.abs(a.value)));
      }
      const card = scene.scienceCard(scene.defaults);
      expect(card.confidence).toBe('exact');
      expect(card.sources.length).toBeGreaterThan(0);
    }
  });

  it('free fall maps a signed v0 onto an upward/downward launch', () => {
    const up = freeFall.engineParams!({ h0: 0, v0: 10, g: 10, m: 1 });
    expect(up.angle).toBeCloseTo(Math.PI / 2, 12);
    const sol = freeFall.solve({ h0: 0, v0: 10, g: 10, m: 1 }, 'vi');
    expect(sol.answers.find((a) => a.id === 'time_of_flight')!.value).toBeCloseTo(2, 12);
    expect(sol.answers.find((a) => a.id === 'max_height')!.value).toBeCloseTo(5, 12);
  });

  it('horizontal throw refuses h₀ = 0', () => {
    expect(horizontalProjectile.validate!({ v0: 5, h0: 0, g: 9.81, m: 1 })).toHaveLength(1);
  });
});
