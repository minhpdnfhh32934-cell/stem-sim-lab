/**
 * 3D scenes of the genetics lessons; every number is the lesson model's.
 *
 * - Drift: every Wright–Fisher run is a tube of its 2N gene copies (beads), copies of A filling
 *   it from the bottom: the fill level is the frequency of A at the generation shown, a full or
 *   empty tube a fixed or lost allele.
 * - Hardy–Weinberg: the population's individuals coloured by genotype, and its gene pool
 *   (2·AA + Aa copies of A, Aa + 2·aa of a) in a jar.
 * - Mendel: the Punnett square as a board of tiles coloured by phenotype, the gametes along its
 *   edges, and a bar per phenotype as tall as its exact probability.
 */
import * as THREE from 'three';
import { discPoints, type Bio3DScene, type SceneKit, type Vec3 } from '../view3d/kit';
import { figuresAt, ground } from '../view3d/creatures';
import { driftAt } from './genetics3d';

export interface DriftSceneInput {
  runs: number[][];
  /** Gene copies per population (2N). */
  copies: number;
  /** Gene copies one bead stands for. */
  per: number;
  texts: { tube: (k: number) => string };
}

/** Beads per layer in a tube: one in the middle, six around it. */
const RING = [
  [0, 0],
  ...Array.from({ length: 6 }, (_, i) => [
    Math.cos((i * Math.PI) / 3),
    Math.sin((i * Math.PI) / 3),
  ]),
] as const;

export function buildDriftScene(kit: SceneKit, input: DriftSceneInput): Bio3DScene {
  const { runs, per } = input;
  const n = Math.max(1, runs.length);
  const beadsPerTube = Math.max(1, Math.round(input.copies / per));
  const bead = 0.12;
  const pitch = 0.255;
  const layers = Math.ceil(beadsPerTube / RING.length);
  const tubeR = pitch + bead + 0.08;
  const H = layers * bead * 2.05 + 0.4;
  const cols = Math.min(n, 10);
  const rows = Math.ceil(n / cols);
  const dx = 1.15;
  const dz = 1.7;
  const centre = (k: number): Vec3 => {
    const r = Math.floor(k / cols);
    const c = k % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols;
    return [(c - (inRow - 1) / 2) * dx, 0, (r - (rows - 1) / 2) * dz];
  };
  const muted = kit.color('--text-muted');
  const glassMat = kit.glass(muted, {
    opacity: 0.07,
    side: THREE.DoubleSide,
    rim: { color: muted, strength: 0.6, alpha: 0.45 },
  });
  const baseMat = kit.solid(kit.color('--bg-panel-2'), { roughness: 0.8 });
  const rack = kit.mesh(kit.roundedBox(12), baseMat);
  const w = (cols * dx) / 2 + 0.5;
  const d = (rows * dz) / 2 + 0.3;
  rack.scale.set(w, 0.15, d);
  rack.position.y = -0.18;
  kit.shadow(-0.5, w + 0.8, d + 0.8, 0.22);
  for (let k = 0; k < n; k++) {
    const [x, , z] = centre(k);
    const tube = kit.mesh(kit.cylinder(Math.max(16, kit.seg), true), glassMat);
    tube.scale.set(tubeR, H, tubeR);
    tube.position.set(x, H / 2, z);
    kit.label(input.texts.tube(k), [x, -0.5, z + tubeR + 0.35], 'muted');
  }
  // Every bead place of every tube, bottom layer first (A fills the tube from the bottom).
  const slot = (k: number, i: number): Vec3 => {
    const [x, , z] = centre(k);
    const layer = Math.floor(i / RING.length);
    const [u, v] = RING[i % RING.length] ?? [0, 0];
    return [x + u * pitch, bead + layer * bead * 2.05, z + v * pitch];
  };
  const total = n * beadsPerTube;
  const mk = (token: string) =>
    kit.instanced(
      kit.sphere(0.5),
      kit.solid(kit.color(token), { roughness: 0.3, clearcoat: 0.6 }),
      total,
    );
  const beadsA = mk('--chart-1');
  const beadsa = mk('--chart-3');
  const m = new THREE.Matrix4();
  const put = (mesh: THREE.InstancedMesh, i: number, p: Vec3) => {
    m.makeScale(bead, bead, bead);
    m.setPosition(p[0], p[1], p[2]);
    mesh.setMatrixAt(i, m);
  };
  const top = H + 0.6;
  const pts: Vec3[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) pts.push([sx * w, -0.4, sz * (d + 0.4)], [sx * w, top, sz * d]);
  return {
    kit,
    bounds: { center: [0, H / 2, 0], radius: Math.hypot(w, H / 2, d), points: pts },
    setTime: (g) => {
      const now = driftAt(runs, g);
      let a = 0;
      let b = 0;
      now.p.forEach((p, k) => {
        // Copies of A in this population now (the model's count), drawn as beads.
        const nA = Math.max(0, Math.min(beadsPerTube, Math.round((p * input.copies) / per)));
        for (let i = 0; i < beadsPerTube; i++) {
          if (i < nA) put(beadsA, a++, slot(k, i));
          else put(beadsa, b++, slot(k, i));
        }
      });
      beadsA.count = a;
      beadsa.count = b;
      beadsA.visible = a > 0;
      beadsa.visible = b > 0;
      beadsA.instanceMatrix.needsUpdate = true;
      beadsa.instanceMatrix.needsUpdate = true;
    },
  };
}

