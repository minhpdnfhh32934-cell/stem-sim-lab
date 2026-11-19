import * as THREE from 'three';
import type { ItemDefinition } from '../../gameplay/item';
import { DECOR } from '../../gameplay/props';
import type { WorldEntity } from '../../world/World';
import type { Palette } from './palette';
import { castsShadow, partMaterial, type PropPart } from './props';

/** A part drawn for each copy in place of the item's own (a control's trim: addPart). */
interface OwnPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  readonly casts: boolean;
}

/** One item's copies in one room of a scene (or one part's: `own`). */
interface Batch {
  readonly item: ItemDefinition;
  readonly own: OwnPart | null;
  /** A part batch's key (addPart), null for a decor item's. */
  readonly key: string | null;
  /** Its room (`roomOf` its meshes): for the room's light and sleep. */
  readonly roomId: string;
  /** In instance order. */
  readonly copies: WorldEntity[];
  /** One per part, each with the copies in that order; none until the scene is built. */
  readonly meshes: THREE.InstancedMesh[];
}

interface SceneDecor {
  built: boolean;
  readonly batches: Map<string, Batch>;
}

// Scratch for the copies' matrices: written on events (build, removal), never per frame.
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const ONE = new THREE.Vector3(1, 1, 1);
const NONE = new THREE.Vector3(0, 0, 0);

/**
 * Decorative items drawn together: per room and per item, one InstancedMesh per part (of its prop,
 * or its primitive as the body) with a matrix per copy — a draw per part, not per copy. Per room so
 * a room's decor can be lit, darkened or left undrawn with it (world/dormancy.ts); built and freed
 * per scene, so a neighbouring scene's decor comes and goes on its own.
 *
 * Owns its meshes and their instance buffers (freed by `clear`, `dispose` and every rebuild); the
 * geometries (`partsOf`'s) and the materials (the palette's) are shared and freed by their owners.
 * Decor never moves, glows, opens or hides, so nothing here runs per frame.
 */
export class DecorBatches {
  private readonly scenes = new Map<string, SceneDecor>();
  /** Each copy's batches: a decor item's one, or a viewed entity's parts (addPart). */
  private readonly batchOf = new Map<string, Batch[]>();
  /** Each mesh's room (not in its userData: a glass part's sheen copies that). */
  private readonly rooms = new Map<THREE.InstancedMesh, string>();
  /** Copies hidden where they stand (a ceiling fitting blown away), kept hidden through rebuilds. */
  private readonly hidden = new Set<string>();
  /** Parts drawn by their entity's view for now (`hidePart`): `entityId|key`. */
  private readonly partsHidden = new Set<string>();

  constructor(
    /** Where the meshes are added (the renderer's scene). */
    private readonly parent: THREE.Object3D,
    private readonly palette: Palette,
    /** An item's parts: its prop's, or its primitive as the body. Shared: never freed here. */
    private readonly partsOf: (item: ItemDefinition) => readonly PropPart[],
    /** Each mesh as it is made (a scene's build, a later copy): the preset's finishes laid on. */
    private readonly adopt: (mesh: THREE.InstancedMesh) => void = () => undefined,
  ) {}

  /**
   * Whether an item is drawn here: tagged decor, nothing to interact with, never moved by
   * physics, and nothing of its own to show — a label, screen, stream, open box, control model
   * or apparatus (those keep their own entity view).
   */
  static accepts(item: ItemDefinition): boolean {
    const { visual } = item;
    return (
      item.tags.includes(DECOR) &&
      item.interactions.length === 0 &&
      item.physical.body !== 'dynamic' &&
      !visual.label &&
      !visual.screen &&
      !visual.stream &&
      !visual.openBox &&
      !item.hinged &&
      !visual.model &&
      !item.launcher &&
      !item.pendulum &&
      !item.dropTower &&
      !item.springStand &&
      !item.bench
    );
  }

