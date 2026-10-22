/**
 * Camera framing of the 3D meiosis view (pure maths, no renderer, no DOM). The overview frames
 * every cell of the current division — meiosis I: the germ cell and the two cells it gives;
 * meiosis II: those two cells and the four at the end — so the camera holds still while a
 * division plays and moves smoothly once, when meiosis II starts (the view animates it). In Basic
 * mode the stages whose subject is the chromosomes (prophase I: pairing and crossing over;
 * metaphase I: bivalents on the plate) frame every chromosome of those stages with a 25 % margin
 * instead (`chromosomeFocusFrame`): the bivalents and their chiasma can be read, the cell is still
 * around them. The close-up frames the chromosomes of this moment. Field of view, view direction
 * and the safe area are the mitosis view's.
 */
import {
  placeCamera as placeGeneric,
  zoomLimits as zoomGeneric,
  type CameraPlacement,
} from '@/ui/three/camera';
import {
  VIEW_DIR,
  defaultInsets,
  fitDistance,
  spherePoints,
  viewTangents,
  type CameraFrame,
  type Insets,
} from '../mitosis3d/camera';
import type { MeiosisCameraMode } from './components';
import {
  DAUGHTER1_X,
  DAUGHTER2_Y,
  MEIOSIS,
  type Meiosis3DState,
  type MeiosisStage3D,
  type MeiosisTimeline,
  type Vec3,
} from './timeline';

export { FOV, VIEW_DIR, defaultInsets, spherePoints } from '../mitosis3d/camera';
export type { CameraFrame, CameraPlacement, Insets };

/** The camera never comes closer than this to the cells' bounding sphere (near plane 0.1). */
const SURFACE_GAP = 0.5;
const MAX_DISTANCE = 90;

/** Cells of a division at their largest (stretched before each cytokinesis); 0 = both. */
function cellsOf(division: 0 | 1 | 2): { c: Vec3; r: number }[] {
  const M = MEIOSIS;
  const e = M.elongation;
  const x1 = DAUGHTER1_X;
  const first = [{ c: [0, 0, 0] as Vec3, r: M.radius * (1 + e / 2) }];
  const two = [-1, 1].map((sx) => ({ c: [sx * x1, 0, 0] as Vec3, r: M.radius1 * (1 + e / 2) }));
  const four = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => ({ c: [sx * x1, sy * DAUGHTER2_Y, 0] as Vec3, r: M.radius2 })),
  );
  if (division === 1) return [...first, ...two];
  if (division === 2) return [...two, ...four];
  return [...first, ...two, ...four];
}

/** Radius of a sphere about the origin that holds every cell at every moment. */
export const MEIOSIS_BOUND = Math.max(...cellsOf(0).map((x) => Math.hypot(...x.c) + x.r));

/** The overview of one division (0: every cell of both, for the zoom-out limit). */
export function overviewFrame(division: 0 | 1 | 2): CameraFrame {
  return { center: [0, 0, 0], points: cellsOf(division).flatMap((x) => spherePoints(x.c, x.r)) };
}

/** What to frame: the cells of this division (overview), or the chromosomes now (close-up). */
export function meiosisFrame(mode: MeiosisCameraMode, state: Meiosis3DState | null): CameraFrame {
  if (mode === 'overview' || !state) return overviewFrame(state?.division ?? 1);
  const pts = state.chromatids.filter((c) => c.present).map((c) => c.centromere);
  if (pts.length === 0) return { center: [0, 0, 0], points: spherePoints([0, 0, 0], 4) };
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k] ?? 0, p[k] ?? 0);
      hi[k] = Math.max(hi[k] ?? 0, p[k] ?? 0);
    }
  }
  const center: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  return {
    center,
    points: pts.flatMap((p) =>
      spherePoints([p[0] - center[0], p[1] - center[1], p[2] - center[2]], 1.3),
    ),
  };
}

/**
 * Default view direction in meiosis II: nearly from the front, a little from above, so the four
 * final cells (a 2 × 2 block in the x–y plane) and both meiosis II spindles (along y) are seen side
 * by side, none behind another. Meiosis I keeps the mitosis view's direction.
 */
export const MEIOSIS2_DIR: Vec3 = (() => {
  const l = Math.hypot(0.15, 0.3, 1);
  return [0.15 / l, 0.3 / l, 1 / l];
})();

