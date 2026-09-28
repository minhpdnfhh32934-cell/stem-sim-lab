import { describe, expect, it } from 'vitest';
import { CS, CollisionEngine, collisionInput } from './engine';
import { collide, collideCM, contactTime, kinetic } from './model';
import { collisions, outcome } from './scenes';

const x = (v: number) => ({ x: v, y: 0 });
const nx = { x: 1, y: 0 };

describe('collision model', () => {
  it('elastic head-on with equal masses exchanges velocities', () => {
    const r = collide(1, 1, x(3), x(0), nx, 1);
    expect(r.v1.x).toBeCloseTo(0, 14);
    expect(r.v2.x).toBeCloseTo(3, 14);
  });

  it('elastic 1D matches the textbook formulas and conserves p and K', () => {
    const [m1, m2, v1, v2] = [2, 1, 3, -1];
    const r = collide(m1, m2, x(v1), x(v2), nx, 1);
    expect(r.v1.x).toBeCloseTo(((m1 - m2) * v1 + 2 * m2 * v2) / (m1 + m2), 12);
    expect(r.v2.x).toBeCloseTo(((m2 - m1) * v2 + 2 * m1 * v1) / (m1 + m2), 12);
    expect(m1 * r.v1.x + m2 * r.v2.x).toBeCloseTo(m1 * v1 + m2 * v2, 12);
    expect(kinetic(m1, r.v1) + kinetic(m2, r.v2)).toBeCloseTo(
      kinetic(m1, x(v1)) + kinetic(m2, x(v2)),
      12,
    );
  });

  it('perfectly inelastic: common velocity and maximal KE loss', () => {
    const r = collide(2, 1, x(3), x(-1), nx, 0);
    expect(r.v1.x).toBeCloseTo(5 / 3, 12);
    expect(r.v2.x).toBeCloseTo(5 / 3, 12);
  });

  it('impulse and centre-of-mass derivations agree for oblique collisions', () => {
    const n = { x: Math.sqrt(1 - 0.16), y: 0.4 };
    for (const e of [1, 0.6]) {
      const a = collide(2, 1.3, { x: 2, y: 0.3 }, { x: -0.5, y: 0 }, n, e);
      const b = collideCM(2, 1.3, { x: 2, y: 0.3 }, { x: -0.5, y: 0 }, n, e);
      expect(a.v1.x).toBeCloseTo(b.v1.x, 12);
      expect(a.v2.y).toBeCloseTo(b.v2.y, 12);
    }
  });

  it('equal-mass elastic oblique collision: outgoing velocities are perpendicular', () => {
    const n = { x: Math.sqrt(1 - 0.25), y: 0.5 };
    const r = collide(1, 1, x(2), x(0), n, 1);
    expect(r.v1.x * r.v2.x + r.v1.y * r.v2.y).toBeCloseTo(0, 12);
  });

  it('contact time for approaching disks', () => {
    expect(contactTime({ x: 1, y: 0 }, { x: -2, y: 0 }, 0.2, 1)).toBeCloseTo(0.4, 12);
    expect(contactTime({ x: 1, y: 0 }, { x: 2, y: 0 }, 0.2, 1)).toBeNull();
  });
});

describe('collision engine', () => {
  it('reproduces the analytic post-collision velocities', () => {
    const p = { ...collisions.defaults, mode: 1, e: 0.8 };
    const e = new CollisionEngine();
    e.reset(p);
    for (let i = 0; i < 1200; i++) e.step();
    const s = new Float64Array(10);
    e.readState(s);
    const o = outcome(collisionInput(p));
    expect(s[CS.count]).toBe(1);
    expect(s[CS.vx1]).toBeCloseTo(o.after.v1.x, 12);
    expect(s[CS.vy2]).toBeCloseTo(o.after.v2.y, 12);
  });

  it('scene solution checks agree', () => {
    for (const mode of [0, 1]) {
      const sol = collisions.solve({ ...collisions.defaults, mode }, 'vi');
      for (const a of sol.answers)
        if (a.check !== undefined) expect(a.check).toBeCloseTo(a.value, 10);
    }
  });
});
