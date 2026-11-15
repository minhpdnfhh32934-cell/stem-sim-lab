import { z } from 'zod';
import raw from '@data/ions.json';
import { loadDataset, ReviewStatusSchema, SourceSchema, type Source } from '@/core/data/dataset';

/**
 * Common monatomic ion of a main-group element (scripts/data/gen_ions.py): the textbook first
 * (SGK Hóa học 10 KNTT Bài 11), OpenStax Fig. 2.29 for the elements the book does not print.
 */
const IonSchema = z.object({
  element: z.string().min(1),
  charge: z.number().int().min(-3).max(3),
  /** sgk: the book prints this ion (`book` says where); openstax: from the second source. */
  source: z.enum(['sgk', 'openstax']),
  book: z.string().min(1).optional(),
  review_status: ReviewStatusSchema,
});
export type IonData = z.infer<typeof IonSchema>;

const dataset = loadDataset('ions', IonSchema, raw);
export const IONS: readonly IonData[] = dataset.items;
/** SGK Hóa học 10 KNTT Bài 11 (the rule and the ions it prints). */
export const IONS_SOURCE: Source = dataset.source;
/** OpenStax Chemistry 2e, Fig. 2.29: the ions of the elements the book does not print. */
export const IONS_SECOND_SOURCE: Source = SourceSchema.parse(raw.second_source);