export interface HwSceneInput {
  figures: { AA: number; Aa: number; aa: number };
  pool: { A: number; a: number };
  /** Gene copies one bead stands for. */
  perAllele: number;
  texts: { A: string; a: string; pool: string; AA: string; Aa: string; aa: string };
}

/** Seeded shuffle (Fisher–Yates) of a list, in place. */
function shuffle<T>(list: T[], seed: number): T[] {
  let s = 1 + seed * 7919;
  for (let k = list.length - 1; k > 0; k--) {
    s = (s * 16807) % 2147483647;
    const j = Math.floor((s / 2147483647) * (k + 1));
    const a = list[k];
    const b = list[j];
    if (a !== undefined && b !== undefined) {
      list[k] = b;
      list[j] = a;
    }
  }
  return list;
}

export function buildHwScene(kit: SceneKit, input: HwSceneInput): Bio3DScene {
  const { AA, Aa, aa } = input.figures;
  const total = AA + Aa + aa;
  const R = Math.max(5, Math.sqrt(Math.max(1, total)) * 0.9);
  ground(kit, R + 1.2, kit.color('--bio3d-ground'));
  // One shuffled order of places: the genotypes are mixed, not grouped.
  const pts = shuffle(discPoints(total, R, 0, 3), 41);
  let at = 0;
  for (const [count, token, seed] of [
    [AA, '--chart-1', 1],
    [Aa, '--chart-2', 2],
    [aa, '--chart-3', 3],
  ] as [number, string, number][]) {
    figuresAt(kit, pts.slice(at, at + count), {
      color: kit.color(token),
      kind: 'small',
      size: 0.85,
      seed,
    });
    at += count;
  }
  kit.label(input.texts.AA, [-R * 0.6, 0.5, R + 2], 'plain');
  kit.label(input.texts.Aa, [0, 0.5, R + 2], 'plain');
  kit.label(input.texts.aa, [R * 0.6, 0.5, R + 2], 'plain');

  // Gene pool jar beside the population: A and a beads mixed, counts exact (or per bead).
  const jarR = R * 0.42;
  const jarX = R + jarR + 3;
  const beadsA = Math.round(input.pool.A / input.perAllele);
  const beadsa = Math.round(input.pool.a / input.perAllele);
  const beadCount = beadsA + beadsa;
  const beadR = jarR * 0.075;
  const inner = jarR - 2 * beadR;
  const perLayer = Math.max(1, Math.floor((Math.PI * inner * inner) / (2.4 * beadR) ** 2));
  const layers = Math.max(1, Math.ceil(beadCount / perLayer));
  const jarH = Math.max(jarR, layers * beadR * 2.25 + 2 * beadR);
  const muted = kit.color('--text-muted');
  const jar = kit.mesh(
    kit.cylinder(Math.max(24, kit.seg * 2), true),
    kit.glass(muted, {
      opacity: 0.06,
      side: THREE.DoubleSide,
      rim: { color: muted, strength: 0.6, alpha: 0.45 },
    }),
  );
  jar.scale.set(jarR, jarH, jarR);
  jar.position.set(jarX, jarH / 2, 0);
  kit.shadow(-0.4, jarR * 1.4, jarR * 1.4, 0.25);
  const layerPts = discPoints(perLayer, inner, 0, 9);
  const places: Vec3[] = [];
  for (let i = 0; i < beadCount; i++) {
    const p = layerPts[i % perLayer] ?? [0, 0, 0];
    const layer = Math.floor(i / perLayer);
    places.push([jarX + p[0], beadR + layer * beadR * 2.25, p[2]]);
  }
  const order = shuffle(
    places.map((_, i) => i),
    17,
  );
  const bead = (n: number, offset: number, token: string) => {
    const mesh = kit.instanced(
      kit.sphere(0.5),
      kit.solid(kit.color(token), { roughness: 0.3, clearcoat: 0.6 }),
      n,
    );
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const p = places[order[offset + i] ?? 0] ?? [0, 0, 0];
      m.makeScale(beadR, beadR, beadR);
      m.setPosition(p[0], p[1], p[2]);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = n > 0;
  };
  bead(beadsA, 0, '--chart-1');
  bead(beadsa, beadsA, '--chart-3');
  kit.label(input.texts.pool, [jarX, jarH + 3, 0], 'strong');
  kit.label(input.texts.A, [jarX - jarR * 0.55, -0.4, jarR + 2.2], 'plain');
  kit.label(input.texts.a, [jarX + jarR * 0.55, -0.4, jarR + 4.2], 'plain');
  const left = -R - 1.5;
  const right = jarX + jarR + 1;
  const top = Math.max(jarH + 2.6, 4);
  const pts3: Vec3[] = [];
  for (const x of [left, right])
    for (const z of [-R - 1.5, R + 3.5]) pts3.push([x, 0, z], [x, top, z]);
  return {
    kit,
    bounds: {
      center: [(left + right) / 2, top / 3, 0.8],
      radius: Math.hypot((right - left) / 2, R + 2),
      points: pts3,
    },
  };
}

