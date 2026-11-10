/** Pure helpers of the phase-portrait chart (PhaseChart.tsx): bounds, ticks, wrapped curves. */

export interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Bounds of every point with a 6 % margin; `origin` keeps (0, 0) inside (the phase circle). */
export function phaseBounds(
  sets: readonly (readonly [number, number])[][],
  origin: boolean,
): Bounds {
  let b: Bounds = origin
    ? { xMin: 0, xMax: 0, yMin: 0, yMax: 0 }
    : { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
  for (const set of sets) {
    for (const [x, y] of set) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      b = {
        xMin: Math.min(b.xMin, x),
        xMax: Math.max(b.xMax, x),
        yMin: Math.min(b.yMin, y),
        yMax: Math.max(b.yMax, y),
      };
    }
  }
  if (!Number.isFinite(b.xMin)) b = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const pad = (lo: number, hi: number): [number, number] => {
    const span = hi - lo || Math.abs(hi) || 1;
    return [lo - 0.06 * span, hi + 0.06 * span];
  };
  const [xMin, xMax] = pad(b.xMin, b.xMax);
  const [yMin, yMax] = pad(b.yMin, b.yMax);
  return { xMin, xMax, yMin, yMax };
}

/**
 * Widens one axis so both have the same units per pixel (a circle stays round), keeping each
 * range centred.
 */
export function equalScales(b: Bounds, width: number, height: number): Bounds {
  const perX = (b.xMax - b.xMin) / Math.max(1, width);
  const perY = (b.yMax - b.yMin) / Math.max(1, height);
  const per = Math.max(perX, perY);
  const cx = (b.xMin + b.xMax) / 2;
  const cy = (b.yMin + b.yMax) / 2;
  return {
    xMin: cx - (per * width) / 2,
    xMax: cx + (per * width) / 2,
    yMin: cy - (per * height) / 2,
    yMax: cy + (per * height) / 2,
  };
}

/** Tick values at 1, 2 or 5 × 10ⁿ covering [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    // Snap tiny float noise (0.30000000000000004 → 0.3; −1e-17 → 0).
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return out;
}

/**
 * A wrapped quantity (an angle in (−π, π]) jumps by about one period when it passes the edge:
 * the curve is split there so no line crosses the whole plot.
 */
export function splitAtWraps(
  points: readonly [number, number][],
  period: number | undefined,
): [number, number][][] {
  if (!period) return [[...points]];
  const out: [number, number][][] = [];
  let run: [number, number][] = [];
  let prev: number | null = null;
  for (const pt of points) {
    if (prev !== null && Math.abs(pt[0] - prev) > period / 2) {
      out.push(run);
      run = [];
    }
    run.push(pt);
    prev = pt[0];
  }
  out.push(run);
  return out.filter((r) => r.length > 0);
}
