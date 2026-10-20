import { C } from '@/core/constants';
import { IntegrationError, allFinite, dopri5, trbdf2 } from '@/core/ode';

/**
 * Homogeneous reversible reaction with elementary mass-action kinetics:
 *   r = k_f·Π[reactant]^ν − k_r·Π[product]^ν,   d[X]/dt = ν_X·r (products +, reactants −).
 * At equilibrium Q = K = k_f/k_r (concentration units). Temperature changes both rate
 * constants by the Arrhenius law, so ΔH = Eₐ,f − Eₐ,r and K(T) follows van 't Hoff.
 */
export interface Term {
  species: string;
  nu: number;
}

export interface EquilibriumSystem {
  id: string;
  reactants: Term[];
  products: Term[];
}

export const SYSTEMS: EquilibriumSystem[] = [
  { id: 'a-b', reactants: [{ species: 'A', nu: 1 }], products: [{ species: 'B', nu: 1 }] },
  {
    id: 'a+b-c',
    reactants: [
      { species: 'A', nu: 1 },
      { species: 'B', nu: 1 },
    ],
    products: [{ species: 'C', nu: 1 }],
  },
  { id: '2a-b', reactants: [{ species: 'A', nu: 2 }], products: [{ species: 'B', nu: 1 }] },
  {
    id: 'a+b-c+d',
    reactants: [
      { species: 'A', nu: 1 },
      { species: 'B', nu: 1 },
    ],
    products: [
      { species: 'C', nu: 1 },
      { species: 'D', nu: 1 },
    ],
  },
];

export interface Kinetics {
  /** Rate constants at the reference temperature T0. */
  kf0: number;
  kr0: number;
  /** Activation energies (J/mol). */
  eaf: number;
  ear: number;
  T0: number;
}

export function speciesOf(s: EquilibriumSystem): string[] {
  return [...new Set([...s.reactants, ...s.products].map((t) => t.species))];
}

/** Arrhenius: k(T) = k(T0)·exp(−Eₐ/R·(1/T − 1/T0)). */
export function rateConstants(k: Kinetics, T: number): { kf: number; kr: number } {
  const f = (k0: number, ea: number) => k0 * Math.exp((-ea / C.R) * (1 / T - 1 / k.T0));
  return { kf: f(k.kf0, k.eaf), kr: f(k.kr0, k.ear) };
}

export function equilibriumConstant(k: Kinetics, T: number): number {
  const { kf, kr } = rateConstants(k, T);
  return kf / kr;
}

/** Reaction quotient Q = Π[P]^ν / Π[R]^ν (Infinity when a reactant is 0). */
export function quotient(s: EquilibriumSystem, c: Record<string, number>): number {
  const prod = (terms: Term[]) => terms.reduce((p, t) => p * (c[t.species] ?? 0) ** t.nu, 1);
  const den = prod(s.reactants);
  return den === 0 ? Infinity : prod(s.products) / den;
}

/** Le Chatelier from Q vs K: which way the reaction runs next. */
export function shiftDirection(q: number, K: number, rtol = 1e-3): 'forward' | 'backward' | 'none' {
  if (!Number.isFinite(q)) return 'backward';
  if (Math.abs(q - K) <= rtol * K) return 'none';
  return q < K ? 'forward' : 'backward';
}

/** Signed stoichiometric slope dc/dξ of each term: −ν for reactants, +ν for products. */
type SignedTerm = Term & { d: number };
const sideOf = (terms: Term[], sign: -1 | 1): SignedTerm[] =>
  terms.map((t) => ({ ...t, d: sign * t.nu }));

/**
 * Value and slope (d/dξ) of k·Π(c + d·ξ)^ν over one side of the reaction, with every factor
 * clamped at 0 (concentrations are never negative).
 */
function sideRate(
  terms: SignedTerm[],
  k: number,
  c0: Record<string, number>,
  xi: number,
): { v: number; dv: number } {
  const g = terms.map((t) => Math.max(0, (c0[t.species] ?? 0) + t.d * xi));
  let v = k;
  terms.forEach((t, i) => {
    v *= (g[i] ?? 0) ** t.nu;
  });
  let dv = 0;
  terms.forEach((ti, i) => {
    let part = k * ti.d * ti.nu * (g[i] ?? 0) ** (ti.nu - 1);
    terms.forEach((tj, j) => {
      if (j !== i) part *= (g[j] ?? 0) ** tj.nu;
    });
    dv += part;
  });
  return { v, dv };
}

