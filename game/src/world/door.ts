import type { Vec3 } from '../core/math';

// Geometry of walk-through doors: a pair of sliding leaves back to back through one wall, both
// turned by the same rotationY and sliding along their local +x. Turned by r, a leaf's local +x
// points along (cos r, 0, −sin r) and its thin axis (local z) along (sin r, 0, cos r), as the
// renderer and physics turn every placement. Pure: no three.js, Rapier or DOM.

/** A box turned about +y; the functions that fill one write its arrays in place. */
export interface YawBox {
  /** Centre (m). */
  readonly center: Vec3;
  /** Half its size (m) along its own x, y and z. */
  readonly halfExtents: Vec3;
  /** Rotation about +y (rad). */
  rotationY: number;
}

export const createYawBox = (): YawBox => ({
  center: [0, 0, 0],
  halfExtents: [0, 0, 0],
  rotationY: 0,
});

/** A leaf where it stands closed: its box centre (m) and size (width along its slide, height, thickness). */
export interface LeafBox {
  readonly center: Readonly<Vec3>;
  readonly size: Readonly<Vec3>;
}

/** Both leaves of a pair: at opening fraction f each has slid f·travel (m) along its local +x. */
export interface SlidingPair {
  readonly leaves: readonly [LeafBox, LeafBox];
  readonly rotationY: number;
  readonly travel: number;
}

/** Where a leaf turned by `rotationY` stands at opening fraction f, from its closed place (into `out`). */
export function leafOffset(rotationY: number, travel: number, f: number, out: Vec3): Vec3 {
  const d = f * travel;
  out[0] = Math.cos(rotationY) * d;
  out[1] = 0;
  out[2] = -Math.sin(rotationY) * d;
  return out;
}

// Bounds of the box being built, in the pair's turned frame: module-level so a check per frame
// allocates nothing.
let x0 = 0;
let x1 = 0;
let y0 = 0;
let y1 = 0;
let z0 = 0;
let z1 = 0;

/** Grows the bounds by what `leaf` newly covers while its offset goes from `lo` to `hi` (m). */
function extend(leaf: LeafBox, c: number, s: number, lo: number, hi: number, opening: boolean) {
  const w = leaf.size[0] / 2;
  const h = leaf.size[1] / 2;
  const d = leaf.size[2] / 2;
  const lx = leaf.center[0] * c - leaf.center[2] * s; // the closed centre, turned
  const lz = leaf.center[0] * s + leaf.center[2] * c;
  // Its leading edge: the +x edge while opening, the −x edge while closing.
  const edge = opening ? lx + w : lx - w;
  x0 = Math.min(x0, edge + lo);
  x1 = Math.max(x1, edge + hi);
  y0 = Math.min(y0, leaf.center[1] - h);
  y1 = Math.max(y1, leaf.center[1] + h);
  z0 = Math.min(z0, lz - d);
  z1 = Math.max(z1, lz + d);
}

/**
 * The space a pair's leaves still sweep sliding from fraction `from` to `to`, with the tunnel
 * between the two leaves (through their wall), grown by `margin` (m): one box turned like the
 * leaves, written into `out`. Closing sweeps the doorway ahead of each leaf's leading edge, grown on
 * every side (someone about to step into the doorway holds it open); opening sweeps the pocket
 * beside it, grown along the slide and in height but not across the leaves: a leaf slides along its
 * own face, so what stands in front of it, even pressed against it by its leading edge, is never
 * reached. The leaves' current place is left out: nothing stands inside a leaf. With `from` = `to`
 * nothing is swept, yet the box is a 2·margin slab at the leading edge: ask only about a motion
 * that remains.
 */
export function sweptBox(
  pair: SlidingPair,
  from: number,
  to: number,
  margin: number,
  out: YawBox,
): YawBox {
  const c = Math.cos(pair.rotationY);
  const s = Math.sin(pair.rotationY);
  const opening = to > from;
  const lo = Math.min(from, to) * pair.travel;
  const hi = Math.max(from, to) * pair.travel;
  x0 = y0 = z0 = Infinity;
  x1 = y1 = z1 = -Infinity;
  extend(pair.leaves[0], c, s, lo, hi, opening);
  extend(pair.leaves[1], c, s, lo, hi, opening);
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  out.center[0] = mx * c + mz * s; // back from the turned frame
  out.center[1] = (y0 + y1) / 2;
  out.center[2] = -mx * s + mz * c;
  out.halfExtents[0] = (x1 - x0) / 2 + margin;
  out.halfExtents[1] = (y1 - y0) / 2 + margin;
  out.halfExtents[2] = (z1 - z0) / 2 + (opening ? 0 : margin);
  out.rotationY = pair.rotationY;
  return out;
}

/**
 * Whether a standing capsule (feet at `feet`, total height 2·halfHeight) meets `box`: its axis
 * within `radius` of the box's footprint (the footprint grown by the radius, rounded corners)
 * and its height overlapping the box's. Touching counts as meeting.
 */
export function capsuleInBox(
  box: YawBox,
  feet: Readonly<Vec3>,
  radius: number,
  halfHeight: number,
): boolean {
  const c = Math.cos(box.rotationY);
  const s = Math.sin(box.rotationY);
  const dx = feet[0] - box.center[0];
  const dz = feet[2] - box.center[2];
  const ox = Math.max(Math.abs(dx * c - dz * s) - box.halfExtents[0], 0);
  const oz = Math.max(Math.abs(dx * s + dz * c) - box.halfExtents[2], 0);
  if (ox * ox + oz * oz > radius * radius) return false;
  const bottom = box.center[1] - box.halfExtents[1];
  const top = box.center[1] + box.halfExtents[1];
  return feet[1] <= top && feet[1] + 2 * halfHeight >= bottom;
}
