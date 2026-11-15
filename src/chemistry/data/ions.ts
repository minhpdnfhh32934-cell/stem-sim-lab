import { z } from 'zod';
import raw from '@data/ions.json';
import { loadDataset, ReviewStatusSchema, type Source } from '@/core/data/dataset';

/** Common monatomic ion of a main-group element (scripts/data/gen_ions.py, OpenStax Fig. 2.29). */
const IonSchema = z.object({
  element: z.string().min(1),
  charge: z.number().int().min(-3).max(3),
  review_status: ReviewStatusSchema,
});
export type IonData = z.infer<typeof IonSchema>;

const dataset = loadDataset('ions', IonSchema, raw);
export const IONS: readonly IonData[] = dataset.items;
export const IONS_SOURCE: Source = dataset.source;
