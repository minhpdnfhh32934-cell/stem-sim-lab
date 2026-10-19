/**
 * Camera framing for the biology 3D views (pure maths, no renderer, no DOM): the picture is
 * centred in the canvas's safe area — the canvas minus the controls drawn over its edges (chips
 * at the top, buttons and captions at the bottom, a part's card at the right) — and the camera
 * is moved back until the subject fits that area.
 */

/** Pixels covered by controls on each side of the canvas. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Default viewing direction of a lesson's 3D view: slightly from the side and above. */
export const DEFAULT_VIEW: [number, number, number] = [0.45, 0.5, 1];

/** The safe area never shrinks below these shares of the canvas (huge overlays on tiny canvases). */
const MIN_SAFE_W = 0.4;
const MIN_SAFE_H = 0.35;

/**
 * Insets as they will be used: non-negative and, when the controls leave too little room, scaled
 * down so the safe area keeps a minimum share of the canvas (it then overlaps the controls a
 * little rather than shrinking the picture to nothing).
 */
export function clampInsets(width: number, height: number, i: Insets): Insets {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const pos = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);
  let { top, right, bottom, left } = {
    top: pos(i.top),
    right: pos(i.right),
    bottom: pos(i.bottom),
    left: pos(i.left),
  };
  const maxX = w * (1 - MIN_SAFE_W);
  if (left + right > maxX) {
    const k = maxX / (left + right);
    left *= k;
    right *= k;
  }
  const maxY = h * (1 - MIN_SAFE_H);
  if (top + bottom > maxY) {
    const k = maxY / (top + bottom);
    top *= k;
    bottom *= k;
  }
  return { top, right, bottom, left };
}

/**
 * `camera.setViewOffset` arguments that put the projection centre (the orbit target) at the
 * centre of the safe area: a larger virtual image, of which the canvas shows one window.
 */
export interface ViewWindow {
  fullWidth: number;
  fullHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function viewWindow(width: number, height: number, insets: Insets): ViewWindow {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const i = clampInsets(w, h, insets);
  // Shift of the safe area's centre from the canvas centre (px, right / down positive).
  const dx = (i.left - i.right) / 2;
  const dy = (i.top - i.bottom) / 2;
  return {
    fullWidth: w + 2 * Math.abs(dx),
    fullHeight: h + 2 * Math.abs(dy),
    x: Math.abs(dx) - dx,
    y: Math.abs(dy) - dy,
    width: w,
    height: h,
  };
}

/**
 * Tangents of the half-angles of the safe area seen from the camera (horizontal, vertical), for
 * a camera whose vertical field of view `fovDeg` spans the virtual image.
 */
export function safeTangents(
  fovDeg: number,
  width: number,
  height: number,
  insets: Insets,
): { h: number; v: number } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const i = clampInsets(w, h, insets);
  const win = viewWindow(w, h, i);
  const perPx = Math.tan(((fovDeg / 2) * Math.PI) / 180) / (win.fullHeight / 2);
  return {
    h: (perPx * Math.max(1, w - i.left - i.right)) / 2,
    v: (perPx * Math.max(1, h - i.top - i.bottom)) / 2,
  };
}

/**
 * Distance from a sphere's centre at which the whole sphere fits the safe area (any viewing
 * direction), times `margin`.
 */
export function fitSphereDistance(
  radius: number,
  fovDeg: number,
  width: number,
  height: number,
  insets: Insets,
  margin = 1.08,
): number {
  const t = safeTangents(fovDeg, width, height, insets);
  const m = Math.max(1e-6, Math.min(t.h, t.v));
  // A sphere of radius r at distance d spans half-angle asin(r/d): tan = r / √(d² − r²).
  return Math.max(radius * 1.05, radius * Math.sqrt(1 + 1 / (m * m))) * margin;
}

type V3 = [number, number, number];

/** Right and up vectors of a camera looking along −dir (as `Object3D.lookAt` builds them). */
function basis(dir: V3): { z: V3; right: V3; up: V3 } {
  const l = Math.hypot(...dir) || 1;
  const z: V3 = [dir[0] / l, dir[1] / l, dir[2] / l];
  // right = (0, 1, 0) × z
  let right: V3 = [z[2], 0, -z[0]];
  const rl = Math.hypot(...right);
  right = rl < 1e-9 ? [1, 0, 0] : [right[0] / rl, right[1] / rl, right[2] / rl];
  // up = z × right
  const up: V3 = [
    z[1] * right[2] - z[2] * right[1],
    z[2] * right[0] - z[0] * right[2],
    z[0] * right[1] - z[1] * right[0],
  ];
  return { z, right, up };
}

const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Distance from `center` along `dir` at which every point is inside the safe area (a tighter fit
 * than a bounding sphere for flat subjects such as a habitat seen from above), times `margin`.
 */
export function fitPointsDistance(
  points: readonly V3[],
  center: V3,
  dir: V3,
  fovDeg: number,
  width: number,
  height: number,
  insets: Insets,
  margin = 1.06,
): number {
  const t = safeTangents(fovDeg, width, height, insets);
  const { z, right, up } = basis(dir);
  let dist = 1e-3;
  for (const p of points) {
    const q: V3 = [p[0] - center[0], p[1] - center[1], p[2] - center[2]];
    const need = dot3(q, z) + Math.max(Math.abs(dot3(q, right)) / t.h, Math.abs(dot3(q, up)) / t.v);
    dist = Math.max(dist, need);
  }
  return dist * margin;
}
