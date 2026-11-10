import { dopri5 } from '@/core/ode/dopri5';
import type { OdeFn } from '@/core/ode/types';
import { A, gm, perihelion, type Orbit } from './model';

/** Independent check: Newton's law of gravitation, r″ = −GM·r/|r|³. State [x, y, vx, vy]. */
export function gravity(o: Orbit): OdeFn {
  const k = gm(o);
  return (_t, y, d) => {
    const x = y[0] ?? 0;
    const yy = y[1] ?? 0;
    const r3 = Math.hypot(x, yy) ** 3;
    d[0] = y[2] ?? 0;
    d[1] = y[3] ?? 0;
    d[2] = (-k * x) / r3;
    d[3] = (-k * yy) / r3;
  };
}

/** Start at perihelion with the vis-viva speed √(GM(1 + e)/(a(1 − e))). */
export function startAtPerihelion(o: Orbit): number[] {
  return [perihelion(o), 0, 0, Math.sqrt((gm(o) * (1 + o.e)) / (A * (1 - o.e)))];
}

/** The integrated state at time t. */
export function integrate(o: Orbit, t: number): Float64Array {
  return dopri5(gravity(o), startAtPerihelion(o), 0, t, { rtol: 1e-12, atol: 1e-14 }).y;
}

/** v at perihelion over v at aphelion, both from the integrated motion (aphelion at t = T/2). */
export function numericSpeedRatio(o: Orbit): number {
  const s = integrate(o, o.T / 2);
  const vPeri = startAtPerihelion(o)[3] ?? 0;
  return vPeri / Math.hypot(s[2] ?? 0, s[3] ?? 0);
}
