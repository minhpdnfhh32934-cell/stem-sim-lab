/**
 * What the 3D view of "Con lắc đơn" draws (pure, no three.js; tested): the bob at angle θ from the
 * vertical (pivot at the origin, the swing in the x–y plane, y up), the swing arc between the
 * model's turning points, and the 2D picture's arrow scales (v: 0.35 L for √(4gL); forces: 0.35 L
 * for 3mg).
 */
import { vectorScale } from '../render/draw';
import type { PendulumInput } from './engine';
import { maxAngle } from './scenes';

export type Vec3 = [number, number, number];

export const bobAt = (q: PendulumInput, th: number): Vec3 => [
  q.L * Math.sin(th),
  -q.L * Math.cos(th),
  0,
];

export function pendulum3d(q: PendulumInput) {
  const tm = maxAngle(q);
  const arc: Vec3[] =
    tm === null ? [] : Array.from({ length: 41 }, (_, i) => bobAt(q, -tm + (2 * tm * i) / 40));
  return {
    arc,
    kv: vectorScale(Math.sqrt(2 * q.g * q.L * 2), q.L, 0.35),
    kf: vectorScale(q.m * q.g * 3, q.L, 0.35),
  };
}
