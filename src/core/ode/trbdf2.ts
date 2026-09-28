import { luDecompose, luSolve, SingularMatrixError, type LU } from '../numeric/linalg';
import { IntegrationError, allFinite, type IntegrationStats, type OdeFn } from './types';

/*
 * TR-BDF2: an L-stable, second-order, one-step implicit method for stiff systems
 * (Bank, Coughran, Fichtner et al., IEEE Trans. CAD 4 (1985); Hosea & Shampine,
 * Appl. Numer. Math. 20 (1996)). A trapezoidal stage to t+γh is followed by a BDF2 stage,
 * with γ = 2 − √2 so both stages share the same Newton matrix I − (γ/2)·h·J.
 *
 * Error control uses step doubling (one step of h vs two of h/2), which is simple and
 * robust for the small systems in this app (chemical kinetics, Hodgkin–Huxley).
 */
const GAMMA = 2 - Math.SQRT2;
const D = GAMMA / 2; // = (1 − γ)/(2 − γ) for γ = 2 − √2
const W_Z = 1 / (GAMMA * (2 - GAMMA));
const W_Y = ((1 - GAMMA) * (1 - GAMMA)) / (GAMMA * (2 - GAMMA));

export type JacobianFn = (t: number, y: Float64Array, jac: Float64Array) => void;

export interface TrBdf2Options {
  rtol?: number;
  atol?: number;
  h0?: number;
  hMax?: number;
  maxSteps?: number;
  /** Analytic Jacobian ∂f/∂y (row-major n×n). Finite differences are used otherwise. */
  jacobian?: JacobianFn;
  onStep?: (t: number, y: Float64Array) => boolean | undefined;
}

export interface TrBdf2Result {
  t: number;
  y: Float64Array;
  stats: IntegrationStats;
}

class NewtonFailure extends Error {}

class Core {
  readonly n: number;
  fEvals = 0;
  private readonly jac: Float64Array;
  private readonly mat: Float64Array;
  private readonly fx: Float64Array;
  private readonly res: Float64Array;
  private readonly delta: Float64Array;
  private readonly fy: Float64Array;
  private readonly rhs: Float64Array;
  private readonly z: Float64Array;

  constructor(
    readonly f: OdeFn,
    n: number,
    private readonly jacobianFn: JacobianFn | undefined,
    private readonly rtol: number,
    private readonly atol: number,
  ) {
    this.n = n;
    this.jac = new Float64Array(n * n);
    this.mat = new Float64Array(n * n);
    this.fx = new Float64Array(n);
    this.res = new Float64Array(n);
    this.delta = new Float64Array(n);
    this.fy = new Float64Array(n);
    this.rhs = new Float64Array(n);
    this.z = new Float64Array(n);
  }

  private evalF(t: number, y: Float64Array, out: Float64Array) {
    this.fEvals++;
    this.f(t, y, out);
  }

  private computeJacobian(t: number, y: Float64Array) {
    const { n, jac } = this;
    if (this.jacobianFn) {
      this.jacobianFn(t, y, jac);
      return;
    }
    const f0 = new Float64Array(n);
    const f1 = new Float64Array(n);
    const yp = Float64Array.from(y);
    this.evalF(t, y, f0);
    for (let j = 0; j < n; j++) {
      const yj = y[j] ?? 0;
      const eps = Math.sqrt(Number.EPSILON) * Math.max(Math.abs(yj), this.atol / this.rtol, 1e-8);
      yp[j] = yj + eps;
      this.evalF(t, yp, f1);
      yp[j] = yj;
      for (let i = 0; i < n; i++) jac[i * n + j] = ((f1[i] ?? 0) - (f0[i] ?? 0)) / eps;
    }
  }

  /** Solves x − c·h·f(τ, x) = rhs by modified Newton, starting from `x` (in place). */
  private newton(tau: number, ch: number, lu: LU, rhs: Float64Array, x: Float64Array) {
    const { n, fx, res, delta } = this;
    for (let iter = 0; iter < 12; iter++) {
      this.evalF(tau, x, fx);
      for (let i = 0; i < n; i++) res[i] = (rhs[i] ?? 0) - (x[i] ?? 0) + ch * (fx[i] ?? 0);
      luSolve(lu, res, delta);
      let norm = 0;
      for (let i = 0; i < n; i++) {
        x[i] = (x[i] ?? 0) + (delta[i] ?? 0);
        const sc = this.atol + this.rtol * Math.abs(x[i] ?? 0);
        norm = Math.max(norm, Math.abs(delta[i] ?? 0) / sc);
      }
      if (!allFinite(x)) throw new NewtonFailure();
      if (norm < 1e-3) return;
    }
    throw new NewtonFailure();
  }