/** The default view direction of a division. */
export const defaultDirection = (division: 1 | 2): Vec3 =>
  division === 2 ? MEIOSIS2_DIR : VIEW_DIR;

/** Stages whose subject is the chromosomes: the Basic overview frames them (not the cells). */
export const CHROMOSOME_FOCUS: ReadonlySet<MeiosisStage3D> = new Set(['prophase1', 'metaphase1']);

/** Margin around the chromosomes of the focus stages (share of their extent). */
export const FOCUS_MARGIN = 1.25;
/** Samples over a focus stage; reach of a decondensed thread around its centromere. */
const FOCUS_SAMPLES = 24;
const THREAD_REACH = 0.8;
/** The smallest radius framed (world units). */
const FOCUS_MIN_RADIUS = 1.5;

const focusFrames = new WeakMap<MeiosisTimeline, Map<MeiosisStage3D, CameraFrame>>();

/**
 * The Basic overview of a chromosome stage (prophase I or metaphase I): one sphere holding every
 * chromosome at every moment of the stage — each condensed chromatid's centromere and arm tips
 * (the model's arm lengths along its arm directions), a thread's centromere with the thread's
 * reach — grown by FOCUS_MARGIN. One frame per stage: the camera holds still while it plays and
 * glides once to the next.
 */
export function chromosomeFocusFrame(tl: MeiosisTimeline, stage: MeiosisStage3D): CameraFrame {
  let byStage = focusFrames.get(tl);
  if (!byStage) {
    byStage = new Map();
    focusFrames.set(tl, byStage);
  }
  const cached = byStage.get(stage);
  if (cached) return cached;
  const window = tl.stages.find((w) => w.id === stage);
  const from = window?.start ?? 0;
  const to = window?.end ?? 0;
  const pts: { p: Vec3; r: number }[] = [];
  for (let k = 0; k <= FOCUS_SAMPLES; k++) {
    const st = tl.stateAt(
      from + ((to - from) * k) / FOCUS_SAMPLES - (k === FOCUS_SAMPLES ? 1e-6 : 0),
    );
    const rod = st.condensation >= 0.5;
    st.chromatids.forEach((c, i) => {
      if (!c.present) return;
      const info = tl.chromatids[i];
      if (!rod || !info) {
        pts.push({ p: c.centromere, r: THREAD_REACH });
        return;
      }
      const tip = (d: Vec3, l: number): Vec3 => [
        c.centromere[0] + d[0] * l,
        c.centromere[1] + d[1] * l,
        c.centromere[2] + d[2] * l,
      ];
      pts.push({ p: c.centromere, r: 0 });
      pts.push({ p: tip(c.dirA, info.armA), r: 0 });
      pts.push({ p: tip(c.dirB, info.armB), r: 0 });
    });
  }
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const { p, r } of pts)
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a] ?? 0, (p[a] ?? 0) - r);
      hi[a] = Math.max(hi[a] ?? 0, (p[a] ?? 0) + r);
    }
  const center: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  let radius = FOCUS_MIN_RADIUS;
  for (const { p, r } of pts)
    radius = Math.max(radius, Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]) + r);
  const frame = { center, points: spherePoints([0, 0, 0], radius * FOCUS_MARGIN) };
  byStage.set(stage, frame);
  return frame;
}

/** Zoom limits: outside every cell; far enough for the overview, never cut. */
export function meiosisZoomLimits(target: Vec3, overviewDistance: number) {
  return zoomGeneric(MEIOSIS_BOUND, target, overviewDistance, {
    gap: SURFACE_GAP,
    maxDistance: MAX_DISTANCE,
  });
}

/** Where the camera goes to show a frame on a canvas (fit distance within the zoom limits). */
export function placeMeiosisCamera(
  frame: CameraFrame,
  width: number,
  height: number,
  dir: Vec3 = VIEW_DIR,
  insets: Insets = defaultInsets(height),
): CameraPlacement {
  const tan = viewTangents(width, height, insets);
  const overview = fitDistance(overviewFrame(0), tan);
  const limits = meiosisZoomLimits(frame.center, overview);
  return placeGeneric(frame.center, frame.points, tan, dir, limits);
}
