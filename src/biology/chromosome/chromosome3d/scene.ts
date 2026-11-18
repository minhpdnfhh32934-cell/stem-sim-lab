/**
 * The 3D scene of a structural chromosome mutation (three.js on the biology scene kit): the
 * chromosomes before (top) and after (bottom) as rows of gene beads with their letters — genes of
 * the first chromosome --chart-1, of the second (translocation) --chart-2, a gene marked new
 * ringed in --chart-4 as in 2D — and a faint link from each gene before to where it is after.
 * Static: rebuilt on change.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { chromosome } from '@/biology/view3d/recipes';
import type { Structure } from '../model';
import { GENE_W, ROW_AFTER, ROW_BEFORE, structure3d, type Bead, type Vec3 } from './layout';

export interface ChromosomeScene extends Bio3DScene {
  state(): { before: string[]; after: string[]; links: number; marked: string[] };
}

export function buildChromosomeScene(
  kit: SceneKit,
  o: { structure: Structure; texts: { before: string; after: string } },
): ChromosomeScene {
  const d = structure3d(o.structure);
  const bead = kit.shared(`chromo-bead|${String(kit.seg)}`, () =>
    new THREE.CapsuleGeometry(0.36, GENE_W * 0.5, 6, Math.max(10, kit.seg)).rotateZ(Math.PI / 2),
  );
  const firstOf = new Set(d.before[0] ?? '');
  const mat = {
    first: chromosome(kit, kit.color('--chart-1')),
    second: chromosome(kit, kit.color('--chart-2')),
  };
  const ring = kit.shared('chromo-ring', () =>
    new THREE.TorusGeometry(0.48, 0.05, 8, 28).rotateY(Math.PI / 2),
  );
  const ringMat = kit.solid(kit.color('--chart-4'), { roughness: 0.5 });
  const draw = (b: Bead) => {
    const m = kit.mesh(bead, firstOf.has(b.gene) ? mat.first : mat.second);
    m.position.set(...b.at);
    kit.label(b.gene, [b.at[0], b.at[1] + 0.75, 0], 'strong');
    if (b.isNew) {
      const r = kit.mesh(ring, ringMat);
      r.name = `chromo-new-${b.gene}`;
      r.position.set(...b.at);
    }
  };
  d.top.forEach(draw);
  d.bottom.forEach(draw);
  const width = Math.max(...[...d.top, ...d.bottom].map((b) => Math.abs(b.at[0]))) + 1;
  kit.label(o.texts.before, [-width - 0.8, ROW_BEFORE, 0], 'muted');
  kit.label(o.texts.after, [-width - 0.8, ROW_AFTER, 0], 'muted');

  // Links: before → after, in one draw call.
  const pts: THREE.Vector3[] = [];
  for (const l of d.links) {
    pts.push(
      new THREE.Vector3(l.from[0], l.from[1] - 0.45, 0),
      new THREE.Vector3(l.to[0], l.to[1] + 0.45, 0),
    );
  }
  const links = new THREE.LineSegments(
    kit.geometry(new THREE.BufferGeometry().setFromPoints(pts)),
    kit.own(new THREE.LineBasicMaterial({ color: kit.color('--text-faint') })),
  );
  links.name = 'chromo-links';
  kit.scene.add(links);

  const points: Vec3[] = [
    [-width - 1.6, ROW_AFTER - 1, 0],
    [width + 0.6, ROW_AFTER - 1, 0],
    [-width - 1.6, ROW_BEFORE + 1.4, 0],
    [width + 0.6, ROW_BEFORE + 1.4, 0],
    [0, 0, -0.8],
    [0, 0, 0.8],
  ];
  return {
    kit,
    bounds: { center: [-0.5, 0, 0], radius: width + 1.5, points },
    state: () => ({
      before: [...d.before],
      after: [...d.after],
      links: d.links.length,
      marked: d.bottom.filter((b) => b.isNew).map((b) => b.gene),
    }),
  };
}
