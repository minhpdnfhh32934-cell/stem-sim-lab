import { z } from 'zod';
import raw from '@data/polyatomic_ions.json';
import { loadDataset, ReviewStatusSchema, SourceSchema, type Source } from '@/core/data/dataset';

/**
 * Charges of common polyatomic ions (scripts/data/gen_polyatomic_ions.py): the textbook first
 * (SGK Hóa học 10 KNTT Bài 15, Quy tắc 4: NH₄⁺), OpenStax Table 2.5 for the others.
 */
const PolyIonSchema = z.object({
  id: z.string().min(1),
  /** "SO4^2-", as parseFormula reads it. */
  formula: z.string().min(1),
  /** The group as written inside a salt's formula: "SO4" in "CuSO4" and "Fe2(SO4)3". */
  body: z.string().regex(/^([A-Z][a-z]?\d*)+$/),
  charge: z.number().int().min(-3).max(3),
  source: z.enum(['sgk', 'openstax']),
  book: z.string().min(1).optional(),
  review_status: ReviewStatusSchema,
});
export type PolyIon = z.infer<typeof PolyIonSchema>;

const dataset = loadDataset('polyatomic_ions', PolyIonSchema, raw);
export const POLYATOMIC_IONS: readonly PolyIon[] = dataset.items;
/** SGK Hóa học 10 KNTT Bài 15 tr. 72, Quy tắc 4. */
export const POLYATOMIC_IONS_SOURCE: Source = dataset.source;
/** OpenStax Chemistry 2e, Table 2.5 (the ions the book does not print). */
export const POLYATOMIC_IONS_SECOND_SOURCE: Source = SourceSchema.parse(raw.second_source);
