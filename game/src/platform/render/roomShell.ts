import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RoomDefinition } from '../../world/definitions';
import type { Slab } from '../../world/roomGeometry';

/** Floor tiles and ceiling panels: 0.6 m, the usual module of both. */
export const TILE_M = 0.6;
/** The skirting: its height and how far it stands out from the wall (m); tiling starts above it. */
export const BASEBOARD_H = 0.1;
const BASEBOARD_D = 0.012;

/**
 * A tile's surface, drawn once (256 px, a few kilobytes): near-white with a faint variation per
 * patch and a darker joint on two edges, so tiled across a slab it reads as a grid of joints. It is
 * multiplied by each room's own colour; `panel`: the ceiling's thinner, lighter joint.
 */
export function tileImage(panel: boolean): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null; // tests without a page: untextured
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  if (!c) return canvas;
  // Fixed seed: the same image every time.
  let seed = panel ? 7 : 3;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let y = 0; y < size; y += 16) {
    for (let x = 0; x < size; x += 16) {
      const v = Math.round(255 * (panel ? 0.99 : 0.955 + 0.04 * random()));
      c.fillStyle = `rgb(${v} ${v} ${v})`;
      c.fillRect(x, y, 16, 16);
    }
  }
  const joint = panel ? 2 : 3;
  c.fillStyle = panel ? 'rgb(214 214 214)' : 'rgb(170 170 170)';
  c.fillRect(0, 0, size, joint);
  c.fillRect(0, 0, joint, size);
  return canvas;
}

/** A tiled copy of `image` for a slab `width` × `depth` m (one texture per slab size). */
export function tiles(image: HTMLCanvasElement, width: number, depth: number): THREE.Texture {
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8; // floors are seen at a grazing angle
  texture.repeat.set(width / TILE_M, depth / TILE_M);
  return texture;
}

/**
 * The skirting along the foot of each wall piece standing on the floor (beside an opening it
 * stops at the opening), on the room's side of the wall: one merged geometry, or null.
 */
export function baseboards(
  room: RoomDefinition,
  slabs: readonly Slab[],
): THREE.BufferGeometry | null {
  const { min, max } = room.bounds;
  const pieces: THREE.BufferGeometry[] = [];
  const y = min[1] + BASEBOARD_H / 2;
  for (const { part, center, halfExtents: h } of slabs) {
    if (part !== 'wall' || Math.abs(center[1] - h[1] - min[1]) > 1e-6) continue;
    const alongX = h[0] > h[2];
    if (alongX) {
      const x0 = Math.max(center[0] - h[0], min[0]);
      const x1 = Math.min(center[0] + h[0], max[0]);
      const z = center[2] < min[2] ? min[2] + BASEBOARD_D / 2 : max[2] - BASEBOARD_D / 2;
      if (x1 - x0 > 1e-3) {
        pieces.push(
          new THREE.BoxGeometry(x1 - x0, BASEBOARD_H, BASEBOARD_D).translate((x0 + x1) / 2, y, z),
        );
      }
    } else {
      const z0 = Math.max(center[2] - h[2], min[2]);
      const z1 = Math.min(center[2] + h[2], max[2]);
      const x = center[0] < min[0] ? min[0] + BASEBOARD_D / 2 : max[0] - BASEBOARD_D / 2;
      if (z1 - z0 > 1e-3) {
        pieces.push(
          new THREE.BoxGeometry(BASEBOARD_D, BASEBOARD_H, z1 - z0).translate(x, y, (z0 + z1) / 2),
        );
      }
    }
  }
  if (pieces.length === 0) return null;
  const merged = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return merged;
}
