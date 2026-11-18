/**
 * What the 3D view of "Chuyển động tròn đều" draws (pure, no three.js; tested against the model):
 * the circle laid in a horizontal plane (model x → world x, model y → world −z, so the world's up
 * is the axis of turning), and the 2D picture's arrow scales: v is 0.45 r long, a_ht 0.4 r (the
 * arrows show directions; the magnitudes are in the Inspector, as in 2D).
 */
import { vectorScale } from '../render/draw';
import type { Circular } from './model';

export type Vec3 = [number, number, number];

/** A model point (x, y) of the turning plane in the world. */
export const toWorld = (x: number, y: number): Vec3 => [x, 0, -y];

export function circle3d(c: Circular) {
  const r = Math.max(c.r, 1e-3);
  return { r, kv: vectorScale(c.v, r, 0.45), ka: vectorScale(c.aC, r, 0.4) };
}
