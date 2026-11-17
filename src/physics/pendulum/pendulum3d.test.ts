import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { PE, pendulumInput } from './engine';
import { bobAt, pendulum3d } from './pendulum3d';
import { buildPendulumScene } from './scene3d';
import { maxAngle } from './scenes';

const texts = { v: 'v', P: 'P', T: 'T', small: 'small' };
const q = pendulumInput({ L: 1.5, theta0: Math.PI / 3, m: 0.5, g: 9.8 });

function buffer(th: number, om: number, thS: number) {
  const b = new Float64Array(6);
  b[PE.th] = th;
  b[PE.om] = om;
  b[PE.thS] = thS;
  b[PE.T] = q.m * (q.g * Math.cos(th) + q.L * om * om);
  return b;
}

describe('pendulum 3D', () => {
  it('the bob is ℓ from the pivot; the arc spans the model’s turning points', () => {
    for (const th of [-1, 0, 0.4, 1.2]) expect(Math.hypot(...bobAt(q, th))).toBeCloseTo(q.L, 12);
    const tm = maxAngle(q) ?? NaN;
    const { arc } = pendulum3d(q);
    expect(arc[0]).toEqual(bobAt(q, -tm));
    expect(arc.at(-1)).toEqual(bobAt(q, tm));
  });

  it('the bob at the engine’s angle, the small-angle ghost, and the frees', () => {
    const { kit, track, start } = testKit();
    let s = buffer(0.5, -1.2, 0.45);
    const sc = buildPendulumScene(kit, { q, showSmall: true, texts, read: () => s });
    expect(sc.state().bob).toEqual(bobAt(q, 0.5));
    expect(sc.state().small).toEqual(bobAt(q, 0.45));
    s = buffer(-0.3, 2, -0.2);
    sc.tick?.(1 / 60);
    expect(sc.state().th).toBe(-0.3);
    expect(kit.scene.getObjectByName('pendulum-bob')?.position.toArray()).toEqual(bobAt(q, -0.3));
    // T points from the bob to the pivot; P points down.
    const T = kit.scene.getObjectByName('pendulum-T');
    const up = T?.up.clone().applyQuaternion(T.quaternion);
    const [bx, by] = bobAt(q, -0.3);
    expect((up?.x ?? 0) * -bx + (up?.y ?? 0) * -by).toBeCloseTo(q.L, 9);
    const P = kit.scene.getObjectByName('pendulum-P');
    expect(P?.up.clone().applyQuaternion(P.quaternion).y).toBeCloseTo(-1, 9);
    expectAllFreed(kit, track, start);
  });

  it('no ghost when the lesson hides the small-angle model', () => {
    const { kit, track, start } = testKit();
    const sc = buildPendulumScene(kit, {
      q,
      showSmall: false,
      texts,
      read: () => buffer(0.2, 0, 0.2),
    });
    expect(sc.state().small).toBeNull();
    expect(kit.scene.getObjectByName('pendulum-small')).toBeUndefined();
    expectAllFreed(kit, track, start);
  });
});
