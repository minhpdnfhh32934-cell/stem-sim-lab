/**
 * Finer parts of the nuclei in the 3D division views (High tier): nuclear pores on the double
 * envelope and the vesicles it breaks into in prophase (re-forming in telophase), written into
 * two instanced meshes for all nuclei at once; and the nucleolus, placed off-centre. Counts of
 * pores and vesicles and all sizes are illustrative (`sceneParts.ts`).
 */
import * as THREE from 'three';
import type { Vec3 } from './math';
import { envelopeBreakdown } from './sceneParts';
import type { NucleusState } from './types';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const tmpDir = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpMat = new THREE.Matrix4();

/**
 * Writes the pores of every nucleus whose envelope still shows as a sheet and the vesicles of
 * every nucleus breaking down or re-forming (the first `maxNuclei` nuclei). `refRadius` is the
 * interphase nucleus radius: smaller nuclei get proportionally smaller pores and vesicles.
 */
export function writeEnvelopeParts(
  pores: THREE.InstancedMesh,
  vesicles: THREE.InstancedMesh,
  nuclei: readonly NucleusState[],
  poreDirs: readonly Vec3[],
  vesicleDirs: readonly Vec3[],
  maxNuclei: number,
  refRadius: number,
): void {
  let np = 0;
  let nv = 0;
  nuclei.forEach((n, i) => {
    if (i >= maxNuclei) return;
    const b = envelopeBreakdown(n.envelope);
    const size = Math.max(0.5, n.radius / refRadius);
    if (b.shell > 0.05) {
      for (const d of poreDirs) {
        tmpDir.set(d[0], d[1], d[2]);
        tmpPos.set(...n.center).addScaledVector(tmpDir, n.radius * 0.96);
        tmpQuat.setFromUnitVectors(Z_AXIS, tmpDir);
        tmpScale.setScalar(size);
        pores.setMatrixAt(np++, tmpMat.compose(tmpPos, tmpQuat, tmpScale));
      }
    }
    if (b.vesicles > 0.02) {
      const s = 0.17 * b.vesicles * size;
      for (const d of vesicleDirs) {
        tmpDir.set(d[0], d[1], d[2]);
        tmpPos.set(...n.center).addScaledVector(tmpDir, n.radius * (1 + b.drift));
        // Flattened pieces of membrane, lying along the old surface.
        tmpQuat.setFromUnitVectors(Z_AXIS, tmpDir);
        tmpScale.set(s, s, s * 0.4);
        vesicles.setMatrixAt(nv++, tmpMat.compose(tmpPos, tmpQuat, tmpScale));
      }
    }
  });
  pores.count = np;
  vesicles.count = nv;
  pores.visible = np > 0;
  vesicles.visible = nv > 0;
  pores.instanceMatrix.needsUpdate = true;
  vesicles.instanceMatrix.needsUpdate = true;
  vesicles.boundingSphere = null;
}

/** The nucleolus: off-centre inside its nucleus, a quarter of its radius. */
export function placeNucleolus(mesh: THREE.Object3D, n: NucleusState): void {
  mesh.position.set(
    n.center[0] + 0.3 * n.radius,
    n.center[1] + 0.25 * n.radius,
    n.center[2] - 0.2 * n.radius,
  );
  mesh.scale.setScalar(0.24 * n.radius);
}
