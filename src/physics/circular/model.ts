import type { Params } from '../types';

/**
 * Uniform circular motion (SGK Vật lí 10; Halliday ch. 4 and 6). Pure formulas: the learner
 * gives the radius and ONE of v, ω, T or f; everything else follows exactly.
 */

/** Which quantity the learner gives (`mode` choice). */
export const MODE = { v: 0, omega: 1, period: 2, freq: 3 } as const;

export interface Circular {
  r: number;
  m: number;
  /** Speed (m/s). */
  v: number;
  /** Angular speed (rad/s), always > 0; the turning sense is `dir`. */
  omega: number;
  /** Period (s) and frequency (Hz). */
  T: number;
  f: number;
  /** Centripetal acceleration (m/s²) and force (N). */
  aC: number;
  F: number;
  phi0: number;
  /** +1 counterclockwise, −1 clockwise. */
  dir: 1 | -1;
}

export function circular(p: Params): Circular {
  const r = p.r ?? 1;
  const m = p.m ?? 0.5;
  const mode = p.mode ?? MODE.v;
  const omega =
    mode === MODE.omega
      ? (p.omega ?? 2)
      : mode === MODE.period
        ? (2 * Math.PI) / (p.T ?? Math.PI)
        : mode === MODE.freq
          ? 2 * Math.PI * (p.f ?? 1 / Math.PI)
          : (p.v ?? 2) / r;
  const v = mode === MODE.v ? (p.v ?? 2) : omega * r;
  const aC = (v * v) / r;
  return {
    r,
    m,
    v,
    omega,
    T: (2 * Math.PI) / omega,
    f: omega / (2 * Math.PI),
    aC,
    F: m * aC,
    phi0: p.phi0 ?? 0,
    dir: (p.dir ?? 1) < 0 ? -1 : 1,
  };
}

/** Kinematic state at time t, straight from t (no accumulated steps). */
export interface CircularState {
  phi: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
}

export function stateAt(c: Circular, t: number): CircularState {
  const phi = c.phi0 + c.dir * c.omega * t;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const w = c.dir * c.omega;
  return {
    phi,
    x: c.r * cos,
    y: c.r * sin,
    vx: -w * c.r * sin,
    vy: w * c.r * cos,
    ax: -c.omega * c.omega * c.r * cos,
    ay: -c.omega * c.omega * c.r * sin,
  };
}
