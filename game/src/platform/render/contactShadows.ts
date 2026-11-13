import * as THREE from 'three';

/** How dark a contact shadow is at its centre (a look value for the user's eyes). */
const DARKNESS = 0.45;
/** Its texture: a soft disc, drawn once (a few kilobytes). */
const SIZE = 64;
/** Above the surface it lies on (m), with a polygon offset: never in the bench top. */
const LIFT = 0.001;
/** A height change between two places (m) that hides it: far above a resting body's jitter. */
const SETTLE = 0.0005;

/**
 * Soft contact shadows under vessels (render-quality audit F14): glass and liquids never cast a
 * shadow (a standard material would cast a solid black one), so without these a flask looks
 * pasted on the bench. One blurred disc per vessel, all in one instanced mesh: one draw for them
 * all, shown from Medium up (quality.ts `contactShadows`). Placed by the renderer from each
 * vessel's drawn pose; nothing here moves anything or reads game state. Writing a place assigns
 * into the instance buffer: nothing is allocated per frame.
 */
export class ContactShadows {
  readonly mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly slots = new Map<string, number>();
  private readonly ids: string[] = [];
  private enabled = false;

  constructor(readonly capacity = 64) {
    const geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2); // a unit disc's square
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: disc(),
      transparent: true,
      opacity: DARKNESS,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = 'contact-shadows';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false; // its instances move; one draw either way
    this.mesh.renderOrder = 0.5; // before the glass (1–2) that stands on it
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.visible = false;
  }

  /** Shown (from Medium up) or not: no draw at all when off or empty. */
  set visible(on: boolean) {
    this.enabled = on;
    this.mesh.visible = on && this.mesh.count > 0;
  }

  /**
   * `id`'s shadow centred at (x, y, z), `radius` m across its half; radius 0 hides it. Hidden too
   * while its height moves (more than SETTLE since the last place: the vessel falls or is lifted,
   * and a disc would hang in the air), shown again once it is still. Uploads only a change.
   */
  place(id: string, x: number, y: number, z: number, radius: number): void {
    let slot = this.slots.get(id);
    const fresh = slot === undefined;
    if (slot === undefined) {
      if (this.ids.length >= this.capacity) return; // shortcut: more vessels than slots go ungrounded
      slot = this.ids.length;
      this.ids.push(id);
      this.slots.set(id, slot);
      this.mesh.count = this.ids.length;
      this.visible = this.enabled;
    }
    const e = this.mesh.instanceMatrix.array;
    const i = slot * 16;
    // As stored (32-bit), so an unchanged place compares equal.
    const h = Math.fround(y + LIFT);
    const r = Math.fround(!fresh && Math.abs((e[i + 13] ?? h) - h) > SETTLE ? 0 : radius);
    const fx = Math.fround(x);
    const fz = Math.fround(z);
    if (!fresh && e[i] === r && e[i + 12] === fx && e[i + 13] === h && e[i + 14] === fz) return;
    e[i] = r;
    e[i + 5] = r > 0 ? 1 : 0;
    e[i + 10] = r;
    e[i + 12] = fx;
    e[i + 13] = h;
    e[i + 14] = fz;
    e[i + 15] = 1;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** `id`'s shadow gone: the last one takes its slot. */
  remove(id: string): void {
    const slot = this.slots.get(id);
    if (slot === undefined) return;
    const last = this.ids.length - 1;
    const moved = this.ids[last];
    if (moved !== undefined && slot !== last) {
      const e = this.mesh.instanceMatrix.array;
      e.copyWithin(slot * 16, last * 16, last * 16 + 16);
      this.ids[slot] = moved;
      this.slots.set(moved, slot);
    }
    this.ids.pop();
    this.slots.delete(id);
    this.mesh.count = this.ids.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.visible = this.enabled;
  }

  /** Those placed, by id (tests). */
  get placed(): readonly string[] {
    return this.ids;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.map?.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
    this.mesh.removeFromParent();
  }
}

/** A soft disc in the texture's alpha: opaque at the centre, gone at the rim. */
function disc(): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x + 0.5) / (SIZE / 2) - 1;
      const dy = (y + 0.5) / (SIZE / 2) - 1;
      const fall = Math.max(0, 1 - (dx * dx + dy * dy));
      data[(y * SIZE + x) * 4 + 3] = Math.round(255 * fall * fall);
    }
  }
  const texture = new THREE.DataTexture(data, SIZE, SIZE);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
