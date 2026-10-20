/**
 * Camera framing of the 3D mitosis view: pure math (three.js maths and camera objects only, no
 * renderer, no DOM), shared by the view and its tests.
 *
 * The camera looks at a target (the cell centre, or the chromosomes in the close-up) from a
 * direction (VIEW_DIR when framed, the learner's orbit afterwards). Controls are drawn over the
 * canvas edges (the chips at the top, the stage strip and caption at the bottom, a picked part's
 * card at the right): the view measures them as insets, the camera centres the picture in the
 * rest (the safe area, `@/ui/three/frame.ts`) and fits the cell inside it. Orbiting still
 * turns around the target.
 */
import * as THREE from 'three';
import {
  fitDistance as fitPoints,
  placeCamera as placeGeneric,
  viewBasis,
  zoomLimits as zoomGeneric,
  type CameraPlacement,
  type ViewTangents,
} from '@/ui/three/camera';
import { safeTangents, viewWindow, type Insets } from '@/ui/three/frame';
import type { CameraMode } from './components';
import {
  ANIMAL,
  ANIMAL_DAUGHTER_X,
  PLANT,
  type CellType,
  type Mitosis3DState,
  type Vec3,
} from './timeline';

export type { CameraPlacement, Insets, ViewTangents };
export { viewBasis };

/** What the camera must show: points (relative to `center`) that have to be in view. */
export interface CameraFrame {
  center: Vec3;
  points: Vec3[];
}

/** Vertical field of view of the virtual (uncropped) image, degrees. */
export const FOV = 38;
/**
 * Without measured controls (tests, the first frame), the bottom 14 % of the canvas is kept free
 * for the stage strip and caption.
 */
const BOTTOM_SHARE = 0.14;
/** The camera never comes closer than this to the cell surface (the near plane is 0.1). */
const SURFACE_GAP = 0.5;
/** Default zoom-out limit; raised when a frame needs more (very narrow canvases). */
const MAX_DISTANCE = 80;

/** Slightly from the side and above: the equatorial plate shows as a plane, not a line. */
export const VIEW_DIR: Vec3 = (() => {
  const v = new THREE.Vector3(0.55, 0.4, 1).normalize();
  return [v.x, v.y, v.z];
})();

/** Half length (x) of the two animal daughter cells together at the end of cytokinesis. */
export const ANIMAL_EXTENT = ANIMAL_DAUGHTER_X + ANIMAL.daughterRadius;

/** 26 points on a sphere (axes, edge and corner directions of a cube). */
export function spherePoints(c: Vec3, r: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        if (i === 0 && j === 0 && k === 0) continue;
        const l = Math.hypot(i, j, k);
        out.push([c[0] + (r * i) / l, c[1] + (r * j) / l, c[2] + (r * k) / l]);
      }
  return out;
}

/**
 * What to frame: the whole cell (overview; the mother cell and, at the end, both daughters), or
 * every chromosome at this moment with a margin for its arms (close-up).
 */
export function cameraFrame(
  mode: CameraMode,
  state: Mitosis3DState | null,
  cellType: CellType,
): CameraFrame {
  if (mode === 'overview' || !state) {
    if (cellType === 'plant') {
      const [hx, hy, hz] = PLANT.half;
      const w = PLANT.wall;
      const corners: Vec3[] = [];
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1]) corners.push([sx * (hx + w), sy * (hy + w), sz * (hz + w)]);
      return { center: [0, 0, 0], points: corners };
    }
    const d = ANIMAL_EXTENT - ANIMAL.daughterRadius;
    return {
      center: [0, 0, 0],
      points: [
        ...spherePoints([0, 0, 0], ANIMAL.radius * (1 + ANIMAL.elongation / 2)),
        ...spherePoints([-d, 0, 0], ANIMAL.daughterRadius),
        ...spherePoints([d, 0, 0], ANIMAL.daughterRadius),
      ],
    };
  }
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
      spherePoints([p[0] - center[0], p[1] - center[1], p[2] - center[2]], 1.2),
    ),
  };
}

/** Insets used before the controls are measured: room for the stage strip and caption. */
export function defaultInsets(height: number): Insets {
  return { top: 0, right: 0, bottom: Math.round(Math.max(1, height) * BOTTOM_SHARE), left: 0 };
}

/** Sets the camera for a canvas: aspect and the window that centres the safe area. */
export function applyViewport(
  cam: THREE.PerspectiveCamera,
  width: number,
  height: number,
  insets: Insets = defaultInsets(height),
): void {
  const win = viewWindow(width, height, insets);
  cam.fov = FOV;
  cam.aspect = win.fullWidth / win.fullHeight;
  cam.setViewOffset(win.fullWidth, win.fullHeight, win.x, win.y, win.width, win.height);
  cam.updateProjectionMatrix();
}

export function viewTangents(
  width: number,
  height: number,
  insets: Insets = defaultInsets(height),
): ViewTangents {
  const t = safeTangents(FOV, width, height, insets);
  return { h: t.h, up: t.v, down: t.v };
}

/**
 * Camera distance (along `dir`, from the frame centre) at which every point of the frame is
 * inside the safe area, with a small margin.
 */
export function fitDistance(f: CameraFrame, tan: ViewTangents, dir: Vec3 = VIEW_DIR): number {
  return fitPoints(f.points, tan, dir);
}

/** Radius of a sphere around the cell centre that holds the cell at every moment of the division. */
export function cellBound(cellType: CellType): number {
  if (cellType === 'plant') {
    const [hx, hy, hz] = PLANT.half;
    const w = PLANT.wall;
    return Math.hypot(hx + w, hy + w, hz + w);
  }
  return Math.max(ANIMAL.radius * (1 + ANIMAL.elongation), ANIMAL_EXTENT);
}

/**
 * Zoom limits around a target. Near: the camera stays outside a sphere holding the whole cell,
 * so it can never enter it. Far: at least the overview distance, so a framed view is never cut.
 */
export function zoomLimits(
  cellType: CellType,
  target: Vec3,
  overviewDistance: number,
): { min: number; max: number } {
  return zoomGeneric(cellBound(cellType), target, overviewDistance, {
    gap: SURFACE_GAP,
    maxDistance: MAX_DISTANCE,
  });
}

/**
 * Where the camera goes to show a frame on a canvas: target, position (along `dir`), distance
 * (the fit distance, never closer than the near limit) and the zoom limits for that target.
 */
export function placeCamera(
  frame: CameraFrame,
  cellType: CellType,
  width: number,
  height: number,
  dir: Vec3 = VIEW_DIR,
  insets: Insets = defaultInsets(height),
): CameraPlacement {
  const tan = viewTangents(width, height, insets);
  const overview = fitDistance(cameraFrame('overview', null, cellType), tan);
  const limits = zoomLimits(cellType, frame.center, overview);
  return placeGeneric(frame.center, frame.points, tan, dir, limits);
}