/**
 * Exact solution of the mass-action kinetics in the reaction extent ξ (c_X = c_X⁰ + ν_X ξ):
 *   dξ/dt = r(ξ) = k_f Π[R]^ν − k_r Π[P]^ν.
 * When each side has total order ≤ 2, r is a quadratic aξ² + bξ + c and this Riccati equation
 * has the closed form (ξₑ = equilibrium root, λ = r′(ξₑ) ≤ 0, d₀ = ξ(0) − ξₑ, φ(x) = (eˣ − 1)/x)
 *   ξ(t) = ξₑ + d₀·e^{λt} / (1 − a·d₀·t·φ(λt)),
 * which is exact for any rate constants (no stiffness, no step size) and stays finite when
 * the two roots coincide. Returns null when the closed form does not apply.
 */
export function extentSolution(
  s: EquilibriumSystem,
  k: Kinetics,
  T: number,
  c0: Record<string, number>,
): ((t: number) => Record<string, number>) | null {
  const order = (terms: Term[]) => terms.reduce((n, t) => n + t.nu, 0);
  // A species on both sides, or a side of order > 2, has no quadratic rate.
  if (speciesOf(s).length !== s.reactants.length + s.products.length) return null;
  const oF = order(s.reactants);
  const oR = order(s.products);
  if (oF > 2 || oR > 2) return null;
  const { kf, kr } = rateConstants(k, T);
  const R = sideOf(s.reactants, -1);
  const P = sideOf(s.products, 1);
  const all = [...R, ...P];
  let lo = -Infinity;
  let hi = Infinity;
  for (const t of R) hi = Math.min(hi, (c0[t.species] ?? 0) / t.nu);
  for (const t of P) lo = Math.max(lo, -(c0[t.species] ?? 0) / t.nu);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return null;
  const rate = (xi: number) => {
    const f = sideRate(R, kf, c0, xi);
    const b = sideRate(P, kr, c0, xi);
    return { v: f.v - b.v, dv: f.dv - b.dv };
  };
  // r is strictly decreasing on [lo, hi] with r(lo) ≥ 0 ≥ r(hi): bisection to full precision.
  let a0 = lo;
  let b0 = hi;
  for (let i = 0; i < 2000; i++) {
    const mid = a0 + (b0 - a0) / 2;
    if (mid <= a0 || mid >= b0) break;
    if (rate(mid).v > 0) a0 = mid;
    else b0 = mid;
  }
  const xe = Math.abs(rate(b0).v) <= Math.abs(rate(a0).v) ? b0 : a0;
  const lambda = Math.min(0, rate(xe).dv);
  // Leading (ξ²) coefficient: k times the product of the factors' slopes on an order-2 side.
  const lead = (terms: SignedTerm[], kk: number, o: number) =>
    o === 2 ? kk * terms.reduce((p, t) => p * t.d ** t.nu, 1) : 0;
  const a = lead(R, kf, oF) - lead(P, kr, oR);
  if (![kf, kr, lambda, a, xe].every(Number.isFinite)) return null;
  const d0 = -xe;
  // The denominator 1 − a·d₀·t·φ(λt) falls monotonically towards 1 + a·d₀/λ (λ < 0) and
  // stays positive for the exact solution; if rounding breaks that, use the numerical path.
  if (lambda < 0 ? 1 + (a * d0) / lambda <= 0 : a * d0 > 0) return null;
  const phi = (x: number) => (x === 0 ? 1 : Math.expm1(x) / x);
  return (t: number) => {
    const den = 1 - a * d0 * t * phi(lambda * t);
    const xi = d0 === 0 ? xe : xe + (d0 * Math.exp(lambda * t)) / den;
    const x = Math.min(hi, Math.max(lo, Number.isFinite(xi) ? xi : xe));
    return Object.fromEntries(
      all.map((term) => [term.species, Math.max(0, (c0[term.species] ?? 0) + term.d * x)]),
    );
  };
}

/** Explicit DOPRI5 gives up after this many steps and the stiff solver takes over. */
const NONSTIFF_MAX_STEPS = 5000;
const RTOL = 1e-9;
const ATOL = 1e-12;

export interface IntegrateOptions {
  /** `performance.now()` time after which the numerical path stops early (smoothness first). */
  deadline?: number;
  /** Skip the closed form (tests use it to cross-check the numerical path). */
  numeric?: boolean;
}

