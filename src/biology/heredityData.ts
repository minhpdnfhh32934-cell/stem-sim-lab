import { z } from 'zod';
import raw from '@data/heredity_kntt.json';
import {
  loadDataset,
  LocalizedTextSchema,
  ReviewStatusSchema,
  type Source,
} from '@/core/data/dataset';

/**
 * The book's numbers for SH12 Bài 11–12 (data/heredity_kntt.json, scripts/data/gen_heredity_kntt.py;
 * review pending, DATA_REVIEW SH12-HER-1): the question counts of tr. 59 are the items.
 */
const CountSchema = z.object({
  id: z.string(),
  label: LocalizedTextSchema,
  count: z.number().int().nonnegative(),
  review_status: ReviewStatusSchema,
});
const ExtraSchema = z.object({
  cells_with_crossover: z.number(),
  testcross_percent: z.array(z.number()),
  structure: z.record(z.string(), z.array(z.string())),
  allopolyploid: z.object({ a_2n: z.number().int(), b_2n: z.number().int() }),
  human_2n: z.number().int(),
  chimp_2n: z.number().int(),
  down_by_age: z.array(
    z.object({
      from: z.number().nullable(),
      to: z.number().nullable(),
      births_per_case: z.number().positive(),
    }),
  ),
});

const dataset = loadDataset('heredity_kntt', CountSchema, raw);
export const HEREDITY_ITEMS = dataset.items;
export const HEREDITY_SOURCE: Source = dataset.source;
export const HEREDITY = ExtraSchema.parse(raw);
