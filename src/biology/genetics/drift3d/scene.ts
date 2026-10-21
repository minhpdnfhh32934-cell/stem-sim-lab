/**
 * The genetic drift archipelago in 3D: one island per Wright–Fisher run of the lesson, on a calm
 * sea under the outdoor light. Each island holds its population (N / k figures, two allele beads
 * each on their antennae: A a cube, a a sphere), a band round its coast split exactly p : q, and a
 * numbered tag on the water in front. When the model fixes or loses A on an island, its grass
 * turns towards that allele's colour and the tag shows the allele left (■ A, ● a).
 *
 * `setTime` moves to another generation of the model's runs without rebuilding; `tick` plays the
 * illustrative idle hops. Besides the whole archipelago, the scene frames a close-up of each
 * island (`frames['island:<i>']`) and names its parts with callouts.
 */
import * as THREE from 'three';
import type { Bio3DScene, Callout, SceneKit, Vec3 } from '../../view3d/kit';
import { alleleToken } from '../hw3d/binding';
import { FIGURE_CLEARANCE, balancedCenter } from '../hw3d/layout';
import { herd } from '../hw3d/organisms';
import { plants } from '../hw3d/vegetation';
import {
  beadKeys,
  generationAt,
  islandAt,
  pairing,
  parseSelection,
  type DriftModel3D,
  type Fate,
} from './binding';
import type { DriftCallout } from './facts';
import { islandGround, pqBands, sea } from './island';
import {
  BAND_GAP,
  BAND_WIDTH,
  DRIFT_CLOSE_VIEW,
  DRIFT_VIEW,
  coastAt,
  coastMax,
  driftLayout,
  islandPlantCounts,
  islandPlants,
  islandPoints,
  subjectPoints,
  tagPoint,
} from './layout';

export interface DriftSceneInput {
  model: DriftModel3D;
}

/** Glyphs of the allele left on a fixed island (the beads' shapes: A a cube, a a sphere). */
export const FATE_GLYPH: Record<Fate, string> = { fixed: '■', lost: '●', polymorphic: '' };

/** What the scene draws now (read back from its meshes: tests compare it with the model). */
export interface DriftSceneState {
  generation: number;
  islands: number;
  /** Figures drawn on each island (the same on every island). */
  figures: number;
  per: number;
  /** Per island: A beads on its figures' antennae (read back from the figures shown). */
  beadsA: number[];
  /** Allele beads drawn in all (the two instanced bead meshes). */
  tips: { A: number; a: number };
  /** Per island: the p its band is split at, and the fate its grass is coloured for. */
  bands: number[];
  fates: Fate[];
  /** Per island: its tag's text. */
  tags: string[];
  /** A figure of the first island, each island's centre and the front of each band (world). */
  figurePoint: Vec3 | null;
  islandPoints: Vec3[];
  bandPoints: Vec3[];
}

export interface DriftScene extends Bio3DScene {
  state(): DriftSceneState;
}

/** The framing id of an island's close-up. */
export const islandFrame = (i: number) => `island:${String(i)}`;

