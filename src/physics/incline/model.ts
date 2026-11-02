import { heading } from '../common/coulomb1d';

/**
 * Block on an inclined plane (θ = 0 gives a horizontal surface) with an applied force
 * and Coulomb friction (static μs, kinetic μk). One coordinate s along the surface,
 * positive up the slope. Source: SGK Vật lí 10 (định luật Newton, lực ma sát);
 * Halliday–Resnick–Walker ch. 5–6.
 *
 * Forces along the surface:
 *   F cos β − m g sin θ − F_ms,   N = m g cos θ − F sin β
 * with β the angle of F above the surface direction (up-slope).
 */
export interface InclineInput {
  m: number;
  g: number;
  theta: number; // rad
  F: number;
  beta: number; // rad
  muS: number;
  muK: number;
  s0: number;
  v0: number;
  length: number;
}

export interface Forces {
  /** Normal force (N); negative means the block would lift off. */
  N: number;
  /** Driving force along +s without friction (N). */
  drive: number;
  /** Maximum static friction μs·N. */
  staticMax: number;
  kinetic: number;
}

export function forces(p: InclineInput): Forces {
  const N = p.m * p.g * Math.cos(p.theta) - p.F * Math.sin(p.beta);
  const drive = p.F * Math.cos(p.beta) - p.m * p.g * Math.sin(p.theta);
  return { N, drive, staticMax: p.muS * Math.max(N, 0), kinetic: p.muK * Math.max(N, 0) };
}

export type Regime = 'static' | 'up' | 'down';

/** Acceleration for a given velocity sign (and whether a resting block starts to move). */
export function accelFor(
  p: InclineInput,
  v: number,
): { a: number; regime: Regime; friction: number } {
  const f = forces(p);
  if (v > 0) return { a: (f.drive - f.kinetic) / p.m, regime: 'up', friction: -f.kinetic };
  if (v < 0) return { a: (f.drive + f.kinetic) / p.m, regime: 'down', friction: f.kinetic };
  if (Math.abs(f.drive) <= f.staticMax) return { a: 0, regime: 'static', friction: -f.drive };
  const dir = Math.sign(f.drive);
  return {
    a: (f.drive - dir * f.kinetic) / p.m,
    regime: dir > 0 ? 'up' : 'down',
    friction: -dir * f.kinetic,
  };
}

export interface Segment {
  t0: number;
  s0: number;
  v0: number;
  a: number;
  regime: Regime;
  friction: number;
  /** End time (Infinity if unbounded). */
  t1: number;
  end: 'rest' | 'bottom' | 'top' | 'none';
}

/**
 * Width of the band, relative to the size of the terms summed to get a stop position
 * (|s| + v²/|a| + L), within which a stop counts as a stop on an edge (#112). A tie (the stop
 * exactly on an edge) is decided by rounding otherwise — each side (formula, engine, check)
 * rounding its own way — and with a small |a| the two readings ("stops", "leaves") differ by
 * whole seconds. 1e-10 is far above that rounding (the engine's thousands of steps included) and
 * far below anything on a slider.
 */
export const EDGE_TIE = 1e-10;

/**
 * The block, at s with speed v and constant acceleration a against v, stops on an edge of the
 * surface [0, length] to within EDGE_TIE: it stops there; it does not leave. One rule for the
 * exact solution, the engine and the cross-check. `stop` defaults to s − v²/(2a).
 */
export function stopsOnEdge(
  s: number,
  v: number,
  a: number,
  length: number,
  stop = s - (v * v) / (2 * a),
): boolean {
  if (v === 0 || a === 0 || Math.sign(a) === Math.sign(v)) return false;
  const band = EDGE_TIE * (Math.abs(s) + (v * v) / Math.abs(a) + length);
  return Math.abs(stop) <= band || Math.abs(stop - length) <= band;
}

/**
 * Exact piecewise motion: constant acceleration between events (stop at v = 0,
 * leaving the surface at s = 0 or s = length). At each stop the static condition
 * is re-checked, so stick–slip is resolved exactly.
 */
export function segments(p: InclineInput, tMax = 1e4): Segment[] {
  const out: Segment[] = [];
  let t = 0;
  let s = p.s0;
  let v = p.v0;
  for (let guard = 0; guard < 16 && t < tMax; guard++) {
    const { a, regime, friction } = accelFor(p, v);
    if (regime === 'static') {
      out.push({ t0: t, s0: s, v0: 0, a: 0, regime, friction, t1: Infinity, end: 'none' });
      break;
    }
    // Candidate event times.
    let tEnd = Infinity;
    let end: Segment['end'] = 'none';
    if (a !== 0 && Math.sign(a) !== Math.sign(v) && v !== 0) {
      tEnd = -v / a;
      end = 'rest';
    }
    const hit = (target: number): number => {
      // s + v τ + ½ a τ² = target, smallest τ > 0.
      const A = 0.5 * a;
      const B = v;
      const C = s - target;
      if (Math.abs(A) < 1e-300) return B !== 0 && -C / B > 1e-15 ? -C / B : Infinity;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return Infinity;
      const r = Math.sqrt(disc);
      const roots = [(-B - r) / (2 * A), (-B + r) / (2 * A)].filter((x) => x > 1e-12);
      return roots.length ? Math.min(...roots) : Infinity;
    };
    // A stop on an edge is a stop (stopsOnEdge): the edge equation's double root is then
    // ignored, which rounding can split into two close roots just before the stop.
    const tie = stopsOnEdge(s, v, a, p.length);
    // On an edge and moving outward: the block leaves the surface at once (τ = 0).
    const dir = heading(v, a);
    const tb = tie ? Infinity : dir < 0 && s <= 0 ? 0 : hit(0);
    if (tb < tEnd) {
      tEnd = tb;
      end = 'bottom';
    }
    const tt = tie ? Infinity : dir > 0 && s >= p.length ? 0 : hit(p.length);
    if (tt < tEnd) {
      tEnd = tt;
      end = 'top';
    }
    out.push({ t0: t, s0: s, v0: v, a, regime, friction, t1: t + tEnd, end });
    if (end !== 'rest') break;
    s = s + v * tEnd + 0.5 * a * tEnd * tEnd;
    // A stop on an edge sits on it: rounded a hair beyond, the next segment would "cross" it.
    if (tie) s = Math.min(p.length, Math.max(0, s));
    t += tEnd;
    v = 0;
  }
  return out;
}

export function stateAt(
  segs: Segment[],
  t: number,
): { s: number; v: number; a: number; friction: number } {
  let seg = segs[0];
  for (const sg of segs) if (t >= sg.t0) seg = sg;
  if (!seg) return { s: 0, v: 0, a: 0, friction: 0 };
  const tau = Math.min(t, seg.t1) - seg.t0;
  const done = t >= seg.t1;
  return {
    s: seg.s0 + seg.v0 * tau + 0.5 * seg.a * tau * tau,
    v: done && seg.end === 'rest' ? 0 : seg.v0 + seg.a * tau,
    a: done ? 0 : seg.a,
    friction: seg.friction,
  };
}