  /**
   * Adds a copy to `scene` (the caller's key: its scene id). Drawn at once if that scene is built
   * (its item's batch is rebuilt), else by the scene's build. A copy already here is ignored.
   */
  add(scene: string, entity: WorldEntity): void {
    if (this.batchOf.has(entity.id)) return;
    const decor = this.sceneDecor(scene);
    const key = `${entity.roomId}|${entity.item.id}`;
    let batch = decor.batches.get(key);
    if (!batch) {
      batch = {
        item: entity.item,
        own: null,
        key: null,
        roomId: entity.roomId,
        copies: [],
        meshes: [],
      };
      decor.batches.set(key, batch);
    }
    batch.copies.push(entity);
    this.batchOf.set(entity.id, [batch]);
    if (decor.built) this.draw(batch);
  }

  /**
   * Draws one part of an entity that keeps its own view here, with every other copy of that part
   * in its room (`key` names the part: its geometry and material): a control's trim, the same on
   * every desk, button and display; a body in its shared look (the view draws it itself while it
   * looks otherwise: `hidePart`). The part follows the entity's pose; its owner hides and shows it
   * with the view (`hide`) and takes it out with it (`remove`). Never a moving entity.
   */
  addPart(scene: string, entity: WorldEntity, key: string, part: OwnPart): void {
    const mine = this.batchOf.get(entity.id) ?? [];
    if (mine.some((batch) => batch.key === key)) return;
    const decor = this.sceneDecor(scene);
    const id = `${entity.roomId}|part:${key}`;
    let batch = decor.batches.get(id);
    if (!batch) {
      batch = { item: entity.item, own: part, key, roomId: entity.roomId, copies: [], meshes: [] };
      decor.batches.set(id, batch);
    }
    batch.copies.push(entity);
    this.batchOf.set(entity.id, [...mine, batch]);
    if (decor.built) this.draw(batch);
  }

