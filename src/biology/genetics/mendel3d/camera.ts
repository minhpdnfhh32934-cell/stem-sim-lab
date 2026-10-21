/**
 * Camera framing of the 3D Mendel view (pure maths). "Toàn cảnh" frames the parents, the board,
 * the pedestals and a draw's offspring field; "Bảng Punnett" comes close to the board with both
 * rows of gametes. The camera looks from the front, above and a little from the right, so the
 * board reads like the 2D table (the father's gametes at the top, the mother's on the left).
 */
import {
  fitDistance,
  placeCamera,
  viewBasis,
  type CameraPlacement,
  type ViewTangents,
} from '@/ui/three/camera';
import { safeTangents, type Insets } from '@/ui/three/frame';
import { boardPoints, overviewPoints, parentsPoints, type BoardDims, type Vec3 } from './layout';
import type { MendelCameraMode } from './store';

export const FOV = 34;

/** From the front, well above the board, a little from the right. */
export const VIEW_DIR: Vec3 = (() => {
  const v: Vec3 = [0.16, 0.95, 1];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

/** Closest the camera comes to its target (scene units). */
export const MIN_DISTANCE = 2.5;
const MAX_DISTANCE = 140;

/** Before the controls are measured: room for the step strip and the caption. */
export function defaultInsets(height: number): Insets {
  return { top: 0, right: 0, bottom: Math.round(Math.max(1, height) * 0.24), left: 0 };
}

export interface CameraFrame {
  center: Vec3;
  /** Points (relative to `center`) that must be in view. */
  points: Vec3[];
}

/**
 * A frame around points (absolute). The centre is moved across the view so that the points
 * spread evenly on screen around it (the fit is symmetric): a tall part at the back would
 * otherwise leave an empty band at the top of the picture.
 */
export function pointsFrame(points: readonly Vec3[], dir: Vec3 = VIEW_DIR): CameraFrame {
  if (!points.length) return { center: [0, 0, 0], points: [[0, 0, 0]] };
  const { right, up } = viewBasis(dir);
  const span = (axis: Vec3) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of points) {
      const v = p[0] * axis[0] + p[1] * axis[1] + p[2] * axis[2];
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return (lo + hi) / 2;
  };
  const along = span(dir);
  const r = span(right);
  const u = span(up);
  const center: Vec3 = [
    dir[0] * along + right[0] * r + up[0] * u,
    dir[1] * along + right[1] * r + up[1] * u,
    dir[2] * along + right[2] * r + up[2] * u,
  ];
  return {
    center,
    points: points.map((p) => [p[0] - center[0], p[1] - center[1], p[2] - center[2]]),
  };
}

/** The eight corners of a box as a frame. */
export function boxFrame(lo: Vec3, hi: Vec3): CameraFrame {
  const pts: Vec3[] = [];
  for (const x of [lo[0], hi[0]])
    for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) pts.push([x, y, z]);
  return pointsFrame(pts);
}

/** What the camera frames for a mode (`fieldTotal`: figures of a draw shown, 0 for none). */
export function mendelFrame(mode: MendelCameraMode, d: BoardDims, fieldTotal: number): CameraFrame {
  return pointsFrame(mode === 'board' ? boardPoints(d) : overviewPoints(d, fieldTotal));
}

/**
 * What "Toàn cảnh" frames after a jump to step k (a step button, Next, Previous): meiosis and the
 * gametes come closer to the parents and the tray, fertilisation to the board, the offspring
 * show everything. Null: the mode's own frame.
 */
export function stepFrame(k: number, d: BoardDims): CameraFrame | null {
  if (k <= 1) return pointsFrame(parentsPoints(d));
  if (k === 2) return pointsFrame(boardPoints(d));
  return null;
}

export function viewTangents(width: number, height: number, insets: Insets): ViewTangents {
  const t = safeTangents(FOV, width, height, insets);
  return { h: t.h, up: t.v, down: t.v };
}

/** Where the camera goes to show a frame; it may zoom in close and out past the overview. */
export function placeMendelCamera(
  frame: CameraFrame,
  overview: CameraFrame,
  width: number,
  height: number,
  dir: Vec3 = VIEW_DIR,
  insets: Insets = defaultInsets(height),
): CameraPlacement {
  const tan = viewTangents(width, height, insets);
  const far = fitDistance(overview.points, tan, dir);
  const limits = { min: MIN_DISTANCE, max: Math.max(MAX_DISTANCE, far * 1.5) };
  return placeCamera(frame.center, frame.points, tan, dir, limits);
}
