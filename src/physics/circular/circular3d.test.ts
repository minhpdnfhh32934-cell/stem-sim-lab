import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { circle3d, toWorld } from './circular3d';
import { CE } from './engine';
import { circular, stateAt } from './model';
import { buildCircularScene } from './scene3d';

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
const len = (a: number[]) => Math.hypot(...a);

function buffer(c: ReturnType<typeof circular>, t: number) {
  const s = stateAt(c, t);
  const b = new Float64Array(7);
  b[CE.phi] = s.phi;
  b[CE.x] = s.x;
  b[CE.y] = s.y;
  b[CE.vx] = s.vx;
  b[CE.vy] = s.vy;
  b[CE.ax] = s.ax;
  b[CE.ay] = s.ay;
  return b;
}

describe('circular 3D', () => {
  it('the turning plane is horizontal: the model y goes to world −z', () => {
    expect(toWorld(1, 2)).toEqual([1, 0, -2]);
  });

  it('the body on the circle, v tangent and a_ht towards the centre, at the 2D scales', () => {
    for (const p of [
      { r: 1, v: 2 },
      { r: 2.5, v: 3, dir: -1 },
      { r: 0.4, mode: 2, T: 0.5 },
    ]) {
      const c = circular(p);
      const { kv, ka } = circle3d(c);
      const { kit, track, start } = testKit();
      let t = 0.37;
      const sc = buildCircularScene(kit, {
        c,
        texts: { v: 'v', a: 'a' },
        read: () => buffer(c, t),
      });
      for (t of [0.37, 1.1, 2.9]) {
        sc.tick?.(1 / 60);
        const { at, v, a } = sc.state();
        const m = stateAt(c, t);
        expect(at[0]).toBeCloseTo(m.x, 12);
        expect(at[2]).toBeCloseTo(-m.y, 12);
        expect(len(at)).toBeCloseTo(c.r, 12);
        expect(dot(v, at)).toBeCloseTo(0, 9);
        expect(len(v) * kv).toBeCloseTo(0.45 * c.r, 9);
        expect(dot(a, at) / (len(a) * len(at))).toBeCloseTo(-1, 9);
        expect(len(a) * ka).toBeCloseTo(0.4 * c.r, 9);
      }
      expectAllFreed(kit, track, start);
    }
  });
});
