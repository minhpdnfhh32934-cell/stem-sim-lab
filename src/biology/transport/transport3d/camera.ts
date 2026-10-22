/**
 * Camera framing of the "Khuếch tán & thẩm thấu" 3D view (pure maths). The diffusion tank is seen
 * from the front, a little above and from the right, so the membrane's face with its pores shows
 * and the tank's top stays shallow (a wide subject in a short stage); the U-tube from the front,
 * a little above and right, so both columns and the ruler read.
 */
import {
  fitDistance,
  placeCamera,
  viewBasis,
  type CameraPlacement,
  type Vec3,
  type ViewTangents,
} from '@/ui/three/camera';
import { safeTangents, type Insets } from '@/ui/three/frame';

export const FOV = 34;

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Viewing direction of each process (from the target towards the camera). */
export const VIEW_DIR = {
  diffusion: unit([0.62, 0.4, 1]),
  osmosis: unit([0.22, 0.2, 1]),
} as const;

const MIN_DISTANCE = 1.5;
const MAX_DISTANCE = 120;

/** Before the controls are measured: room for the player row and the caption. */
export function defaultInsets(height: number): Insets {
  return { top: 0, right: 0, bottom: Math.round(Math.max(1, height) * 0.24), left: 0 };
}

export interface CameraFrame {
  center: Vec3;
  /** Points (relative to `center`) that must be in view. */
  points: Vec3[];
}

/** A frame around points (absolute), centred so they spread evenly on screen. */
export function pointsFrame(points: readonly Vec3[], dir: Vec3): CameraFrame {
  if (!points.length) return { center: [0, 0, 0], points: [[0, 0, 0]] };
  const { right, up } = viewBasis(dir);
  const mid = (axis: Vec3) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of points) {
      const v = p[0] * axis[0] + p[1] * axis[1] + p[2] * axis[2];
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return (lo + hi) / 2;
  };
  const a = mid(dir);
  const r = mid(right);
  const u = mid(up);
  const center: Vec3 = [
    dir[0] * a + right[0] * r + up[0] * u,
    dir[1] * a + right[1] * r + up[1] * u,
    dir[2] * a + right[2] * r + up[2] * u,
  ];
  return {
    center,
    points: points.map((p) => [p[0] - center[0], p[1] - center[1], p[2] - center[2]]),
  };
}

/** A cube of half size r around a point. */
export function aroundFrame(at: Vec3, r: number, dir: Vec3): CameraFrame {
  const pts: Vec3[] = [];
  for (const x of [-r, r])
    for (const y of [-r, r]) for (const z of [-r, r]) pts.push([at[0] + x, at[1] + y, at[2] + z]);
  return pointsFrame(pts, dir);
}

export function viewTangents(width: number, height: number, insets: Insets): ViewTangents {
  const t = safeTangents(FOV, width, height, insets);
  return { h: t.h, up: t.v, down: t.v };
}

/** Where the camera goes to show a frame; it may zoom in close and out past the overview. */
export function placeTransportCamera(
  frame: CameraFrame,
  overview: CameraFrame,
  width: number,
  height: number,
  dir: Vec3,
  insets: Insets = defaultInsets(height),
): CameraPlacement {
  const tan = viewTangents(width, height, insets);
  const far = fitDistance(overview.points, tan, dir);
  const limits = { min: MIN_DISTANCE, max: Math.max(MAX_DISTANCE, far * 1.6) };
  return placeCamera(frame.center, frame.points, tan, dir, limits);
}
