/**
 * The 3D scene of the sex-linked cross (three.js on the biology scene kit): the parents' sex
 * chromosomes on top, the gametes along the grid's edges, and the four children of the cross, each
 * an X from the mother (--chart-4, the division lessons' maternal colour) with an X or a Y from
 * the father (--chart-1); a band on each X marks its allele (A dark, a light; none on Y) and a
 * small sphere shows the eye colour (red or white). Static: rebuilt on change.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { chromosome } from '@/biology/view3d/recipes';
import type { Father, Mother } from '../model';
import { gameteText, genotype, motherGametes } from '../model';
import { COLS, EGG_X, PARENT_Y, ROWS, SPERM_Y, cells, type Chrom, type Vec3 } from './layout';

export interface SexLinkedScene extends Bio3DScene {
  state(): { cells: { alleles: string; sex: string; dominant: boolean }[] };
}

const X_LEN = 1.5;
const Y_LEN = 0.8;
const R = 0.24;

export function buildSexLinkedScene(
  kit: SceneKit,
  o: {
    mother: Mother;
    father: Father;
    texts: { red: string; white: string; mother: string; father: string; quarter: string };
  },
): SexLinkedScene {
  const geo = (len: number) =>
    kit.shared(
      `sexchrom|${String(len)}|${String(kit.seg)}`,
      () => new THREE.CapsuleGeometry(R, len, 6, Math.max(10, kit.seg)),
    );
  const band = kit.shared(
    'sexchrom-band',
    () => new THREE.CylinderGeometry(R * 1.12, R * 1.12, 0.22, 24),
  );
  const origin = { maternal: kit.color('--chart-4'), paternal: kit.color('--chart-1') };
  const alleleMat = {
    A: kit.solid(kit.color('--text'), { roughness: 0.5 }),
    a: kit.solid(kit.color('--bg-panel'), { roughness: 0.5 }),
  };
  // `side`: where the allele's letter goes (outside a pair, never on the other chromosome).
  const draw = (c: Chrom, at: Vec3, side: 1 | -1 = 1) => {
    const len = c.kind === 'X' ? X_LEN : Y_LEN;
    const m = kit.mesh(geo(len), chromosome(kit, origin[c.from]));
    // Y is shorter; both stand on the same base line.
    m.position.set(at[0], at[1] + (len - X_LEN) / 2, at[2]);
    if (c.allele) {
      const b = kit.mesh(band, alleleMat[c.allele]);
      b.position.set(at[0], at[1] + 0.35, at[2]);
      kit.label(c.allele, [at[0] + side * 0.55, at[1] + 0.35, at[2]], 'muted');
    }
    return m;
  };
  const pair = (a: Chrom, b: Chrom, at: Vec3) => {
    draw(a, [at[0] - 0.4, at[1], at[2]], -1);
    draw(b, [at[0] + 0.4, at[1], at[2]]);
  };

  // The parents.
  const [e1, e2] = motherGametes(o.mother);
  pair({ kind: 'X', allele: e1, from: 'maternal' }, { kind: 'X', allele: e2, from: 'maternal' }, [
    EGG_X,
    PARENT_Y,
    0,
  ]);
  kit.label(`${o.texts.mother} ${genotype(o.mother, false)}`, [EGG_X, PARENT_Y + 1.5, 0], 'strong');
  pair(
    { kind: 'X', allele: o.father, from: 'paternal' },
    { kind: 'Y', allele: null, from: 'paternal' },
    [(COLS[0] + COLS[1]) / 2, PARENT_Y, 0],
  );
  kit.label(
    `${o.texts.father} ${genotype(o.father, true)}`,
    [(COLS[0] + COLS[1]) / 2, PARENT_Y + 1.5, 0],
    'strong',
  );

  // The gametes: eggs on the left, sperm along the top.
  [e1, e2].forEach((egg, i) => {
    const y = ROWS[i] ?? 0;
    draw({ kind: 'X', allele: egg, from: 'maternal' }, [EGG_X, y, 0]);
    kit.label(gameteText(egg), [EGG_X, y - 1.2, 0], 'muted');
  });
  ([o.father, 'Y'] as const).forEach((sperm, j) => {
    const x = COLS[j] ?? 0;
    draw(
      sperm === 'Y'
        ? { kind: 'Y', allele: null, from: 'paternal' }
        : { kind: 'X', allele: sperm, from: 'paternal' },
      [x, SPERM_Y, 0],
    );
    kit.label(gameteText(sperm), [x, SPERM_Y - 1.2, 0], 'muted');
  });

  // The four children of the cross.
  const eye = {
    red: kit.solid(kit.color('--chart-4'), { roughness: 0.3 }),
    white: kit.solid(kit.color('--bg-panel'), { roughness: 0.3 }),
  };
  const all = cells(o.mother, o.father);
  for (const c of all) {
    pair(c.chroms[0], c.chroms[1], c.at);
    const e = kit.mesh(kit.sphere(), c.dominant ? eye.red : eye.white);
    e.name = `sexlinked-eye-${c.alleles}-${c.sex}`;
    e.scale.setScalar(0.3);
    e.position.set(c.at[0] + 1.25, c.at[1] + 0.5, 0);
    kit.label(
      `${genotype(c.alleles, c.sex === 'male')} · ${c.dominant ? o.texts.red : o.texts.white} · ${o.texts.quarter}`,
      [c.at[0], c.at[1] - 1.25, 0],
      'plain',
    );
  }
  // Faint grid lines between the cells.
  const lineMat = kit.own(new THREE.LineBasicMaterial({ color: kit.color('--text-faint') }));
  const segs = [
    [
      [-1.6, 3.2, 0],
      [5, 3.2, 0],
    ],
    [
      [-1.6, -0.1, 0],
      [5, -0.1, 0],
    ],
    [
      [1.7, 3.6, 0],
      [1.7, -3.6, 0],
    ],
  ] as const;
  for (const [a, b] of segs) {
    const g = kit.geometry(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]),
    );
    kit.scene.add(new THREE.Line(g, lineMat));
  }

  const points: Vec3[] = [
    [EGG_X - 1.2, -3.4, 0],
    [COLS[1] + 2.2, -3.4, 0],
    [EGG_X - 1.2, PARENT_Y + 2, 0],
    [COLS[1] + 2.2, PARENT_Y + 2, 0],
    [0, 2, -1],
    [0, 2, 1],
  ];
  return {
    kit,
    bounds: { center: [0.6, 2.4, 0], radius: 7, points },
    state: () => ({
      cells: all.map((c) => ({ alleles: c.alleles, sex: c.sex, dominant: c.dominant })),
    }),
  };
}