export interface IntegrateResult {
  t: number[];
  c: Record<string, number>[];
  final: Record<string, number>;
  method: 'exact' | 'numeric';
}

/**
 * Integrates the kinetics from `c0` over `duration` at temperature T; returns samples
 * (every `dtSample`) and the final concentrations. Uses the exact closed form when the rate is
 * quadratic in ξ (every built-in system); otherwise DOPRI5 (rtol 1e-9), switching to the stiff
 * TR-BDF2 solver when DOPRI5 needs too many steps. With a `deadline` the numerical path may
 * stop before `duration`: the samples then end at the time actually reached (the simulation
 * slows down instead of losing accuracy). Throws IntegrationError when both solvers fail.
 */
export function integrate(
  s: EquilibriumSystem,
  k: Kinetics,
  T: number,
  c0: Record<string, number>,
  t0: number,
  duration: number,
  dtSample: number,
  options: IntegrateOptions = {},
): IntegrateResult {
  const names = speciesOf(s);
  const ts: number[] = [t0];
  const cs: Record<string, number>[] = [{ ...c0 }];
  const steps = Math.max(1, Math.round(duration / dtSample));
  const exact = options.numeric ? null : extentSolution(s, k, T, c0);
  if (exact) {
    for (let i = 1; i <= steps; i++) {
      const tau = (duration * i) / steps;
      const c = exact(tau);
      ts.push(t0 + tau);
      cs.push(Object.fromEntries(names.map((n) => [n, c[n] ?? 0])));
    }
    return { t: ts, c: cs, final: cs[cs.length - 1] ?? { ...c0 }, method: 'exact' };
  }
  const idx = new Map(names.map((n, i) => [n, i]));
  const { kf, kr } = rateConstants(k, T);
  const f = (_t: number, y: Float64Array, dy: Float64Array) => {
    let rf = kf;
    for (const r of s.reactants) rf *= Math.max(0, y[idx.get(r.species) ?? 0] ?? 0) ** r.nu;
    let rr = kr;
    for (const p of s.products) rr *= Math.max(0, y[idx.get(p.species) ?? 0] ?? 0) ** p.nu;
    const rate = rf - rr;
    dy.fill(0);
    for (const r of s.reactants) {
      const i = idx.get(r.species) ?? 0;
      dy[i] = (dy[i] ?? 0) - r.nu * rate;
    }
    for (const p of s.products) {
      const i = idx.get(p.species) ?? 0;
      dy[i] = (dy[i] ?? 0) + p.nu * rate;
    }
  };
  const deadline = options.deadline;
  const onStep =
    deadline === undefined ? undefined : () => (performance.now() > deadline ? false : undefined);
  const solve = (y: Float64Array, ta: number, tb: number): { t: number; y: Float64Array } => {
    try {
      return dopri5(f, y, ta, tb, {
        rtol: RTOL,
        atol: ATOL,
        maxSteps: NONSTIFF_MAX_STEPS,
        ...(onStep ? { onStep } : {}),
      });
    } catch (e) {
      if (!(e instanceof IntegrationError)) throw e;
      // Too many explicit steps: the system is stiff.
      return trbdf2(f, y, ta, tb, { rtol: RTOL, atol: ATOL, ...(onStep ? { onStep } : {}) });
    }
  };
  let t = t0;
  let cur = Float64Array.from(names.map((n) => c0[n] ?? 0));
  for (let i = 1; i <= steps; i++) {
    const t1 = t0 + (duration * i) / steps;
    const r = solve(cur, t, t1);
    if (!allFinite(r.y)) throw new IntegrationError('equilibrium: non-finite concentrations');
    cur = Float64Array.from(r.y);
    const stopped = r.t < t1;
    t = stopped ? r.t : t1;
    if (t > (ts[ts.length - 1] ?? t0)) {
      ts.push(t);
      cs.push(Object.fromEntries(names.map((n, j) => [n, Math.max(0, cur[j] ?? 0)])));
    }
    if (stopped) break;
  }
  return { t: ts, c: cs, final: cs[cs.length - 1] ?? { ...c0 }, method: 'numeric' };
}

/** "A + B ⇌ C" */
export function equationOf(s: EquilibriumSystem): string {
  const side = (t: EquilibriumSystem['reactants']) =>
    t.map((x) => `${x.nu > 1 ? String(x.nu) : ''}${x.species}`).join(' + ');
  return `${side(s.reactants)} ⇌ ${side(s.products)}`;
}
