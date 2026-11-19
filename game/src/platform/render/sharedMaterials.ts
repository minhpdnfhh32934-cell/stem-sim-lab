import type * as THREE from 'three';

/**
 * One material for every owner of a key (a look and a colour): taken with a maker for the first,
 * given back by each owner, freed with the last. Owners never change it; one that has to (focus,
 * glow, soot) draws with a copy of its own meanwhile (WorldRenderer.repaint).
 */
export class SharedMaterials<M extends THREE.Material> {
  private readonly entries = new Map<string, { material: M; owners: number }>();

  take(key: string, make: () => M): M {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { material: make(), owners: 0 };
      this.entries.set(key, entry);
    }
    entry.owners++;
    return entry.material;
  }

  release(key: string): void {
    const entry = this.entries.get(key);
    if (!entry || --entry.owners > 0) return;
    this.entries.delete(key);
    entry.material.dispose();
  }

  /** How many materials are shared (tests). */
  get size(): number {
    return this.entries.size;
  }
}