export interface MendelSceneInput {
  rows: string[];
  cols: string[];
  cells: string[][];
  /** Phenotype class (0…4) of each cell, as the Punnett table colours it. */
  hue: number[][];
  bars: { key: string; count: string; probability: number; hue: number }[];
  texts: { female: string; male: string };
}

/** The Punnett table's colours, in the same order (bio.css .punnett-cell--n). */
const HUE_TOKEN = ['--chart-1', '--chart-2', '--chart-3', '--chart-5', '--chart-6'];

export function buildMendelScene(kit: SceneKit, input: MendelSceneInput): Bio3DScene {
  const n = input.rows.length;
  const mCols = input.cols.length;
  const tile = 2;
  const gap = 0.22;
  const step = tile + gap;
  // Tiles: columns along x, rows along z (the first row at the back, like the table's top).
  const x0 = -((mCols - 1) * step) / 2;
  const z0 = -((n - 1) * step) / 2;
  const hueMat = (h: number) =>
    kit.solid(kit.color(HUE_TOKEN[h % HUE_TOKEN.length] ?? '--chart-1'), {
      roughness: 0.5,
      clearcoat: 0.3,
    });
  const board = kit.mesh(
    kit.roundedBox(12),
    kit.solid(kit.color('--bg-panel-2'), { roughness: 0.8 }),
  );
  const bw = ((mCols + 1) * step) / 2 + 0.3;
  const bd = ((n + 1) * step) / 2 + 0.3;
  board.scale.set(bw, 0.12, bd);
  board.position.set(
    x0 - step / 2 + ((mCols - 1) * step) / 2,
    -0.2,
    z0 - step / 2 + ((n - 1) * step) / 2,
  );
  kit.shadow(-0.5, bw + 1, bd + 1, 0.2);
  input.cells.forEach((row, i) => {
    row.forEach((genotype, j) => {
      const t = kit.mesh(kit.roundedBox(10), hueMat(input.hue[i]?.[j] ?? 0));
      t.scale.set(tile / 2, 0.18, tile / 2);
      t.position.set(x0 + j * step, 0.1, z0 + i * step);
      kit.label(genotype, [x0 + j * step, 0.35, z0 + i * step], 'plain');
    });
  });
  // Gametes: spheres along the left edge (♀, rows) and the back edge (♂, columns).
  const gameteMat = kit.solid(kit.color('--text-muted'), { roughness: 0.35, clearcoat: 0.5 });
  const gamete = (g: string, x: number, z: number) => {
    const s = kit.mesh(kit.sphere(), gameteMat);
    s.scale.setScalar(0.45);
    s.position.set(x, 0.45, z);
    kit.label(g, [x, 1.25, z], 'strong');
  };
  input.rows.forEach((g, i) => {
    gamete(g, x0 - step, z0 + i * step);
  });
  input.cols.forEach((g, j) => {
    gamete(g, x0 + j * step, z0 - step);
  });
  kit.label(`${input.texts.female} \\ ${input.texts.male}`, [x0 - step, 1.25, z0 - step], 'muted');

  // Bars: one per phenotype, height ∝ exact probability; the count on top, the class below.
  const H = Math.max(4, n * step * 0.75);
  const bx0 = x0 + mCols * step + 1.6;
  input.bars.forEach((b, k) => {
    const bar = kit.mesh(kit.roundedBox(10), hueMat(b.hue));
    const h = Math.max(0.06, b.probability * H);
    const x = bx0 + k * 2;
    bar.scale.set(0.7, h / 2, 0.7);
    bar.position.set(x, h / 2, 0);
    kit.label(b.count, [x, h + 0.7, 0], 'strong');
    kit.label(b.key, [x, -0.5, 1.6], 'plain');
  });
  const right = bx0 + Math.max(1, input.bars.length) * 2 - 0.8;
  const left = x0 - step - 0.8;
  const back = z0 - step - 0.6;
  const front = z0 + n * step + 0.6;
  const pts: Vec3[] = [];
  for (const x of [left, right]) for (const z of [back, front]) pts.push([x, -0.3, z], [x, 1.4, z]);
  pts.push([right, H + 1.2, 0], [bx0, H + 1.2, 0]);
  return {
    kit,
    bounds: {
      center: [(left + right) / 2, H / 4, (back + front) / 2],
      radius: Math.hypot((right - left) / 2, (front - back) / 2),
      points: pts,
    },
  };
}
