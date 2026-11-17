/**
 * What the 3D view of "Tụ điện" draws (pure, no three.js; tested against the model): each
 * capacitor as two plates, in a chain (series) or side by side (parallel, single), and the charge
 * on its plates as dots. Capacitor i holds qᵢ = Cᵢ·Uᵢ(t) with Uᵢ from the engine (`CP.U1…`); its
 * plates carry round(DOTS_MAX · qᵢ / Q_max) dots each, Q_max being the largest final charge
 * (`parts`), so the dots compare the charges. Plate sizes and spacing are illustration.
 */
import { CP } from './engine';
import { MODE, parts, type Bank } from './model';

export type Vec3 = [number, number, number];

/** Dots on a plate of the capacitor with the largest final charge. */
export const DOTS_MAX = 36;
/** Gap between a capacitor's plates (world units, illustration). */
export const GAP = 0.5;

export interface Cap3D {
  C: number;
  /** Middle of the gap. */
  center: Vec3;
  /** Side of the square plates: grows with √C (a larger plate, a larger C — illustration). */
  side: number;
}

export function capLayout(b: Bank): Cap3D[] {
  const cMax = Math.max(...b.caps);
  const n = b.caps.length;
  const series = b.mode === MODE.series;
  return b.caps.map((C, i) => {
    const k = i - (n - 1) / 2;
    return {
      C,
      center: series ? [k * 1.7, 0, 0] : [0, 0, k * 1.9],
      side: 0.7 + 0.6 * Math.sqrt(C / cMax),
    };
  });
}

/** The largest final charge of one capacitor (C): DOTS_MAX dots stand for it. */
export const largestCharge = (b: Bank) => Math.max(...parts(b).map((p) => p.Q));

/** Dots on a plate of a capacitor C at voltage U (V), qMax from `largestCharge`. */
export const dotsFor = (C: number, U: number, qMax: number) =>
  qMax > 0 ? Math.round((DOTS_MAX * C * U) / qMax) : 0;

/** Dots on each capacitor's plates for the engine's state (0 before charging). */
export function dotsOn(b: Bank, state: Float64Array | null): number[] {
  const qMax = largestCharge(b);
  return b.caps.map((C, i) => dotsFor(C, state?.[CP.U1 + i] ?? 0, qMax));
}

/**
 * Where dot j sits on a plate of side `side` (a 6 × 6 grid filled row by row, in the plate's own
 * y–z plane): the first dots fill the middle rows.
 */
export function dotSpot(j: number, side: number): [number, number] {
  const row = [2, 3, 1, 4, 0, 5][Math.floor(j / 6)] ?? 0;
  const col = j % 6;
  const step = (side * 0.8) / 6;
  return [(row - 2.5) * step, (col - 2.5) * step];
}
