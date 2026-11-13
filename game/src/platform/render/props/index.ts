import * as THREE from 'three';
import type { ItemDefinition } from '../../../gameplay/item';
import type { Prop } from '../../../gameplay/props';
import { castsShadowIn, FINISHES, type Palette } from '../palette';
import { DOOR_PROPS } from './doors';
import { CEILING_PROPS } from './ceiling';
import { CIRCUIT_PROPS } from './circuit';
import { LAPTOP_PROPS } from './laptop';
import { HUB_PROPS } from './hub';
import { LAB_PROPS } from './labs';
import type { PropBuilder, PropPart } from './parts';
import { PREPARATION_PROPS } from './preparation';
import { REAGENT_PROPS } from './reagent';
import { ROOM_PROPS } from './rooms';
import { STARSHIP_PROPS } from './starship';
import { WASHROOM_PROPS } from './washroom';

export type { Hinge, PropBuilder, PropPart } from './parts';

/** A door leaf of an entity's prop: the pivot its parts hang from, at its hinge. */
export interface Leaf {
  readonly pivot: THREE.Object3D;
  readonly opens: 1 | -1;
}

/** Every prop's builder. A prop without one (between cards) is drawn as its item's primitive. */
export const PROP_BUILDERS: Partial<Record<Prop, PropBuilder>> = {
  ...HUB_PROPS,
  ...STARSHIP_PROPS,
  ...LAB_PROPS,
  ...ROOM_PROPS,
  ...PREPARATION_PROPS,
  ...REAGENT_PROPS,
  ...DOOR_PROPS,
  ...WASHROOM_PROPS,
  ...CEILING_PROPS,
  ...CIRCUIT_PROPS,
  ...LAPTOP_PROPS,
};

/**
 * Props' parts, built once per prop and size and shared by every copy, entities and decor alike.
 * Owns their geometries: `dispose()` frees them (the renderer's lifetime, like its primitives).
 */
export class PropCache {
  private readonly built = new Map<string, readonly PropPart[] | null>();

  /** The parts of `prop` at `size`; null if it has no builder yet. */
  get(prop: Prop, size: readonly number[]): readonly PropPart[] | null {
    const key = `${prop}:${size.join(',')}`;
    let parts = this.built.get(key);
    if (parts === undefined) {
      parts = PROP_BUILDERS[prop]?.(size) ?? null;
      this.built.set(key, parts);
    }
    return parts;
  }

  dispose(): void {
    for (const parts of this.built.values()) for (const p of parts ?? []) p.geometry.dispose();
    this.built.clear();
  }
}

/**
 * Whether a part casts a shadow: if it says so, and its look (a body's: its item's) is neither lit
 * nor see-through.
 */
export const castsShadow = (part: PropPart, item: ItemDefinition) =>
  part.casts &&
  castsShadowIn(part.finish === 'body' ? item.visual.material : FINISHES[part.finish].look);

/** A part's material from the palette: a body in its item's colour and look, others in their finish. */
export const partMaterial = (part: PropPart, item: ItemDefinition, palette: Palette) =>
  part.finish === 'body'
    ? palette.surface(item.visual.color, item.visual.material)
    : palette.finish(part.finish);

/**
 * Dresses an entity's mesh — drawn with the prop's body geometry and the entity's own material
 * (so focus and the active glow show on it) — with the prop's other parts as its children: they
 * move with it (physics pose) and share their geometry and material, so nothing is freed per
 * copy. A leaf's parts hang from a pivot at its hinge (a leaf's body in the entity's material);
 * returns the leaves, for the caller to turn. Sets the mesh's shadow by the body's rule.
 */
export function attachParts(
  mesh: THREE.Mesh,
  parts: readonly PropPart[],
  item: ItemDefinition,
  palette: Palette,
): Leaf[] {
  const leaves = new Map<object, Leaf>();
  for (const part of parts) {
    const { hinge } = part;
    if (part.finish === 'body' && !hinge) {
      mesh.castShadow = castsShadow(part, item);
      continue;
    }
    const material = part.finish === 'body' ? mesh.material : palette.finish(part.finish);
    const child = new THREE.Mesh(part.geometry, material);
    child.castShadow = castsShadow(part, item);
    child.receiveShadow = true;
    if (!hinge) {
      mesh.add(child);
      continue;
    }
    let leaf = leaves.get(hinge);
    if (!leaf) {
      const pivot = new THREE.Object3D();
      pivot.position.set(hinge.x, 0, hinge.z);
      mesh.add(pivot);
      leaf = { pivot, opens: hinge.opens };
      leaves.set(hinge, leaf);
    }
    child.position.set(-hinge.x, 0, -hinge.z);
    leaf.pivot.add(child);
  }
  return [...leaves.values()];
}
