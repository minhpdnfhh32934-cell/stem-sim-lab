import * as THREE from 'three';
import type { Actor } from '../render/body/actor';
import type { BoneName } from '../render/body/BodyModel';

/*
 * The bodies as solids (Phase W, Phú: nothing through anything, "vật lý thật"). Each person is a
 * few capsules, refreshed from the bones each frame: the trunk (below and above the waist, each two
 * side by side, the trunk being wider than deep), the head, and each arm's and leg's two bones.
 * The rig keeps a reaching limb out of them — its wrist put on their surface, its elbow or knee
 * swung round its reach to where it passes clear (`rig.ts`) — and the bust gives way where they
 * press on it (`press.ts`). Nothing allocated per frame.
 */

export type Part =
  | 'belly'
  | 'chest'
  | 'head'
  | 'upperArmL'
  | 'foreArmL'
  | 'upperArmR'
  | 'foreArmR'
  | 'thighL'
  | 'shinL'
  | 'thighR'
  | 'shinR';

export interface Capsule {
  readonly part: Part;
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  readonly r: number;
}

/** A person's thicknesses (m): each capsule's radius; the trunk's two sit `apart` either side. */
export interface Build {
  readonly trunk: number;
  readonly apart: number;
  readonly head: number;
  readonly upperArm: number;
  readonly foreArm: number;
  readonly thigh: number;
  readonly shin: number;
}

const LIMB_PARTS: readonly [Part, BoneName, BoneName, keyof Build][] = [
  ['upperArmL', 'upperArmL', 'foreArmL', 'upperArm'],
  ['foreArmL', 'foreArmL', 'handL', 'foreArm'],
  ['upperArmR', 'upperArmR', 'foreArmR', 'upperArm'],
  ['foreArmR', 'foreArmR', 'handR', 'foreArm'],
  ['thighL', 'thighL', 'shinL', 'thigh'],
  ['shinL', 'shinL', 'footL', 'shin'],
  ['thighR', 'thighR', 'shinR', 'thigh'],
  ['shinR', 'shinR', 'footR', 'shin'],
];

const v = new THREE.Vector3();
const side = new THREE.Vector3();
const top = new THREE.Vector3();
const q = new THREE.Quaternion();
const c = new THREE.Vector3();

export class Solids {
  readonly capsules: Capsule[] = [];

  constructor(readonly build: Build) {
    const make = (part: Part, r: number): Capsule => {
      const capsule = { part, a: new THREE.Vector3(), b: new THREE.Vector3(), r };
      this.capsules.push(capsule);
      return capsule;
    };
    for (let i = 0; i < 2; i++) make('belly', build.trunk);
    for (let i = 0; i < 2; i++) make('chest', build.trunk);
    make('head', build.head);
    for (const [part, , , size] of LIMB_PARTS) make(part, build[size]);
  }

  /** Placed on `actor`'s bones as they are now (their world matrices up to date). */
  update(actor: Actor): void {
    const bones = actor.model.bones;
    const [b0, b1, c0, c1, head, ...limbs] = this.capsules;
    if (!b0 || !b1 || !c0 || !c1 || !head) return;
    bones.chest.getWorldQuaternion(q);
    side.set(this.build.apart, 0, 0).applyQuaternion(q);
    // The trunk's top: up from the chest bone most of the way to the neck (the shoulders).
    bones.chest.getWorldPosition(c);
    bones.neck.getWorldPosition(top).sub(c).multiplyScalar(0.6).add(c);
    bones.hips.getWorldPosition(v);
    b0.a.copy(v).add(side);
    b1.a.copy(v).sub(side);
    bones.spine.getWorldPosition(v);
    b0.b.copy(v).add(side);
    b1.b.copy(v).sub(side);
    c0.a.copy(b0.b);
    c1.a.copy(b1.b);
    c0.b.copy(top).add(side);
    c1.b.copy(top).sub(side);
    // The head: a ball a tenth of a metre up from its bone (the skull's base).
    bones.head.getWorldPosition(head.a);
    bones.head.getWorldQuaternion(q);
    head.a.add(v.set(0, 0.1, 0).applyQuaternion(q));
    head.b.copy(head.a);
    for (let i = 0; i < LIMB_PARTS.length; i++) {
      const spec = LIMB_PARTS[i];
      const capsule = limbs[i];
      if (!spec || !capsule) continue;
      bones[spec[1]].getWorldPosition(capsule.a);
      bones[spec[2]].getWorldPosition(capsule.b);
    }
  }
}

/** The closest point to `p` on the segment `a`–`b` (into `out`); returns the distance. */
export function closest(
  p: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  out: THREE.Vector3,
): number {
  out.subVectors(b, a);
  const l2 = out.lengthSq();
  const t = l2 < 1e-12 ? 0 : Math.min(1, Math.max(0, v.subVectors(p, a).dot(out) / l2));
  out.multiplyScalar(t).add(a);
  return out.distanceTo(p);
}

const near = new THREE.Vector3();

/**
 * How deep a ball (`p`, radius `r`) sits in the capsules of `lists` (past `soft`), but for parts
 * `skip` leaves out; the way out of the deepest into `away` (unit), if given.
 */
export function depthIn(
  p: THREE.Vector3,
  r: number,
  lists: readonly (readonly Capsule[])[],
  skip: (list: number, part: Part) => boolean,
  soft: number,
  away?: THREE.Vector3,
): number {
  let deepest = 0;
  for (let l = 0; l < lists.length; l++) {
    const list = lists[l];
    if (!list) continue;
    for (const capsule of list) {
      if (skip(l, capsule.part)) continue;
      const d = closest(p, capsule.a, capsule.b, near);
      const depth = capsule.r + r - soft - d;
      if (depth > deepest) {
        deepest = depth;
        if (away) {
          away.subVectors(p, near);
          if (away.lengthSq() < 1e-12) away.set(0, 1, 0);
          away.normalize();
        }
      }
    }
  }
  return deepest;
}

const sample = new THREE.Vector3();

/**
 * How deep five balls along `p`–`q` (from `from` of the way along) sit in the capsules, all told
 * (summed: a part that cannot help touching — a shoulder against the one it leans on — does not
 * hide the rest of the limb going through).
 */
export function segmentDepth(
  p: THREE.Vector3,
  q2: THREE.Vector3,
  r: number,
  lists: readonly (readonly Capsule[])[],
  skip: (list: number, part: Part) => boolean,
  soft: number,
  from = 0,
): number {
  let deepest = 0;
  for (let k = 0; k <= 4; k++) {
    sample.lerpVectors(p, q2, from + ((1 - from) * k) / 4);
    deepest += depthIn(sample, r, lists, skip, soft);
  }
  return deepest;
}
