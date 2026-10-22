/**
 * The logistic-growth habitat in 3D: a meadow on procedural terrain under the outdoor light, its
 * plants, a low fence round the room for K individuals, clover patches inside it, the population
 * at time t (one grazer per drawn slot, in the N(t) curve's colour) and the gauge column with its
 * K and K/2 rings and the dN/dt arrow. `setTime` moves to another moment of the exact solution
 * without rebuilding; `tick` plays the illustrative idle motion and newcomers growing in. Name
 * callouts: a figure, the fence and the clover (the column carries its own labels). Besides the
 * whole subject, the scene frames close-ups (`frames`): 'closeup' ("Cận cảnh đàn": the meadow
 * from its centre to the fence facing the camera) and one per pick, keyed by its selection id
 * (`figure:<slot>`, 'gauge', 'food'), so a tap moves in on what it picked.
 */
import * as THREE from 'three';
import type { Bio3DScene, Callout, SceneFrame, SceneKit, Vec3 } from '../../view3d/kit';
import { habitat } from '../../view3d/primitives/habitat';
import { FIGURE_CLEARANCE, balancedCenter, plantCounts } from '../../genetics/hw3d/layout';
import { plants } from '../../genetics/hw3d/vegetation';
import {
  CAPACITY_TOKEN,
  POPULATION_TOKEN,
  grazedPatches,
  momentAt,
  parseSelection,
  selectionId,
  type LogisticModel3D,
  type LogisticMoment,
} from './binding';
import type { LogiCallout } from './facts';
import { gauge, type GaugeTexts } from './gauge';
import {
  LOGI_CLOSE_VIEW,
  LOGI_PICK_VIEW,
  LOGI_VIEW,
  closeupPoints,
  figurePoints,
  foodCount,
  foodPoints,
  gaugePoints,
  logiLayout,
  logiPlants,
  subjectPoints,
} from './layout';
import { meadow } from './meadow';
import { flock } from './organisms';

export interface LogiSceneInput {
  model: LogisticModel3D;
  texts: GaugeTexts;
}

/** What the scene draws now (read back from its meshes: end-to-end tests compare the model). */
export interface LogiSceneState {
  t: number;
  N: number;
  /** Figures standing now. */
  drawn: number;
  per: number;
  /** Slots of the run and the fence's slots. */
  slots: number;
  kSlots: number;
  /** The column's liquid height and full scale (world units). */
  fill: number;
  column: number;
  /** The arrow's signed length (world units, 0: hidden). */
  arrow: number;
  food: { lush: number; grazed: number };
  /** A figure near the crowd's front, the column's liquid surface, a lush clover patch (world). */
  figurePoint: Vec3 | null;
  gaugePoint: Vec3;
  foodPoint: Vec3 | null;
  /** Newcomers still growing in, or leavers shrinking. */
  settling: boolean;
}

export interface LogiScene extends Bio3DScene {
  state(): LogiSceneState;
}

