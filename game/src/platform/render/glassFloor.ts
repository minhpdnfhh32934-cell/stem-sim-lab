import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// A room's glass floor (Phase V-2, a room's `glassFloor`): under High and Ultra its floor slab is
// laid round the glass area, and the area is laminated glass in a steel grid, flush with the floor,
// over the city below. Drawn only: the floor physics walks on is the slab, whole, at every preset.

/** The steel grid's module (m), its bars' width and depth under the glass's top. */
export const GLASS_MODULE = 1.2;
const BAR_W = 0.05;
const BAR_D = 0.08;
/** The glass's thickness (laminated), its top just under the floor's. */
const GLASS_T = 0.024;

/** An axis-aligned rectangle on the floor: [x0, x1, z0, z1]. */
export type Rect = readonly [number, number, number, number];

/**
 * The floor slab `slab` (its x and z extent) with `hole` taken out: up to four rectangles, west and
 * east strips the slab's full depth, north and south ones between them; empty ones left out.
 */
export function around(slab: Rect, hole: Rect): Rect[] {
  const [x0, x1, z0, z1] = slab;
  const [hx0, hx1, hz0, hz1] = [
    Math.max(x0, hole[0]),
    Math.min(x1, hole[1]),
    Math.max(z0, hole[2]),
    Math.min(z1, hole[3]),
  ];
  const pieces: Rect[] = [
    [x0, hx0, z0, z1],
    [hx1, x1, z0, z1],
    [hx0, hx1, z0, hz0],
    [hx0, hx1, hz1, z1],
  ];
  return pieces.filter(([a, b, c, d]) => b - a > 1e-6 && d - c > 1e-6);
}

/** The glass pane over `hole`, its top `top` (m), in world coordinates. */
export function glassPane(hole: Rect, top: number): THREE.BufferGeometry {
  const [x0, x1, z0, z1] = hole;
  return new THREE.BoxGeometry(x1 - x0, GLASS_T, z1 - z0).translate(
    (x0 + x1) / 2,
    top - 0.001 - GLASS_T / 2,
    (z0 + z1) / 2,
  );
}

/**
 * The steel grid the panes sit in: a bar round the edge and every `GLASS_MODULE` across, its top
 * flush with the floor's, merged (one draw).
 */
export function glassGrid(hole: Rect, top: number): THREE.BufferGeometry {
  const [x0, x1, z0, z1] = hole;
  const y = top - BAR_D / 2;
  const bars: THREE.BufferGeometry[] = [];
  const lines = (from: number, to: number) => {
    const n = Math.max(1, Math.round((to - from) / GLASS_MODULE));
    return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
  };
  for (const x of lines(x0, x1)) {
    bars.push(new THREE.BoxGeometry(BAR_W, BAR_D, z1 - z0 + BAR_W).translate(x, y, (z0 + z1) / 2));
  }
  for (const z of lines(z0, z1)) {
    bars.push(new THREE.BoxGeometry(x1 - x0 + BAR_W, BAR_D, BAR_W).translate((x0 + x1) / 2, y, z));
  }
  const grid = mergeGeometries(bars);
  for (const bar of bars) bar.dispose();
  return grid;
}
