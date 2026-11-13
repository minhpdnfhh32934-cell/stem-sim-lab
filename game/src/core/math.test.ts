import { describe, expect, it } from 'vitest';
import {
  directionFromYawPitch,
  lerp3,
  nlerpQuat,
  type Quat,
  quatFromYaw,
  turnView,
  type Vec3,
} from './math';

describe('lerp3', () => {
  it('gives a at 0, b at 1 and the midpoint at ½', () => {
    const a: Vec3 = [1, -2, 3];
    const b: Vec3 = [3, 2, -1];
    expect(lerp3(a, b, 0, [0, 0, 0])).toEqual(a);
    expect(lerp3(a, b, 1, [0, 0, 0])).toEqual(b);
    expect(lerp3(a, b, 0.5, [0, 0, 0])).toEqual([2, 0, 1]);
  });
});

describe('nlerpQuat', () => {
  const yawOf = (q: Quat) => 2 * Math.atan2(q[1], q[3]);

  it('gives a at 0 and b at 1, unit length', () => {
    const a = quatFromYaw(0.2);
    const b = quatFromYaw(0.5);
    const at0 = nlerpQuat(a, b, 0, [0, 0, 0, 1]);
    const at1 = nlerpQuat(a, b, 1, [0, 0, 0, 1]);
    for (let i = 0; i < 4; i++) {
      expect(at0[i]).toBeCloseTo(a[i]!, 12);
      expect(at1[i]).toBeCloseTo(b[i]!, 12);
    }
    const mid = nlerpQuat(a, b, 0.5, [0, 0, 0, 1]);
    expect(Math.hypot(...mid)).toBeCloseTo(1, 12);
    expect(yawOf(mid)).toBeCloseTo(0.35, 12); // symmetric about the middle
  });

  it('takes the short way when b is given as −b', () => {
    const a = quatFromYaw(0.2);
    const b = quatFromYaw(0.4).map((v) => -v) as Quat; // the same rotation, opposite sign
    const mid = nlerpQuat(a, b, 0.5, [0, 0, 0, 1]);
    expect(yawOf(mid)).toBeCloseTo(0.3, 12);
    expect(Math.hypot(...mid)).toBeCloseTo(1, 12);
  });
});

describe('turnView', () => {
  it('turns a view direction into the other view’s direction, and back', () => {
    const views: [number, number][] = [
      [0, 0],
      [0.7, -0.3],
      [-2.4, 0.9],
      [3.1, -1.2],
    ];
    for (const [y0, p0] of views) {
      for (const [y1, p1] of views) {
        const from = directionFromYawPitch(y0, p0, [0, 0, 0]);
        const to = directionFromYawPitch(y1, p1, [0, 0, 0]);
        const out = turnView(from, y0, p0, y1, p1, [0, 0, 0]);
        for (let i = 0; i < 3; i++) expect(out[i]).toBeCloseTo(to[i]!, 12);
      }
    }
    // Any offset keeps its length, and an unchanged view leaves it as it is.
    const v: Vec3 = [0.3, -0.2, -0.9];
    expect(Math.hypot(...turnView(v, 0.4, 0.1, -1, 0.5, [0, 0, 0]))).toBeCloseTo(
      Math.hypot(...v),
      12,
    );
    expect(turnView(v, 0.4, 0.1, 0.4, 0.1, [0, 0, 0]).map((n) => +n.toFixed(12))).toEqual(v);
  });
});
