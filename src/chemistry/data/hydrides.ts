import { z } from 'zod';
import raw from '@data/hydrides.json';
import { loadDataset, ReviewStatusSchema, type Source } from '@/core/data/dataset';

/** A boiling point as its source gives it (scripts/data/gen_hydrides.py). */
const BoilingPointSchema = z.object({
  value: z.number(),
  uncertainty: z.number().positive().optional(),
  unit: z.enum(['K', '°C']),
  as_given: z.string().min(1),
  source: z.enum(['nist', 'pubchem']),
  url: z.url(),
  reference: z.string().min(1),
  note: z.string().min(1),
});
const HydrideSchema = z.object({
  id: z.string().min(1),
  formula: z.string().min(1),
  element: z.string().min(1),
  cas: z.string().min(1),
  pubchem_cid: z.number().int().positive(),
  /** null: neither NIST nor PubChem gives one (`missing` says so). */
  boiling_point: BoilingPointSchema.nullable(),
  missing: z.string().optional(),
  review_status: ReviewStatusSchema,
});
export type BoilingPoint = z.infer<typeof BoilingPointSchema>;
export type Hydride = z.infer<typeof HydrideSchema>;

const dataset = loadDataset('hydrides', HydrideSchema, raw);
export const HYDRIDES: readonly Hydride[] = dataset.items;
export const HYDRIDES_SOURCE: Source = dataset.source;
