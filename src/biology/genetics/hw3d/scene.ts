/**
 * The Hardy–Weinberg habitat in 3D: a meadow on procedural terrain under the outdoor light, its
 * plants, the population of one generation (one creature per drawn slot, coloured by genotype,
 * two allele beads on its antennae) and the gene pool jar with its p / q dial. `setTime` moves
 * to another generation of the model's run without rebuilding; `tick` plays the illustrative
 * idle motion and the hatching of a new generation.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit, Vec3 } from '../../view3d/kit';
import { habitat } from '../../view3d/primitives/habitat';
import {
  generationAt,
  parseSelection,
  slotClasses,
  slotKeys,
  type Allele,
  type Genotype,
  type HwModel3D,
} from './binding';
import { genePool } from './genePool';
import {
  HW_VIEW,
  balancedCenter,
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
    /** Title over the jar. */
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
  const title = kit.label(input.texts.pool, [pool.x, jar.jarTop + 1.1, pool.z], 'strong');
  title.name = 'hw-pool-title';
  // One two-line label in front of the dial: A and p over a and q.
  const dial = kit.label('', [pool.x, jar.top, pool.z + pool.plinthR + 0.9]);
  dial.name = 'hw-dial-label';
  dial.element.classList.add('hw3d__dial-label');

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
    dial.element.textContent = input.texts.dial[g] ?? '';
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

  return {
    kit,
    bounds: { center, radius, points: pts },
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
