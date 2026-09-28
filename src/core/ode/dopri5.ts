import { findRoot } from '../math/special';
import {
  IntegrationError,
  allFinite,
  type EventHit,
  type IntegrationStats,
  type OdeEvent,
  type OdeFn,
} from './types';

/*
 * Dormand–Prince 5(4) embedded Runge–Kutta pair with adaptive step size
 * (Dormand & Prince, J. Comput. Appl. Math. 6 (1980) 19–26; Hairer, Nørsett & Wanner,
 * "Solving ODEs I", §II.5). The 5th-order solution is propagated (local extrapolation).
 */
const C2 = 1 / 5,
  C3 = 3 / 10,
  C4 = 4 / 5,
  C5 = 8 / 9;
const A21 = 1 / 5;
const A31 = 3 / 40,
  A32 = 9 / 40;
const A41 = 44 / 45,
  A42 = -56 / 15,
  A43 = 32 / 9;
const A51 = 19372 / 6561,
  A52 = -25360 / 2187,
  A53 = 64448 / 6561,
  A54 = -212 / 729;
const A61 = 9017 / 3168,
  A62 = -355 / 33,
  A63 = 46732 / 5247,
  A64 = 49 / 176,
  A65 = -5103 / 18656;
// 5th-order weights (also row 7 of the tableau: FSAL).
const B1 = 35 / 384,
  B3 = 500 / 1113,
  B4 = 125 / 192,
  B5 = -2187 / 6784,
  B6 = 11 / 84;
// Error weights e = b(5) − b*(4).
const E1 = 71 / 57600,
  E3 = -71 / 16695,
  E4 = 71 / 1920,
  E5 = -17253 / 339200,
  E6 = 22 / 525,
  E7 = -1 / 40;

export interface Dopri5Options {
  rtol?: number;
  atol?: number;
  /** Initial step; estimated automatically when omitted. */
  h0?: number;
  hMax?: number;
  maxSteps?: number;
  events?: OdeEvent[];
  /** Called after every accepted step. Return `false` to stop. */
  onStep?: (t: number, y: Float64Array) => boolean | undefined;
}

export interface Dopri5Result {
  t: number;
  y: Float64Array;
  events: EventHit[];
  /** Set when a terminal event stopped the integration. */
  stoppedBy?: string;
  stats: IntegrationStats;
}

/** Single-step workspace; exposed for event localisation. */
class Stepper {
  readonly k1: Float64Array;
  readonly k2: Float64Array;
  readonly k3: Float64Array;
  readonly k4: Float64Array;
  readonly k5: Float64Array;
  readonly k6: Float64Array;
  readonly k7: Float64Array;
  readonly tmp: Float64Array;
  fEvals = 0;

  constructor(
    readonly f: OdeFn,
    readonly n: number,
  ) {
    this.k1 = new Float64Array(n);
    this.k2 = new Float64Array(n);
    this.k3 = new Float64Array(n);
    this.k4 = new Float64Array(n);
    this.k5 = new Float64Array(n);
    this.k6 = new Float64Array(n);
    this.k7 = new Float64Array(n);
    this.tmp = new Float64Array(n);
  }

  private eval(t: number, y: Float64Array, out: Float64Array) {
    this.fEvals++;
    this.f(t, y, out);
  }

