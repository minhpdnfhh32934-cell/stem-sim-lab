/**
 * Camera framing of the enzyme 3D view (pure maths). "Toàn cảnh" frames the whole reaction
 * volume; "Cận cảnh enzyme" comes close to one enzyme (the picked one, else the front enzyme
 * nearest the middle). The camera looks from the front, a little above and from the right, so
 * the active sites (turned towards the viewer) are seen.
 */
import {
  fitDistance,
  placeCamera,
  viewBasis,
  type CameraPlacement,
  type ViewTangents,
} from '@/ui/three/camera';
import { safeTangents, type Insets } from '@/ui/three/frame';
import { ENZYME_PLACES, LAYOUT, boxCorners, type Vec3 } from './layout';

export const FOV = 34;

/** From the front, a little above and from the right. */
export const VIEW_DIR: Vec3 = (() => {
  const v: Vec3 = [0.24, 0.42, 1];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

export const MIN_DISTANCE = 2.2;
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
export function pointsFrame(points: readonly Vec3[], dir: Vec3 = VIEW_DIR): CameraFrame {
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
export function aroundFrame(at: Vec3, r: number): CameraFrame {
  const pts: Vec3[] = [];
  for (const x of [-r, r])
    for (const y of [-r, r]) for (const z of [-r, r]) pts.push([at[0] + x, at[1] + y, at[2] + z]);
  return pointsFrame(pts);
}

/** The enzyme "Cận cảnh" shows without a pick: of the front row, the one nearest the middle. */
export const CLOSE_DEFAULT = (() => {
  let best = 0;
  let bestD = Infinity;
  ENZYME_PLACES.forEach((e, k) => {
    const d = Math.hypot(e.center[0], e.center[1] - LAYOUT.hy * 0.5) - e.center[2];
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  });
  return best;
})();

/** What the camera frames for a mode (`enzyme`: the enzyme of the close view). */
export function enzymeFrame(mode: 'overview' | 'close', enzyme: number): CameraFrame {
  if (mode === 'close') {
    const e = ENZYME_PLACES[enzyme] ?? ENZYME_PLACES[CLOSE_DEFAULT];
    return aroundFrame(e?.center ?? [0, 0, 0], LAYOUT.enzymeR * 1.5);
  }
  return pointsFrame(boxCorners());
}

export function viewTangents(width: number, height: number, insets: Insets): ViewTangents {
  const t = safeTangents(FOV, width, height, insets);
  return { h: t.h, up: t.v, down: t.v };
}

/** Where the camera goes to show a frame; it may zoom in close and out past the overview. */
export function placeEnzymeCamera(
  frame: CameraFrame,
  width: number,
  height: number,
  dir: Vec3 = VIEW_DIR,
  insets: Insets = defaultInsets(height),
): CameraPlacement {
  const tan = viewTangents(width, height, insets);
  const overview = enzymeFrame('overview', 0);
  const far = fitDistance(overview.points, tan, dir);
  const limits = { min: MIN_DISTANCE, max: Math.max(MAX_DISTANCE, far * 1.6) };
  return placeCamera(frame.center, frame.points, tan, dir, limits);
}
