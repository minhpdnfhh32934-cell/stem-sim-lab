import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Finish } from '../palette';

/**
 * One finish of a prop: all its pieces merged into one geometry (one draw per copy), in the item's
 * frame — origin at the centre of the box, front +z, floor at −h/2 — and inside the box (a
 * cylinder item's: inside its radius). `body` is drawn in the item's own colour and look.
 */
export interface PropPart {
  readonly finish: Finish | 'body';
  readonly geometry: THREE.BufferGeometry;
  /** Whether it casts a shadow (lit and see-through finishes never do: palette.castsShadowIn). */
  readonly casts: boolean;
  /** A door leaf's part: it swings about this hinge while its item is open (drawn closed). */
  readonly hinge?: Hinge;
}

/**
 * The vertical line, at (x, z) in the item's frame, a leaf turns about; `opens` is the sign of the
 * turn (about +y) that opens it. The parts of one leaf share one hinge object.
 */
export interface Hinge {
  readonly x: number;
  readonly z: number;
  readonly opens: 1 | -1;
}

/**
 * A prop's parts at a size [w, h, d]: one per finish and leaf, exactly one `body` off the leaves
 * (a leaf's body part is drawn in the item's colour too).
 */
export type PropBuilder = (size: readonly number[]) => readonly PropPart[];

/** One piece of a merged part: its kind and parameters (if it has them), its vertex and index range. */
export interface MergedPiece {
  readonly type: string;
  readonly parameters: Readonly<Record<string, unknown>> | undefined;
  readonly vertex: number;
  readonly count: number;
  readonly index: number;
  readonly indices: number;
  /**
   * The turn (and scale) the piece was placed with, column-major, when it is not one of the
   * quarter turns detail.ts tries itself (a part merged from a mesh turned any way: mergeStill.ts).
   */
  readonly linear?: readonly number[];
}

/** The pieces of one finish, merged (texture coordinates dropped: props are not textured). */
export function part(
  finish: Finish | 'body',
  casts: boolean,
  pieces: readonly THREE.BufferGeometry[],
  hinge?: Hinge,
): PropPart {
  for (const piece of pieces) piece.deleteAttribute('uv');
  const geometry = mergePieces(pieces);
  if (!geometry) throw new Error('A prop part whose pieces do not merge');
  return hinge ? { finish, geometry, casts, hinge } : { finish, geometry, casts };
}

/**
 * `pieces` (alike in their attributes) as one geometry, or null if they do not merge. Where each
 * piece lies in it, and what made it, is recorded (`userData.pieces`): Ultra's model detail
 * (render/detail.ts) rebuilds the merge with its round pieces rounder and its boxes bevelled.
 * `linear[i]`: the turn piece i was placed with, if any (MergedPiece.linear).
 */
export function mergePieces(
  pieces: readonly THREE.BufferGeometry[],
  linear?: readonly (THREE.Matrix4 | null)[],
): THREE.BufferGeometry | null {
  const recipe: MergedPiece[] = [];
  let vertex = 0;
  let index = 0;
  pieces.forEach((piece, i) => {
    const count = piece.getAttribute('position').count;
    // Polyhedra come unindexed; all or none must be indexed to merge.
    if (!piece.index) piece.setIndex([...Array(count).keys()]);
    const indices = piece.index?.count ?? count;
    const { parameters } = piece as { parameters?: MergedPiece['parameters'] };
    const turn = linear?.[i];
    recipe.push({
      type: piece.type,
      parameters,
      vertex,
      count,
      index,
      indices,
      ...(turn ? { linear: turn.toArray() } : {}),
    });
    vertex += count;
    index += indices;
  });
  const geometry = mergeGeometries([...pieces]) as THREE.BufferGeometry | null;
  if (geometry) geometry.userData.pieces = recipe;
  return geometry;
}

/** A box w × h × d centred at (x, y, z). */
export const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) =>
  new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** An upright round solid about the y axis from y0 to y1, radius r0 at the bottom, r1 at the top. */
export const drum = (r0: number, r1: number, y0: number, y1: number, segments = 32, open = false) =>
  new THREE.CylinderGeometry(r1, r0, y1 - y0, segments, 1, open).translate(0, (y0 + y1) / 2, 0);

/** A round bar of radius r from a to b. */
export function rod(r: number, a: THREE.Vector3, b: THREE.Vector3, segments = 8) {
  const along = b.clone().sub(a);
  const geometry = new THREE.CylinderGeometry(r, r, along.length(), segments);
  geometry.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.normalize()),
  );
  return geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

/** A ball of radius r at (x, y, z). */
export const sphere = (r: number, x: number, y: number, z: number, segments = 12) =>
  new THREE.SphereGeometry(r, segments, Math.max(6, segments / 2)).translate(x, y, z);
