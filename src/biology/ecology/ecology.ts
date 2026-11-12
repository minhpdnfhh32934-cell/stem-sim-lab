import { dopri5 } from '@/core/ode';

/** Logistic growth dN/dt = rN(1 − N/K): exact solution. */
export function logistic(N0: number, r: number, K: number, t: number): number {
  if (N0 === 0) return 0;
  return K / (1 + (K / N0 - 1) * Math.exp(-r * t));
}

/**
 * Time t* ≥ 0 at which the logistic curve passes its inflection N = K/2, or NaN when it never
 * does for t ≥ 0 (N₀ ≥ K/2: the curve already starts at or above K/2).
 */
export function logisticInflection(N0: number, r: number, K: number): number {
  if (!(N0 > 0 && N0 < K / 2 && r > 0)) return NaN;
  return Math.log(K / N0 - 1) / r;
}

/** Exponential growth dN/dt = rN (for comparison). */
export const exponential = (N0: number, r: number, t: number) => N0 * Math.exp(r * t);

export interface LvParams {
  /** Prey birth rate α, predation rate β, predator efficiency δ, predator death rate γ. */
  alpha: number;
  beta: number;
  delta: number;
  gamma: number;
}

/**
 * Lotka–Volterra predator–prey model:
 *   dx/dt = αx − βxy,  dy/dt = δxy − γy.
 * Integrated in log variables u = ln x, v = ln y (du/dt = α − βeᵛ, dv/dt = δeᵘ − γ) with
 * DOPRI5: populations stay positive and keep their RELATIVE accuracy even when a population
 * collapses to 10⁻¹³⁰ (in x itself the absolute tolerance would swamp it). The conserved
 * quantity V monitors accuracy. x₀ and y₀ must be > 0 (a zero population stays zero).
 */
export function lotkaVolterra(
  p: LvParams,
  x0: number,
  y0: number,
  tEnd: number,
  samples: number,
): LvRun {
  return lvSegment(p, { t: 0, u: Math.log(x0), v: Math.log(y0) }, tEnd, samples);
}

export interface LvRun {
  t: number[];
  x: number[];
  y: number[];
  u: number[];
  v: number[];
}

/**
 * The run from a computed sample `from` (t, u = ln x, v = ln y) over `span`, `samples` steps: the
 * same DOPRI5 step by step as `lotkaVolterra`, so a run continued segment by segment from each
 * last sample is the run computed in one go (#205 C5: an endless lesson adds segments, it never
 * interpolates). Sample i is at from.t + i·span/samples.
 */
export function lvSegment(
  p: LvParams,
  from: { t: number; u: number; v: number },
  span: number,
  samples: number,
): LvRun {
  const f = (_t: number, s: Float64Array, d: Float64Array) => {
    const u = s[0] ?? 0;
    const v = s[1] ?? 0;
    d[0] = p.alpha - p.beta * Math.exp(v);
    d[1] = p.delta * Math.exp(u) - p.gamma;
  };
  const t: number[] = [from.t];
  const us: number[] = [from.u];
  const vs: number[] = [from.v];
  let state = Float64Array.from([from.u, from.v]);
  for (let i = 1; i <= samples; i++) {
    const t0 = from.t + ((i - 1) * span) / samples;
    const t1 = from.t + (i * span) / samples;
    state = Float64Array.from(dopri5(f, state, t0, t1, { rtol: 1e-10, atol: 1e-12 }).y);
    t.push(t1);
    us.push(state[0] ?? 0);
    vs.push(state[1] ?? 0);
  }
  return { t, x: us.map(Math.exp), y: vs.map(Math.exp), u: us, v: vs };
}

/** Conserved quantity of the Lotka–Volterra system. */
export function lvInvariant(p: LvParams, x: number, y: number): number {
  return lvInvariantLog(p, Math.log(x), Math.log(y));
}

/** The same invariant from u = ln x, v = ln y (no underflow for tiny populations). */
export function lvInvariantLog(p: LvParams, u: number, v: number): number {
  return p.delta * Math.exp(u) - p.gamma * u + p.beta * Math.exp(v) - p.alpha * v;
}

/** Largest relative change of V along a trajectory (0 for an exact solution). */
export function lvDrift(p: LvParams, traj: { u: number[]; v: number[] }): number {
  const v0 = lvInvariantLog(p, traj.u[0] ?? 0, traj.v[0] ?? 0);
  let drift = 0;
  traj.u.forEach((u, i) => {
    const v = lvInvariantLog(p, u, traj.v[i] ?? 0);
    drift = Math.max(drift, Math.abs(v - v0) / Math.max(1e-12, Math.abs(v0)));
  });
  return drift;
}

/** Above this drift of V the trajectory is flagged as less reliable in the view. */
export const LV_DRIFT_WARN = 1e-6;

/** Coexistence equilibrium (γ/δ, α/β) and the small-oscillation period 2π/√(αγ). */
export function lvEquilibrium(p: LvParams): { x: number; y: number; period: number } {
  return {
    x: p.gamma / p.delta,
    y: p.alpha / p.beta,
    period: (2 * Math.PI) / Math.sqrt(p.alpha * p.gamma),
  };
}
