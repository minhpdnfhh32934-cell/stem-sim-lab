/**
 * Camera framing of the 3D meiosis view (pure maths, no renderer, no DOM). The overview frames
 * every cell of the current division — meiosis I: the germ cell and the two cells it gives;
 * meiosis II: those two cells and the four at the end — so the camera holds still while a
 * division plays and moves smoothly once, when meiosis II starts (the view animates it). The
 * close-up frames the chromosomes of this moment. Field of view, view direction and the safe area
 * are the mitosis view's.
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
import { DAUGHTER1_X, DAUGHTER2_Y, MEIOSIS, type Meiosis3DState, type Vec3 } from './timeline';

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
