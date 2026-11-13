/** A plot axis: its drawn range and the tick values on it ("nice" 1/2/2.5/5 × 10ⁿ steps). */
export interface Axis {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly ticks: readonly number[];
}

const NICE = [1, 2, 2.5, 5, 10];

/**
 * An axis covering [min, max] with about `count` intervals on round values, so a graph reads
 * like one drawn by hand: 0, 0.5, 1.0, 1.5 s rather than 0, 0.37, 0.74 s. A degenerate range
 * (a flat series) is widened so it still gets a scale.
 */
export function niceAxis(min: number, max: number, count = 5): Axis {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return { min: 0, max: 1, step: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  }
  if (max - min < 1e-12) {
    const pad = Math.abs(max) > 1e-12 ? Math.abs(max) * 0.1 : 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = (NICE.find((m) => m * magnitude >= raw - 1e-12) ?? 10) * magnitude;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let k = 0; lo + k * step <= hi + step * 1e-6; k++) ticks.push(round(lo + k * step));
  return { min: round(lo), max: round(hi), step, ticks };
}

/** Lowest and highest of the first `count` values. */
export function extent(values: ArrayLike<number>, count: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < count; i++) {
    const v = values[i] ?? NaN;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

/** A tick label with as many decimals as the step needs (no float noise like 0.30000000004). */
export function tickLabel(value: number, step: number): string {
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
  const text = value.toFixed(
    step % 1 === 0 ? 0 : decimals + (Number.isInteger(step * 10 ** decimals) ? 0 : 1),
  );
  return text === '-0' || /^-0\.0*$/.test(text) ? text.slice(1) : text;
}

/** Linear map from [a0, a1] to [b0, b1]. */
export const scale = (a0: number, a1: number, b0: number, b1: number) => (v: number) =>
  b0 + ((v - a0) / (a1 - a0 || 1)) * (b1 - b0);

const round = (v: number) => Math.round(v * 1e10) / 1e10;
