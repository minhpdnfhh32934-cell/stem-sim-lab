/**
 * What three.js draws for a scene in one frame, counted on the CPU (no GPU needed): the 3D views'
 * performance budgets are tested with it.
 */
import * as THREE from 'three';

/** Draw calls, triangles and line segments of one frame. */
export interface DrawStats {
  calls: number;
  triangles: number;
  lines: number;
}

/** Copies one draw call makes: an instanced mesh's `count`, an instanced geometry's instances. */
function copiesOf(o: THREE.Object3D, g: THREE.BufferGeometry): number {
  if (o instanceof THREE.InstancedMesh) return o.count;
  if (g instanceof THREE.InstancedBufferGeometry) {
    const n = g.instanceCount;
    return Number.isFinite(n) ? n : 0;
  }
  return 1;
}

/**
 * Mirrors WebGLRenderer: hidden objects (or hidden parents) and empty draw ranges are skipped, a
 * transparent double-sided material without `forceSinglePass` is drawn twice (back faces, then
 * front faces), and an instanced mesh (or a fat line: `LineSegments2`, one quad per segment)
 * draws all its copies in one call. An upper bound of `renderer.info.render`: frustum culling can
 * only lower it.
 */
export function drawStats(root: THREE.Object3D): DrawStats {
  const out: DrawStats = { calls: 0, triangles: 0, lines: 0 };
  const visit = (o: THREE.Object3D) => {
    if (!o.visible) return;
    const isMesh = o instanceof THREE.Mesh;
    const isLines = o instanceof THREE.LineSegments;
    if (isMesh || isLines) {
      const g = o.geometry as THREE.BufferGeometry;
      const mat = o.material as THREE.Material;
      const total = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
      const start = Math.max(0, g.drawRange.start);
      const count = Math.max(0, Math.min(total, start + g.drawRange.count) - start);
      const copies = copiesOf(o, g);
      if (count > 0 && copies > 0) {
        const passes =
          mat.transparent && mat.side === THREE.DoubleSide && !mat.forceSinglePass ? 2 : 1;
        out.calls += passes;
        if (isMesh) out.triangles += passes * copies * Math.floor(count / 3);
        else out.lines += passes * Math.floor(count / 2);
      }
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  return out;
}