  /**
   * Computes y(t+h) into `out` assuming k1 = f(t, y) is already set.
   * Returns the scaled RMS error norm (≤ 1 means acceptable) when `rtol/atol` are given.
   */
  step(t: number, y: Float64Array, h: number, out: Float64Array, rtol: number, atol: number) {
    const { n, k1, k2, k3, k4, k5, k6, k7, tmp } = this;
    const g = (a: Float64Array, i: number) => a[i] ?? 0;
    for (let i = 0; i < n; i++) tmp[i] = g(y, i) + h * A21 * g(k1, i);
    this.eval(t + C2 * h, tmp, k2);
    for (let i = 0; i < n; i++) tmp[i] = g(y, i) + h * (A31 * g(k1, i) + A32 * g(k2, i));
    this.eval(t + C3 * h, tmp, k3);
    for (let i = 0; i < n; i++) {
      tmp[i] = g(y, i) + h * (A41 * g(k1, i) + A42 * g(k2, i) + A43 * g(k3, i));
    }
    this.eval(t + C4 * h, tmp, k4);
    for (let i = 0; i < n; i++) {
      tmp[i] = g(y, i) + h * (A51 * g(k1, i) + A52 * g(k2, i) + A53 * g(k3, i) + A54 * g(k4, i));
    }
    this.eval(t + C5 * h, tmp, k5);
    for (let i = 0; i < n; i++) {
      tmp[i] =
        g(y, i) +
        h * (A61 * g(k1, i) + A62 * g(k2, i) + A63 * g(k3, i) + A64 * g(k4, i) + A65 * g(k5, i));
    }
    this.eval(t + h, tmp, k6);
    for (let i = 0; i < n; i++) {
      out[i] =
        g(y, i) +
        h * (B1 * g(k1, i) + B3 * g(k3, i) + B4 * g(k4, i) + B5 * g(k5, i) + B6 * g(k6, i));
    }
    this.eval(t + h, out, k7);

    let sum = 0;
    for (let i = 0; i < n; i++) {
      const err =
        h *
        (E1 * g(k1, i) +
          E3 * g(k3, i) +
          E4 * g(k4, i) +
          E5 * g(k5, i) +
          E6 * g(k6, i) +
          E7 * g(k7, i));
      const sc = atol + rtol * Math.max(Math.abs(g(y, i)), Math.abs(g(out, i)));
      sum += (err / sc) ** 2;
    }
    return Math.sqrt(sum / n);
  }
}

/**
 * Integrates y' = f(t, y) from t0 to t1 (t1 > t0) with error control and optional
 * event detection. Events are located to ~1e-12 relative precision by re-stepping
 * from the start of the step (no interpolation error).
 */
