/**
 * Camera framing of the 3D view of "ADN → mARN → Protein" (pure maths). "Toàn cảnh" frames
 * every base pair drawn and the machinery under it; "Theo dõi" follows the RNA polymerase in
 * transcription and the ribosome in translation, close enough to read the bases. The camera
 * looks slightly from the front, above and the right; it may come close to the helix (letters at
 * close zoom), and never so far that a framed view is cut.
 */
import {
  fitDistance,
  placeCamera,
  type CameraPlacement,
  type ViewTangents,
} from '@/ui/three/camera';
import { safeTangents, type Insets } from '@/ui/three/frame';
import { activeIndex, type DogmaModel3D, type DogmaMoment } from './binding';
import { LAYOUT, ribosomePose, xOf, type RibosomePose, type Vec3 } from './layout';

export type DogmaCameraMode = 'follow' | 'overview';

/** Vertical field of view (degrees). */
export const FOV = 34;

/** From the front, a little above and from the right: rungs and letters read, the helix too. */
export const VIEW_DIR: Vec3 = (() => {
  const v: Vec3 = [0.28, 0.3, 1];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

/** Closest the camera comes to its target (scene units; near plane 0.05). */
export const MIN_DISTANCE = 2.2;
const MAX_DISTANCE = 70;

/** Before the controls are measured: room for the strip, the slider and the caption. */
export function defaultInsets(height: number): Insets {
  return { top: 0, right: 0, bottom: Math.round(Math.max(1, height) * 0.2), left: 0 };
}

export interface CameraFrame {
  center: Vec3;
  /** Points (relative to `center`) that must be in view. */
  points: Vec3[];
}

function box(center: Vec3, lo: Vec3, hi: Vec3): CameraFrame {
  const points: Vec3[] = [];
  for (const x of [lo[0], hi[0]])
    for (const y of [lo[1], hi[1]])
      for (const z of [lo[2], hi[2]]) points.push([x - center[0], y - center[1], z - center[2]]);
  return { center, points };
}

/** Lowest point of the translation machinery (the chain under the large subunit). */
const BOTTOM_TL = LAYOUT.mrnaLineY - 7;
/** Lowest point while transcribing (the new mRNA on its line). */
const BOTTOM_TX = LAYOUT.mrnaLineY - 1.1;
/** Top of the picture: the ruler of positions above the helix. */
const TOP = LAYOUT.rulerY + 0.35;
/** Following the ribosome, the frame still holds the helix above it (never under the controls). */
const TOP_TL = 1.5;
/** Half width (scene units) of what "Theo dõi" frames: about 12 base pairs each side. */
const FOLLOW_HALF = 4;

const _rib: RibosomePose = { x: 0, opacity: 0, smallLift: 0, largeDrop: 0 };

/** What the camera frames at a moment, for the base pairs drawn [from, to). */
export function dogmaFrame(
  mode: DogmaCameraMode,
  m: DogmaModel3D,
  mo: DogmaMoment,
  win: { from: number; to: number },
): CameraFrame {
  const translating = mo.phase === 'translation';
  if (mode === 'overview') {
    const bottom = m.t.codons.length > 0 ? BOTTOM_TL : BOTTOM_TX;
    const x0 = xOf(win.from) - 1.2;
    const x1 = xOf(Math.max(win.from, win.to - 1)) + 1.2;
    const c: Vec3 = [(x0 + x1) / 2, (TOP + bottom) / 2, 0];
    return box(c, [x0, bottom, -2], [x1, TOP, 2]);
  }
  if (translating) {
    // The ribosome, the tRNAs and the chain trailing behind them (to the left).
    const x = ribosomePose(m, mo, _rib).x - 0.8;
    const c: Vec3 = [x, (TOP_TL + BOTTOM_TL) / 2, 0];
    return box(c, [x - FOLLOW_HALF, BOTTOM_TL, -1.5], [x + FOLLOW_HALF, TOP_TL, 1.5]);
  }
  const x = xOf(activeIndex(m, mo));
  const c: Vec3 = [x, (TOP + BOTTOM_TX) / 2, 0];
  return box(c, [x - FOLLOW_HALF, BOTTOM_TX, -1.5], [x + FOLLOW_HALF, TOP, 1.5]);
}

export function viewTangents(width: number, height: number, insets: Insets): ViewTangents {
  const t = safeTangents(FOV, width, height, insets);
  return { h: t.h, up: t.v, down: t.v };
}

/**
 * Where the camera goes to show a frame (fit distance from `dir`); it may zoom in to
 * MIN_DISTANCE and out to well past the overview.
 */
export function placeDogmaCamera(
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
