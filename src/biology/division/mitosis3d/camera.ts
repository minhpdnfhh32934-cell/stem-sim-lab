/**
 * Camera framing of the 3D mitosis view: pure math (three.js maths and camera objects only, no
 * renderer, no DOM), shared by the view and its tests.
 *
 * The camera looks at a target (the cell centre, or the chromosomes in the close-up) from a
 * direction (VIEW_DIR when framed, the learner's orbit afterwards). The stage strip and caption
 * cover the bottom of the canvas, so the picture is drawn a little higher: the camera renders a
 * taller virtual image and only its lower part is shown (`applyViewport`). Orbiting still turns
 * around the target.
 */
import * as THREE from 'three';
import type { CameraMode } from './components';
import { ANIMAL, PLANT, type CellType, type Mitosis3DState, type Vec3 } from './timeline';

/** What the camera must show: points (relative to `center`) that have to be in view. */
export interface CameraFrame {
  center: Vec3;
  points: Vec3[];
}

/** Vertical field of view of the virtual (uncropped) image, degrees. */
export const FOV = 38;
/** The picture is lifted by this share of the canvas height. */
const LIFT = 0.07;
/** Margin for the controls drawn over the edges of the canvas. */
const FIT_MARGIN = 1.22;
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
export const ANIMAL_EXTENT = 1.06 * ANIMAL.daughterRadius + ANIMAL.daughterRadius;

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

/** Pixels the picture is lifted by on a canvas of this height. */
const liftOf = (height: number) => Math.round(height * LIFT);

/** Sets the camera for a canvas: aspect and the lifted, cropped view. */
export function applyViewport(cam: THREE.PerspectiveCamera, width: number, height: number): void {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const d = liftOf(h);
  cam.fov = FOV;
  cam.aspect = w / (h + 2 * d);
  cam.setViewOffset(w, h + 2 * d, 0, 2 * d, w, h);
  cam.updateProjectionMatrix();
}

/**
 * Visible extent of the cropped view as tangents of the half-angles: left/right, above and
 * below the target (the crop removes the top of the virtual image, so `up` < `down`).
 */
export interface ViewTangents {
  h: number;
  up: number;
  down: number;
}

export function viewTangents(width: number, height: number): ViewTangents {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const d = liftOf(h);
  const full = h + 2 * d;
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return { h: (t * w) / full, up: (t * (full - 4 * d)) / full, down: t };
}

/** Right and up vectors of a camera looking along −dir (as `Object3D.lookAt` builds them). */
export function viewBasis(dir: Vec3): { right: Vec3; up: Vec3 } {
  const z = new THREE.Vector3(...dir).normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z);
  if (x.lengthSq() < 1e-12) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return { right: [x.x, x.y, x.z], up: [y.x, y.y, y.z] };
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Camera distance (along `dir`, from the frame centre) at which every point of the frame is
 * inside the cropped view, with a margin for the controls drawn over the canvas edges.
 */
export function fitDistance(f: CameraFrame, tan: ViewTangents, dir: Vec3 = VIEW_DIR): number {
  const { right, up } = viewBasis(dir);
  let dist = 1;
  for (const p of f.points) {
    const x = Math.abs(dot(p, right));
    const y = dot(p, up);
    const need = dot(p, dir) + Math.max(x / tan.h, y >= 0 ? y / tan.up : -y / tan.down);
    dist = Math.max(dist, need);
  }
  return dist * FIT_MARGIN;
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
  const min = cellBound(cellType) + Math.hypot(...target) + SURFACE_GAP;
  return { min, max: Math.max(MAX_DISTANCE, overviewDistance * 1.25, min * 2) };
}

export interface CameraPlacement {
  target: Vec3;
  position: Vec3;
  distance: number;
  min: number;
  max: number;
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
): CameraPlacement {
  const tan = viewTangents(width, height);
  const overview = fitDistance(cameraFrame('overview', null, cellType), tan);
  const { min, max } = zoomLimits(cellType, frame.center, overview);
  const distance = Math.min(max, Math.max(min, fitDistance(frame, tan, dir)));
  const [cx, cy, cz] = frame.center;
  return {
    target: [cx, cy, cz],
    position: [cx + dir[0] * distance, cy + dir[1] * distance, cz + dir[2] * distance],
    distance,
    min,
    max,
  };
}
