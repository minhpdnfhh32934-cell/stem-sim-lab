import { dopri5 } from '@/core/ode/dopri5';
import type { OdeFn } from '@/core/ode/types';
import { freePart, settleTime, steady, type Forced } from './model';

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
 * sinusoid of angular frequency Ω, x² + (v/Ω)² is the amplitude squared at every instant, and
 * the free part (x_h, v_h) moves that reading by at most |(x_h, v_h/Ω)|. The integration runs
 * until the model's free part is below 1e-10·A in those terms (a large start or Ω ≪ ω₀ needs
 * longer than one settling time); only its length comes from the model, the reading is the
 * integrated motion's. Null when that takes longer than MAX_T.
 */
export function numericAmplitude(o: Forced): number | null {
  const A = steady(o).A;
  const fold = settleTime(o) / 21; // one e-fold of the slowest free mode
  const left = (t: number) => {
    const [xh, vh] = freePart(o, t);
    return Math.hypot(xh, vh / o.W);
  };
  let t1 = 21 * fold;
  while (t1 <= MAX_T && !(left(t1) <= 1e-10 * A)) t1 += fold;
  if (!(t1 <= MAX_T)) return null;
  const scale = Math.max(1e-6, Math.abs(o.x0), o.F0 / o.k);
  const y = dopri5(forcedLaw(o), [o.x0, o.v0], 0, t1, { rtol: 1e-11, atol: 1e-13 * scale }).y;
  return Math.hypot(y[0] ?? 0, (y[1] ?? 0) / o.W);
}