export function dopri5(
  f: OdeFn,
  y0: ArrayLike<number>,
  t0: number,
  t1: number,
  options: Dopri5Options = {},
): Dopri5Result {
  const rtol = options.rtol ?? 1e-9;
  const atol = options.atol ?? 1e-12;
  const hMax = options.hMax ?? Math.abs(t1 - t0);
  const maxSteps = options.maxSteps ?? 1_000_000;
  const events = options.events ?? [];
  if (!(t1 > t0)) throw new RangeError('dopri5: t1 must be greater than t0');

  const n = y0.length;
  const st = new Stepper(f, n);
  let t = t0;
  let y = Float64Array.from(y0);
  let yNew = new Float64Array(n);
  const hits: EventHit[] = [];
  const stats: IntegrationStats = { steps: 0, rejected: 0, fEvals: 0 };

  st.fEvals++;
  f(t, y, st.k1);
  let h = options.h0 ?? initialStep(st, t, y, rtol, atol, hMax);
  let gPrev = events.map((e) => e.g(t, y));

  while (t < t1) {
    if (stats.steps + stats.rejected >= maxSteps) {
      throw new IntegrationError(`dopri5: exceeded ${maxSteps} steps at t=${t}`);
    }
    h = Math.min(h, hMax, t1 - t);
    const err = st.step(t, y, h, yNew, rtol, atol);
    if (!allFinite(yNew) || !Number.isFinite(err)) {
      // Non-finite values: shrink hard and retry; give up if the step collapses.
      h *= 0.1;
      stats.rejected++;
      if (h < 1e-14 * Math.max(1, Math.abs(t))) {
        throw new IntegrationError(`dopri5: non-finite state at t=${t}`);
      }
      continue;
    }
    if (err > 1) {
      stats.rejected++;
      h *= Math.max(0.2, 0.9 * err ** -0.2);
      continue;
    }

    // Accepted step: check events on [t, t+h]. Event probing re-runs the stepper and
    // overwrites k7, so keep the accepted step's k7 for FSAL.
    const tNew = t + h;
    const k7Accepted = events.length > 0 ? Float64Array.from(st.k7) : st.k7;
    let stopped: string | undefined;
    const gNew = events.map((e) => e.g(tNew, yNew));
    const crossings: { index: number; tc: number }[] = [];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const b = gNew[i] ?? 0;
      if (!ev || (b === 0 && (gPrev[i] ?? 0) === 0)) continue;
      const probe = new Float64Array(n);
      const k1Saved = Float64Array.from(st.k1);
      const gAt = (s: number) => {
        st.k1.set(k1Saved);
        st.step(t, y, s, probe, rtol, atol);
        return ev.g(t + s, probe);
      };
      // Starting exactly on the event surface (e.g. a launch from the ground at y = 0):
      // judge the crossing from just after the start, otherwise a single long step that
      // leaves and re-crosses the surface would be missed.
      let lo = 0;
      let a = gPrev[i] ?? 0;
      if (a === 0) {
        lo = h * 1e-9;
        a = gAt(lo);
      }
      if (a === 0 || Math.sign(a) === Math.sign(b)) {
        st.k1.set(k1Saved);
        continue;
      }
      const rising = b > a;
      if ((ev.direction === 1 && !rising) || (ev.direction === -1 && rising)) {
        st.k1.set(k1Saved);
        continue;
      }
      const aLo = a;
      const tc = findRoot((s) => (s === lo ? aLo : gAt(s)), lo, h, 1e-14);
      st.k1.set(k1Saved);
      crossings.push({ index: i, tc });
    }

    // Several events may fall inside one step: record them in time order and stop at the
    // first terminal one (a non-terminal event must not hide a later terminal event).
    crossings.sort((p, q) => p.tc - q.tc);
    for (const c of crossings) {
      const ev = events[c.index];
      if (!ev) continue;
      const yc = new Float64Array(n);
      const k1Saved = Float64Array.from(st.k1);
      st.step(t, y, c.tc, yc, rtol, atol);
      st.k1.set(k1Saved);
      hits.push({ id: ev.id, t: t + c.tc, y: yc });
      if (ev.terminal) {
        stopped = ev.id;
        t = t + c.tc;
        y = yc;
        stats.steps++;
        stats.fEvals = st.fEvals;
        return { t, y, events: hits, stoppedBy: stopped, stats };
      }
    }

    // Commit the step (FSAL: k7 becomes the next k1).
    t = tNew;
    const swap = y;
    y = yNew;
    yNew = swap;
    st.k1.set(k7Accepted);
    gPrev = gNew;
    stats.steps++;
    if (options.onStep?.(t, y) === false) break;

    const factor = err === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * err ** -0.2));
    h *= factor;
  }
  stats.fEvals = st.fEvals;
  return { t, y, events: hits, stats };
}

/** Hairer–Wanner starting step heuristic (Solving ODEs I, §II.4). */
function initialStep(
  st: Stepper,
  t: number,
  y: Float64Array,
  rtol: number,
  atol: number,
  hMax: number,
): number {
  const n = y.length;
  let d0 = 0;
  let d1 = 0;
  for (let i = 0; i < n; i++) {
    const sc = atol + rtol * Math.abs(y[i] ?? 0);
    d0 += ((y[i] ?? 0) / sc) ** 2;
    d1 += ((st.k1[i] ?? 0) / sc) ** 2;
  }
  d0 = Math.sqrt(d0 / n);
  d1 = Math.sqrt(d1 / n);
  let h0 = d0 < 1e-5 || d1 < 1e-5 ? 1e-6 : 0.01 * (d0 / d1);
  h0 = Math.min(h0, hMax);
  const y1 = new Float64Array(n);
  for (let i = 0; i < n; i++) y1[i] = (y[i] ?? 0) + h0 * (st.k1[i] ?? 0);
  const f1 = new Float64Array(n);
  st.f(t + h0, y1, f1);
  st.fEvals++;
  let d2 = 0;
  for (let i = 0; i < n; i++) {
    const sc = atol + rtol * Math.abs(y[i] ?? 0);
    d2 += (((f1[i] ?? 0) - (st.k1[i] ?? 0)) / sc) ** 2;
  }
  d2 = Math.sqrt(d2 / n) / h0;
  const h1 =
    Math.max(d1, d2) <= 1e-15 ? Math.max(1e-6, h0 * 1e-3) : (0.01 / Math.max(d1, d2)) ** 0.2;
  return Math.min(100 * h0, h1, hMax);
}
