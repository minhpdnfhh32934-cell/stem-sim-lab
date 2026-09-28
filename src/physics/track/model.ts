/**
 * Bead sliding without friction on a fixed track y = f(x) (it can never leave the track).
 * Lagrangian L = ½ m (1 + f′²) ẋ² − m g f(x) gives
 *   ẍ = −f′(x) (g + f″(x) ẋ²) / (1 + f′(x)²),
 * and mechanical energy ½ m v² + m g f(x) is conserved (v² = (1 + f′²) ẋ²).
 */
export interface Track {
  f: (x: number) => number;
  df: (x: number) => number;
  d2f: (x: number) => number;
  xMin: number;
  xMax: number;
}

/** Parabolic valley y = H (x/a)², x ∈ [−a, a]. */
export function parabola(H: number, a: number): Track {
  const k = H / (a * a);
  return { f: (x) => k * x * x, df: (x) => 2 * k * x, d2f: () => 2 * k, xMin: -a, xMax: a };
}

/**
 * Two Gaussian hills of heights H1 (left, at x = −a) and H2 (right, at x = +a) with
 * width w, on flat ground — a "roller coaster" for the energy question
 * "does it get over the second hill?".
 */
export function twoHills(H1: number, H2: number, a: number, w: number): Track {
  const g1 = (x: number) => Math.exp(-(((x + a) / w) ** 2));
  const g2 = (x: number) => Math.exp(-(((x - a) / w) ** 2));
  return {
    f: (x) => H1 * g1(x) + H2 * g2(x),
    df: (x) => (H1 * g1(x) * (-2 * (x + a))) / (w * w) + (H2 * g2(x) * (-2 * (x - a))) / (w * w),
    d2f: (x) =>
      H1 * g1(x) * ((4 * (x + a) ** 2) / w ** 4 - 2 / (w * w)) +
      H2 * g2(x) * ((4 * (x - a) ** 2) / w ** 4 - 2 / (w * w)),
    xMin: -a - 2.5 * w,
    xMax: a + 2.5 * w,
  };
}

export function trackAccel(tr: Track, g: number, x: number, xd: number): number {
  const d = tr.df(x);
  return (-d * (g + tr.d2f(x) * xd * xd)) / (1 + d * d);
}

/** Speed along the track from energy conservation at a point of height y. */
export function speedAt(g: number, y0: number, v0: number, y: number): number | null {
  const v2 = v0 * v0 + 2 * g * (y0 - y);
  return v2 >= 0 ? Math.sqrt(v2) : null;
}
