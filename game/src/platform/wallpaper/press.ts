import * as THREE from 'three';
import type { Actor } from '../render/body/actor';
import { type Capsule, closest, type Part } from './contact';

/*
 * A bust that gives way (Phase W, Phú: "ôm vào áp ngực vào thì ngực phải bị hóp vào"). Where an
 * arm, a knee or the other's body presses on it, its surface is pushed back out of them — every
 * layer the same way and in order (skin, top, jacket, outline), the push easing in over a couple of
 * centimetres (no crease where it starts) and never deeper than the bust rises (past that are the
 * ribs: a pose that goes deeper is a fault, `cast.test.ts`). The vertex shader does it (look.ts,
 * `PRESS`), on the bust only (found by the bind position), from up to `PRESS_N` capsules near it
 * each frame (`contact.ts`), given in the body's own frame.
 */

export const PRESS_N = 6;
/** How far out from a capsule the push eases in (m). */
export const PRESS_SOFT = 0.025;
/** Each half of the bust as a ball this big, behind its fullest point (m). */
const LOBE = 0.07;

export interface PressUniforms {
  readonly uPressA: { value: THREE.Vector4[] };
  readonly uPressB: { value: THREE.Vector4[] };
  /** Each half in the bind pose: its ball's middle (xyz) and how far round it the bust reaches (w). */
  readonly uBust: { value: THREE.Vector4[] };
  /** How far the bust can be pressed in (m): as far as it rises. */
  readonly uBustDepth: { value: number };
}

/** What presses on her bust: her own forearms and legs, and all of the other. */
const PRESSES = (list: number, part: Part): boolean =>
  list === 1 ||
  part === 'foreArmL' ||
  part === 'foreArmR' ||
  part === 'thighL' ||
  part === 'thighR' ||
  part === 'shinL' ||
  part === 'shinR';

const v = new THREE.Vector3();
const near = new THREE.Vector3();
const inverse = new THREE.Matrix4();

export class BustPress {
  readonly uniforms: PressUniforms;
  /** The halves' middles in the chest bone's frame, and now (world). */
  private readonly local: THREE.Vector3[] = [];
  readonly lobes: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3()];
  readonly depth: number;
  private readonly found: { capsule: Capsule; d: number }[] = [];

  /** `actor` unmoved (its bind pose); null if it has no bust. */
  static of(actor: Actor): BustPress | null {
    const bust = actor.character.appearance.bustM;
    return bust > 0 ? new BustPress(actor, bust) : null;
  }

  private constructor(actor: Actor, bust: number) {
    const model = actor.model;
    // The fullest point of each half: the frontmost (−z) of the body's surfaces at bust height,
    // either side of the middle.
    const h = actor.character.appearance.heightM;
    const apex = 0.716 * h;
    const tips = [new THREE.Vector3(0, 0, Infinity), new THREE.Vector3(0, 0, Infinity)];
    for (const mesh of model.meshes) {
      const surface = mesh.userData.surface as string;
      if (surface === 'hair' || surface === 'photo' || surface === 'accent') continue;
      const p = mesh.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        if (Math.abs(v.y - apex) > 0.06 || Math.abs(v.x) < 0.02 || Math.abs(v.x) > 0.16) continue;
        const tip = tips[v.x < 0 ? 0 : 1];
        if (tip && v.z < tip.z) tip.copy(v);
      }
    }
    const chest = model.bones.chest;
    chest.updateWorldMatrix(true, false);
    inverse.copy(chest.matrixWorld).invert();
    const group = actor.group.position;
    const bind: THREE.Vector4[] = [];
    for (const tip of tips) {
      // The ball behind the tip (+z is the back); in the body's frame, then the chest bone's.
      const middle = tip.clone().add(new THREE.Vector3(0, 0, LOBE));
      bind.push(new THREE.Vector4(middle.x, middle.y, middle.z, LOBE + 0.045));
      this.local.push(middle.clone().add(group).applyMatrix4(inverse));
    }
    this.depth = bust + 0.012;
    this.uniforms = {
      uPressA: { value: Array.from({ length: PRESS_N }, () => new THREE.Vector4()) },
      uPressB: { value: Array.from({ length: PRESS_N }, () => new THREE.Vector4()) },
      uBust: { value: bind },
      uBustDepth: { value: this.depth },
    };
    for (let i = 0; i < PRESS_N; i++) this.found.push({ capsule: EMPTY, d: Infinity });
  }

  /** Where the halves are now (world), from the chest bone of the body showing. */
  place(body: Actor): void {
    const chest = body.model.bones.chest;
    for (let i = 0; i < 2; i++) {
      const local = this.local[i];
      const lobe = this.lobes[i];
      if (local && lobe) lobe.copy(local).applyMatrix4(chest.matrixWorld);
    }
  }

  /**
   * How far the deepest capsule pressing on her bust reaches into it (m; below 0, how far the
   * nearest is from touching it): up to `depth` it gives way, past that a body is in her chest.
   * `lists`: 0 her own, 1 the other's.
   */
  deepest(lists: readonly (readonly Capsule[])[]): number {
    let deepest = -Infinity;
    for (let l = 0; l < lists.length; l++) {
      for (const capsule of lists[l] ?? []) {
        if (!PRESSES(l, capsule.part)) continue;
        for (const lobe of this.lobes) {
          deepest = Math.max(deepest, LOBE + capsule.r - closest(lobe, capsule.a, capsule.b, near));
        }
      }
    }
    return deepest;
  }

  /** This frame's press: the capsules nearest the bust (within reach of it), in the body's frame. */
  update(body: Actor, lists: readonly (readonly Capsule[])[]): void {
    this.place(body);
    for (const f of this.found) {
      f.capsule = EMPTY;
      f.d = Infinity;
    }
    for (let l = 0; l < lists.length; l++) {
      for (const capsule of lists[l] ?? []) {
        if (!PRESSES(l, capsule.part)) continue;
        let d = Infinity;
        for (const lobe of this.lobes) {
          d = Math.min(d, closest(lobe, capsule.a, capsule.b, near) - capsule.r - LOBE);
        }
        // Only what reaches the bust's surface and the soft band round it.
        if (d > PRESS_SOFT + 0.01) continue;
        // Kept among the nearest few (the farthest kept is replaced).
        let worst = this.found[0];
        for (const f of this.found) if (worst && f.d > worst.d) worst = f;
        if (worst && d < worst.d) {
          worst.capsule = capsule;
          worst.d = d;
        }
      }
    }
    // Into the frame the body's vertices are skinned in (a body mesh's own).
    const mesh = body.model.meshes[0];
    if (!mesh) return;
    inverse.copy(mesh.matrixWorld).invert();
    for (let i = 0; i < PRESS_N; i++) {
      const f = this.found[i];
      const a = this.uniforms.uPressA.value[i];
      const b = this.uniforms.uPressB.value[i];
      if (!f || !a || !b) continue;
      if (f.capsule === EMPTY) {
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

const EMPTY: Capsule = { part: 'head', a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0 };
