/**
 * The Hardy–Weinberg habitat in 3D: a meadow on procedural terrain under the outdoor light, its
 * plants, the population of one generation (one creature per drawn slot, coloured by genotype,
 * two allele beads on its antennae) and the gene pool jar with its p / q dial. `setTime` moves
 * to another generation of the model's run without rebuilding; `tick` plays the illustrative
 * idle motion and the hatching of a new generation. Besides the whole subject, the scene frames
 * a close-up (`frames.closeup`: a few figures beside the jar) and names its parts with callouts
 * (one figure of each genotype, the antennae, the jar's beads, the p / q ring).
 */
import * as THREE from 'three';
import type { Bio3DScene, Callout, SceneKit, Vec3 } from '../../view3d/kit';
import { habitat } from '../../view3d/primitives/habitat';
import {
  GENOTYPES,
  generationAt,
  genotypeToken,
  parseSelection,
  slotClasses,
  slotKeys,
  type Allele,
  type Genotype,
  type HwModel3D,
} from './binding';
import { genePool } from './genePool';
import type { HwCallout } from './facts';
import {
  FIGURE_CLEARANCE,
  HW_CLOSE_VIEW,
  HW_VIEW,
  balancedCenter,
  closeupPoints,
  hwLayout,
  plantCounts,
  plantPlaces,
  subjectPoints,
} from './layout';
import { herd } from './organisms';
import { plants } from './vegetation';

export interface HwSceneInput {
  model: HwModel3D;
  texts: {
    /** The gene pool's name (first line of its label in front of the plinth). */
    pool: string;
    /** Per generation: the dial's label (copies of A and p, copies of a and q; two lines). */
    dial: readonly string[];
  };
}

/** What the scene draws now (read back from its meshes: end-to-end tests compare the model). */
export interface HwSceneState {
  generation: number;
  drawn: Record<Genotype, number>;
  beads: Record<Allele, number>;
  per: number;
  perBead: number;
  /** A figure near the middle of the meadow and the plinth's top centre (world). */
  figurePoint: Vec3 | null;
  poolPoint: Vec3;
  /** The generation's figures are still hatching (growing in). */
  hatching: boolean;
}

export interface HwScene extends Bio3DScene {
  state(): HwSceneState;
}

