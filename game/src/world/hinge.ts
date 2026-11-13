import type { Vec3 } from '../core/math';
import { capsuleInBox, createYawBox, type YawBox } from './door';

// Geometry of hinged leaves (UX3.1): a cabinet's doors, the washroom door. A leaf turns about a
// vertical hinge line through (x, z) in its item's frame; turned by `opens`·angle about +y, its
// free edge moves towards the item's +z (the front) as it opens. Rotation follows the renderer
// and physics: turned by r, (x, z) goes to (x cos r + z sin r, −x sin r + z cos r). Pure: no
// three.js, Rapier or DOM, so gameplay (the swing), physics (the collider) and the renderer (the
// drawn leaf) share it.

/** A hinged leaf in its item's frame, closed: as items.json `hinged.leaves` gives it. */
export interface HingedLeaf {
  /** Its box centre and size (m), from the item's centre. */
  readonly center: Readonly<Vec3>;
  readonly size: Readonly<Vec3>;
  /** The hinge line's (x, z) (m). */
  readonly hinge: readonly [number, number];
  /** The sign of the turn about +y that opens it. */
  readonly opens: 1 | -1;
}

/** How far a leaf at opening fraction f (0 … 1) has turned (rad): eased in and out (smoothstep). */
export function swingAngle(f: number, widest: number): number {
  return widest * f * f * (3 - 2 * f);
}

/**
 * Where a leaf turned by `angle` (signed: already times `opens`) stands, its item's box centre at
 * `position` turned by `yaw`: its box centre written into `out`; returns its yaw.
 */
export function leafPose(
  position: Readonly<Vec3>,
  yaw: number,
  leaf: HingedLeaf,
  angle: number,
  out: Vec3,
): number {
  const [hx, hz] = leaf.hinge;
  // The leaf's centre from its hinge, turned by the swing, then back to the hinge.
  const dx = leaf.center[0] - hx;
  const dz = leaf.center[2] - hz;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const lx = hx + dx * ca + dz * sa;
  const lz = hz - dx * sa + dz * ca;
  // The item's frame in the world.
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  out[0] = position[0] + lx * c + lz * s;
  out[1] = position[1] + leaf.center[1];
  out[2] = position[2] - lx * s + lz * c;
  return yaw + angle;
}

/** Steps (rad) the remaining swing is sampled at: a leaf ≤ 1.1 m wide moves ≤ 0.1 m between two. */
const SAMPLE = (5 * Math.PI) / 180;
const sampled: YawBox = createYawBox();
const centre: Vec3 = [0, 0, 0];

/**
 * Whether a standing capsule meets what `leaf` still sweeps turning from fraction `from` to `to`
 * (its current place left out: nothing stands inside a leaf), grown by `margin` (m) on its sides
 * and edges and on the face it moves towards — the front while opening, the back while closing —
 * so someone pressed against the face it moves away from is never "in" it. Allocates nothing.
 */
export function capsuleInSwing(
  position: Readonly<Vec3>,
  yaw: number,
  leaf: HingedLeaf,
  widest: number,
  from: number,
  to: number,
  margin: number,
  feet: Readonly<Vec3>,
  radius: number,
  halfHeight: number,
): boolean {
  if (from === to) return false;
  const a0 = swingAngle(from, widest);
  const a1 = swingAngle(to, widest);
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / SAMPLE));
  const ahead = to > from ? margin / 2 : -margin / 2; // the leading face, in the leaf's own z
  for (let i = 1; i <= steps; i++) {
    const angle = leaf.opens * (a0 + ((a1 - a0) * i) / steps);
    const r = leafPose(position, yaw, leaf, angle, centre);
    const c = Math.cos(r);
    const s = Math.sin(r);
    sampled.center[0] = centre[0] + ahead * s;
    sampled.center[1] = centre[1];
    sampled.center[2] = centre[2] + ahead * c;
    sampled.halfExtents[0] = leaf.size[0] / 2 + margin;
    sampled.halfExtents[1] = leaf.size[1] / 2 + margin;
    sampled.halfExtents[2] = leaf.size[2] / 2 + margin / 2;
    sampled.rotationY = r;
    if (capsuleInBox(sampled, feet, radius, halfHeight)) return true;
  }
  return false;
}

/** What a swept leaf asks physics: whether a dynamic body overlaps a box turned about +y. */
export interface BodyQuery {
  dynamicBodyIn(center: Readonly<Vec3>, halfExtents: Readonly<Vec3>, rotationY: number): boolean;
}

/** How much (m) a leaf's box is shrunk for the body test: a body resting against it is not "in" it. */
const TOUCH = 0.005;
const bodyAt: Vec3 = [0, 0, 0];
const bodyHalf: Vec3 = [0, 0, 0];

/**
 * Whether a dynamic body (glass on a shelf edge, a bottle sticking out) stands in what `leaf` still
 * sweeps turning from fraction `from` to `to` (its current place left out), sampled as
 * `capsuleInSwing` is. Asked once per request, never per frame. Allocates nothing.
 */
export function bodyInSwing(
  position: Readonly<Vec3>,
  yaw: number,
  leaf: HingedLeaf,
  widest: number,
  from: number,
  to: number,
  bodies: BodyQuery,
): boolean {
  if (from === to) return false;
  const a0 = swingAngle(from, widest);
  const a1 = swingAngle(to, widest);
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / SAMPLE));
  bodyHalf[0] = leaf.size[0] / 2 - TOUCH;
  bodyHalf[1] = leaf.size[1] / 2 - TOUCH;
  bodyHalf[2] = Math.max(leaf.size[2] / 2 - TOUCH, 0.001);
  for (let i = 1; i <= steps; i++) {
    const r = leafPose(position, yaw, leaf, leaf.opens * (a0 + ((a1 - a0) * i) / steps), bodyAt);
    if (bodies.dynamicBodyIn(bodyAt, bodyHalf, r)) return true;
  }
  return false;
}
