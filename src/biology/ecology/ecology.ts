import { dopri5 } from '@/core/ode';

/** Logistic growth dN/dt = rN(1 − N/K): exact solution. */
export function logistic(N0: number, r: number, K: number, t: number): number {
  if (N0 === 0) return 0;
  return K / (1 + (K / N0 - 1) * Math.exp(-r * t));
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
 * Integrated with DOPRI5 (tight tolerances); the conserved quantity V monitors accuracy.
 */
export function lotkaVolterra(
  p: LvParams,
  x0: number,
  y0: number,
  tEnd: number,
  samples: number,
): { t: number[]; x: number[]; y: number[] } {
  const f = (_t: number, s: Float64Array, d: Float64Array) => {
    const x = s[0] ?? 0;
    const y = s[1] ?? 0;
    d[0] = p.alpha * x - p.beta * x * y;
    d[1] = p.delta * x * y - p.gamma * y;
  };
  const t: number[] = [0];
  const x: number[] = [x0];
  const y: number[] = [y0];
  let state = Float64Array.from([x0, y0]);
  for (let i = 1; i <= samples; i++) {
    const t0 = ((i - 1) * tEnd) / samples;
    const t1 = (i * tEnd) / samples;
    state = Float64Array.from(dopri5(f, state, t0, t1, { rtol: 1e-10, atol: 1e-12 }).y);
    t.push(t1);
    x.push(state[0] ?? 0);
    y.push(state[1] ?? 0);
  }
  return { t, x, y };
}

/** Conserved quantity of the Lotka–Volterra system. */
export function lvInvariant(p: LvParams, x: number, y: number): number {
  return p.delta * x - p.gamma * Math.log(x) + p.beta * y - p.alpha * Math.log(y);
}

/** Coexistence equilibrium (γ/δ, α/β) and the small-oscillation period 2π/√(αγ). */
export function lvEquilibrium(p: LvParams): { x: number; y: number; period: number } {
  return {
    x: p.gamma / p.delta,
    y: p.alpha / p.beta,
    period: (2 * Math.PI) / Math.sqrt(p.alpha * p.gamma),
  };
}