  /** Takes a copy out at once, the last copy moving into its place; false if it is not here. */
  remove(entityId: string): boolean {
    const batches = this.batchOf.get(entityId);
    if (!batches) return false;
    this.batchOf.delete(entityId);
    for (const { copies, meshes, key } of batches) {
      if (key !== null) this.partsHidden.delete(`${entityId}|${key}`);
      const i = copies.findIndex((copy) => copy.id === entityId);
      const last = copies.length - 1;
      const moved = copies.pop();
      if (moved && i < last) copies[i] = moved;
      for (const mesh of meshes) {
        if (i < last) mesh.setMatrixAt(i, mesh.getMatrixAt(last, matrix));
        mesh.count = last;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    return true;
  }

  /**
   * Hides a copy where it stands (drawn at no size) or shows it again, every part of it; false if
   * it is not here. An event (an emergency's breach and its mending, a view hidden), never per frame.
   */
  hide(entityId: string, hidden: boolean): boolean {
    if (hidden) this.hidden.add(entityId);
    else this.hidden.delete(entityId);
    const batches = this.batchOf.get(entityId);
    if (!batches) return false;
    for (const batch of batches) this.place(batch, entityId);
    return true;
  }

  /**
   * One part of a copy left out of its batch (its view draws it: a body focused, lit or outlined)
   * or drawn in it again. An event, never per frame.
   */
  hidePart(entityId: string, key: string, hidden: boolean): void {
    const id = `${entityId}|${key}`;
    if (hidden === this.partsHidden.has(id)) return;
    if (hidden) this.partsHidden.add(id);
    else this.partsHidden.delete(id);
    const batch = this.batchOf.get(entityId)?.find((b) => b.key === key);
    if (batch) this.place(batch, entityId);
  }

  /** Whether a copy is drawn in `batch`: not hidden, nor that part of it. */
  private shown(batch: Batch, entityId: string): boolean {
    if (this.hidden.has(entityId)) return false;
    return batch.key === null || !this.partsHidden.has(`${entityId}|${batch.key}`);
  }

  /** A copy's matrix in `batch` as it is to be drawn (its pose, or no size). */
  /**
   * A plain copy of a decor entity — its batch's geometries and materials (shared: never freed by
   * the copy), at its pose — to be moved on its own (an emergency's fall); its batched copy is
   * hidden meanwhile (`hide`). Null where it is not drawn here.
   */
  copyOf(entityId: string): THREE.Group | null {
    const batch = this.batchOf.get(entityId)?.find((b) => b.key === null);
    const copy = batch?.copies.find((c) => c.id === entityId);
    if (!batch || !copy || batch.meshes.length === 0) return null;
    const group = new THREE.Group();
    group.position.fromArray(copy.pose.position);
    group.quaternion.fromArray(copy.pose.rotation);
    for (const m of batch.meshes) {
      const mesh = new THREE.Mesh(m.geometry, m.material);
      mesh.castShadow = m.castShadow;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  private place(batch: Batch, entityId: string): void {
    const i = batch.copies.findIndex((copy) => copy.id === entityId);
    const copy = batch.copies[i];
    if (!copy) return;
    position.fromArray(copy.pose.position);
    rotation.fromArray(copy.pose.rotation);
    matrix.compose(position, rotation, this.shown(batch, entityId) ? ONE : NONE);
    for (const mesh of batch.meshes) {
      mesh.setMatrixAt(i, matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Builds `scene`'s batches, or rebuilds them (each sized to its copies). A scene without decor is
   * built too, so a copy added to it later is drawn at once.
   */
  build(scene: string): void {
    const decor = this.sceneDecor(scene);
    decor.built = true;
    for (const batch of decor.batches.values()) this.draw(batch);
  }

  /** `scene`'s meshes as they are drawn now (allocates). */
  /** The room a mesh drawn here stands in. */
  roomOf(mesh: THREE.InstancedMesh): string | undefined {
    return this.rooms.get(mesh);
  }

  meshesOf(scene: string): THREE.InstancedMesh[] {
    return [...(this.scenes.get(scene)?.batches.values() ?? [])].flatMap((batch) => batch.meshes);
  }

  /** Frees `scene`'s batches (meshes and instance buffers) and forgets its copies. */
  clear(scene: string): void {
    const decor = this.scenes.get(scene);
    if (!decor) return;
    for (const batch of decor.batches.values()) {
      this.free(batch);
      for (const copy of batch.copies) {
        this.batchOf.delete(copy.id);
        if (batch.key !== null) this.partsHidden.delete(`${copy.id}|${batch.key}`);
      }
    }
    this.scenes.delete(scene);
  }

  /** Frees every scene's batches. */
  dispose(): void {
    for (const scene of [...this.scenes.keys()]) this.clear(scene);
  }

  private sceneDecor(scene: string): SceneDecor {
    let decor = this.scenes.get(scene);
    if (!decor) {
      decor = { built: false, batches: new Map() };
      this.scenes.set(scene, decor);
    }
    return decor;
  }

  private draw(batch: Batch): void {
    this.free(batch);
    const { item, own, copies, meshes } = batch;
    if (copies.length === 0) return;
    const parts = own
      ? [own]
      : this.partsOf(item).map((part) => ({
          geometry: part.geometry,
          material: partMaterial(part, item, this.palette),
          casts: castsShadow(part, item),
        }));
    for (const { geometry, material, casts } of parts) {
      const mesh = new THREE.InstancedMesh(geometry, material, copies.length);
      // (Named for three's tools and frame breakdowns: an item's decor, or a viewed entity's part.)
      mesh.name = `${batch.key === null ? `decor:${item.id}` : `part:${batch.key}`}@${batch.roomId}`;
      copies.forEach(({ id, pose }, i) => {
        position.fromArray(pose.position);
        rotation.fromArray(pose.rotation);
        mesh.setMatrixAt(i, matrix.compose(position, rotation, this.shown(batch, id) ? ONE : NONE));
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = casts;
      mesh.receiveShadow = true;
      this.rooms.set(mesh, batch.roomId);
      this.parent.add(mesh);
      meshes.push(mesh);
      this.adopt(mesh);
    }
  }

  private free(batch: Batch): void {
    for (const mesh of batch.meshes) {
      this.parent.remove(mesh);
      this.rooms.delete(mesh);
      mesh.dispose(); // its instance buffers (the renderer listens for this)
    }
    batch.meshes.length = 0;
  }
}
