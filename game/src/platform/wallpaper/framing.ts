/*
 * Where the wallpaper's camera stands (Phase W, Phú 2026-11-17) and how the mouse sways it. The
 * roof's frame: its floor at y = 0, the ledge along x at z = 0 with the drop beyond it (−z), the
 * city 100 m below. Pure numbers (tested): `Wallpaper` turns them into a three.js camera.
 */

export type Vec = readonly [number, number, number];

export interface Framing {
  /** What it shows (for the report). */
  readonly name: string;
  readonly eye: Vec;
  readonly target: Vec;
  /** Vertical field of view (degrees) at 16:10. */
  readonly fov: number;
}

/**
 * Phú's framing (2026-11-17): Linh and Khoa on the right of the picture, looking deep into its
 * left where the lab floats; the eye a little above them, so they sit low in the picture and the
 * city below, the lab and the hills are all seen over the ledge.
 */
export const FRAMING: Framing = {
  name: 'behind them, the two on the right, the lab deep on the left',
  eye: [-1.2, 2.3, 3.8],
  target: [-0.11, 0.54, -6.14],
  fov: 46,
};

/** How far the mouse moves the eye (m) at the screen's edge, sideways and up. */
export const SWAY = { x: 0.22, y: 0.1 } as const;
/** The spring's stiffness (1/s²): the eye settles in ~0.6 s, never overshooting (critically damped). */
const STIFFNESS = 60;

/** The eye's sway, eased after the mouse. */
export interface Sway {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const restingSway = (): Sway => ({ x: 0, y: 0, vx: 0, vy: 0 });

/**
 * One step of the sway towards the mouse (`mx`, `my` in −1…1, right and up positive), `dt` s
 * on: a critically damped spring, so a jerk of the mouse never shows as a jerk of the view.
 */
export function stepSway(s: Sway, mx: number, my: number, dt: number): void {
  const tx = clamp(mx, -1, 1) * SWAY.x;
  const ty = clamp(my, -1, 1) * SWAY.y;
  const damping = 2 * Math.sqrt(STIFFNESS);
  // Small sub-steps: a long frame (the wallpaper paused, then resumed) stays stable.
  let left = Math.min(dt, 0.25);
  while (left > 0) {
    const h = Math.min(left, 1 / 120);
    s.vx += (STIFFNESS * (tx - s.x) - damping * s.vx) * h;
    s.vy += (STIFFNESS * (ty - s.y) - damping * s.vy) * h;
    s.x += s.vx * h;
    s.y += s.vy * h;
    left -= h;
  }
}

/*
 * The mouse wheel turns the view round the two (Phú: scrolled down, the camera goes round to the
 * left round Linh and Khoa little by little — past her left, before them — and stops side-on to
 * her right, over 180° round ("0 độ so với Linh … thấy phía bên phải của Linh"); scrolled up, it
 * comes back to the framing it starts at). The whole framing — eye and target — is turned about a point between
 * them, so they stay where they are in the picture and the world turns behind them. Eased (no jerk
 * however the wheel jumps).
 */

/** What the view turns about: between the two, at their chests (the roof's frame). */
export const PIVOT: Vec = [0.55, 0.85, -0.15];
/** How far one pixel of scrolling turns the view (rad): a wheel's notch (~100 px) about 8°. */
const PER_PIXEL = 0.0014;

export interface Orbit {
  /** The turn now (rad, + to the left of the picture … 0 the framing). */
  yaw: number;
  /** The turn scrolled to. */
  yawTo: number;
  /** As far as it turns: side-on to Linh's right (`rightSide`). */
  readonly stop: number;
}

/**
 * The turn that brings `framing` side-on to Linh's right: its line of sight square to the way she
 * faces (−z, out over the drop), gone round to the left past her left and her front (rad, negative,
 * past −π).
 */
export function rightSide(framing: Framing): number {
  const dx = framing.target[0] - framing.eye[0];
  const dz = framing.target[2] - framing.eye[2];
  return -(Math.PI / 2 - Math.atan2(dx, -dz)) - Math.PI;
}

export const restingOrbit = (framing: Framing): Orbit => ({
  yaw: 0,
  yawTo: 0,
  stop: rightSide(framing),
});

/** Scrolled by `deltaY` px (down positive): down turns on round, up back to the framing. */
export function scrollOrbit(o: Orbit, deltaY: number): void {
  o.yawTo = clamp(o.yawTo - deltaY * PER_PIXEL, o.stop, 0);
}

/** One step of the view after the wheel (`dt` s): eased, settling in ~0.4 s. */
export function stepOrbit(o: Orbit, dt: number): void {
  const k = 1 - Math.exp(-Math.min(dt, 0.25) * 9);
  o.yaw += (o.yawTo - o.yaw) * k;
}

/** `p` turned by the orbit round the upright through the pivot (into `out`). */
export function orbitPoint(o: Orbit, p: Vec, out: { x: number; y: number; z: number }): void {
  const [cx, , cz] = PIVOT;
  const c = Math.cos(o.yaw);
  const s = Math.sin(o.yaw);
  const x = p[0] - cx;
  const z = p[2] - cz;
  out.x = cx + x * c + z * s;
  out.y = p[1];
  out.z = cz - x * s + z * c;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
