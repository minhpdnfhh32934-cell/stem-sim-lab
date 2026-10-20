/**
 * Camera framing of the 3D view of "Đột biến điểm" (pure maths). "Toàn cảnh" frames every base
 * pair drawn with both mRNAs and both chains; "Vị trí đột biến" comes close to the changed base
 * pairs of both helices. The camera looks from the
 * front, a little above and from the right (the DNA → protein view's direction).
 */
import { safeTangents, type Insets } from '@/ui/three/frame';
import {
  fitDistance,
  placeCamera,
  type CameraPlacement,
  type ViewTangents,
} from '@/ui/three/camera';
import { LAYOUT, PICTURE_BOTTOM, PICTURE_TOP, xOf, type Vec3 } from './layout';
import type { MutationModel3D } from './binding';
import { FOV, MIN_DISTANCE, VIEW_DIR } from '../dogma3d/camera';
import type { MutationCameraMode } from './store';

export { FOV, VIEW_DIR };

const MAX_DISTANCE = 80;
/** Half width (scene units) of the site view: about seven base pairs each side. */
const SITE_HALF = 2.4;

/** Before the controls are measured: room for the chips, the proteins and the caption. */
export function defaultInsets(height: number): Insets {
  return { top: 0, right: 0, bottom: Math.round(Math.max(1, height) * 0.24), left: 0 };
}

export interface CameraFrame {
  center: Vec3;
  /** Points (relative to `center`) that must be in view. */
  points: Vec3[];
}

function box(lo: Vec3, hi: Vec3): CameraFrame {
  const center: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const points: Vec3[] = [];
  for (const x of [lo[0], hi[0]])
    for (const y of [lo[1], hi[1]])
      for (const z of [lo[2], hi[2]]) points.push([x - center[0], y - center[1], z - center[2]]);
  return { center, points };
}

/** What the camera frames, for the slots drawn [from, to). */
export function mutationFrame(
  mode: MutationCameraMode,
  m: MutationModel3D,
  win: { from: number; to: number },
): CameraFrame {
  const front = m.bulge ? LAYOUT.bulgeDepth + 0.4 : 1.2;
  if (mode === 'overview') {
    const x0 = xOf(win.from) - 1.2;
    const x1 = xOf(Math.max(win.from, win.to - 1)) + 1.2;
    return box([x0, PICTURE_BOTTOM, -1.2], [x1, PICTURE_TOP, front]);
  }
  // Both helices around the site (their mRNAs and chains are out of the frame).
  const x = xOf(m.site);
  return box(
    [x - SITE_HALF, LAYOUT.helixY.mutated - 1.3, -1.2],
    [x + SITE_HALF, LAYOUT.helixY.normal + 1.3, front],
  );
}

export function viewTangents(width: number, height: number, insets: Insets): ViewTangents {
  const t = safeTangents(FOV, width, height, insets);
  return { h: t.h, up: t.v, down: t.v };
}

/** Where the camera goes to show a frame; it may zoom in close and out past the overview. */
export function placeMutationCamera(
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
