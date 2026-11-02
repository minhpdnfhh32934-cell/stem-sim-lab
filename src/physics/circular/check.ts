import { dopri5 } from '@/core/ode/dopri5';
import type { OdeFn } from '@/core/ode/types';
import type { Circular } from './model';

/**
 * Independent cross-check: instead of the closed form, integrate Newton's law with the
 * centripetal force of `model.ts`, r″ = −(F_ht / (m·|r|))·r, from the starting point with a
 * tangential speed v. State [x, y, vx, vy].
 */
export function forceLaw(c: Circular): OdeFn {
  const k = c.F / c.m;
  return (_t, y, d) => {
    const x = y[0] ?? 0;
    const yy = y[1] ?? 0;
    const r = Math.hypot(x, yy);
    d[0] = y[2] ?? 0;
    d[1] = y[3] ?? 0;
    d[2] = (-k * x) / r;
    d[3] = (-k * yy) / r;
  };
}

export function forceLawStart(c: Circular): number[] {
  const cos = Math.cos(c.phi0);
  const sin = Math.sin(c.phi0);
  return [c.r * cos, c.r * sin, -c.dir * c.v * sin, c.dir * c.v * cos];
}

export const CHECK_TOL = { rtol: 1e-12 } as const;

/** Absolute tolerance on the scale of the motion (positions in m, speeds in m/s). */
export const checkAtol = (c: Circular): number => 1e-13 * Math.max(1, c.r, c.v);

/** Period measured on the integrated path: time between two upward crossings of y = 0. */
export function numericPeriod(c: Circular): number | null {
  const r = dopri5(forceLaw(c), forceLawStart(c), 0, 2.5 * c.T, {
    ...CHECK_TOL,
    atol: checkAtol(c),
    events: [{ id: 'up', g: (_t, y) => y[1] ?? 0, direction: 1 }],
  });
  const [a, b] = r.events;
  return a && b ? b.t - a.t : null;
}
