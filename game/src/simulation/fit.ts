/** A straight line fitted to points, or why none was. */
export type LineFit =
  | {
      readonly status: 'fitted';
      /** Points used: those with finite coordinates. */
      readonly n: number;
      /** a in y = a·x + b, in y's unit per x's unit. */
      readonly slope: number;
      /** b, in y's unit. */
      readonly intercept: number;
      /** Σ (y − a·x − b)², the residual sum of squares. */
      readonly sse: number;
      /** 1 − SSE / Σ (y − ȳ)²; null when every y is the same (nothing to explain). */
      readonly r2: number | null;
      /** Standard error of the slope, √(SSE / (n − 2) / Σ (x − x̄)²); null below 3 points. */
      readonly slopeError: number | null;
      /** The measured range the line holds over: it is never drawn beyond it. */
      readonly xMin: number;
      readonly xMax: number;
    }
  | { readonly status: 'too-few' | 'same-x'; readonly n: number };

/**
 * The ordinary least-squares straight line y = a·x + b through the points, the intercept free
 * (never forced through 0): a = Σ (x − x̄)(y − ȳ) / Σ (x − x̄)², b = ȳ − a·x̄, from sums about the
 * means, so large offsets do not cancel. Points with a non-finite coordinate are left out. No
 * line for fewer than 2 points, or when every x is the same (Σ (x − x̄)² is 0, or only rounding).
 */
export function fitLine(points: readonly { readonly x: number; readonly y: number }[]): LineFit {
  const used = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = used.length;
  if (n < 2) return { status: 'too-few', n };
  let mx = 0;
  let my = 0;
  for (const p of used) {
    mx += p.x / n;
    my += p.y / n;
  }
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let xMin = Infinity;
  let xMax = -Infinity;
  for (const p of used) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
    xMin = Math.min(xMin, p.x);
    xMax = Math.max(xMax, p.x);
  }
  // Every x the same, up to rounding of the mean: no slope is defined.
  if (!(sxx > 1e-20 * n * Math.max(mx * mx, Number.MIN_VALUE))) return { status: 'same-x', n };
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (const p of used) sse += (p.y - slope * p.x - intercept) ** 2;
  return {
    status: 'fitted',
    n,
    slope,
    intercept,
    sse,
    r2: syy > 0 ? 1 - sse / syy : null,
    slopeError: n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : null,
    xMin,
    xMax,
  };
}