export function buildHwHabitat(kit: SceneKit, input: HwSceneInput): HwScene {
  const { model } = input;
  const L = hwLayout(model.slots, model.beadSlots);
  const { pool } = L;
  const land = habitat(kit, {
    radius: L.habitatR,
    seed: 4,
    relief: Math.min(1.2, L.habitatR * 0.025),
  });
  const heightAt = (x: number, z: number) => land.heightAt(x, z);
  plants(kit, plantPlaces(L, plantCounts(kit.tier)), heightAt);
  const figures = herd(kit, L.slots, heightAt, [pool.x, pool.z]);
  const jar = genePool(kit, model, pool, heightAt);

  // Which genotype each slot shows, per generation (the mix is illustration, the counts exact).
  const classes = model.generations.map((gen) =>
    slotClasses([gen.figures.AA, gen.figures.Aa, gen.figures.aa], slotKeys(model.slots, gen.g)),
  );
  // One label in front of the plinth (in the picture in both framings): the gene pool's name,
  // then A and p over a and q.
  const dial = kit.label('', [pool.x, jar.top, pool.z + pool.plinthR + 0.9]);
  dial.name = 'hw-dial-label';
  dial.element.classList.add('hw3d__dial-label');
  const poolName = document.createElement('strong');
  poolName.className = 'hw3d__dial-title';
  poolName.textContent = input.texts.pool;
  const dialText = document.createElement('span');
  dialText.className = 'hw3d__dial-text';
  dial.element.replaceChildren(poolName, dialText);

  const last = model.generations.length - 1;
  let shown = -1;
  let lastTick = -Infinity;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const show = (g: number) => {
    if (g === shown) return;
    // A new generation hatches while the scene is animating; a scrub while paused just swaps.
    const live = now() - lastTick < 250;
    figures.show(classes[g] ?? new Uint8Array(0), live && shown >= 0);
    jar.show(g);
    dialText.textContent = input.texts.dial[g] ?? '';
    shown = g;
  };
  show(0);

  const pts = subjectPoints(L);
  const center = balancedCenter(pts, HW_VIEW);
  const radius = Math.max(
    1,
    ...pts.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2])),
  );

  // Haze only beyond the subject: the terrain's far edge melts into the sky's horizon colour.
  const horizon = kit.color('--bio3d-sky-horizon');
  if (/^#[0-9a-f]{3,6}$/i.test(horizon)) {
    const camera = radius * 2.6;
    kit.scene.fog = new THREE.Fog(horizon, camera + radius * 0.6, camera + L.habitatR * 1.25);
  }

  // The close-up: figures every generation draws (the fewest slots any generation fills) beside
  // the jar, seen lower and nearer.
  const fewest = Math.min(
    ...model.generations.map((gen) => gen.figures.AA + gen.figures.Aa + gen.figures.aa),
  );
  const closePts = closeupPoints(L, fewest);
  const closeCenter = balancedCenter(closePts, HW_CLOSE_VIEW);
  const closeRadius = Math.max(
    1,
    ...closePts.map((p) =>
      Math.hypot(p[0] - closeCenter[0], p[1] - closeCenter[1], p[2] - closeCenter[2]),
    ),
  );

  // Name callouts: one figure of each genotype (the nearest in view; the same one while it stays
  // about as near, so an orbit does not make the names jump), its antennae, the beads, the ring.
  const genotypeColor = GENOTYPES.map((g) => kit.color(genotypeToken(g)));
  const proj = new THREE.Vector3();
  const at = new THREE.Vector3();
  /** Slot named per genotype index (−1: none). */
  const named = [-1, -1, -1];
  const inView = (camera: THREE.Camera, p: Vec3) => {
    proj.set(p[0], p[1], p[2]).project(camera);
    return proj.z < 1 && Math.abs(proj.x) < 0.8 && Math.abs(proj.y) < 0.75;
  };
  const distance = (camera: THREE.Camera, p: Vec3) =>
    camera.position.distanceTo(at.set(p[0], p[1], p[2]));
  /** A named figure's body and head (a name never covers the figure it names). */
  const figureHull = (p: Vec3): Vec3[] => {
    const r = FIGURE_CLEARANCE / 4;
    return [
      [p[0] - r, p[1] - 0.4, p[2]],
      [p[0] + r, p[1] - 0.4, p[2]],
      [p[0], p[1] + 0.35, p[2]],
    ];
  };
  // The two subjects' sides as tall columns: a leader never runs from the meadow across the
  // jar's side of the picture, or from the jar across the meadow's.
  const column = (x: number, z: number): Vec3[] => [
    [x, -6, z],
    [x, 10, z],
  ];
  const meadowSide: Vec3[] = [];
  const herdHull: Vec3[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const x = L.meadow.x + Math.cos(a) * L.meadow.r;
    const z = L.meadow.z + Math.sin(a) * L.meadow.r;
    meadowSide.push(...column(x, z));
    herdHull.push([x, 0, z], [x, 1.45, z]);
  }
  const poolSide: Vec3[] = [
    ...column(pool.x - pool.plinthR, pool.z - pool.plinthR),
    ...column(pool.x + pool.plinthR, pool.z + pool.plinthR),
    ...column(pool.x - pool.plinthR, pool.z + pool.plinthR),
    ...column(pool.x + pool.plinthR, pool.z - pool.plinthR),
  ];

  const callouts = (camera: THREE.Camera): Callout[] => {
    const cls = figures.classes();
    const best = [-1, -1, -1];
    const bestD = [Infinity, Infinity, Infinity];
    for (let i = 0; i < cls.length; i++) {
      const p = figures.point(i);
      const c = cls[i] ?? 0;
      if (!p || !inView(camera, p)) continue;
      const d = distance(camera, p);
      if (d < (bestD[c] ?? Infinity)) {
        bestD[c] = d;
        best[c] = i;
      }
    }
    for (let c = 0; c < 3; c++) {
      const prev = named[c] ?? -1;
      const p = prev >= 0 && cls[prev] === c ? figures.point(prev) : null;
      if (p && inView(camera, p) && distance(camera, p) <= (bestD[c] ?? Infinity) * 1.2)
        best[c] = prev;
      named[c] = best[c] ?? -1;
    }
    const out: { id: HwCallout; point: Vec3; color?: string }[] = [];
    // The antennae on the Aa figure (one cube, one sphere), else on another named one.
    const withTips = [best[1], best[0], best[2]].find((x) => x !== undefined && x >= 0);
    const tips = withTips === undefined ? null : figures.tipPoint(withTips);
    if (tips) out.push({ id: 'antennae', point: tips });
    GENOTYPES.forEach((g, c) => {
      const p = figures.point(best[c] ?? -1);
      const color = genotypeColor[c];
      if (p) out.push({ id: g, point: p, ...(color ? { color } : {}) });
    });
    const beads = jar.beadsPoint();
    if (beads) out.push({ id: 'beads', point: beads });
    const ring = jar.dialPoint();
    if (ring) out.push({ id: 'dial', point: ring });
    return out;
  };

  return {
    kit,
    bounds: { center, radius, points: pts },
    frames: {
      closeup: {
        bounds: { center: closeCenter, radius: closeRadius, points: closePts },
        dir: HW_CLOSE_VIEW,
      },
    },
    callouts,
    // A name never covers the jar, nor the herd seen whole (the names stand beside it) or, up
    // close where the herd fills the picture, the figures it names; a leader stays on its own
    // subject's side.
    calloutObstacles: (view) => ({
      avoid: [
        jar.hull,
        ...(view === 'closeup'
          ? named.flatMap((slot) => {
              const p = slot >= 0 ? figures.point(slot) : null;
              return p ? [figureHull(p)] : [];
            })
          : [herdHull]),
      ],
      regions: [meadowSide, poolSide],
    }),
    setTime(t) {
      show(generationAt(t, last));
    },
    tick(dt) {
      lastTick = now();
      figures.tick(dt);
    },
    rest() {
      lastTick = -Infinity;
      figures.rest();
    },
    pick(ray: THREE.Raycaster) {
      const a = figures.pick(ray);
      const b = ray.intersectObjects(jar.pickables, false)[0];
      if (b && (!a || b.distance < a.distance)) return 'pool';
      return a ? `figure:${String(a.slot)}` : null;
    },
    select(id) {
      const s = parseSelection(id);
      figures.select(s?.kind === 'figure' ? s.slot : null);
      jar.select(s?.kind === 'pool');
    },
    state: () => ({
      generation: shown,
      drawn: figures.drawn(),
      beads: jar.drawn(),
      per: model.per,
      perBead: model.perBead,
      figurePoint: figures.point(0),
      poolPoint: [pool.x, jar.top, pool.z],
      hatching: figures.hatching(),
    }),
  };
}
