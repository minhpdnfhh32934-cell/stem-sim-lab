import { z } from 'zod';
import raw from '@data/magnetism_kntt.json';
import { loadDataset, ReviewStatusSchema, type Source } from '@/core/data/dataset';

/**
 * Vật lí 12 KNTT Bài 15 "Lực từ tác dụng lên dây dẫn mang dòng điện. Cảm ứng từ": F = BIL sinα
 * (15.2), its direction from F⃗ = I·L⃗ × B⃗ (the left-hand rule, tr. 62) and the measurement of
 * Bảng 15.1. Data: data/magnetism_kntt.json (scripts/data/gen_magnetism_kntt.py; review pending,
 * DATA_REVIEW VL12-MAG-1).
 */
const RowSchema = z.object({
  id: z.string().min(1),
  I: z.number().positive(),
  F: z.number().positive(),
  B_printed: z.number().positive(),
  review_status: ReviewStatusSchema,
});
const ExtraSchema = z.object({
  coil: z.object({
    turns: z.number(),
    side_m: z.number(),
    length_m: z.number(),
    angle_deg: z.number(),
  }),
  electron_charge: z.number(),
  three_phase_shift: z.number(),
  examples: z.array(z.looseObject({ id: z.string(), lesson: z.number(), page: z.number() })),
});

const dataset = loadDataset('magnetism_kntt', RowSchema, raw);
const extra = ExtraSchema.parse(raw);

export const TABLE_15_1 = dataset.items;
export const MAGNETISM_SOURCE: Source = dataset.source;
export const COIL = extra.coil;
/** |e| as the book gives it (1,60·10⁻¹⁹ C, tr. 63). */
export const ELECTRON_CHARGE = extra.electron_charge;
export const THREE_PHASE_SHIFT = extra.three_phase_shift;
export const EXAMPLES = extra.examples;

const rad = (deg: number) => (deg * Math.PI) / 180;
/** sin of an angle in degrees, exactly 0 at 0° and 180°. */
const sinDeg = (deg: number) => (deg % 180 === 0 ? 0 : Math.sin(rad(deg)));

/** F = BIL sinα (15.2): N from T, A, m and the angle between the wire and B⃗ (degrees). */
export const force = (B: number, I: number, L: number, alphaDeg: number) =>
  B * I * L * sinDeg(alphaDeg);

/** B = F/(IL sinα) (15.1), or null when the wire lies along the field. */
export function fieldFromForce(F: number, I: number, L: number, alphaDeg: number) {
  const s = sinDeg(alphaDeg);
  return s === 0 || I === 0 || L === 0 ? null : F / (I * L * s);
}

export type Out = 'into' | 'outOf' | 'none';
/**
 * Direction of F⃗ = I·L⃗ × B⃗ on the page: B⃗ points right (+x), the current makes the angle α with B⃗
 * counter-clockwise in the page, `reversed` flips it. The force is ⊥ to the page: z = −sinα.
 */
export function forceDirection(alphaDeg: number, reversed: boolean): Out {
  const z = -(reversed ? -1 : 1) * sinDeg(alphaDeg);
  return Math.abs(z) < 1e-12 ? 'none' : z < 0 ? 'into' : 'outOf';
}

/** Full cross product, for the check of the left-hand rule: I⃗ × B⃗. */
export function cross(a: readonly [number, number, number], b: readonly [number, number, number]) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] as const;
}

/** The current carried by `perSecond` electrons through a cross-section each second (I = Δq/Δt). */
export const currentFromElectrons = (perSecond: number) => perSecond * ELECTRON_CHARGE;

/* ───────── Bảng 15.1 ───────── */

export interface Measurement {
  /** B for each row, computed from I, F and L = nl (α = 90°). */
  values: number[];
  mean: number;
  /** Mean absolute deviation ΔB̄ (the error the grade 10 book teaches) and ΔB̄/B̄. */
  error: number;
  relative: number;
  /** Least-squares slope of F against I through the origin, and B = slope/L. */
  slope: number;
  fromSlope: number;
}

export function measure(rows = TABLE_15_1, L = COIL.length_m): Measurement {
  const values = rows.map((r) => r.F / (r.I * L));
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const error = values.reduce((a, v) => a + Math.abs(v - mean), 0) / values.length;
  const slope = rows.reduce((a, r) => a + r.I * r.F, 0) / rows.reduce((a, r) => a + r.I * r.I, 0);
  return { values, mean, error, relative: error / mean, slope, fromSlope: slope / L };
}
