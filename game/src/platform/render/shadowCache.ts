import * as THREE from 'three';

export type ShadowLight = THREE.SpotLight | THREE.DirectionalLight;

/**
 * Bones mark joints, not the skin around them: a hand, the hair, a skirt reach this far past them.
 */
const SKIN_MARGIN_M = 0.5;

/** A caster as its shadow last saw it. */
interface Caster {
  seen: number;
  /** matrixWorld, then the numbers that change what it draws (versions, ranges, influences). */
  state: Float64Array;
  geometry: unknown;
  material: unknown;
  /** Where it was drawn (world): the lights that saw it there must draw again when it changes. */
  readonly sphere: THREE.Sphere;
}

interface Bones {
  seen: number;
  changed: boolean;
  readonly matrices: Float64Array;
  readonly sphere: THREE.Sphere;
}

const LIGHT_STATE = 20;
/**
 * A change smaller than this (m, or a rotation's sine) is not drawn: 0.1 mm, against 1.5 mm a
 * texel for Ultra's 4096² map over a 6 m room. The player standing still moves by less every
 * frame (a settling hand, the capsule's own float noise); kept to the value last drawn, a slow
 * drift still draws once it adds up.
 */
const STILL = 1e-4;
const point = new THREE.Vector3();
const box = new THREE.Box3();

/**
 * Shadow maps drawn again only when what they show changes (Phú 2026-11-08: "reduce the load
 * without lowering quality"), as engines cache the shadows of what stands still (Unity's on-demand
 * shadows, Unreal's cached shadow pages). A lab stands still most of the time: before, each lit
 * key light drew its map every frame — the whole room again, up to four times a frame.
 *
 * Once a frame, before the frame's shadows (`update`, from the scene's onBeforeRender, after three
 * has updated the world matrices), every shadow caster three would draw (visible, castShadow, on a
 * shadow camera's layer) is compared with the last frame: its world matrix, geometry and material,
 * the geometry's versions and draw range, an instanced mesh's matrices, morph influences, a skinned
 * mesh's bones. One that changed, appeared or went away marks the lights whose shadow frustum held
 * it, where it was and where it is; a light that moved or changed marks itself. Those maps are
 * drawn by the frame (three's `shadow.needsUpdate`); the others keep the last frame's, which show
 * the same thing. A dark light (intensity 0) is not marked by casters: it adds no light.
 *
 * What it cannot see: a vertex shader that moves geometry by time alone (none in SimLab: no custom
 * depth material).
 */
export class ShadowCache {
  private readonly casters = new Map<THREE.Object3D, Caster>();
  private readonly skeletons = new Map<THREE.Skeleton, Bones>();
  private readonly lightStates: Float64Array[];
  private frame = 0;
  private mask = 0;
  private cursor = 0;
  private changed = false;
  private state: Float64Array = new Float64Array(0);
  /** Shadow maps drawn since the start (the debug panel; an e2e test reads it standing still). */
  mapsDrawn = 0;
  /**
   * The shortest time (s) between two draws of one map (Medium: 1/30): a map asked for sooner is
   * drawn as soon as that time is up, with what it then shows — never left out. 0: every frame.
   */
  minInterval = 0;
  private readonly drawnAt: Float64Array;
  private readonly pending: Uint8Array;
  /** Asked for this frame (`mark`), not yet paced. */
  private readonly asked: Uint8Array;
  /** Invalidated: the next frame draws every map asked for, whatever `minInterval`. */
  private forced = false;
  /** Lights that changed themselves this frame: drawn at once. */
  private readonly urgent: Uint8Array;
  /** What made the last map draw (the debug panel names it). */
  lastCause: THREE.Object3D | null = null;

  constructor(private readonly lights: readonly ShadowLight[]) {
    this.lightStates = lights.map(() => new Float64Array(LIGHT_STATE).fill(NaN));
    this.drawnAt = new Float64Array(lights.length).fill(-Infinity);
    this.pending = new Uint8Array(lights.length);
    this.asked = new Uint8Array(lights.length);
    this.urgent = new Uint8Array(lights.length);
    for (const light of lights) {
      light.shadow.autoUpdate = false;
      this.mark(light); // every map once, dark ones too: the shaders sample them all
    }
  }

  /** Every lit map drawn again (a warm-up draw wrote its own batch into them). */
  invalidate(): void {
    for (const light of this.lights) if (lit(light)) this.mark(light);
    this.forced = true; // a map written over is never kept, not even for a frame
  }

