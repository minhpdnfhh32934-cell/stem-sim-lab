import { z } from 'zod';
import raw from '@data/constants.json';
import { LocalizedTextSchema, ReviewStatusSchema, loadDataset } from './data/dataset';

const ConstantSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: LocalizedTextSchema,
  value: z.number(),
  unit: z.string(),
  uncertainty: z.number().nonnegative(),
  exact: z.boolean(),
  codata_key: z.string().nullable(),
  derived_from: z.string().optional(),
  review_status: ReviewStatusSchema,
});
export type PhysicalConstant = z.infer<typeof ConstantSchema>;

/** CODATA constants (see data/constants.json and scripts/data/gen_constants.py). */
export const CONSTANTS_DATASET = loadDataset('physical_constants', ConstantSchema, raw);

const byId = new Map(CONSTANTS_DATASET.items.map((c) => [c.id, c]));

/** Looks up a constant by id; throws for unknown ids so typos never become NaN. */
export function constant(id: string): PhysicalConstant {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown physical constant "${id}"`);
  return c;
}

/** Frequently used values (SI). */
export const C = {
  c: constant('c').value,
  G: constant('G').value,
  kB: constant('kB').value,
  NA: constant('NA').value,
  R: constant('R').value,
  e: constant('e').value,
  h: constant('h').value,
  gn: constant('gn').value,
  kC: constant('kC').value,
  me: constant('me').value,
  mu: constant('mu').value,
} as const;

/**
 * Gravity values a user can choose as the *default* g (used only when the problem does
 * not state g). Vietnamese textbooks commonly use 9.8 or 10 m/s²; the MASTER_PROMPT
 * example uses 9.81. The standard value g_n = 9.80665 m/s² is exact by definition.
 * Which one is the app default is a teacher decision (docs/DATA_REVIEW.md).
 */
export const GRAVITY_PRESETS = [9.80665, 9.81, 9.8, 10] as const;
export type GravityPreset = (typeof GRAVITY_PRESETS)[number];
export const DEFAULT_GRAVITY: GravityPreset = 9.81;
