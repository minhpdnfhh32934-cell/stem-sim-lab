import { z } from 'zod';
import raw from '@data/ecology12_kntt.json';
import {
  loadDataset,
  LocalizedTextSchema,
  ReviewStatusSchema,
  type Source,
} from '@/core/data/dataset';

/**
 * Sinh học 12 KNTT Bài 23 (the law of tolerance, Hình 23.5 and its temperature example) and Bài 29
 * (ecological pyramids of Hình 29.6, ecological efficiency). Data: data/ecology12_kntt.json
 * (scripts/data/gen_ecology12_kntt.py; review pending, DATA_REVIEW SH12-ECO-1).
 */
const PyramidSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['number', 'biomass', 'energy']),
  place: LocalizedTextSchema,
  unit: z.string(),
  levels: z
    .array(
      z.object({
        level: z.number().int().positive(),
        name: LocalizedTextSchema,
        value: z.number().positive(),
      }),
    )
    .min(2),
  review_status: ReviewStatusSchema,
});
const ExtraSchema = z.object({
  tolerance_celsius: z.object({
    lower_limit: z.number(),
    optimum_from: z.number(),
    optimum_to: z.number(),
    upper_limit: z.number(),
  }),
  efficiency_average: z.number(),
  efficiency_range: z.tuple([z.number(), z.number()]),
  sunlight_to_photosynthesis: z.number(),
});

const dataset = loadDataset('ecology12_kntt', PyramidSchema, raw);
const extra = ExtraSchema.parse(raw);

export type Pyramid = z.infer<typeof PyramidSchema>;
export const PYRAMIDS: readonly Pyramid[] = dataset.items;
export const ECOLOGY12_SOURCE: Source = dataset.source;
export const TOLERANCE = extra.tolerance_celsius;
export const EFFICIENCY_AVERAGE = extra.efficiency_average;
export const EFFICIENCY_RANGE = extra.efficiency_range;
export const SUNLIGHT_TO_PHOTOSYNTHESIS = extra.sunlight_to_photosynthesis;

/* ───────── Bài 23: the law of tolerance ───────── */

export type Zone = 'below' | 'lowStress' | 'optimum' | 'highStress' | 'above';

/** Where a temperature falls in the book's example: limits 0 and 40 °C, best from 20 to 30 °C. */
export function zoneAt(t: number): Zone {
  const g = TOLERANCE;
  if (t < g.lower_limit) return 'below';
  if (t > g.upper_limit) return 'above';
  if (t < g.optimum_from) return 'lowStress';
  if (t > g.optimum_to) return 'highStress';
  return 'optimum';
}

/* ───────── Bài 29: pyramids and efficiency ───────── */

/** Upright when every level is smaller than the one below it; otherwise inverted (in part). */
export function upright(p: Pyramid): boolean {
  return p.levels.every((l, i) => i === 0 || l.value < (p.levels[i - 1]?.value ?? Infinity));
}

/** Ecological efficiency between successive levels of an energy pyramid (fractions). */
export function efficiencies(p: Pyramid): number[] {
  return p.levels.slice(1).map((l, i) => l.value / (p.levels[i]?.value ?? l.value));
}
