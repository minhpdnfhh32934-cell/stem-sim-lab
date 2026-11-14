import type { Params } from '../types';

/**
 * A uniform rigid beam of length L pivoted at its middle, a weight m₁ hung d₁ to the left and
 * m₂ hung d₂ to the right (VL10 Bài 21: moment lực, cân bằng của vật rắn). Released level and at
 * rest: it stays level when the moments balance, otherwise it turns until its low end touches
 * the ground. θ is the beam's angle, counter-clockwise (left end down) positive.
 */
export interface Lever {
  m1: number;
  d1: number;
  m2: number;
  d2: number;
  /** Beam mass (kg): its weight acts at the pivot, so it adds inertia but no moment. */
  M: number;
  g: number;
}

/** Beam length and pivot height (m): the low end touches the ground at sin θ = H/(L/2). */
export const BEAM = 2;
export const PIVOT_H = 0.4;
export const THETA_MAX = Math.asin(PIVOT_H / (BEAM / 2));

export function lever(p: Params): Lever {
  return {
    m1: p.m1 ?? 1.5,
    d1: p.d1 ?? 0.4,
    m2: p.m2 ?? 1,
    d2: p.d2 ?? 0.8,
    M: p.M ?? 1,
    g: p.g ?? 9.81,
  };
}

/** Moments of the two weights about the pivot (N·m), with the beam level. */
export const moments = (q: Lever) => ({ M1: q.m1 * q.g * q.d1, M2: q.m2 * q.g * q.d2 });

/** Net moment with the beam level (N·m), counter-clockwise (left side down) positive. */
export const netMoment = (q: Lever) => (q.m1 * q.d1 - q.m2 * q.d2) * q.g;

/** Moment of inertia about the pivot (kg·m²): point weights plus the uniform beam. */
export const inertia = (q: Lever) => q.m1 * q.d1 ** 2 + q.m2 * q.d2 ** 2 + (q.M * BEAM ** 2) / 12;

/** Angular acceleration at angle θ: the lever arms shrink with cos θ. */
export const angularAccel = (q: Lever, theta: number) =>
  (netMoment(q) * Math.cos(theta)) / inertia(q);

/** Where m₂ must hang for balance: m₁d₁ = m₂d₂ (the moment rule). */
export const balanceDistance = (q: Lever) => (q.m1 * q.d1) / q.m2;

/** Balanced when the net moment is rounding only. */
export const balanced = (q: Lever) =>
  Math.abs(netMoment(q)) <= 1e-12 * (moments(q).M1 + moments(q).M2 + 1e-300);

/**
 * Time to tip from level to the ground, by quadrature of energy conservation:
 * ½θ′² = K·sin θ (K = |net moment|/I) gives t = ∫₀^θmax dθ/√(2K sin θ). With θ = s² the
 * 1/√θ singularity at 0 disappears; 8-point Gauss–Legendre on 8 panels (64 evaluations).
 */
export function tipTime(q: Lever): number {
  if (balanced(q)) return Infinity;
  const K = Math.abs(netMoment(q)) / inertia(q);
  const sMax = Math.sqrt(THETA_MAX);
  const f = (s: number) => {
    if (s === 0) return 2 / Math.sqrt(2 * K);
    return (2 * s) / Math.sqrt(2 * K * Math.sin(s * s));
  };
  return gaussLegendre(f, 0, sMax, 8);
}

// 8-point Gauss–Legendre nodes and weights on [−1, 1].
const GL_X = [
  -0.9602898564975363, -0.7966664774136267, -0.525532409916329, -0.1834346424956498,
  0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363,
];
const GL_W = [
  0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.362683783378362, 0.362683783378362,
  0.3137066458778873, 0.2223810344533745, 0.1012285362903763,
];

function gaussLegendre(f: (x: number) => number, a: number, b: number, panels: number): number {
  const h = (b - a) / panels;
  let sum = 0;
  for (let k = 0; k < panels; k++) {
    const mid = a + (k + 0.5) * h;
    for (let i = 0; i < GL_X.length; i++) sum += (GL_W[i] ?? 0) * f(mid + ((GL_X[i] ?? 0) * h) / 2);
  }
  return (sum * h) / 2;
}
