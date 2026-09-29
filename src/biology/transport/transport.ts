import { C } from '@/core/constants';
import { dopri5 } from '@/core/ode';

/**
 * Diffusion between two compartments through a membrane (Fick):
 *   dC₁/dt = −(P·A/V₁)(C₁ − C₂),  dC₂/dt = +(P·A/V₂)(C₁ − C₂).
 * Exact solution: the difference decays as exp(−k t), k = P·A·(1/V₁ + 1/V₂).
 */
export function twoCompartment(
  c1: number,
  c2: number,
  v1: number,
  v2: number,
  pa: number,
  t: number,
): { c1: number; c2: number } {
  const ceq = (c1 * v1 + c2 * v2) / (v1 + v2);
  const k = pa * (1 / v1 + 1 / v2);
  const d = (c1 - c2) * Math.exp(-k * t);
  // c1 − ceq = d·V2/(V1+V2), c2 − ceq = −d·V1/(V1+V2)
  return { c1: ceq + (d * v2) / (v1 + v2), c2: ceq - (d * v1) / (v1 + v2) };
}

export interface OsmosisParams {
  /** Initial solute concentration in the left arm (mol/m³ = mM). */
  c0: number;
  /** van 't Hoff factor i (1 sucrose/glucose, ≈2 NaCl for an ideal solution). */
  i: number;
  T: number;
  /** Initial height of liquid in each arm (m). */
  h0: number;
  /** Water density (kg/m³) and g (m/s²). */
  rho: number;
  g: number;
  /** Membrane permeance (illustrative time scale), m/(Pa·s). */
  lp: number;
}

/**
 * U-tube osmometer: left arm solution, right arm pure water, semipermeable membrane at the
 * bottom. Water flows while the osmotic pressure Π = i·c·R·T (van 't Hoff, dilute solution)
 * exceeds the hydrostatic pressure ρ·g·Δh:
 *   dh_L/dt = L_p (Π − ρ g (h_L − h_R)),  h_L + h_R = 2h₀,  c = c₀h₀/h_L.
 */
export function osmosisRate(p: OsmosisParams, hL: number): number {
  const hR = 2 * p.h0 - hL;
  const pi = p.i * ((p.c0 * p.h0) / hL) * C.R * p.T;
  return p.lp * (pi - p.rho * p.g * (hL - hR));
}

/** Exact equilibrium height of the solution arm (root of the quadratic). */
export function osmosisEquilibrium(p: OsmosisParams): {
  hL: number;
  hR: number;
  dh: number;
  pi: number;
} {
  const a = 2 * p.rho * p.g;
  const b = -2 * p.rho * p.g * p.h0;
  const c = -p.i * p.c0 * p.h0 * C.R * p.T;
  const hL = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const hR = 2 * p.h0 - hL;
  return { hL, hR, dh: hL - hR, pi: p.i * ((p.c0 * p.h0) / hL) * C.R * p.T };
}

export function osmosisTrajectory(
  p: OsmosisParams,
  tEnd: number,
  samples: number,
): { t: number[]; hL: number[] } {
  const t: number[] = [0];
  const h: number[] = [p.h0];
  let y = Float64Array.from([p.h0]);
  for (let k = 1; k <= samples; k++) {
    const t0 = ((k - 1) * tEnd) / samples;
    const t1 = (k * tEnd) / samples;
    y = Float64Array.from(
      dopri5(
        (_t, s, d) => {
          d[0] = osmosisRate(p, s[0] ?? p.h0);
        },
        y,
        t0,
        t1,
        { rtol: 1e-10, atol: 1e-13 },
      ).y,
    );
    t.push(t1);
    h.push(y[0] ?? p.h0);
  }
  return { t, hL: h };
}

/** 2D Brownian random walk step (Gaussian, variance 2DΔt per axis). */
export function brownianStep(D: number, dt: number, rand: () => number): [number, number] {
  const u = Math.max(1e-12, rand());
  const v = rand();
  const r = Math.sqrt(-2 * Math.log(u)) * Math.sqrt(2 * D * dt);
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)];
}
