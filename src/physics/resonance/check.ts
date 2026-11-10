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
 * sinusoid of angular frequency Ω, x² + (v/Ω)² is the amplitude squared at every instant. The
 * motion is integrated one settling time at a time (the free part shrinks by e⁻²¹ in each) until
 * that reading stops changing, since a large start or Ω ≪ ω₀ can leave a visible free part after
 * the first. Null when it does not settle within MAX_T.
 */
export function numericAmplitude(o: Forced): number | null {
  const span = settleTime(o);
  const scale = Math.max(1e-6, Math.abs(o.x0), o.F0 / o.k);
  let y: ArrayLike<number> = [o.x0, o.v0];
  let last = Number.NaN;
  for (let t = 0; t + span <= MAX_T; t += span) {
    y = dopri5(forcedLaw(o), y, t, t + span, { rtol: 1e-11, atol: 1e-13 * scale }).y;
    const amp = Math.hypot(y[0] ?? 0, (y[1] ?? 0) / o.W);
    if (Math.abs(amp - last) <= 1e-10 * amp) return amp;
    last = amp;
  }
  return null;
}