export function buildDriftArchipelago(kit: SceneKit, input: DriftSceneInput): DriftScene {
  const { model } = input;
  const runs = model.runs.length;
  const L = driftLayout(runs, model.figures);
  const colors = { A: kit.color(alleleToken('A')), a: kit.color(alleleToken('a')) };
  const ground = islandGround(kit, L, colors);
  sea(kit, L.extent * 4 + 60, L);
  const bands = pqBands(kit, L, colors);
  const heightAt = (x: number, z: number) => ground.heightAt(x, z);
  plants(kit, islandPlants(L, islandPlantCounts(kit.tier)), heightAt);
  // One body colour for all: the model counts gene copies, not genotypes (data on the beads).
  const figures = herd(kit, L.slots, heightAt, [0, 0], kit.color('--bio3d-creature'));
  figures.body.name = 'drift-figures';

  // The sun's shadow camera over the whole archipelago (High tier on a discrete GPU).
  kit.groundShadows([0, 0, 0], L.extent);

  const tags = L.islands.map((is) => {
    const t = kit.label(String(is.index + 1), tagPoint(is), 'muted');
    t.element.classList.add('drift3d__tag');
    t.element.dataset.island = String(is.index + 1);
    return t;
  });
  const tagText = L.islands.map(() => '');

  // The picked island's ring on the water (the picked figure has the herd's own ring).
  const ringMat = kit.own(
    new THREE.MeshStandardMaterial({ color: kit.color('--m3d-highlight'), roughness: 0.4 }),
  );
  ringMat.emissive.set(kit.color('--m3d-highlight'));
  ringMat.emissiveIntensity = kit.hdr ? 3 : 1;
  ringMat.userData.bloom = kit.hdr;
  const pickRing = kit.mesh(
    kit.geometry(new THREE.RingGeometry(1, 1.06, Math.max(48, kit.seg * 4)).rotateX(-Math.PI / 2)),
    ringMat,
  );
  pickRing.name = 'drift-pick-island';
  pickRing.visible = false;
  pickRing.raycast = () => undefined;

  const keys = L.islands.map((is) => beadKeys(is.index, 2 * model.figures));
  const classes = new Uint8Array(runs * model.figures);
  const G = model.generations;
  let shown = -1;

  const show = (g: number) => {
    if (g === shown) return;
    for (let i = 0; i < runs; i++) {
      const x = islandAt(model, i, g);
      if (!x) continue;
      bands.set(i, x.p);
      ground.setFate(i, x.fate);
      classes.set(pairing(x.beads.A, model.figures, keys[i] ?? []), i * model.figures);
      const text = `${String(i + 1)}${FATE_GLYPH[x.fate] ? ` ${FATE_GLYPH[x.fate]}` : ''}`;
      const tag = tags[i];
      if (tag && tagText[i] !== text) {
        tagText[i] = text;
        tag.element.textContent = text;
        tag.element.dataset.fate = x.fate;
      }
    }
    figures.show(classes, false);
    shown = g;
  };
  show(0);

  const pts = subjectPoints(L);
  const center = balancedCenter(pts, DRIFT_VIEW);
  const radius = Math.max(
    1,
    ...pts.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2])),
  );
  // Haze only beyond the archipelago: the sea's far edge melts into the horizon colour.
  const horizon = kit.color('--bio3d-sky-horizon');
  if (/^#[0-9a-f]{3,6}$/i.test(horizon)) {
    const camera = radius * 2.6;
    kit.scene.fog = new THREE.Fog(horizon, camera + radius * 0.5, camera + radius * 3.5);
  }

  const frames = Object.fromEntries(
    L.islands.map((is) => {
      const p = islandPoints(is);
      const c = balancedCenter(p, DRIFT_CLOSE_VIEW);
      const r = Math.max(1, ...p.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2])));
      return [
        islandFrame(is.index),
        { bounds: { center: c, radius: r, points: p }, dir: DRIFT_CLOSE_VIEW },
      ];
    }),
  );

  // Name callouts: the island nearest the camera (or the picked one) and its parts; one island
  // where A is fixed and one where it is lost, when the generation shown has them.
  const proj = new THREE.Vector3();
  const at = new THREE.Vector3();
  let picked: number | null = null;
  let named = -1;
  let namedFigure = -1;
  const inView = (camera: THREE.Camera, p: Vec3) => {
    proj.set(p[0], p[1], p[2]).project(camera);
    return proj.z < 1 && Math.abs(proj.x) < 0.85 && Math.abs(proj.y) < 0.8;
  };
  const distance = (camera: THREE.Camera, p: Vec3) =>
    camera.position.distanceTo(at.set(p[0], p[1], p[2]));
  const islandTop = (i: number): Vec3 => {
    const is = L.islands[i];
    return is ? [is.x, ground.heightAt(is.x, is.z) + 0.2, is.z] : [0, 0, 0];
  };
  const onCoast = (i: number, angle: number, u: number, lift = 0.1): Vec3 => {
    const is = L.islands[i];
    if (!is) return [0, 0, 0];
    const r = u * coastAt(is, angle);
    const x = is.x + Math.cos(angle) * r;
    const z = is.z + Math.sin(angle) * r;
    return [x, ground.heightAt(x, z) + lift, z];
  };
  const onBand = (i: number, angle: number): Vec3 => {
    const is = L.islands[i];
    if (!is) return [0, 0, 0];
    const r = coastMax(is) + BAND_GAP + BAND_WIDTH / 2;
    return [is.x + Math.cos(angle) * r, 0.1, is.z + Math.sin(angle) * r];
  };
  const nearest = (camera: THREE.Camera, ok: (i: number) => boolean): number => {
    let best = -1;
    let d = Infinity;
    for (let i = 0; i < runs; i++) {
      if (!ok(i)) continue;
      const p = islandTop(i);
      if (!inView(camera, p)) continue;
      const e = distance(camera, p);
      if (e < d) {
        d = e;
        best = i;
      }
    }
    return best;
  };
  const meadowHull = (i: number): Vec3[] => {
    const is = L.islands[i];
    if (!is) return [];
    const out: Vec3[] = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const x = is.x + Math.cos(a) * is.meadow;
      const z = is.z + Math.sin(a) * is.meadow;
      out.push([x, 0.3, z], [x, 1.45, z]);
    }
    return out;
  };

  const callouts = (camera: THREE.Camera): Callout[] => {
    const fates = ground.fates();
    const i =
      picked !== null && inView(camera, islandTop(picked))
        ? picked
        : nearest(camera, (k) => fates[k] === 'polymorphic') >= 0
          ? nearest(camera, (k) => fates[k] === 'polymorphic')
          : nearest(camera, () => true);
    named = i;
    namedFigure = -1;
    const out: { id: DriftCallout; point: Vec3; color?: string }[] = [];
    if (i >= 0) {
      out.push({ id: 'island', point: onCoast(i, (3 * Math.PI) / 4, 0.9) });
      out.push({ id: 'band', point: onBand(i, Math.PI / 4), color: colors.A });
      // The figure of that island nearest the camera: its antennae carry its two gene copies.
      let best = -1;
      let d = Infinity;
      for (let s = i * model.figures; s < (i + 1) * model.figures; s++) {
        const p = figures.point(s);
        if (!p || !inView(camera, p)) continue;
        const e = distance(camera, p);
        if (e < d) {
          d = e;
          best = s;
        }
      }
      namedFigure = best;
      const tips = best >= 0 ? figures.tipPoint(best) : null;
      if (tips) out.push({ id: 'genes', point: tips });
      const body = best >= 0 ? figures.point(best) : null;
      if (body) out.push({ id: 'figure', point: body });
    }
    const fixed = nearest(camera, (k) => k !== i && fates[k] === 'fixed');
    if (fixed >= 0) out.push({ id: 'fixed', point: islandTop(fixed), color: colors.A });
    const lost = nearest(camera, (k) => k !== i && fates[k] === 'lost');
    if (lost >= 0) out.push({ id: 'lost', point: islandTop(lost), color: colors.a });
    return out;
  };

  return {
    kit,
    bounds: { center, radius, points: pts },
    frames,
    callouts,
    // A name never covers the named island's figures (nor, close up, the named figure).
    calloutObstacles: () => {
      const avoid: Vec3[][] = [];
      if (named >= 0) avoid.push(meadowHull(named));
      const p = namedFigure >= 0 ? figures.point(namedFigure) : null;
      if (p) {
        const r = FIGURE_CLEARANCE / 2;
        avoid.push([
          [p[0] - r, p[1] - 0.4, p[2]],
          [p[0] + r, p[1] - 0.4, p[2]],
          [p[0], p[1] + 0.9, p[2]],
        ]);
      }
      return { avoid };
    },
    setTime(t) {
      show(generationAt(t, G));
    },
    tick(dt) {
      figures.tick(dt);
    },
    rest() {
      figures.rest();
    },
    pick(ray: THREE.Raycaster) {
      const f = figures.pick(ray);
      const g = ray.intersectObject(ground.mesh, false)[0];
      const b = ray.intersectObject(bands.mesh, false)[0];
      const land = [
        g ? { d: g.distance, i: ground.islandOfFace(g.faceIndex ?? -1) } : null,
        b ? { d: b.distance, i: bands.islandOfFace(b.faceIndex ?? -1) } : null,
      ]
        .filter((x): x is { d: number; i: number | null } => x !== null && x.i !== null)
        .sort((x, y) => x.d - y.d)[0];
      if (f && (!land || f.distance <= land.d + 1e-6)) return `figure:${String(f.slot)}`;
      return land && land.i !== null ? `island:${String(land.i)}` : null;
    },
    select(id) {
      const s = parseSelection(id);
      figures.select(s?.kind === 'figure' ? s.slot : null);
      picked =
        s?.kind === 'island'
          ? s.island
          : s?.kind === 'figure'
            ? Math.floor(s.slot / Math.max(1, model.figures))
            : null;
      const is = s?.kind === 'island' ? L.islands[s.island] : undefined;
      pickRing.visible = !!is;
      if (is) {
        const r = coastMax(is) + BAND_GAP + BAND_WIDTH + 0.3;
        pickRing.position.set(is.x, 0.04, is.z);
        pickRing.scale.set(r, 1, r);
      }
    },
    state: () => {
      const cls = figures.classes();
      const beadsA = L.islands.map((_, i) => {
        let n = 0;
        for (let s = i * model.figures; s < (i + 1) * model.figures && s < cls.length; s++)
          n += 2 - (cls[s] ?? 0);
        return n;
      });
      const count = (name: string) => {
        const m = kit.scene.getObjectByName(name);
        return m instanceof THREE.InstancedMesh ? m.count : 0;
      };
      return {
        generation: shown,
        islands: runs,
        figures: model.figures,
        per: model.per,
        beadsA,
        tips: { A: count('hw-allele-A'), a: count('hw-allele-a') },
        bands: [...bands.shown()],
        fates: [...ground.fates()],
        tags: [...tagText],
        figurePoint: figures.point(0),
        islandPoints: L.islands.map((_, i) => islandTop(i)),
        bandPoints: L.islands.map((_, i) => onBand(i, Math.PI / 2)),
      };
    },
  };
}
