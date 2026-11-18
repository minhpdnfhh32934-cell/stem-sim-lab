/**
 * What the 3D view of "Con lắc lò xo" draws (pure, no three.js; tested): the 2D picture's layout
 * (block size, spring length, amplitude, arrow scales) and the coil as a helix between two points
 * on one axis, written into a reused buffer (no allocation per frame).
 */
import { vectorScale } from '../render/draw';
import { staticExtension, type SpringInput } from './engine';
import { omega0 } from './model';
import { bounds } from './scenes';

export type Vec3 = [number, number, number];

export const COIL_TURNS = 14;
export const COIL_STEPS = 12;
export const COIL_POINTS = COIL_TURNS * COIL_STEPS + 1;

export function spring3d(q: SpringInput) {
  const { A, bs, len } = bounds(q);
  if (q.vertical) {
    const k = vectorScale(Math.max(q.m * q.g, q.k * (staticExtension(q) + A)), len, 0.3);
    return { A, bs, len, ceil: len + bs / 2, kv: 0, kf: k };
  }
  return {
    A,
    bs,
    len,
    wall: -len - bs / 2,
    kv: vectorScale(Math.max(omega0(q) * A, 1e-6), len, 0.2),
    kf: vectorScale(Math.max(q.k * A, 1e-6), len, 0.2),
  };
}

/**
 * The coil from `a` to `b` along axis `ax` (0: x, 1: y) with radius `r`, into `out` (3 ×
 * COIL_POINTS numbers). The ends sit on the axis, the turns go round it in the other two axes.
 */
export function writeCoil(
  out: Float32Array,
  a: number,
  b: number,
  ax: 0 | 1,
  other: number,
  r: number,
) {
  for (let i = 0; i < COIL_POINTS; i++) {
    const u = i / (COIL_POINTS - 1);
    const along = a + (b - a) * u;
    const ang = 2 * Math.PI * COIL_TURNS * u;
    // The radius fades to 0 at both ends so the coil starts on the wall and ends on the block.
    const rr = r * Math.min(1, 12 * u, 12 * (1 - u));
    const c = rr * Math.cos(ang);
    const s = rr * Math.sin(ang);
    const j = 3 * i;
    if (ax === 0) {
      out[j] = along;
      out[j + 1] = other + c;
      out[j + 2] = s;
    } else {
      out[j] = c;
      out[j + 1] = along;
      out[j + 2] = s;
    }
  }
}
