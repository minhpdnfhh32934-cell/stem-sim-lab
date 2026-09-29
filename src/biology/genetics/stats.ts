/** Statistics used by the genetics modules (χ² goodness-of-fit, RNG). */

function lnGamma(x: number): number {
  // Lanczos approximation (g = 7, n = 9), |error| < 1e-15 for x > 0.
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = c[0] ?? 1;
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += (c[i] ?? 0) / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularized lower incomplete gamma P(a, x) (series / continued fraction). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  // Continued fraction for Q(a, x) (Lentz).
  let b = x + 1 - a;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** p-value of a χ² statistic with `df` degrees of freedom: P(X ≥ chi2). */
export function chiSquarePValue(chi2: number, df: number): number {
  return Math.max(0, Math.min(1, 1 - gammaP(df / 2, chi2 / 2)));
}

export interface ChiSquare {
  chi2: number;
  df: number;
  p: number;
}

/** Pearson χ² for observed vs expected counts; `estimated` parameters reduce df. */
export function chiSquare(observed: number[], expected: number[], estimated = 0): ChiSquare {
  let chi2 = 0;
  observed.forEach((o, i) => {
    const e = expected[i] ?? 0;
    if (e > 0) chi2 += (o - e) ** 2 / e;
  });
  const df = Math.max(1, observed.length - 1 - estimated);
  return { chi2, df, p: chiSquarePValue(chi2, df) };
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exact binomial draw by summing Bernoulli trials (fine for n ≤ a few thousand). */
export function binomial(n: number, p: number, rand: () => number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rand() < p) k++;
  return k;
}
