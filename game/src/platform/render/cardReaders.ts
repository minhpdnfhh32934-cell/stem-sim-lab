import * as THREE from 'three';
import { handPoint } from '../../gameplay/action/handPoint';
import type { World, WorldEntity } from '../../world/World';

/** The reader's box (m): width, height, depth off the wall. */
const SIZE = [0.08, 0.12, 0.025] as const;

/**
 * The card readers beside walk-through doors (Phú, 2026-11-04: a key card is tapped on a reader
 * beside the door to open it): a dark box on the wall where the hand holds the card
 * (`handPoint`), its green light above the tap area. Built when a door is added, at the door's
 * closed pose; it stays on the wall as the leaf slides. Two shared geometries and materials.
 */
export class CardReaders {
  readonly group = new THREE.Group();
  private readonly readers = new Map<string, THREE.Group>();
  private readonly body = new THREE.BoxGeometry(...SIZE);
  private readonly lamp = new THREE.BoxGeometry(0.03, 0.008, 0.004);
  private readonly dark = new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.5 });
  private readonly green = new THREE.MeshStandardMaterial({
    color: '#1d6b3a',
    emissive: '#2bd46a',
    emissiveIntensity: 0.8,
  });
  private readonly at: [number, number, number] = [0, 0, 0];

  /** A reader for `entity` if it is a walk-through door. */
  add(entity: WorldEntity, world: World): void {
    if (!entity.item.door || this.readers.has(entity.id)) return;
    const reader = new THREE.Group();
    reader.add(new THREE.Mesh(this.body, this.dark));
    const lamp = new THREE.Mesh(this.lamp, this.green);
    lamp.position.set(0, SIZE[1] / 2 - 0.018, 0);
    reader.add(lamp);
    handPoint(entity, world, this.at);
    reader.position.set(...this.at);
    const [x, y, z, w] = entity.pose.rotation;
    reader.quaternion.set(x, y, z, w);
    reader.updateMatrixWorld(true);
    this.readers.set(entity.id, reader);
    this.group.add(reader);
  }

  remove(entityId: string): void {
    const reader = this.readers.get(entityId);
    if (!reader) return;
    reader.removeFromParent();
    this.readers.delete(entityId);
  }

  dispose(): void {
    for (const id of [...this.readers.keys()]) this.remove(id);
    this.body.dispose();
    this.lamp.dispose();
    this.dark.dispose();
    this.green.dispose();
  }
}
