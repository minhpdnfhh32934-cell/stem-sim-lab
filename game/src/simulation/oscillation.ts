import { fitLine } from './fit';
import type { RunData } from './RunRecord';

/** A turning point of the swing: its time (s) and its distance from rest (the amplitude). */
export interface Peak {
  readonly t: number;
  readonly amplitude: number;
}

/** What a recorded oscillation shows, measured from its samples, or why a part could not be. */
export interface OscillationMeasure {
  /** Times (s) the coordinate crosses its rest value going up (− to +), interpolated. */
  readonly crossings: readonly number[];
  /** The period over whole cycles between the first and last crossing used; null below 2 cycles. */
  readonly period: { readonly value: number; readonly cycles: number } | null;
  /** The maxima above the floor, each interpolated through its three samples. */
  readonly peaks: readonly Peak[];
  /**
   * ln A against t fitted with a straight line: the decay rate σ = −slope (1/s), its R², and when
   * a period was measured the logarithmic decrement δ = σ·T and the damping ratio
   * ζ = δ / √(4π² + δ²). Null below 3 peaks, or when the amplitude does not fall.
   */
  readonly decay: {
    readonly rate: number;
    readonly r2: number | null;
    readonly amplitude0: number;
    readonly decrement: number | null;
    readonly zeta: number | null;
  } | null;
  /** Below it, a swing is too small to read: a fraction of the largest distance from rest. */
  readonly floor: number;
}

/** Peaks smaller than this share of the largest distance from rest are not used. */
export const PEAK_FLOOR = 0.02;
/** Whole cycles needed before a period is given. */
export const MIN_CYCLES = 2;
/** Peaks needed before a decay rate is given. */
export const MIN_PEAKS = 3;

/**
 * Measures an oscillation about `rest` from its samples (`times`, `values`, the first `count`
 * valid), in simulated time — never per frame. Crossings of rest going up are interpolated
 * linearly between the two samples around them; the period is the time between the first and
 * last crossing over the whole cycles between them. Peaks are maxima above rest, each refined by
 * the parabola through its three samples. Only swings larger than `PEAK_FLOOR` of the largest are
 * used — and crossings only while the swing is that large — so the end of a run, where the
 * motion is too small to read, does not bias the result. Samples that are not finite end the
 * data there.
 */
export function measureOscillation(
  times: ArrayLike<number>,
  values: ArrayLike<number>,
  count: number,
  rest = 0,
): OscillationMeasure {
  let n = 0;
  let largest = 0;
  while (n < count && Number.isFinite(times[n]) && Number.isFinite(values[n])) {
    largest = Math.max(largest, Math.abs((values[n] ?? 0) - rest));
    n++;
  }
  const floor = PEAK_FLOOR * largest;
  const y = (i: number) => (values[i] ?? 0) - rest;
  const t = (i: number) => times[i] ?? 0;

  const peaks: Peak[] = [];
  for (let i = 1; i + 1 < n; i++) {
    const [a, b, c] = [y(i - 1), y(i), y(i + 1)];
    if (!(b > floor && b >= a && b > c)) continue;
    const h = t(i) - t(i - 1);
    if (Math.abs(t(i + 1) - t(i) - h) > 1e-9 * Math.max(1, h)) continue; // uneven: skip
    const curve = a - 2 * b + c;
    const shift = curve < 0 ? (a - c) / (2 * curve) : 0; // in steps, within ±½
    const amplitude = b - ((a - c) * shift) / 4;
    if (amplitude > floor) peaks.push({ t: t(i) + shift * h, amplitude });
  }
  // Crossings only up to the last readable peak's next crossing: after it the swing is too small.
  const until = peaks.length > 0 ? (peaks.at(-1)?.t ?? 0) : -Infinity;
  const crossings: number[] = [];
  for (let i = 0; i + 1 < n; i++) {
    const [a, b] = [y(i), y(i + 1)];
    if (!(a < 0 && b >= 0)) continue;
    const at = t(i) + ((t(i + 1) - t(i)) * -a) / (b - a);
    if (at > until) break;
    crossings.push(at);
  }
  const cycles = crossings.length - 1;
  const period =
    cycles >= MIN_CYCLES
      ? { value: ((crossings.at(-1) ?? 0) - (crossings[0] ?? 0)) / cycles, cycles }
      : null;

  let decay: OscillationMeasure['decay'] = null;
  if (peaks.length >= MIN_PEAKS) {
    const fit = fitLine(peaks.map((p) => ({ x: p.t, y: Math.log(p.amplitude) })));
    if (fit.status === 'fitted' && fit.slope < 0) {
      const rate = -fit.slope;
      const decrement = period ? rate * period.value : null;
      decay = {
        rate,
        r2: fit.r2,
        amplitude0: Math.exp(fit.intercept),
        decrement,
        zeta: decrement === null ? null : decrement / Math.sqrt(4 * Math.PI ** 2 + decrement ** 2),
      };
    }
  }
  return { crossings, period, peaks, decay, floor };
}

/** A run's oscillation, measured from the samples of its experiment's `oscillation` measurement. */
export function oscillationOf(run: RunData): OscillationMeasure {
  const id = run.definition.oscillation?.measurement;
  const i = run.definition.measurements.findIndex((m) => m.id === id);
  const values = run.sampleValues[i];
  return values
    ? measureOscillation(run.sampleTimes, values, run.sampleCount)
    : measureOscillation([], [], 0);
}
