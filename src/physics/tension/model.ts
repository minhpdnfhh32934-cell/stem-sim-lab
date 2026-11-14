import type { Params } from '../types';

/**
 * A lamp of mass m hangs from a knot held by one vertical string, or by two strings that make
 * angles α₁ (left) and α₂ (right) with the vertical (VL10 Bài 17: trọng lực và lực căng).
 * Everything is at rest: the tensions balance the weight at the knot.
 */
export interface Hanging {
  m: number;
  g: number;
  two: boolean;
  /** Angles with the vertical (rad), 0 ≤ α < π/2. */
  a1: number;
  a2: number;
}

export function hanging(p: Params): Hanging {
  return {
    m: p.m ?? 2,
    g: p.g ?? 9.81,
    two: Math.round(p.strings ?? 2) === 2,
    a1: p.a1 ?? Math.PI / 6,
    a2: p.a2 ?? Math.PI / 3,
  };
}

export const weight = (h: Hanging) => h.m * h.g;

/** Two vertical strings share the load in a way statics cannot tell (it depends on stretch). */
export const indeterminate = (h: Hanging) => h.two && h.a1 + h.a2 < 1e-9;

/** Lamy's rule: T₁ = P·sin α₂ / sin(α₁ + α₂), T₂ = P·sin α₁ / sin(α₁ + α₂). One string: T = P. */
export function tensions(h: Hanging): { T1: number; T2: number } {
  const P = weight(h);
  if (!h.two) return { T1: P, T2: 0 };
  const s = Math.sin(h.a1 + h.a2);
  return { T1: (P * Math.sin(h.a2)) / s, T2: (P * Math.sin(h.a1)) / s };
}

/**
 * Independent check: the two balance equations at the knot solved as a linear system
 * (Cramer's rule), no trigonometric identity used.
 * Horizontal: −T₁ sin α₁ + T₂ sin α₂ = 0; vertical: T₁ cos α₁ + T₂ cos α₂ = P.
 */
export function tensionsByComponents(h: Hanging): { T1: number; T2: number } | null {
  if (!h.two) return { T1: weight(h), T2: 0 };
  const [a, b, c, d] = [-Math.sin(h.a1), Math.sin(h.a2), Math.cos(h.a1), Math.cos(h.a2)];
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return null;
  const P = weight(h);
  // [a b; c d]·[T1; T2] = [0; P]
  return { T1: (0 * d - b * P) / det, T2: (a * P - c * 0) / det };
}
