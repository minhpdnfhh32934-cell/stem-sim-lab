/**
 * The predator–prey habitat in 3D: a meadow on procedural terrain under the outdoor light, its
 * plants and clover, the two species at time t (prey and predators mingling on one spiral, in
 * the 2D time chart's colours), the two columns x(t), y(t) on one scale with rings at x* and y*
 * and rate arrows, and the phase-plane board behind the meadow with the orbit and the moment's
 * bead. `setTime` moves to the computed sample nearest t without rebuilding; `tick` plays the
 * illustrative idle motion and newcomers growing in. Name callouts: a prey, a predator and the
 * clover (the columns and the board carry their own labels). Frames: 'closeup' ("Cận cảnh đàn")
 * and one per pick keyed by its selection id (`prey:<slot>`, `predator:<slot>`, 'columns',
 * 'board'), so a tap moves in on what it picked.
 */
import * as THREE from 'three';
import type { Bio3DScene, Callout, SceneFrame, SceneKit, Vec3 } from '../../view3d/kit';
import { habitat } from '../../view3d/primitives/habitat';
import { FIGURE_CLEARANCE, balancedCenter, plantCounts } from '../../genetics/hw3d/layout';
import { plants } from '../../genetics/hw3d/vegetation';
import { cloverGeometry } from '../logistic3d/meadow';
import {
  PREDATOR_TOKEN,
  PREY_TOKEN,
  momentAt,
  parseSelection,
  selectionId,
  type LvModel3D,
  type LvMoment,
} from './binding';
import { board, type BoardTexts } from './board';
import { columns, type ColumnsTexts } from './columns';
import type { LvCallout } from './facts';
import {
  LV_CLOSE_VIEW,
  LV_PICK_VIEW,
  LV_VIEW,
  boardPoints,
  boardView,
  closeupPoints,
  cloverCount,
  columnsPoints,
  figurePoints,
  lvLayout,
  lvPlants,
  subjectPoints,
} from './layout';
import { animals } from './organisms';

export interface LvSceneInput {
  model: LvModel3D;
  texts: { columns: ColumnsTexts; board: BoardTexts };
}

/** What the scene draws now (read back from its meshes: tests compare it with the model). */
export interface LvSceneState {
  /** The computed sample shown, its time and values. */
  k: number;
  t: number;
  x: number;
  y: number;
  drawn: { prey: number; predators: number };
  per: number;
  slots: { prey: number; predators: number };
  /** The liquids' heights and the columns' full scale (world units). */
  fill: { prey: number; predators: number };
  column: number;
  /** Signed arrow lengths (world units, 0: hidden). */
  arrow: { prey: number; predators: number };
  /** The bead on the board (shares of its axes) and the equilibrium marker. */
  bead: [number, number];
  equilibrium: [number, number];
  /** The front-most prey and predator, the prey liquid's surface, the bead (world). */
  preyPoint: Vec3 | null;
  predatorPoint: Vec3 | null;
  columnsPoint: Vec3;
  boardPoint: Vec3;
  /** Newcomers still growing in, or leavers shrinking. */
  settling: boolean;
}

export interface LvScene extends Bio3DScene {
  state(): LvSceneState;
}

