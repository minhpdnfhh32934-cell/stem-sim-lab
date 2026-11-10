/**
 * Fourier series of two ideal periodic waves (amplitude 1, period T = 1/f₁, odd functions):
 * the square wave sgn(sin ωt) and the sawtooth that rises from −1 to 1 over a period. The partial
 * sum S_N keeps harmonics n = 1…N; every coefficient is the closed form (Kreyszig ch. 11) and is
 * cross-checked by integrating the ideal wave numerically.
 */
export type Wave = 'square' | 'sawtooth';
export const WAVES: Wave[] = ['square', 'sawtooth'];

/** Sine coefficient b_n of harmonic n (the cosine ones are all 0: odd functions). */
export function coefficient(wave: Wave, n: number): number {
  if (wave === 'square') return n % 2 === 1 ? 4 / (n * Math.PI) : 0;
  return ((n % 2 === 1 ? 1 : -1) * 2) / (n * Math.PI);
}

/** The ideal wave at phase u = t/T (one period is u ∈ [0, 1)); 0 at the jumps. */
export function ideal(wave: Wave, u: number): number {
  const v = u - Math.floor(u);
  if (wave === 'square') return v === 0 || v === 0.5 ? 0 : v < 0.5 ? 1 : -1;
  // Sawtooth: 2v on [0, ½), 2v − 2 on [½, 1); 0 at the jump v = ½.
  return v === 0.5 ? 0 : v < 0.5 ? 2 * v : 2 * v - 2;
}

/** Partial sum S_N at phase u = t/T. */
export function partialSum(wave: Wave, N: number, u: number): number {
  let s = 0;
  for (let n = 1; n <= N; n++) s += coefficient(wave, n) * Math.sin(2 * Math.PI * n * u);
  return s;
}

/** The harmonics a partial sum keeps (non-zero coefficients only). */
export function harmonics(wave: Wave, N: number): { n: number; b: number }[] {
  return Array.from({ length: N }, (_, i) => ({ n: i + 1, b: coefficient(wave, i + 1) })).filter(
    (h) => h.b !== 0,
  );
}

/**
 * Independent check of b_n: (2/T)∫ f(t) sin(nωt) dt over a period, by the midpoint rule on the
 * ideal wave (never evaluated at a jump).
 */
export function numericCoefficient(wave: Wave, n: number, steps = 200_000): number {
  let s = 0;
  for (let i = 0; i < steps; i++) {
    const u = (i + 0.5) / steps;
    s += ideal(wave, u) * Math.sin(2 * Math.PI * n * u);
  }
  return (2 * s) / steps;
}

/**
 * Largest value of S_N just after the jump of the wave (the square wave's at t = 0, the
 * sawtooth's at T/2), found on a fine grid: how far the sum overshoots the wave's top (1).
 */
export function overshoot(wave: Wave, N: number, steps = 20_000): number {
  // The first peak after the jump lies within one period of the highest harmonic.
  const start = wave === 'square' ? 0 : 0.5;
  const span = 1 / Math.max(1, N);
  let best = -Infinity;
  for (let i = 0; i <= steps; i++) {
    const u = wave === 'square' ? start + (span * i) / steps : start - (span * i) / steps;
    best = Math.max(best, partialSum(wave, N, u));
  }
  return best - 1;
}
