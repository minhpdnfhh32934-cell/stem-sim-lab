/**
 * 1D motion with constant acceleration, optionally "braking to rest": when the velocity
 * reaches zero while the acceleration opposes it (a vehicle braking), the body stays at
 * rest instead of reversing. Source: SGK Vật lí 10 (chuyển động thẳng biến đổi đều).
 */
export interface Motion1D {
  x0: number;
  v0: number;
  a: number;
  /** Stop permanently when v reaches 0 under an opposing acceleration. */
  stopAtRest: boolean;
}

/** Time at which a braking body stops, or Infinity if it never does. */
export function stopTime(m: Motion1D): number {
  if (!m.stopAtRest || m.a === 0 || m.v0 === 0 || Math.sign(m.a) === Math.sign(m.v0)) {
    return Infinity;
  }
  return -m.v0 / m.a;
}

export function stateAt(m: Motion1D, t: number): { x: number; v: number; a: number } {
  const ts = stopTime(m);
  if (t >= ts) {
    return { x: m.x0 + m.v0 * ts + 0.5 * m.a * ts * ts, v: 0, a: 0 };
  }
  return { x: m.x0 + m.v0 * t + 0.5 * m.a * t * t, v: m.v0 + m.a * t, a: m.a };
}

/** Path length travelled in [0, t] (accounts for direction reversal). */
export function distance(m: Motion1D, t: number): number {
  const ts = stopTime(m);
  const tEnd = Math.min(t, ts);
  // Reversal time (without stopping) where v changes sign.
  const tr = m.a !== 0 ? -m.v0 / m.a : Infinity;
  const pos = (tt: number) => m.x0 + m.v0 * tt + 0.5 * m.a * tt * tt;
  if (tr > 0 && tr < tEnd) {
    return Math.abs(pos(tr) - m.x0) + Math.abs(pos(tEnd) - pos(tr));
  }
  return Math.abs(pos(tEnd) - m.x0);
}

/** Position polynomial x = c0 + c1·t + c2·t² (absolute t) on one piece of the motion. */
type Poly = readonly [number, number, number];

function pieceOf(m: Motion1D, before: boolean): Poly {
  if (before) return [m.x0, m.v0, 0.5 * m.a];
  const ts = stopTime(m);
  return [m.x0 + m.v0 * ts + 0.5 * m.a * ts * ts, 0, 0];
}

/** Real roots of c0 + c1 t + c2 t² (numerically stable form). */
function quadRoots(c0: number, c1: number, c2: number): number[] {
  if (c2 === 0) return c1 === 0 ? [] : [-c0 / c1];
  let disc = c1 * c1 - 4 * c2 * c0;
  if (disc < 0) {
    // A touching meeting (double root) can come out a hair below zero from round-off.
    if (disc < -1e-12 * c1 * c1) return [];
    disc = 0;
  }
  const q = -0.5 * (c1 + (c1 >= 0 ? 1 : -1) * Math.sqrt(disc));
  if (q === 0) return [0];
  return [q / c2, c0 / q];
}

/**
 * First time in (0, tMax] when the two bodies are at the same position, or null.
 * The gap x_A − x_B is a quadratic in t on each piece between the stop times, so every
 * meeting is found exactly — including a start at the same place (t = 0 is not a
 * meeting unless the bodies stay together) and two meetings close together.
 */
export function meetingTime(a: Motion1D, b: Motion1D, tMax: number): number | null {
  const stops = [stopTime(a), stopTime(b)].filter((t) => t > 0 && t < tMax).sort((x, y) => x - y);
  const bounds = [0, ...stops, tMax];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const t0 = bounds[i] ?? 0;
    const t1 = bounds[i + 1] ?? tMax;
    if (t1 <= t0) continue;
    const pa = pieceOf(a, t0 < stopTime(a));
    const pb = pieceOf(b, t0 < stopTime(b));
    const c0 = pa[0] - pb[0];
    const c1 = pa[1] - pb[1];
    const c2 = pa[2] - pb[2];
    // Same motion on this piece: together the whole time (from the start, or since t0).
    if (c0 === 0 && c1 === 0 && c2 === 0) return t0;
    const tol = 1e-12 * Math.max(1, t1);
    const lo = i === 0 ? 0 : t0 - tol;
    const hits = quadRoots(c0, c1, c2).filter((t) => t > lo && t <= t1 + tol);
    if (hits.length > 0) return Math.min(t1, Math.max(t0, Math.min(...hits)));
  }
  return null;
}