export function buildLogisticHabitat(kit: SceneKit, input: LogiSceneInput): LogiScene {
  const { model } = input;
  const L = logiLayout(model.slots, model.kSlots, foodCount(kit.tier));
  const land = habitat(kit, {
    radius: L.habitatR,
    seed: 7,
    relief: Math.min(1.1, L.habitatR * 0.022),
  });
  const heightAt = (x: number, z: number) => land.heightAt(x, z);
  plants(kit, logiPlants(L, plantCounts(kit.tier)), heightAt);
  const field = meadow(kit, L, heightAt);
  const figures = flock(kit, L.slots, heightAt, kit.color(POPULATION_TOKEN));
  const column = gauge(kit, model, L.gauge, heightAt, input.texts);

  let now: LogisticMoment = momentAt(model, 0);
  let lastTick = -Infinity;
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const show = (t: number) => {
    now = momentAt(model, t);
    // Newcomers grow in while the scene is animating; a scrub while paused just swaps.
    figures.show(now.shown, clock() - lastTick < 250);
    column.set(now);
    field.setGrazed(grazedPatches(L.food.length, now.ratio));
  };
  show(0);

  const pts = subjectPoints(L);
  const center = balancedCenter(pts, LOGI_VIEW);
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
  const framing = (points: Vec3[], dir: Vec3): SceneFrame => {
    const p = points.map(lift);
    const c = balancedCenter(p, dir);
    const r = Math.max(1, ...p.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2])));
    return { bounds: { center: c, radius: r, points: p }, dir };
  };
  const frames: Record<string, SceneFrame> = {
    closeup: framing(closeupPoints(L), LOGI_CLOSE_VIEW),
    food: framing(foodPoints(L), LOGI_VIEW),
    gauge: framing(gaugePoints(L), LOGI_CLOSE_VIEW),
  };
  for (let i = 0; i < L.slots.length; i++) {
    const id = selectionId({ kind: 'figure', slot: i });
    if (id) frames[id] = framing(figurePoints(L, i), LOGI_PICK_VIEW);
  }

  // Name callouts: the drawn figure nearest the camera in view (kept while it stays about as
  // near, so an orbit does not make the name jump), the fence's front and a lush clover patch.
  // The column names itself (its title, K and K/2, N and dN/dt beside the arrow).
  const proj = new THREE.Vector3();
  const at = new THREE.Vector3();
  let named = -1;
  const inView = (camera: THREE.Camera, p: Vec3) => {
    proj.set(p[0], p[1], p[2]).project(camera);
    return proj.z < 1 && Math.abs(proj.x) < 0.8 && Math.abs(proj.y) < 0.75;
  };
  const distance = (camera: THREE.Camera, p: Vec3) =>
    camera.position.distanceTo(at.set(p[0], p[1], p[2]));
  const popColor = kit.color(POPULATION_TOKEN);
  const kColor = kit.color(CAPACITY_TOKEN);
  const callouts = (camera: THREE.Camera): Callout[] => {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < figures.drawn(); i++) {
      const p = figures.point(i);
      if (!p || !inView(camera, p)) continue;
      const d = distance(camera, p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const prev = named >= 0 ? figures.point(named) : null;
    if (prev && inView(camera, prev) && distance(camera, prev) <= bestD * 1.2) best = named;
    named = best;
    const out: { id: LogiCallout; point: Vec3; color?: string }[] = [];
    const fp = figures.point(best);
    if (fp) out.push({ id: 'figure', point: fp, color: popColor });
    out.push({ id: 'fence', point: field.fencePoint(), color: kColor });
    const food = field.foodPoint();
    if (food) out.push({ id: 'food', point: food });
    return out;
  };
  // The crowd seen whole (names stand beside it) and the column: what callouts keep clear of.
  // The two subjects' sides as tall columns: a leader never runs from the meadow across the
  // column's side of the picture, or from the column across the meadow's.
  const crowdHull: Vec3[] = [];
  const meadowSide: Vec3[] = [];
  const crowdR = Math.max(L.meadow.r, L.fenceR);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const x = L.meadow.x + Math.cos(a) * crowdR;
    const z = L.meadow.z + Math.sin(a) * crowdR;
    crowdHull.push([x, 0, z], [x, 1.3, z]);
    meadowSide.push([x, -6, z], [x, 12, z]);
  }
  const g = L.gauge;
  const gaugeSide: Vec3[] = [];
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const x = g.x + dx * (g.plinthR + (dx > 0 ? 3 : 0.4));
    gaugeSide.push([x, -6, g.z + dz * g.plinthR], [x, g.tubeH + 6, g.z + dz * g.plinthR]);
  }

  return {
    kit,
    bounds: { center, radius, points: pts },
    frames,
    callouts,
    // Seen whole, a name never covers the crowd (names stand beside it); up close, where the
    // crowd fills the picture, only the figure it names. Never the column.
    calloutObstacles: (view) => {
      if (!view || !frames[view])
        return { avoid: [column.hull, crowdHull], regions: [meadowSide, gaugeSide] };
      const p = named >= 0 ? figures.point(named) : null;
      const r = FIGURE_CLEARANCE / 2;
      const figure: Vec3[][] = p
        ? [
            [
              [p[0] - r, p[1] - 0.4, p[2]],
              [p[0] + r, p[1] - 0.4, p[2]],
              [p[0], p[1] + 1.1, p[2]],
            ],
          ]
        : [];
      return { avoid: [column.hull, ...figure], regions: [meadowSide, gaugeSide] };
    },
    setTime(t) {
      show(t);
    },
    tick(dt) {
      lastTick = clock();
      figures.tick(dt);
    },
    rest() {
      lastTick = -Infinity;
      figures.rest();
    },
    pick(ray: THREE.Raycaster) {
      const a = figures.pick(ray);
      const g = ray.intersectObjects(column.pickables, false)[0];
      const f = ray.intersectObjects(field.pickables, false)[0];
      const hits: { id: string; d: number }[] = [];
      if (a) hits.push({ id: `figure:${String(a.slot)}`, d: a.distance });
      if (g) hits.push({ id: 'gauge', d: g.distance });
      if (f) hits.push({ id: 'food', d: f.distance });
      hits.sort((x, y) => x.d - y.d);
      return hits[0]?.id ?? null;
    },
    select(id) {
      const s = parseSelection(id);
      figures.select(s?.kind === 'figure' ? s.slot : null);
      column.select(s?.kind === 'gauge');
      field.select(s?.kind === 'food');
      // An animal's or the clover's card (and the player's readout) carry the moment's numbers
      // beside its close-up: the column's labels, off to the side and maybe under the card, wait
      // until the card closes.
      column.showLabels(!s || s.kind === 'gauge');
    },
    state: () => {
      // The front-most standing figure (largest z), for tests and the screenshot probes.
      let front = -1;
      let fz = -Infinity;
      for (let i = 0; i < figures.drawn(); i++) {
        const p = figures.point(i);
        if (p && p[2] > fz) {
          fz = p[2];
          front = i;
        }
      }
      return {
        t: now.t,
        N: now.N,
        drawn: figures.drawn(),
        per: model.per,
        slots: model.slots,
        kSlots: model.kSlots,
        fill: column.fillHeight(),
        column: column.height,
        arrow: column.arrowLength(),
        food: field.drawn(),
        figurePoint: figures.point(front),
        gaugePoint: column.surfacePoint(),
        foodPoint: field.foodPoint(),
        settling: figures.settling(),
      };
    },
  };
}
