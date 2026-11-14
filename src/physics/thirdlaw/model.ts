import type { Params } from '../types';

/**
 * Two carts at rest on a smooth horizontal track, a light spring fixed to cart 1 and compressed
 * by d against cart 2 (Newton's third law, VL10 Bài 16). Released at t = 0, the spring pushes
 * both carts with forces of equal size and opposite direction until it reaches its natural
 * length; cart 2 then leaves it and both carts coast.
 */
export interface ThirdLawInput {
  m1: number;
  m2: number;
  k: number;
  /** Compression at release (m), 0 < d < l0. */
  d: number;
  /** Natural length of the spring (m). */
  l0: number;
}

export function thirdLawInput(p: Params): ThirdLawInput {
  return {
    m1: p.m1 ?? 1,
    m2: p.m2 ?? 2,
    k: p.k ?? 20,
    d: p.d ?? 0.1,
    l0: p.l0 ?? 0.15,
  };
}

/** Reduced mass μ = m₁m₂/(m₁ + m₂): the relative motion is that of one body of mass μ. */
export const reducedMass = (q: ThirdLawInput) => (q.m1 * q.m2) / (q.m1 + q.m2);

/** Angular frequency of the relative motion while the spring pushes, ω = √(k/μ). */
export const omega = (q: ThirdLawInput) => Math.sqrt(q.k / reducedMass(q));

/** The spring reaches its natural length after a quarter period: t* = π/(2ω). */
export const contactTime = (q: ThirdLawInput) => Math.PI / (2 * omega(q));

/** Velocities after separation (momentum stays 0, the spring's energy ½kd² is shared). */
export function finalVelocities(q: ThirdLawInput): { v1: number; v2: number } {
  const M = q.m1 + q.m2;
  const rel = q.d * omega(q);
  return { v1: (-q.m2 / M) * rel, v2: (q.m1 / M) * rel };
}

/** Cart widths for the picture only (they grow with the cube root of the mass). */
export const cartWidth = (m: number) => Math.min(0.45, Math.max(0.14, 0.24 * Math.cbrt(m)));

export interface ThirdLawState {
  x1: number;
  v1: number;
  x2: number;
  v2: number;
  /** Size of the spring force (N): the same on both carts. */
  F: number;
}

/**
 * Exact state at time t ≥ 0. The centre of mass stays at x = 0 (the system starts at rest and
 * no horizontal external force acts). The gap between the carts is l0 + s, with
 * s = −d·cos ωt while the spring pushes and s = d·ω·(t − t*) afterwards.
 */
export function stateAt(q: ThirdLawInput, t: number): ThirdLawState {
  const M = q.m1 + q.m2;
  const w = omega(q);
  const tc = contactTime(q);
  const pushing = t < tc;
  const s = pushing ? -q.d * Math.cos(w * t) : q.d * w * (t - tc);
  const ds = pushing ? q.d * w * Math.sin(w * t) : q.d * w;
  // Centre-to-centre distance: half of each cart plus the spring between them.
  const D = (cartWidth(q.m1) + cartWidth(q.m2)) / 2 + q.l0 + s;
  return {
    x1: (-q.m2 / M) * D,
    v1: (-q.m2 / M) * ds,
    x2: (q.m1 / M) * D,
    v2: (q.m1 / M) * ds,
    F: pushing ? q.k * q.d * Math.cos(w * t) : 0,
  };
}
