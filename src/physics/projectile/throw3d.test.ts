import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { vectorScale } from '../render/draw';
import { projectile, projectileAt, type ProjectileInput } from './analytic';
import { PS } from './engine';
import { PATH_SEGMENTS, throw3d } from './projectile3d';
import { buildThrowScene } from './scene3d';

const oblique: ProjectileInput = { v0: 15, angle: Math.PI / 4, h0: 0, g: 9.8 };
const horizontal: ProjectileInput = { v0: 10, angle: 0, h0: 45, g: 9.8 };
const drop: ProjectileInput = { v0: 0, angle: -Math.PI / 2, h0: 45, g: 9.8 };

const texts = { H: 'H', L: 'L', h0: 'h0', v: 'v', a: 'a' };

function state(x: number, y: number, vx: number, vy: number, g: number, landed = 0) {
  const s = new Float64Array(7);
  s[PS.x] = x;
  s[PS.y] = y;
  s[PS.vx] = vx;
  s[PS.vy] = vy;
  s[PS.ay] = -g;
  s[PS.landed] = landed;
  return s;
}

describe('throw 3D (pure)', () => {
  it('the dotted path is the closed form, launch to landing', () => {
    for (const inp of [oblique, horizontal, drop]) {
      const T = throw3d(inp);
      const r = projectile(inp);
      expect(T.path).toHaveLength(PATH_SEGMENTS + 1);
      T.path.forEach(([x, y], i) => {
        const p = projectileAt(inp, (r.flightTime * i) / PATH_SEGMENTS);
        expect(x).toBe(p.x);
        expect(y).toBe(p.y);
      });
      const [lx, ly] = T.path.at(-1) ?? [NaN, NaN];
      expect(lx).toBeCloseTo(r.range, 9);
      expect(ly).toBeCloseTo(0, 9);
    }
  });

  it('the 2D picture’s size and arrow scales', () => {
    const T = throw3d(oblique);
    const r = projectile(oblique);
    expect(T.s).toBe(Math.max(Math.abs(r.range), r.maxHeight, 1));
    const vref = Math.max(oblique.v0, Math.sqrt(2 * oblique.g * Math.max(r.maxHeight, 0.1)));
    expect(T.kv).toBe(vectorScale(vref, T.s, 0.22));
    expect(T.ka).toBe(vectorScale(oblique.g, T.s, 0.1));
  });

  it('ground marks: evenly spaced inside the ground, including 0', () => {
    for (const inp of [oblique, horizontal, drop]) {
      const T = throw3d(inp);
      expect(T.ticks).toContain(0);
      for (const x of T.ticks) {
        expect(x).toBeGreaterThanOrEqual(T.xMin - 1e-9);
        expect(x).toBeLessThanOrEqual(T.xMax + 1e-9);
        expect(Math.abs(x / T.tick - Math.round(x / T.tick))).toBeLessThan(1e-9);
      }
    }
  });
});

describe('throw 3D scene', () => {
  it('puts the ball where the engine is and frees everything', () => {
    const { kit, track, start } = testKit();
    let s = state(5, 3, 10.6, 2, 9.8);
    const sc = buildThrowScene(kit, {
      inp: oblique,
      showPath: true,
      texts,
      fmtX: String,
      read: () => s,
    });
    expect(sc.state()).toEqual({
      x: 5,
      y: 3,
      vx: 10.6,
      vy: 2,
      landed: false,
      path: PATH_SEGMENTS + 1,
    });
    expect(kit.scene.getObjectByName('throw-ball')?.position.toArray()).toEqual([5, 3, 0]);
    s = state(22.96, 0, 10.6, -10.6, 9.8, 1);
    sc.tick?.(1 / 60);
    expect(sc.state()).toMatchObject({ x: 22.96, y: 0, landed: true });
    expect(kit.scene.getObjectByName('throw-ball')?.position.toArray()).toEqual([22.96, 0, 0]);
    expectAllFreed(kit, track, start);
  });

  it('no predicted path once the learner intervened (as in 2D)', () => {
    const { kit, track, start } = testKit();
    const sc = buildThrowScene(kit, {
      inp: horizontal,
      showPath: false,
      texts,
      fmtX: String,
      read: () => state(0, 45, 10, 0, 9.8),
    });
    expect(sc.state().path).toBe(0);
    expect(kit.scene.getObjectByName('throw-path')).toBeUndefined();
    expectAllFreed(kit, track, start);
  });

  it('a velocity of zero hides its arrow (dropped from rest)', () => {
    const { kit, track, start } = testKit();
    buildThrowScene(kit, {
      inp: drop,
      showPath: true,
      texts: { ...texts, L: null },
      fmtX: String,
      read: () => state(0, 45, 0, 0, 9.8),
    });
    expect(kit.scene.getObjectByName('throw-v')?.visible).toBe(false);
    expect(kit.scene.getObjectByName('throw-a')?.visible).toBe(true);
    expectAllFreed(kit, track, start);
  });
});