export function buildLvHabitat(kit: SceneKit, input: LvSceneInput): LvScene {
  const { model } = input;
  const L = lvLayout(model.slots.prey, model.slots.predators, cloverCount(kit.tier));
  const land = habitat(kit, {
    radius: L.habitatR,
    seed: 9,
    relief: Math.min(1.1, L.habitatR * 0.022),
  });
  const heightAt = (x: number, z: number) => land.heightAt(x, z);
  plants(kit, lvPlants(L, plantCounts(kit.tier)), heightAt);

  // Clover all over the meadow, always lush: the model gives the prey unlimited food.
  const col = (name: string) => new THREE.Color(kit.color(name));
  const cloverMat = kit.shared(
    'lv-clover-mat',
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        flatShading: true,
        roughness: 0.88,
        envMapIntensity: 0.4,
      }),
  );
  const clover = kit.instanced(
    kit.geometry(
      cloverGeometry(
        col('--bio3d-island-grass'),
        col('--bio3d-island-grass-2'),
        col('--bio3d-sand'),
      ),
    ),
    cloverMat,
    L.clover.length,
  );
  clover.name = 'lv-clover';
  clover.receiveShadow = kit.shadows;
  clover.raycast = () => undefined;
  const cm = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  L.clover.forEach((p, i) => {
    cm.compose(
      new THREE.Vector3(p.x, heightAt(p.x, p.z) - 0.02, p.z),
      new THREE.Quaternion().setFromAxisAngle(up, p.yaw),
      new THREE.Vector3(p.size, p.size, p.size),
    );
    clover.setMatrixAt(i, cm);
  });
  clover.instanceMatrix.needsUpdate = true;

  const herd = animals(kit, L, heightAt, {
    prey: kit.color(PREY_TOKEN),
    predators: kit.color(PREDATOR_TOKEN),
  });
  const tubes = columns(kit, model, L.columns, heightAt, input.texts.columns);
  const plot = board(kit, model, L.board, heightAt, input.texts.board);

  let now: LvMoment = momentAt(model, 0);
  let lastTick = -Infinity;
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const show = (t: number) => {
    now = momentAt(model, t);
    // Newcomers grow in while the scene is animating; a scrub while paused just swaps.
    const animate = clock() - lastTick < 250;
    herd.prey.show(now.shown.prey, animate);
    herd.predators.show(now.shown.predators, animate);
    tubes.set(now);
    plot.set(now);
  };
  show(0);

  const pts = subjectPoints(L);
  const center = balancedCenter(pts, LV_VIEW);
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

  // Close-ups (on the ground's relief): "Cận cảnh đàn" and one per pick, keyed by its id.
  const lift = (p: Vec3): Vec3 => [p[0], p[1] + heightAt(p[0], p[2]), p[2]];
  const framing = (points: Vec3[], dir: Vec3, onGround = true): SceneFrame => {
    const p = onGround ? points.map(lift) : points;
    const c = balancedCenter(p, dir);
    const r = Math.max(1, ...p.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2])));
    return { bounds: { center: c, radius: r, points: p }, dir };
  };
  const frames: Record<string, SceneFrame> = {
    closeup: framing(closeupPoints(L), LV_CLOSE_VIEW),
    columns: framing(columnsPoints(L), LV_CLOSE_VIEW),
    board: framing(boardPoints(L), boardView(L.board), false),
  };
  for (const kind of ['prey', 'predator'] as const) {
    const list = kind === 'prey' ? L.prey : L.predators;
    for (let i = 0; i < list.length; i++) {
      const id = selectionId({ kind, slot: i });
      if (id) frames[id] = framing(figurePoints(L, kind, i), LV_PICK_VIEW);
    }
  }

  // Name callouts: the drawn prey and predator nearest the camera in view (kept while they stay
  // about as near, so an orbit does not make a name jump), and a clover patch at the front.
  const proj = new THREE.Vector3();
  const at = new THREE.Vector3();
  const named = { prey: -1, predators: -1 };
  const inView = (camera: THREE.Camera, p: Vec3) => {
    proj.set(p[0], p[1], p[2]).project(camera);
    return proj.z < 1 && Math.abs(proj.x) < 0.8 && Math.abs(proj.y) < 0.75;
  };
  const distance = (camera: THREE.Camera, p: Vec3) =>
    camera.position.distanceTo(at.set(p[0], p[1], p[2]));
  const nearest = (camera: THREE.Camera, s: 'prey' | 'predators') => {
    const f = herd[s];
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < f.drawn(); i++) {
      const p = f.point(i);
      if (!p || !inView(camera, p)) continue;
      const d = distance(camera, p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const prev = named[s] >= 0 ? f.point(named[s]) : null;
    if (prev && inView(camera, prev) && distance(camera, prev) <= bestD * 1.2) best = named[s];
    named[s] = best;
    return f.point(best);
  };
  // The clover patch nearest the meadow's front-left (in view beside the crowd).
  let cloverAt: Vec3 | null = null;
  {
    let bestD = Infinity;
    const fx = L.meadow.x - L.meadow.r * 0.55;
    const fz = L.meadow.r * 0.7;
    for (const p of L.clover) {
      const d = Math.hypot(p.x - fx, p.z - fz);
      if (d < bestD) {
        bestD = d;
        cloverAt = [p.x, heightAt(p.x, p.z) + 0.25, p.z];
      }
    }
  }
  const callouts = (camera: THREE.Camera): Callout[] => {
    const out: { id: LvCallout; point: Vec3; color?: string }[] = [];
    const a = nearest(camera, 'prey');
    if (a) out.push({ id: 'prey', point: a, color: kit.color(PREY_TOKEN) });
    const b = nearest(camera, 'predators');
    if (b) out.push({ id: 'predator', point: b, color: kit.color(PREDATOR_TOKEN) });
    if (cloverAt) out.push({ id: 'clover', point: cloverAt });
    return out;
  };
  // The crowd seen whole (names stand beside it), the columns and the board: what callouts keep
  // clear of; the subjects' sides as tall regions so a leader never runs across another subject.
  const crowdHull: Vec3[] = [];
  const meadowSide: Vec3[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const x = L.meadow.x + Math.cos(a) * L.meadow.r;
    const z = L.meadow.z + Math.sin(a) * L.meadow.r;
    crowdHull.push([x, 0, z], [x, 1.3, z]);
    meadowSide.push([x, -6, z], [x, 12, z]);
  }
  const c = L.columns;
  const columnsSide: Vec3[] = [];
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const x = c.x + dx * (c.plinthRx + (dx > 0 ? 2 : 0.4));
    columnsSide.push([x, -6, c.z + dz * c.plinthRz], [x, c.tubeH + 6, c.z + dz * c.plinthRz]);
  }

  return {
    kit,
    bounds: { center, radius, points: pts },
    frames,
    callouts,
    calloutObstacles: (view) => {
      if (!view || !frames[view])
        return { avoid: [tubes.hull, plot.hull, crowdHull], regions: [meadowSide, columnsSide] };
      const r = FIGURE_CLEARANCE / 2;
      const figures: Vec3[][] = [];
      for (const s of ['prey', 'predators'] as const) {
        const p = named[s] >= 0 ? herd[s].point(named[s]) : null;
        if (p)
          figures.push([
            [p[0] - r, p[1] - 0.4, p[2]],
            [p[0] + r, p[1] - 0.4, p[2]],
            [p[0], p[1] + 1.1, p[2]],
          ]);
      }
      return { avoid: [tubes.hull, plot.hull, ...figures], regions: [meadowSide, columnsSide] };
    },
    setTime(t) {
      show(t);
    },
    tick(dt) {
      lastTick = clock();
      herd.prey.tick(dt);
      herd.predators.tick(dt);
    },
    rest() {
      lastTick = -Infinity;
      herd.prey.rest();
      herd.predators.rest();
    },
    pick(ray: THREE.Raycaster) {
      const hits: { id: string; d: number }[] = [];
      const a = herd.prey.pick(ray);
      if (a) hits.push({ id: `prey:${String(a.slot)}`, d: a.distance });
      const b = herd.predators.pick(ray);
      if (b) hits.push({ id: `predator:${String(b.slot)}`, d: b.distance });
      const g = ray.intersectObjects(tubes.pickables, false)[0];
      if (g) hits.push({ id: 'columns', d: g.distance });
      const h = ray.intersectObjects(plot.pickables, false)[0];
      if (h) hits.push({ id: 'board', d: h.distance });
      hits.sort((p, q) => p.d - q.d);
      return hits[0]?.id ?? null;
    },
    select(id) {
      const s = parseSelection(id);
      herd.prey.select(s?.kind === 'prey' ? s.slot : null);
      herd.predators.select(s?.kind === 'predator' ? s.slot : null);
      tubes.select(s?.kind === 'columns');
      plot.select(s?.kind === 'board');
      // A close-up of an animal frames the meadow: the columns' and the board's labels, off to
      // the side and maybe under the card, wait until the card closes.
      const animal = s?.kind === 'prey' || s?.kind === 'predator';
      tubes.showLabels(!animal && s?.kind !== 'board');
      plot.showLabels(!animal && s?.kind !== 'columns');
    },
    state: () => {
      const front = (f: (typeof herd)['prey']) => {
        let best = -1;
        let bz = -Infinity;
        for (let i = 0; i < f.drawn(); i++) {
          const p = f.point(i);
          if (p && p[2] > bz) {
            bz = p[2];
            best = i;
          }
        }
        return f.point(best);
      };
      return {
        k: now.k,
        t: now.t,
        x: now.x,
        y: now.y,
        drawn: { prey: herd.prey.drawn(), predators: herd.predators.drawn() },
        per: model.per,
        slots: { ...model.slots },
        fill: { prey: tubes.fillHeight('prey'), predators: tubes.fillHeight('predators') },
        column: tubes.height,
        arrow: { prey: tubes.arrowLength('prey'), predators: tubes.arrowLength('predators') },
        bead: plot.bead(),
        equilibrium: plot.equilibrium(),
        preyPoint: front(herd.prey),
        predatorPoint: front(herd.predators),
        columnsPoint: tubes.surfacePoint('prey'),
        boardPoint: plot.beadPoint(),
        settling: herd.prey.settling() || herd.predators.settling(),
      };
    },
  };
}
