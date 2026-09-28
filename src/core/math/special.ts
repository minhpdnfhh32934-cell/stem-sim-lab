/**
 * Special functions needed for exact reference solutions.
 */

/**
 * Complete elliptic integral of the first kind K(k), modulus convention:
 *   K(k) = ∫₀^{π/2} dθ / √(1 − k² sin²θ),  0 ≤ k < 1.
 * Computed with the arithmetic–geometric mean: K(k) = π / (2·AGM(1, √(1−k²))).
 * Converges quadratically; accurate to machine precision.
 */
export function ellipticK(k: number): number {
  if (!(k >= 0 && k < 1)) throw new RangeError(`ellipticK: modulus must be in [0, 1), got ${k}`);
  let a = 1;
  let b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 64 && Math.abs(a - b) > 1e-16 * a; i++) {
    const an = (a + b) / 2;
    b = Math.sqrt(a * b);
    a = an;
  }
  return Math.PI / (2 * a);
}

/**
 * Exact period of a simple (frictionless, rigid massless rod) pendulum with amplitude θ₀:
 *   T = 4 √(L/g) · K(sin(θ₀/2)).
 */
export function pendulumPeriodExact(length: number, g: number, theta0: number): number {
  return 4 * Math.sqrt(length / g) * ellipticK(Math.sin(Math.abs(theta0) / 2));
}

/** Small-angle period T₀ = 2π √(L/g). */
export function pendulumPeriodSmallAngle(length: number, g: number): number {
  return 2 * Math.PI * Math.sqrt(length / g);
}

/**
 * Finds a root of f in [a, b], where f(a) and f(b) have opposite signs,
 * using the Illinois variant of regula falsi (superlinear, always bracketed).
 */
export function findRoot(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-13,
  maxIter = 200,
): number {
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Math.sign(fa) === Math.sign(fb)) throw new RangeError('findRoot: root not bracketed');
  for (let i = 0; i < maxIter; i++) {
    const c = b - (fb * (b - a)) / (fb - fa);
    const fc = f(c);
    if (fc === 0) return c;
    if (Math.sign(fc) !== Math.sign(fb)) {
      a = b;
      fa = fb;
    } else {
      fa /= 2;
    }
    b = c;
    fb = fc;
    if (Math.abs(b - a) <= tol * (1 + Math.abs(b))) return b;
  }
  return b;
}
