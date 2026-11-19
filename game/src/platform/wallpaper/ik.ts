import * as THREE from 'three';

/*
 * Limbs placed by where they touch (Phase W, Phú: hands and feet must rest on things, never go
 * through them). Analytic two-bone IK on the body's real bones: the shoulder (or hip) stays, the
 * elbow (knee) is put in the plane of the target and a pole — elbows out and back, knees ahead —
 * and the bones turned to reach it. The body's bones are unturned in the bind pose, their axes the
 * body's (x right, y up, z back), every limb hanging along −y, so a bone's world turn is built
 * straight from its direction; the elbow bends on its x axis forward (+x), the knee backward (−x)
 * (`render/body/actor.ts`). A hand or foot can then be given its own world turn (a palm flat on a
 * ledge). Nothing allocated per call.
 */

export interface Limb {
  readonly upper: THREE.Bone;
  readonly lower: THREE.Bone;
  readonly end: THREE.Bone;
  /** +1 an arm (bends forward, −z), −1 a leg (bends backward, +z). */
  readonly bend: 1 | -1;
  /** The two bones' lengths (m), from the bind pose. */
  readonly l1: number;
  readonly l2: number;
}

export function limb(upper: THREE.Bone, lower: THREE.Bone, end: THREE.Bone, bend: 1 | -1): Limb {
  return { upper, lower, end, bend, l1: lower.position.length(), l2: end.position.length() };
}

const s = new THREE.Vector3();
const e = new THREE.Vector3();
const dir = new THREE.Vector3();
const n = new THREE.Vector3();
const w = new THREE.Vector3();
const x = new THREE.Vector3();
const y = new THREE.Vector3();
const z = new THREE.Vector3();
const basis = new THREE.Matrix4();
const qWorld = new THREE.Quaternion();
const qParent = new THREE.Quaternion();
const qLocal = new THREE.Quaternion();

/**
 * Turns `limb` so its end reaches `target` (world), the middle joint towards `pole` (world), by
 * `weight` (0 keeps the pose it has, 1 is the solution). The limb's parent's world matrix must be
 * up to date; the limb's are updated. Returns how far short the end stays (m, 0 if reached).
 */
export function reach(lb: Limb, target: THREE.Vector3, pole: THREE.Vector3, weight = 1): number {
  if (weight <= 0) return 0;
  const parent = lb.upper.parent;
  if (!parent) return 0;
  const want = middle(lb, target, pole, e);
  const d = Math.min(lb.l1 + lb.l2 - 1e-4, Math.max(Math.abs(lb.l1 - lb.l2) + 1e-4, want));
  // The upper bone: +y back towards its own joint, the bend's side on −z (arm) or +z (leg).
  y.subVectors(s, e).normalize();
  w.copy(s).addScaledVector(dir, d).sub(e);
  w.addScaledVector(y, -w.dot(y));
  if (w.lengthSq() < 1e-10) w.copy(n).multiplyScalar(-1);
  w.normalize();
  z.copy(w).multiplyScalar(lb.bend > 0 ? -1 : 1);
  x.crossVectors(y, z).normalize();
  z.crossVectors(x, y);
  basis.makeBasis(x, y, z);
  qWorld.setFromRotationMatrix(basis);
  parent.getWorldQuaternion(qParent);
  qLocal.copy(qParent).invert().multiply(qWorld);
  lb.upper.quaternion.slerp(qLocal, weight);
  // The lower bone: a hinge on x, its angle from the triangle.
  const cosInner = (lb.l1 * lb.l1 + lb.l2 * lb.l2 - d * d) / (2 * lb.l1 * lb.l2);
  const bendAngle = Math.PI - Math.acos(Math.min(1, Math.max(-1, cosInner)));
  qLocal.setFromAxisAngle(X_AXIS, lb.bend * bendAngle);
  lb.lower.quaternion.slerp(qLocal, weight);
  lb.upper.updateMatrixWorld(true);
  return Math.max(0, want - d);
}

/**
 * Where the middle joint (elbow, knee) of `limb` goes reaching `target` with its `pole` (world,
 * into `out`); the reach's start (shoulder, hip) is left in `s`, its direction in `dir`. Returns
 * how far the target is from the start (m).
 */
export function middle(
  lb: Limb,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  out: THREE.Vector3,
): number {
  lb.upper.getWorldPosition(s);
  dir.subVectors(target, s);
  const want = dir.length();
  const d = Math.min(lb.l1 + lb.l2 - 1e-4, Math.max(Math.abs(lb.l1 - lb.l2) + 1e-4, want));
  dir.multiplyScalar(1 / Math.max(want, 1e-6));
  // The middle joint's side: the pole's, square to the reach.
  n.subVectors(pole, s);
  n.addScaledVector(dir, -n.dot(dir));
  if (n.lengthSq() < 1e-10) n.set(0, 0, lb.bend > 0 ? 1 : -1).addScaledVector(dir, -dir.z);
  n.normalize();
  const a = (lb.l1 * lb.l1 - lb.l2 * lb.l2 + d * d) / (2 * d);
  const hgt = Math.sqrt(Math.max(0, lb.l1 * lb.l1 - a * a));
  out.copy(s).addScaledVector(dir, a).addScaledVector(n, hgt);
  return want;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const fx = new THREE.Vector3();
const fy = new THREE.Vector3();
const fz = new THREE.Vector3();

/**
 * Gives a bone a world turn from two directions (world): where its −y points (a hand's fingers,
 * a foot's sole line) and where its +x points (the right hand's back, the left hand's palm…),
 * by `weight`. Its parent's world matrix must be up to date.
 */
export function orient(
  bone: THREE.Bone,
  along: THREE.Vector3,
  xAxis: THREE.Vector3,
  weight = 1,
): void {
  if (weight <= 0 || !bone.parent) return;
  fy.copy(along).normalize().multiplyScalar(-1);
  fx.copy(xAxis).addScaledVector(fy, -xAxis.dot(fy)).normalize();
  fz.crossVectors(fx, fy);
  basis.makeBasis(fx, fy, fz);
  qWorld.setFromRotationMatrix(basis);
  bone.parent.getWorldQuaternion(qParent);
  qLocal.copy(qParent).invert().multiply(qWorld);
  bone.quaternion.slerp(qLocal, weight);
  bone.updateMatrixWorld(true);
}
