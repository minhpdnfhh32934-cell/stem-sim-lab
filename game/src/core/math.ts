/** World-space vector in metres. Y is up; yaw 0 looks down -Z (three.js convention). */
export type Vec3 = [number, number, number];

export interface Aabb {
  readonly min: Readonly<Vec3>;
  readonly max: Readonly<Vec3>;
}

export function containsXZ(box: Aabb, x: number, z: number): boolean {
  return x >= box.min[0] && x <= box.max[0] && z >= box.min[2] && z <= box.max[2];
}

/** Writes the unit view direction for a yaw/pitch pair into `out` (no allocation). */
export function directionFromYawPitch(yaw: number, pitch: number, out: Vec3): Vec3 {
  const cp = Math.cos(pitch);
  out[0] = -Math.sin(yaw) * cp;
  out[1] = Math.sin(pitch);
  out[2] = -Math.cos(yaw) * cp;
  return out;
}

// Slab-test interval, module-level so the per-frame focus query never allocates.
let tNear = 0;
let tFar = Infinity;

function slab(o: number, d: number, half: number): boolean {
  if (Math.abs(d) < 1e-12) return o >= -half && o <= half;
  const t1 = (-half - o) / d;
  const t2 = (half - o) / d;
  tNear = Math.max(tNear, Math.min(t1, t2));
  tFar = Math.min(tFar, Math.max(t1, t2));
  return tNear <= tFar;
}

/** Unit rotation quaternion [x, y, z, w] (three.js and Rapier order). */
export type Quat = [number, number, number, number];

export const quatFromYaw = (yaw: number): Quat => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

/** Rotates (x, y, z) by the inverse of `q` into `out`: world direction → box-local direction. */
function inverseRotate(q: Readonly<Quat>, x: number, y: number, z: number, out: Vec3): void {
  const qx = -q[0];
  const qy = -q[1];
  const qz = -q[2];
  const w = q[3];
  // v' = v + w·t + q×t with t = 2·(q×v)
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  out[0] = x + w * tx + (qy * tz - qz * ty);
  out[1] = y + w * ty + (qz * tx - qx * tz);
  out[2] = z + w * tz + (qx * ty - qy * tx);
}

/** Rotates a local vector by `q` into `out` (e.g. an offset given in an object's own frame). */
export function rotate(q: Readonly<Quat>, v: Readonly<Vec3>, out: Vec3): Vec3 {
  inverseRotate([-q[0], -q[1], -q[2], q[3]], v[0], v[1], v[2], out);
  return out;
}

const localOrigin: Vec3 = [0, 0, 0];
const localDir: Vec3 = [0, 0, 0];

/**
 * Distance along a ray (unit `dir`) to an oriented box, or null when it misses or lies behind
 * the origin. Inside the box counts as 0. Boxes rather than spheres so a small object resting on
 * a large one can still be targeted; full rotation so tumbling physics objects stay targetable.
 */
export function rayBox(
  origin: Readonly<Vec3>,
  dir: Readonly<Vec3>,
  center: Readonly<Vec3>,
  halfExtents: Readonly<Vec3>,
  rotation: Readonly<Quat>,
): number | null {
  inverseRotate(
    rotation,
    origin[0] - center[0],
    origin[1] - center[1],
    origin[2] - center[2],
    localOrigin,
  );
  inverseRotate(rotation, dir[0], dir[1], dir[2], localDir);
  tNear = 0;
  tFar = Infinity;
  const hit =
    slab(localOrigin[0], localDir[0], halfExtents[0]) &&
    slab(localOrigin[1], localDir[1], halfExtents[1]) &&
    slab(localOrigin[2], localDir[2], halfExtents[2]);
  return hit ? tNear : null;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** `out` = a + (b − a)·t, component-wise (t 0: a, t 1: b). */
export function lerp3(a: Readonly<Vec3>, b: Readonly<Vec3>, t: number, out: Vec3): Vec3 {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

/**
 * The rotation a fraction `t` of the way from a to b, the short way round, normalized (nlerp):
 * for the small turns between two physics steps it matches slerp to well under a degree.
 */
export function nlerpQuat(a: Readonly<Quat>, b: Readonly<Quat>, t: number, out: Quat): Quat {
  // q and −q are the same rotation: flip b onto a's side so the blend takes the short way.
  const s = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  let length = 0;
  for (let i = 0; i < 4; i++) {
    const v = (a[i] ?? 0) + (s * (b[i] ?? 0) - (a[i] ?? 0)) * t;
    out[i] = v;
    length += v * v;
  }
  length = Math.sqrt(length) || 1;
  for (let i = 0; i < 4; i++) out[i] = (out[i] ?? 0) / length;
  return out;
}

/**
 * `v` as seen from a view that turned from (yaw0, pitch0) to (yaw1, pitch1), rad: what stood at
 * `v` from the first view's eye stands at `out` for the second (yaw about y, then pitch about x,
 * as the camera turns). Allocates nothing.
 */
export function turnView(
  v: Readonly<Vec3>,
  yaw0: number,
  pitch0: number,
  yaw1: number,
  pitch1: number,
  out: Vec3,
): Vec3 {
  let x = v[0];
  let y = v[1];
  let z = v[2];
  let t: number;
  // Into the first view's frame: undo its yaw, then its pitch…
  let c = Math.cos(-yaw0);
  let s = Math.sin(-yaw0);
  t = x * c + z * s;
  z = -x * s + z * c;
  x = t;
  c = Math.cos(-pitch0);
  s = Math.sin(-pitch0);
  t = y * c - z * s;
  z = y * s + z * c;
  y = t;
  // …and out through the second: its pitch, then its yaw.
  c = Math.cos(pitch1);
  s = Math.sin(pitch1);
  t = y * c - z * s;
  z = y * s + z * c;
  y = t;
  c = Math.cos(yaw1);
  s = Math.sin(yaw1);
  t = x * c + z * s;
  z = -x * s + z * c;
  x = t;
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
