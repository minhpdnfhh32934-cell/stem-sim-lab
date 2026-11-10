import { dopri5 } from '@/core/ode/dopri5';
import type { OdeFn } from '@/core/ode/types';
import { settleTime, type Forced } from './model';

/** Independent cross-check: integrate m x″ = F₀ cos(Ωt) − b x′ − k x itself. State [x, v]. */
export function forcedLaw(o: Forced): OdeFn {
  return (t, y, d) => {
    const x = y[0] ?? 0;
    const v = y[1] ?? 0;
    d[0] = v;
    d[1] = (o.F0 * Math.cos(o.W * t) - o.b * v - o.k * x) / o.m;
  };
}

/** Longest integration the check runs (slow damping would need minutes of simulated time). */
const MAX_T = 1200;

/**
 * Steady amplitude measured on the integrated motion, once the free part has died out: for a
 * sinusoid of angular frequency Ω, x² + (v/Ω)² is the amplitude squared at every instant. Null
 * when the damping is too weak to settle within MAX_T.
 */
export function numericAmplitude(o: Forced): number | null {
  const t1 = settleTime(o);
  if (!(t1 <= MAX_T)) return null;
  const scale = Math.max(1e-6, Math.abs(o.x0), o.F0 / o.k);
  const r = dopri5(forcedLaw(o), [o.x0, o.v0], 0, t1, {
    rtol: 1e-11,
    atol: 1e-13 * scale,
  });
  const x = r.y[0] ?? 0;
  const v = r.y[1] ?? 0;
  return Math.hypot(x, v / o.W);
}