  /** One TR-BDF2 step of size h from (t, y); result written to `out`. */
  step(t: number, y: Float64Array, h: number, out: Float64Array) {
    const { n, jac, mat, fy, rhs, z } = this;
    this.computeJacobian(t, y);
    const ch = D * h;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        mat[i * n + j] = (i === j ? 1 : 0) - ch * (jac[i * n + j] ?? 0);
      }
    }
    let lu: LU;
    try {
      lu = luDecompose(mat, n);
    } catch (e) {
      if (e instanceof SingularMatrixError) throw new NewtonFailure();
      throw e;
    }
    // Stage 1: trapezoid to t + γh.
    this.evalF(t, y, fy);
    for (let i = 0; i < n; i++) {
      rhs[i] = (y[i] ?? 0) + ch * (fy[i] ?? 0);
      z[i] = (y[i] ?? 0) + GAMMA * h * (fy[i] ?? 0);
    }
    this.newton(t + GAMMA * h, ch, lu, rhs, z);
    // Stage 2: BDF2 to t + h.
    for (let i = 0; i < n; i++) {
      rhs[i] = W_Z * (z[i] ?? 0) - W_Y * (y[i] ?? 0);
      out[i] = z[i] ?? 0;
    }
    this.newton(t + h, ch, lu, rhs, out);
  }
}

/** Integrates a (possibly stiff) system from t0 to t1 with adaptive TR-BDF2. */
export function trbdf2(
  f: OdeFn,
  y0: ArrayLike<number>,
  t0: number,
  t1: number,
  options: TrBdf2Options = {},
): TrBdf2Result {
  const rtol = options.rtol ?? 1e-6;
  const atol = options.atol ?? 1e-9;
  const hMax = options.hMax ?? t1 - t0;
  const maxSteps = options.maxSteps ?? 200_000;
  if (!(t1 > t0)) throw new RangeError('trbdf2: t1 must be greater than t0');

  const n = y0.length;
  const core = new Core(f, n, options.jacobian, rtol, atol);
  let t = t0;
  const y = Float64Array.from(y0);
  const big = new Float64Array(n);
  const half = new Float64Array(n);
  const small = new Float64Array(n);
  const stats: IntegrationStats = { steps: 0, rejected: 0, fEvals: 0 };
  let h = Math.min(options.h0 ?? (t1 - t0) * 1e-4, hMax);

  while (t < t1) {
    if (stats.steps + stats.rejected >= maxSteps) {
      throw new IntegrationError(`trbdf2: exceeded ${maxSteps} steps at t=${t}`);
    }
    h = Math.min(h, hMax, t1 - t);
    if (h < 1e-15 * Math.max(1, Math.abs(t))) {
      throw new IntegrationError(`trbdf2: step size underflow at t=${t}`);
    }
    try {
      core.step(t, y, h, big);
      core.step(t, y, h / 2, half);
      core.step(t + h / 2, half, h / 2, small);
    } catch (e) {
      if (e instanceof NewtonFailure) {
        stats.rejected++;
        h *= 0.25;
        continue;
      }
      throw e;
    }
    // Richardson estimate of the local error of the two half steps (order 2 → /(2²−1)).
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const err = ((small[i] ?? 0) - (big[i] ?? 0)) / 3;
      const sc = atol + rtol * Math.max(Math.abs(y[i] ?? 0), Math.abs(small[i] ?? 0));
      sum += (err / sc) ** 2;
    }
    const err = Math.sqrt(sum / n);
    if (!Number.isFinite(err) || err > 1) {
      stats.rejected++;
      h *= Number.isFinite(err) ? Math.max(0.2, 0.9 * err ** (-1 / 3)) : 0.25;
      continue;
    }
    t += h;
    y.set(small);
    stats.steps++;
    if (options.onStep?.(t, y) === false) break;
    h *= err === 0 ? 4 : Math.min(4, Math.max(0.2, 0.9 * err ** (-1 / 3)));
  }
  stats.fEvals = core.fEvals;
  return { t, y, stats };
}
