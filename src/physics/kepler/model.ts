import type { Params } from '../types';

/**
 * A planet on an ellipse around a fixed Sun at one focus (two-body problem, planet mass
 * negligible), in relative units: semi-major axis a = 1, period T in seconds (only how fast the
 * picture moves). Position from Kepler's equation M = E − e·sin E solved by Newton's method;
 * Kepler's second law: the radius vector sweeps area at the constant rate πab/T.
 * Sources: Halliday ch. 13; Murray & Dermott, Solar System Dynamics, ch. 2.
 */
export const A = 1;

export interface Orbit {
  e: number;
  T: number;
  /** Equal-time slices drawn per period. */
  N: number;
}

export function orbit(p: Params): Orbit {
  return {
    e: Math.min(0.95, Math.max(0, p.e ?? 0.5)),
    T: p.T ?? 12,
    N: Math.max(2, Math.round(p.N ?? 6)),
  };
}

export const semiMinor = (o: Orbit): number => A * Math.sqrt(1 - o.e * o.e);

/** Eccentric anomaly E with E − e·sin E = M (Newton's method, to rounding). */
export function eccentricAnomaly(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 60; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-15) break;
  }
  return E;
}

/** Position and velocity at time t (perihelion at t = 0 on +x, the Sun at the origin). */
export function stateAt(o: Orbit, t: number): { x: number; y: number; vx: number; vy: number } {
  const n = (2 * Math.PI) / o.T;
  const M = n * t;
  const E = eccentricAnomaly(M - 2 * Math.PI * Math.floor(M / (2 * Math.PI)), o.e);
  const b = semiMinor(o);
  const Edot = n / (1 - o.e * Math.cos(E));
  return {
    x: A * (Math.cos(E) - o.e),
    y: b * Math.sin(E),
    vx: -A * Math.sin(E) * Edot,
    vy: b * Math.cos(E) * Edot,
  };
}

/** Kepler's third law in these units: GM = 4π²a³/T². */
export const gm = (o: Orbit): number => (4 * Math.PI ** 2 * A ** 3) / o.T ** 2;

/** Area swept per unit time (a²/s): πab/T. */
export const arealVelocity = (o: Orbit): number => (Math.PI * A * semiMinor(o)) / o.T;

export const perihelion = (o: Orbit): number => A * (1 - o.e);
export const aphelion = (o: Orbit): number => A * (1 + o.e);
/** v at perihelion over v at aphelion: (1 + e)/(1 − e) (equal areal velocities at both ends). */
export const speedRatio = (o: Orbit): number => (1 + o.e) / (1 - o.e);

/** Points of the arc swept between t0 and t1 (for the drawn sector and the area check). */
export function arc(o: Orbit, t0: number, t1: number, steps = 64): { x: number; y: number }[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const s = stateAt(o, t0 + ((t1 - t0) * i) / steps);
    return { x: s.x, y: s.y };
  });
}

/** Area of the sector Sun–arc (shoelace on the polygon): a numerical check of Kepler's 2nd law. */
export function sectorArea(o: Orbit, t0: number, t1: number, steps = 2000): number {
  const pts = [{ x: 0, y: 0 }, ...arc(o, t0, t1, steps)];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i] ?? { x: 0, y: 0 };
    const q = pts[(i + 1) % pts.length] ?? { x: 0, y: 0 };
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}