  /** Once a frame, after three's matrix update and before its shadow pass; `now` in seconds. */
  update(scene: THREE.Object3D, now = 0): void {
    this.frame++;
    this.mask = 0;
    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      if (!light) continue;
      this.mask |= light.shadow.camera.layers.mask;
      if (this.lightChanged(light, i) && light.castShadow) {
        this.mark(light, light);
        // The light itself moved or changed (a slot given another room's light): its old map is
        // wrong now, drawn at once whatever minInterval (a moving caster can wait, it cannot).
        this.urgent[i] = 1;
      }
    }
    this.walk(scene);
    this.casters.forEach(this.sweepCaster);
    this.skeletons.forEach(this.sweepBones);
    this.pace(now);
  }

  /** Each map asked for drawn now, or kept for when `minInterval` since its last draw is up. */
  private pace(now: number): void {
    for (let i = 0; i < this.lights.length; i++) {
      const shadow = this.lights[i]?.shadow;
      if (!shadow) continue;
      // Only a map asked for this frame, or one kept back: one asked for earlier that three has not
      // drawn yet (its light not in this render) stays asked, as it was, and is not counted again.
      const asked = this.asked[i] === 1;
      this.asked[i] = 0;
      if (!asked && this.pending[i] !== 1) continue;
      // (A tenth of slack: frames at exactly the interval are not pushed to the next one.)
      const due =
        this.forced ||
        this.urgent[i] === 1 ||
        now - (this.drawnAt[i] ?? -Infinity) >= this.minInterval * 0.9;
      this.urgent[i] = 0;
      if (!due) {
        shadow.needsUpdate = false;
        this.pending[i] = 1;
        continue;
      }
      shadow.needsUpdate = true;
      this.drawnAt[i] = now;
      this.pending[i] = 0;
      this.mapsDrawn++;
    }
    this.forced = false;
  }

  // (Bound once: no closure or iterator a frame.)
  private readonly sweepCaster = (caster: Caster, object: THREE.Object3D): void => {
    if (caster.seen === this.frame) return;
    this.touch(caster.sphere, object); // gone: hidden, removed, off the shadow layers or castShadow off
    this.casters.delete(object);
  };

  private readonly sweepBones = (bones: Bones, skeleton: THREE.Skeleton): void => {
    if (bones.seen !== this.frame) this.skeletons.delete(skeleton);
  };

  private walk(object: THREE.Object3D): void {
    if (!object.visible) return; // as three's shadow pass: an invisible object hides its children
    if (object.castShadow && (object.layers.mask & this.mask) !== 0 && drawable(object))
      this.check(object as THREE.Mesh);
    const children = object.children;
    for (let i = 0; i < children.length; i++) this.walk(children[i] as THREE.Object3D);
  }

  private check(mesh: THREE.Mesh): void {
    const skinned = (mesh as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true;
    const bones = skinned ? this.bonesOf((mesh as unknown as THREE.SkinnedMesh).skeleton) : null;
    const influences = mesh.morphTargetInfluences;
    const size = 16 + 7 + (influences?.length ?? 0);
    let caster = this.casters.get(mesh);
    const fresh = caster === undefined || caster.state.length !== size;
    if (!caster || fresh) {
      caster = {
        seen: 0,
        state: new Float64Array(size).fill(NaN),
        geometry: null,
        material: null,
        sphere: caster?.sphere ?? new THREE.Sphere(new THREE.Vector3(), -1),
      };
      this.casters.set(mesh, caster);
    }
    caster.seen = this.frame;
    this.state = caster.state;
    this.cursor = 0;
    this.changed = false;
    const m = mesh.matrixWorld.elements;
    for (let i = 0; i < 16; i++) this.put(m[i] ?? 0);
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const positionVersion = position?.version ?? 0;
    const reshaped = this.state[16] !== positionVersion;
    this.put(positionVersion);
    this.put(geometry.index?.version ?? 0);
    this.put(geometry.drawRange.start);
    this.put(geometry.drawRange.count);
    const instanced = (mesh as Partial<THREE.InstancedMesh>).isInstancedMesh === true;
    this.put(instanced ? (mesh as unknown as THREE.InstancedMesh).instanceMatrix.version : 0);
    this.put(instanced ? (mesh as unknown as THREE.InstancedMesh).count : 0);
    const material = mesh.material;
    this.put(Array.isArray(material) ? 1 : material.visible ? 1 : 0);
    if (influences) for (let i = 0; i < influences.length; i++) this.put(influences[i] ?? 0);
    if (caster.geometry !== geometry || caster.material !== material) {
      caster.geometry = geometry;
      caster.material = material;
      this.changed = true;
    }
    if (!this.changed && !bones?.changed) return;
    this.touch(caster.sphere, mesh); // where it was
    const sphere = caster.sphere;
    if (bones) sphere.copy(bones.sphere);
    else if (instanced) {
      // shortcut: an instanced mesh that changes marks every light (its instances' bounds would
      // cost a pass over them); none changes while a lab is used — the city has its own sun.
      sphere.set(point.set(0, 0, 0), Infinity);
    } else {
      // Its own bounds when it has them: a room waking shows hundreds at once (one wake frame).
      if (geometry.boundingSphere === null || (reshaped && !fresh))
        geometry.computeBoundingSphere();
      sphere.copy(geometry.boundingSphere ?? sphere.set(point.set(0, 0, 0), Infinity));
      if (Number.isFinite(sphere.radius)) sphere.applyMatrix4(mesh.matrixWorld);
    }
    this.touch(sphere, mesh); // where it is
  }

  /** A skeleton's bones, compared once a frame however many meshes it moves. */
  private bonesOf(skeleton: THREE.Skeleton): Bones {
    let bones = this.skeletons.get(skeleton);
    const size = skeleton.bones.length * 16;
    if (!bones || bones.matrices.length !== size) {
      bones = {
        seen: 0,
        changed: true,
        matrices: new Float64Array(size).fill(NaN),
        sphere: new THREE.Sphere(),
      };
      this.skeletons.set(skeleton, bones);
    }
    if (bones.seen === this.frame) return bones;
    bones.seen = this.frame;
    this.state = bones.matrices;
    this.cursor = 0;
    this.changed = false;
    box.makeEmpty();
    for (let b = 0; b < skeleton.bones.length; b++) {
      const bone = skeleton.bones[b] as THREE.Bone;
      const e = bone.matrixWorld.elements;
      for (let i = 0; i < 16; i++) this.put(e[i] ?? 0);
      box.expandByPoint(point.setFromMatrixPosition(bone.matrixWorld));
    }
    bones.changed = this.anyChange();
    if (bones.changed) {
      box.getBoundingSphere(bones.sphere);
      bones.sphere.radius += SKIN_MARGIN_M;
    }
    return bones;
  }

  /** Whether a light moved or changed what its shadow camera sees. */
  private lightChanged(light: ShadowLight, index: number): boolean {
    const state = this.lightStates[index];
    if (!state) return false;
    this.state = state;
    this.cursor = 0;
    this.changed = false;
    const m = light.matrixWorld.elements;
    const t = light.target.matrixWorld.elements;
    for (let i = 12; i < 15; i++) this.put(m[i] ?? 0);
    for (let i = 12; i < 15; i++) this.put(t[i] ?? 0);
    this.put(light.castShadow ? 1 : 0);
    this.put(lit(light) ? 1 : 0);
    this.put(light.shadow.mapSize.x);
    this.put(light.shadow.mapSize.y);
    this.put(light.shadow.camera.layers.mask);
    this.put(light.shadow.camera.near);
    if (light instanceof THREE.SpotLight) {
      this.put(light.angle);
      this.put(light.distance);
      this.put(light.shadow.focus);
    } else {
      // A spot's camera follows the light in its shadow pass; a directional one is set by hand.
      const c = light.shadow.camera;
      this.put(c.left);
      this.put(c.right);
      this.put(c.top);
      this.put(c.bottom);
      this.put(c.far);
    }
    return this.changed;
  }

  /** The lit lights whose shadow frustum holds `sphere` draw again. */
  private touch(sphere: THREE.Sphere, cause: THREE.Object3D): void {
    if (sphere.radius < 0) return; // never drawn
    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      if (!light || !lit(light) || light.shadow.needsUpdate) continue;
      if (light.shadow.getFrustum().intersectsSphere(sphere)) this.mark(light, cause);
    }
  }

  private mark(light: ShadowLight, cause: THREE.Object3D | null = null): void {
    if (light.shadow.needsUpdate) return;
    light.shadow.needsUpdate = true;
    this.lastCause = cause;
    const i = this.lights.indexOf(light);
    if (i >= 0) this.asked[i] = 1;
  }

  /** Whether a put() since the last reset changed a value (a call: the flag is not narrowed). */
  private anyChange(): boolean {
    return this.changed;
  }

  private put(value: number): void {
    const was = this.state[this.cursor] ?? NaN;
    // (NaN: never seen; Infinity: a whole draw range; an integer — a version — differs by 1.)
    if (was !== value && !(Math.abs(was - value) <= STILL)) {
      this.state[this.cursor] = value;
      this.changed = true;
    }
    this.cursor++;
  }
}

function lit(light: ShadowLight): boolean {
  return light.castShadow && light.visible && light.intensity > 0;
}

function drawable(object: THREE.Object3D): boolean {
  const o = object as Partial<THREE.Mesh & THREE.Line & THREE.Points>;
  return o.isMesh === true || o.isLine === true || o.isPoints === true;
}
