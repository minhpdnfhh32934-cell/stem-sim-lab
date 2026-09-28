/**
 * One-degree-of-freedom motion under a constant driving force D and Coulomb friction
 * (static limit Fs, kinetic Fk), total inertia M:
 *   v ≠ 0: M a = D − Fk·sign(v)
 *   v = 0: stays if |D| ≤ Fs, else starts with M a = D − Fk·sign(D)
 * Between sign changes of v the acceleration is constant, so motion is exact piecewise.
 */
export interface Coulomb1D {
  M: number;
  D: number;
  Fs: number;
  Fk: number;
}

export type Regime1D = 'static' | 'pos' | 'neg';

export function accel1D(
  c: Coulomb1D,
  v: number,
): { a: number; regime: Regime1D; friction: number } {
  if (v > 0) return { a: (c.D - c.Fk) / c.M, regime: 'pos', friction: -c.Fk };
  if (v < 0) return { a: (c.D + c.Fk) / c.M, regime: 'neg', friction: c.Fk };
  if (Math.abs(c.D) <= c.Fs) return { a: 0, regime: 'static', friction: -c.D };
  const dir = Math.sign(c.D);
  return { a: (c.D - dir * c.Fk) / c.M, regime: dir > 0 ? 'pos' : 'neg', friction: -dir * c.Fk };
}

/** Smallest τ in (0, max] with s + vτ + ½aτ² = target, or Infinity. */
export function firstHit(s: number, v: number, a: number, target: number, max = Infinity): number {
  const A = 0.5 * a;
  const C = s - target;
  let roots: number[];
  if (Math.abs(A) < 1e-300) roots = v !== 0 ? [-C / v] : [];
  else {
    const disc = v * v - 4 * A * C;
    if (disc < 0) return Infinity;
    const r = Math.sqrt(disc);
    roots = [(-v - r) / (2 * A), (-v + r) / (2 * A)];
  }
  const ok = roots.filter((t) => t > 1e-12 && t <= max);
  return ok.length ? Math.min(...ok) : Infinity;
}

export interface Step1D {
  s: number;
  v: number;
  a: number;
  friction: number;
  /** Hit sMin or sMax during the step. */
  hitLimit: boolean;
  /** Seconds the body spent at rest during the step. */
  rest: number;
}

/**
 * Advances (s, v) by h exactly, resolving stops (v = 0) and limits [sMin, sMax]
 * inside the step.
 */
export function advance1D(
  c: Coulomb1D,
  s: number,
  v: number,
  h: number,
  sMin: number,
  sMax: number,
): Step1D {
  let a = 0;
  let friction = 0;
  let rest = 0;
  for (let k = 0; k < 4 && h > 0; k++) {
    const r = accel1D(c, v);
    a = r.a;
    friction = r.friction;
    if (r.regime === 'static') {
      rest += h;
      return { s, v: 0, a: 0, friction, hitLimit: false, rest };
    }
    let tau = h;
    if (v !== 0 && r.a !== 0 && Math.sign(r.a) !== Math.sign(v)) tau = Math.min(tau, -v / r.a);
    const tb = Math.min(firstHit(s, v, r.a, sMin, tau), firstHit(s, v, r.a, sMax, tau));
    if (tb <= tau) {
      const ns = Math.min(sMax, Math.max(sMin, s + v * tb + 0.5 * r.a * tb * tb));
      return { s: ns, v: v + r.a * tb, a, friction, hitLimit: true, rest };
    }
    s += v * tau + 0.5 * r.a * tau * tau;
    v = tau < h ? 0 : v + r.a * tau;
    h -= tau;
  }
  return { s, v, a, friction, hitLimit: false, rest };
}
