import { findRoot } from '@/core/math/special';

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

/**
 * First time in (0, tMax] when the two bodies are at the same position, or null.
 * Piecewise motion is handled by scanning for sign changes and refining with the
 * Illinois root finder (accurate to ~1e-13 s).
 */
export function meetingTime(a: Motion1D, b: Motion1D, tMax: number): number | null {
  const gap = (t: number) => stateAt(a, t).x - stateAt(b, t).x;
  const g0 = gap(0);
  if (g0 === 0) return 0;
  const n = 2000;
  let prevT = 0;
  let prevG = g0;
  for (let i = 1; i <= n; i++) {
    const t = (tMax * i) / n;
    const g = gap(t);
    if (g === 0) return t;
    if (Math.sign(g) !== Math.sign(prevG)) return findRoot(gap, prevT, t, 1e-14);
    prevT = t;
    prevG = g;
  }
  return null;
}
