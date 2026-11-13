import * as THREE from 'three';
import type { ItemDefinition } from '../../gameplay/item';
import { DECOR } from '../../gameplay/props';
import type { WorldEntity } from '../../world/World';
import type { Palette } from './palette';
import { castsShadow, partMaterial, type PropPart } from './props';

/** One item's copies in one room of a scene. */
interface Batch {
  readonly item: ItemDefinition;
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
  private readonly batchOf = new Map<string, Batch>();
  /** Each mesh's room (not in its userData: a glass part's sheen copies that). */
  private readonly rooms = new Map<THREE.InstancedMesh, string>();

  constructor(
    /** Where the meshes are added (the renderer's scene). */
    private readonly parent: THREE.Object3D,
    private readonly palette: Palette,
    /** An item's parts: its prop's, or its primitive as the body. Shared: never freed here. */
    private readonly partsOf: (item: ItemDefinition) => readonly PropPart[],
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
      batch = { item: entity.item, roomId: entity.roomId, copies: [], meshes: [] };
      decor.batches.set(key, batch);
    }
    batch.copies.push(entity);
    this.batchOf.set(entity.id, batch);
    if (decor.built) this.draw(batch);
  }

  /** Takes a copy out at once, the last copy moving into its place; false if it is not here. */
  remove(entityId: string): boolean {
    const batch = this.batchOf.get(entityId);
    if (!batch) return false;
    this.batchOf.delete(entityId);
    const { copies, meshes } = batch;
    const i = copies.findIndex((copy) => copy.id === entityId);
    const last = copies.length - 1;
    const moved = copies.pop();
    if (moved && i < last) copies[i] = moved;
    for (const mesh of meshes) {
      if (i < last) mesh.setMatrixAt(i, mesh.getMatrixAt(last, matrix));
      mesh.count = last;
      mesh.instanceMatrix.needsUpdate = true;
    }
    return true;
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
      for (const copy of batch.copies) this.batchOf.delete(copy.id);
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
    const { item, copies, meshes } = batch;
    if (copies.length === 0) return;
    for (const part of this.partsOf(item)) {
      const material = partMaterial(part, item, this.palette);
      const mesh = new THREE.InstancedMesh(part.geometry, material, copies.length);
      copies.forEach(({ pose }, i) => {
        position.fromArray(pose.position);
        rotation.fromArray(pose.rotation);
        mesh.setMatrixAt(i, matrix.compose(position, rotation, ONE));
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = castsShadow(part, item);
      mesh.receiveShadow = true;
      this.rooms.set(mesh, batch.roomId);
      this.parent.add(mesh);
      meshes.push(mesh);
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
