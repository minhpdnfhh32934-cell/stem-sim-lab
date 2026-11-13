import * as THREE from 'three';
import type { ItemDefinition } from '../../gameplay/item';
import { arc, loft, type Outline, roundRect, slab } from './assembly';
import { withSmallParts } from './detail';

export type ControlModel = NonNullable<ItemDefinition['visual']['model']>;

/**
 * A station control's shapes, in its item's frame (origin at the centre of its box): `body` for
 * the entity's own mesh (its material shows focus and the active glow), `trim` for a dark part
 * beside it, or null. They depend only on the model and the size, so WorldRenderer builds them
 * once per kind and every copy shares them.
 */
export interface ControlShapes {
  readonly body: THREE.BufferGeometry;
  readonly trim: THREE.BufferGeometry | null;
}

export const DESK_TOP = 0.035; // the desk's top board, its upper face the box's top
const DESK_INSET = 0.04; // the cabinet under the top, set back on every side
const PLINTH = 0.08; // the recessed kick plinth under the cabinet
const PLINTH_INSET = 0.06;

/**
 * The station controls, all inside their item's box (the collider and the interaction box):
 * - desk: a top board with a bevelled edge over an inset cabinet, on a dark recessed plinth; the
 *   same from both long sides, as players stand at either;
 * - push-button: a round cap in the button's colour in a dark square bezel;
 * - knob: a round knob on a wider skirt, all in the knob's colour (it shows no setting: no mark);
 * - display: the screen's box as it was, on a dark foot plate across its bottom.
 * Under Ultra only (render/detail.ts), the desk's cabinet shows a vent grille and a blank maker's
 * plate on each long side, and a knob's grip is knurled.
 */
export function controlShapes(model: ControlModel, size: readonly number[]): ControlShapes {
  const [w = 0, h = 0, d = 0] = size;
  const bottom = -h / 2;
  switch (model) {
    case 'desk': {
      const b = 0.006; // the top's edge bevel
      const body = stack(roundRect(w, d, 0.02), [
        [DESK_INSET, PLINTH],
        [DESK_INSET, h - DESK_TOP],
        [0, h - DESK_TOP],
        [0, h - b],
        [b, h],
      ]);
      const trim = slab(w - 2 * PLINTH_INSET, d - 2 * PLINTH_INSET, PLINTH, 0.01, 0.003);
      const sides = () => deskSides(w, h, d).map((g) => down(g, bottom));
      return { body: down(body, bottom), trim: withSmallParts(down(trim, bottom), sides) };
    }
    case 'push-button': {
      const bezel = 0.4 * h; // the bezel's height; the cap rises out of it to the box's top
      const body = stack(circle(0.35 * Math.min(w, d)), [
        [0, 0.3 * h],
        [0, h - 0.007],
        [0.007, h],
      ]);
      const trim = slab(w, d, bezel, 0.15 * Math.min(w, d), 0.003);
      return { body: down(body, bottom), trim: down(trim, bottom) };
    }
    case 'knob': {
      const r = Math.min(w, d) / 2;
      const skirt = 0.14 * h;
      const body = stack(circle(r), [
        [0, 0],
        [0, skirt],
        [0.3 * r, skirt],
        [0.3 * r, h - 0.006],
        [0.3 * r + 0.004, h],
      ]);
      const knurl = () => knurling(0.7 * r, skirt + 0.003, h - 0.01).map((g) => down(g, bottom));
      return { body: withSmallParts(down(body, bottom), knurl), trim: null };
    }
    case 'display': {
      // The foot plate: narrower than the screen, 8 cm deep, so it stays on the desk's top.
      const trim = slab(0.65 * w, 0.08, 0.012, 0.01, 0.003);
      return { body: new THREE.BoxGeometry(w, h, d), trim: down(trim, bottom) };
    }
  }
}

/**
 * The desk's vent grille (low, right) and maker's plate with four screws (high, left) on its
 * cabinet's long sides, built up from y = 0; the same on both, as players stand at either.
 */
function deskSides(w: number, h: number, d: number): THREE.BufferGeometry[] {
  const face = d / 2 - DESK_INSET;
  const one: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    one.push(
      new THREE.BoxGeometry(0.3, 0.007, 0.004).translate(
        w / 2 - 0.32,
        PLINTH + 0.06 + 0.02 * i,
        face + 0.002,
      ),
    );
  }
  const [px, py] = [-w / 2 + 0.22, h - DESK_TOP - 0.09];
  one.push(new THREE.BoxGeometry(0.12, 0.05, 0.002).translate(px, py, face + 0.001));
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const screw = new THREE.CylinderGeometry(0.0028, 0.0028, 0.0015, 12).rotateX(Math.PI / 2);
    one.push(screw.translate(px + sx * 0.052, py + sy * 0.017, face + 0.0028));
  }
  return [...one, ...one.map((g) => g.clone().rotateY(Math.PI))];
}

/** Ridges round a knob's grip of radius r from y0 to y1 (from y = 0): its knurling. */
function knurling(r: number, y0: number, y1: number): THREE.BufferGeometry[] {
  const ridges = 40;
  return Array.from({ length: ridges }, (_, i) =>
    new THREE.BoxGeometry(0.0018, y1 - y0, 0.0024)
      .translate(0, (y0 + y1) / 2, r + 0.0002)
      .rotateY((2 * Math.PI * i) / ridges),
  );
}

/** A round outline of 32 points (no point repeated), counter-clockwise, shrunk by the inset. */
const circle =
  (radius: number): Outline =>
  (inset) =>
    arc(0, 0, radius - inset, 0, (2 * Math.PI * 31) / 32, 31);

/** A solid of the outline stacked up (+y) through the levels: [inset, height] from y = 0. */
function stack(outline: Outline, levels: [inset: number, y: number][]) {
  const geometry = loft(outline, levels);
  geometry.rotateX(-Math.PI / 2); // the outline's y becomes −z
  return geometry;
}

/** Moves a part built up from y = 0 so it stands on the box's bottom. */
function down(geometry: THREE.BufferGeometry, bottom: number) {
  return geometry.translate(0, bottom, 0);
}
