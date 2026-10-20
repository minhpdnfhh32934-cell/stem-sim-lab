/**
 * Imaginary guides of the 3D division views (illustration, never a part of the cell): a dashed
 * ring that marks the metaphase (equatorial) plate. One static geometry, one draw call.
 */
import * as THREE from 'three';

/** Dashes of the ring, the share of each step that is drawn, segments along a dash. */
export const GUIDE_DASHES = 32;
const DASH_SHARE = 0.55;
const DASH_STEPS = 2;
/** Sides around the thin tube of a dash (a triangle in section: few triangles, still round). */
const SIDES = 3;

/**
 * A dashed circle of radius 1 in the y–z plane (normal along x, the spindle axis): thin tube
 * arcs of radius `tube`, written directly (no temporary geometries).
 */
export function dashedRing(tube: number): THREE.BufferGeometry {
  const ringVerts = SIDES + 1;
  const perDash = (DASH_STEPS + 1) * ringVerts;
  const pos = new Float32Array(GUIDE_DASHES * perDash * 3);
  const nor = new Float32Array(GUIDE_DASHES * perDash * 3);
  const index: number[] = [];
  const step = (2 * Math.PI) / GUIDE_DASHES;
  let v = 0;
  for (let d = 0; d < GUIDE_DASHES; d++) {
    const base = v;
    for (let i = 0; i <= DASH_STEPS; i++) {
      const a = d * step + (step * DASH_SHARE * i) / DASH_STEPS;
      // Centre of the tube on the circle (y–z plane) and the radial direction outwards.
      const cy = Math.cos(a);
      const cz = Math.sin(a);
      for (let k = 0; k <= SIDES; k++) {
        const t = (2 * Math.PI * k) / SIDES;
        // Section circle spanned by the radial direction and the x axis.
        const nx = Math.sin(t);
        const nr = Math.cos(t);
        pos[3 * v] = tube * nx;
        pos[3 * v + 1] = cy * (1 + tube * nr);
        pos[3 * v + 2] = cz * (1 + tube * nr);
        nor[3 * v] = nx;
        nor[3 * v + 1] = cy * nr;
        nor[3 * v + 2] = cz * nr;
        v++;
      }
    }
    for (let i = 0; i < DASH_STEPS; i++) {
      for (let k = 0; k < SIDES; k++) {
        const a = base + i * ringVerts + k;
        const b = a + ringVerts;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}
