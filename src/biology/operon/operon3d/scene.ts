/**
 * The 3D scene of the lac operon (three.js on the biology scene kit): the DNA double helix with
 * see-through sleeves marking lacI and the operon's P, O, lacZ, lacY, lacA (structural genes in
 * --chart-1 while transcribed, a damaged part ringed in --chart-4, as in 2D), the repressor
 * (--chart-4) on O or free, allolactose on it, lactose in the medium, and RNA polymerase
 * (--chart-2) blocked on P or on the structural genes with the mRNA. Static: rebuilt on change.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import {
  backboneGeometry,
  backboneMaterial,
  proteinGeometry,
  proteinMaterial,
} from '@/biology/view3d/recipes';
import type { OperonInput, OperonResult } from '../model';
import {
  DNA_END,
  DNA_R,
  LACTOSE_SHOWN,
  REGIONS,
  helixPoints,
  middle,
  placement,
  region,
  type RegionId,
  type Vec3,
} from './layout';

export interface OperonTexts {
  repressor: string;
  polymerase: string;
  allolactose: string;
  lactose: string;
  mrna: string;
  broken: string;
}

export interface OperonScene extends Bio3DScene {
  state(): {
    repressorOnOperator: boolean | null;
    polymeraseOnGenes: boolean;
    allolactoseBound: boolean;
    lactoseFree: number;
    mrna: boolean;
    broken: RegionId[];
  };
}

const STRUCTURAL: readonly RegionId[] = ['lacZ', 'lacY', 'lacA'];

export function buildOperonScene(
  kit: SceneKit,
  o: { input: OperonInput; result: OperonResult; texts: OperonTexts },
): OperonScene {
  const pl = placement(o.input, o.result);
  // The double helix.
  for (const strand of [0, 1] as const) {
    const tube = kit.mesh(
      backboneGeometry(kit, helixPoints(strand), strand === 0 ? 'coding' : 'template', 0.18),
      backboneMaterial(kit, strand === 0 ? 'coding' : 'template'),
    );
    tube.name = `operon-strand-${String(strand)}`;
  }
  // Region sleeves and their names.
  const sleeve = kit.shared('operon-sleeve', () => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  for (const r of REGIONS) {
    if (r.id === 'gap') continue;
    const on = STRUCTURAL.includes(r.id) && o.result.transcribed;
    const broken = pl.broken.includes(r.id);
    const color = broken ? '--chart-4' : on ? '--chart-1' : '--text-muted';
    const m = kit.mesh(
      sleeve,
      kit.glass(kit.color(color), { opacity: on || broken ? 0.28 : 0.12, side: THREE.DoubleSide }),
    );
    m.name = `operon-region-${r.id}`;
    m.scale.set(r.to - r.from - 0.12, DNA_R * 1.45, DNA_R * 1.45);
    m.position.set((r.from + r.to) / 2, 0, 0);
    kit.label(r.id, [(r.from + r.to) / 2, -2.2, 0], 'strong');
    if (broken) {
      const ring = kit.mesh(
        kit.shared('operon-ring', () => new THREE.TorusGeometry(1, 0.08, 8, 40)),
        kit.solid(kit.color('--chart-4')),
      );
      ring.rotation.y = Math.PI / 2;
      ring.scale.setScalar(DNA_R * 1.7);
      ring.position.set((r.from + r.to) / 2, 0, 0);
      kit.label(o.texts.broken, [(r.from + r.to) / 2, -3.3, 0], 'muted');
    }
  }
  // The repressor, allolactose on it, and lactose in the medium.
  if (pl.repressor) {
    const rep = kit.mesh(
      proteinGeometry(kit, 7),
      proteinMaterial(kit, { color: kit.color('--chart-4') }),
    );
    rep.name = 'operon-repressor';
    rep.scale.setScalar(1.15);
    rep.position.set(...pl.repressor.at);
    kit.label(o.texts.repressor, [pl.repressor.at[0], pl.repressor.at[1] + 1.6, 0], 'plain');
    if (pl.allolactoseBound) {
      const al = kit.mesh(kit.sphere(), kit.solid(kit.color('--chart-5'), { roughness: 0.4 }));
      al.name = 'operon-allolactose';
      al.scale.setScalar(0.42);
      al.position.set(pl.repressor.at[0] + 1.05, pl.repressor.at[1] + 0.45, 0.4);
      kit.label(
        o.texts.allolactose,
        [pl.repressor.at[0] + 2.6, pl.repressor.at[1] + 0.6, 0],
        'muted',
      );
    }
  }
  if (pl.lactoseFree > 0) {
    const free = kit.instanced(
      kit.sphere(),
      kit.solid(kit.color('--chart-5'), { roughness: 0.4 }),
      LACTOSE_SHOWN,
    );
    free.name = 'operon-lactose';
    free.count = pl.lactoseFree;
    const m4 = new THREE.Matrix4();
    const one = new THREE.Quaternion();
    const s = new THREE.Vector3().setScalar(0.32);
    for (let i = 0; i < pl.lactoseFree; i++) {
      const x = 2 + (i * (DNA_END - 4)) / Math.max(1, pl.lactoseFree - 1);
      free.setMatrixAt(
        i,
        m4.compose(new THREE.Vector3(x, 6.6 + (i % 2) * 0.9, -1 + (i % 3)), one, s),
      );
    }
    free.instanceMatrix.needsUpdate = true;
    kit.label(o.texts.lactose, [2, 7.8, 0], 'muted');
  }
  // RNA polymerase, and the mRNA while the structural genes are transcribed.
  const pol = kit.mesh(
    proteinGeometry(kit, 3),
    proteinMaterial(kit, { color: kit.color('--chart-2'), seeThrough: true }),
  );
  pol.name = 'operon-polymerase';
  pol.scale.setScalar(1.9);
  pol.position.set(...pl.polymerase.at);
  kit.label(o.texts.polymerase, [pl.polymerase.at[0], 2.5, 0], 'plain');
  if (pl.mrna) {
    const z0 = region('lacZ').from + 0.3;
    const pts: Vec3[] = [];
    for (let x = z0; x <= region('lacA').to - 0.2; x += 0.5)
      pts.push([x, 2.9 + 0.25 * Math.sin(x * 1.3), 0.6]);
    const mrna = kit.mesh(backboneGeometry(kit, pts, 'mrna', 0.18), backboneMaterial(kit, 'mrna'));
    mrna.name = 'operon-mrna';
    kit.label(o.texts.mrna, [middle('lacY'), 4, 0.6], 'muted');
  }

  const points: Vec3[] = [];
  for (const x of [-0.5, DNA_END + 0.5])
    for (const y of [-3.6, pl.lactoseFree > 0 ? 8.2 : 6.8]) points.push([x, y, 0]);
  points.push([DNA_END / 2, 0, -2], [DNA_END / 2, 0, 2]);
  return {
    kit,
    bounds: { center: [DNA_END / 2, 1.5, 0], radius: DNA_END / 2 + 1, points },
    state: () => ({
      repressorOnOperator: pl.repressor ? pl.repressor.onOperator : null,
      polymeraseOnGenes: pl.polymerase.onGenes,
      allolactoseBound: pl.allolactoseBound,
      lactoseFree: pl.lactoseFree,
      mrna: pl.mrna,
      broken: [...pl.broken],
    }),
  };
}
