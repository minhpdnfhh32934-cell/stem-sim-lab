import { C } from '@/core/constants';
import { dopri5 } from '@/core/ode/dopri5';
import type { Params } from '../types';

/**
 * A charge in the uniform field between two parallel plates (SGK Vật lí 11 KNTT, Bài 19 "Thế năng
 * điện", Bài 20 "Điện thế"). The negative plate is y = 0 and the reference (V = 0); the positive
 * plate is y = d, at V = U. The field points from + to −: E = U/d (20.5). A point at height y has
 * V = E·y; a charge q there has W = qV (19.2, 20.4). Moving it from M to N, the electric force does
 * A_MN = qU_MN = W_M − W_N (19.1, 20.3), whatever the path (Hình 19.1).
 */
export const CHARGE = { test: 0, electron: 1, proton: 2 } as const;
export const PATH = { straight: 0, broken: 1 } as const;

export interface Pt {
  x: number;
  y: number;
}

export interface Plates {
  /** Voltage between the plates, positive plate minus negative plate (V). */
  U: number;
  /** Plate separation (m). */
  d: number;
  /** Which charge: a test charge q, an electron or a proton. */
  kind: number;
  /** The charge (C, signed). */
  q: number;
  M: Pt;
  N: Pt;
  /** The corner of the broken path M → P → N (Hình 19.1). */
  P: Pt;
  path: number;
}

/**
 * Defaults: the textbook's worked example (Bài 20, tr. 81): U = 36 V, M in the middle of the gap,
 * N on the negative plate. The book gives no separation; d = 4 cm is illustrative.
 */
export const PLATE_DEFAULTS = {
  U: 36,
  d: 0.04,
  kind: CHARGE.test,
  q: 1e-9,
  hM: 0.02,
  hN: 0,
  dx: 0.02,
  path: PATH.straight,
} as const;

export function platesInput(p: Params): Plates {
  const kind = Math.round(p.kind ?? CHARGE.test);
  const d = p.d ?? PLATE_DEFAULTS.d;
  const q =
    kind === CHARGE.electron ? -C.e : kind === CHARGE.proton ? C.e : (p.q ?? PLATE_DEFAULTS.q);
  const M = { x: 0, y: p.hM ?? PLATE_DEFAULTS.hM };
  const N = { x: p.dx ?? PLATE_DEFAULTS.dx, y: p.hN ?? PLATE_DEFAULTS.hN };
  // P to the side of both points, a third of the way down from M (as in Hình 19.1).
  const P = {
    x: Math.max(M.x, N.x) + 0.3 * d,
    y: Math.min(d, Math.max(0, M.y - (M.y - N.y) / 3)),
  };
  return {
    U: p.U ?? PLATE_DEFAULTS.U,
    d,
    kind: kind === CHARGE.electron || kind === CHARGE.proton ? kind : CHARGE.test,
    q,
    M,
    N,
    P,
    path: Math.round(p.path ?? PATH.straight) === PATH.broken ? PATH.broken : PATH.straight,
  };
}

/** E = U/d (20.5): uniform between the plates. */
export const field = (q: Plates) => q.U / q.d;
/** V = E·y, the negative plate being the reference (Bài 20, "Bài tập ví dụ"). */
export const potential = (q: Plates, y: number) => field(q) * y;
/** W = qV (20.4). */
export const energy = (q: Plates, y: number) => q.q * potential(q, y);
/** A_MN = q(V_M − V_N) (20.3). */
export const work = (q: Plates, from: Pt, to: Pt) =>
  q.q * (potential(q, from.y) - potential(q, to.y));

/** Right end of the plates as drawn: past M, N and P by 0,35·d (2D and 3D pictures). */
export const rightEdge = (q: Plates) => Math.max(q.M.x, q.N.x, q.P.x) + 0.35 * q.d;

/** The points the charge goes through. */
export const pathPoints = (q: Plates): Pt[] =>
  q.path === PATH.broken ? [q.M, q.P, q.N] : [q.M, q.N];

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

export function pathLength(q: Plates): number {
  const pts = pathPoints(q);
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1] ?? q.M, pts[i] ?? q.N);
  return s;
}

/** The point a distance s along the path (clamped to its ends). */
export function pointAt(q: Plates, s: number): Pt {
  const pts = pathPoints(q);
  let left = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] ?? q.M;
    const b = pts[i] ?? q.N;
    const len = dist(a, b);
    if (left <= len || i === pts.length - 1) {
      const f = len > 0 ? Math.min(1, left / len) : 1;
      return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) };
    }
    left -= len;
  }
  return q.N;
}

/** Both points lie between the plates, and the plates are apart. */
export const isValid = (q: Plates) =>
  q.d > 0 &&
  Number.isFinite(q.U) &&
  [q.M.y, q.N.y].every((y) => y >= 0 && y <= q.d + 1e-12) &&
  Number.isFinite(q.N.x);

/**
 * Independent check of a potential: DOPRI5 integrates dV/dy = E up a field line from the
 * negative plate (V = 0) to height y.
 */
export function integratedPotential(q: Plates, y: number): number {
  if (y <= 0) return 0;
  const E = field(q);
  return (
    dopri5(
      (_t, _y, d) => {
        d[0] = E;
      },
      [0],
      0,
      y,
      { rtol: 1e-12, atol: 1e-15 * Math.max(1, Math.abs(q.U)) },
    ).y[0] ?? Number.NaN
  );
}

/**
 * Independent check of A_MN: DOPRI5 integrates the force along each straight piece of the chosen
 * path, dA/ds = F·(unit tangent) = qE·(−Δy/ℓ) (the field points down, −y), and adds the pieces.
 */
export function integratedWork(q: Plates): number {
  const pts = pathPoints(q);
  const F = q.q * field(q);
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] ?? q.M;
    const b = pts[i] ?? q.N;
    const len = dist(a, b);
    if (len === 0) continue;
    const along = (F * -(b.y - a.y)) / len;
    total +=
      dopri5(
        (_t, _y, d) => {
          d[0] = along;
        },
        [0],
        0,
        len,
        { rtol: 1e-12, atol: 1e-30 },
      ).y[0] ?? Number.NaN;
  }
  return total;
}
