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
