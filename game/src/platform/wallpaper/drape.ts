import * as THREE from 'three';
import type { Actor } from '../render/body/actor';
import { type Capsule, closest, type Part } from './contact';

/*
 * Long hair that hangs (Phase W, after Phú's reference: Linh's hair long and waved). Fixed to the
 * head, long hair swung with every tilt of it — across her back as she laid her head on his
 * shoulder, into him. So below the scalp the hair is turned back by the head's tilt, more the
 * lower it falls (the scalp keeps to the head; the ends hang straight down), then pushed out of
 * the bodies round it — her shoulders and back, and his — to lie on them. The vertex shader does it
 * (look.ts, `DRAPE`), the same in the hair and its ink, from up to `DRAPE_N` capsules near the head
 * each frame (`contact.ts`), in the body's own frame.
 */

export const DRAPE_N = 6;

export interface DrapeUniforms {
  readonly uDrapeA: { value: THREE.Vector4[] };
  readonly uDrapeB: { value: THREE.Vector4[] };
  /** The head's tilt undone (the body's frame): what turns hair from hanging off the head to down. */
  readonly uDrapeTurn: { value: THREE.Matrix3 };
  /** The head's middle now (the body's frame): what the hair turns about. */
  readonly uDrapeHead: { value: THREE.Vector3 };
}

/** What the hair lies on: her own trunk (not her arms: pushed off them, it spread out flat), and his. */
const UNDER = (list: number, part: Part): boolean => list === 1 || part === 'chest';

const v = new THREE.Vector3();
const near = new THREE.Vector3();
const down = new THREE.Vector3();
const hangs = new THREE.Vector3();
const fall = new THREE.Vector3();
const q = new THREE.Quaternion();
const m4 = new THREE.Matrix4();
const inverse = new THREE.Matrix4();

export class HairDrape {
  readonly uniforms: DrapeUniforms = {
    uDrapeA: { value: Array.from({ length: DRAPE_N }, () => new THREE.Vector4()) },
    uDrapeB: { value: Array.from({ length: DRAPE_N }, () => new THREE.Vector4()) },
    uDrapeTurn: { value: new THREE.Matrix3() },
    uDrapeHead: { value: new THREE.Vector3() },
  };
  /** The head's middle in the head bone's frame. */
  private readonly middle: THREE.Vector3;
  private readonly found: { capsule: Capsule | null; d: number }[] = [];

  /** `actor` unmoved (its bind pose). */
  constructor(actor: Actor) {
    const bone = actor.model.bones.head;
    bone.updateWorldMatrix(true, false);
    inverse.copy(bone.matrixWorld).invert();
    // The head's middle: a tenth of a metre up from its bone (as look.ts's uHead).
    const up = 0.1 * (actor.character.appearance.heightM / 1.75);
    this.middle = bone
      .getWorldPosition(new THREE.Vector3())
      .add(new THREE.Vector3(0, up, 0))
      .applyMatrix4(inverse);
    for (let i = 0; i < DRAPE_N; i++) this.found.push({ capsule: null, d: Infinity });
  }

  /** This frame's drape on the body showing; `lists`: 0 her own solids, 1 the other's. */
  update(body: Actor, lists: readonly (readonly Capsule[])[]): void {
    const mesh = body.model.meshes[0];
    if (!mesh) return;
    const bone = body.model.bones.head;
    inverse.copy(mesh.matrixWorld).invert();
    // The head's middle, in the world and in the body's frame.
    v.copy(this.middle).applyMatrix4(bone.matrixWorld);
    this.uniforms.uDrapeHead.value.copy(v).applyMatrix4(inverse);
    // (The hair hangs to ~0.35 m below the head's middle: what is near it measured from 0.2 down.)
    fall.copy(v).setY(v.y - 0.2);
    // Where hair falls off the head now (its −y), and straight down, both in the body's frame.
    bone.getWorldQuaternion(q);
    down.set(0, -1, 0).applyQuaternion(q).transformDirection(inverse);
    hangs.set(0, -1, 0).transformDirection(inverse);
    q.setFromUnitVectors(down, hangs);
    this.uniforms.uDrapeTurn.value.setFromMatrix4(m4.makeRotationFromQuaternion(q));
    // The capsules near the head (a hand's breadth round its falling hair).
    for (const f of this.found) {
      f.capsule = null;
      f.d = Infinity;
    }
    for (let l = 0; l < lists.length; l++) {
      for (const capsule of lists[l] ?? []) {
        if (!UNDER(l, capsule.part)) continue;
        const d = closest(fall, capsule.a, capsule.b, near) - capsule.r;
        if (d > 0.3) continue;
        let worst = this.found[0];
        for (const f of this.found) if (worst && f.d > worst.d) worst = f;
        if (worst && d < worst.d) {
          worst.capsule = capsule;
          worst.d = d;
        }
      }
    }
    for (let i = 0; i < DRAPE_N; i++) {
      const f = this.found[i];
      const a = this.uniforms.uDrapeA.value[i];
      const b = this.uniforms.uDrapeB.value[i];
      if (!f || !a || !b) continue;
      if (!f.capsule) {
        a.set(0, 0, 0, 0);
        continue;
      }
      v.copy(f.capsule.a).applyMatrix4(inverse);
      a.set(v.x, v.y, v.z, f.capsule.r);
      v.copy(f.capsule.b).applyMatrix4(inverse);
      b.set(v.x, v.y, v.z, 0);
    }
  }
}
