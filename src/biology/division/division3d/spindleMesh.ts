/**
 * Spindle fibres of the 3D division views: thin tubes, one InstancedMesh for every fibre of the
 * moment (a unit cylinder moved, turned and stretched per fibre; nothing allocated per frame).
 * Kinetochore fibres are bundles of microtubules: drawn thicker than polar and astral fibres
 * (widths are illustrative).
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import type { Fibre, FibreKind } from './types';

/** Spindle fibre radius and sides per tier (world units; an animal cell's radius is 5). */
export const FIBRE: Record<QualityTier, { radius: number; sides: number }> = {
  low: { radius: 0.03, sides: 5 },
  medium: { radius: 0.034, sides: 6 },
  high: { radius: 0.038, sides: 8 },
};

/** Fibre width per kind (shares of the tier's fibre radius). */
export const FIBRE_WIDTH: Record<FibreKind, number> = { kinetochore: 1.7, polar: 1, astral: 0.55 };

/**
 * The unit fibre: radius 1, height 1 along +y, open ends. Its colour attribute is white with an
 * alpha that fades from 1 at the far end (+y) to `poleAlpha` at the pole end (−y, where every
 * fibre starts): where dozens of fibres meet at a pole they do not pile up into a dark knot.
 */
export function fibreGeometry(sides: number, poleAlpha: number): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(1, 1, 1, sides, 1, true);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    colors[4 * i] = 1;
    colors[4 * i + 1] = 1;
    colors[4 * i + 2] = 1;
    colors[4 * i + 3] = pos.getY(i) > 0 ? 1 : poleAlpha;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpMat = new THREE.Matrix4();

/**
 * Writes the fibres into the instanced mesh (at most its capacity) and shows it when there are
 * any. Picking re-measures the moved fibres when it needs to (the bounding sphere is reset).
 */
export function writeFibres(
  spindle: THREE.InstancedMesh,
  fibres: readonly Fibre[],
  radius: number,
  capacity: number,
): number {
  let n = 0;
  for (const f of fibres) {
    if (n >= capacity) break;
    tmpDir.set(f.to[0] - f.from[0], f.to[1] - f.from[1], f.to[2] - f.from[2]);
    const len = tmpDir.length();
    if (len < 1e-6) continue;
    tmpPos.set((f.from[0] + f.to[0]) / 2, (f.from[1] + f.to[1]) / 2, (f.from[2] + f.to[2]) / 2);
    tmpQuat.setFromUnitVectors(UP, tmpDir.divideScalar(len));
    const w = radius * FIBRE_WIDTH[f.kind];
    tmpScale.set(w, len, w);
    spindle.setMatrixAt(n, tmpMat.compose(tmpPos, tmpQuat, tmpScale));
    n++;
  }
  spindle.count = n;
  spindle.instanceMatrix.needsUpdate = true;
  spindle.boundingSphere = null;
  spindle.visible = n > 0;
  return n;
}
