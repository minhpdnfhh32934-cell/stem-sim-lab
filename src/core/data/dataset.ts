import { z } from 'zod';

/**
 * Shared schemas for every scientific dataset in `data/` (MASTER_PROMPT §2.4).
 * Datasets are validated when loaded; an invalid file is a bug and throws loudly.
 */

export const ReviewStatusSchema = z.enum(['pending', 'verified']);

export const LocalizedTextSchema = z.object({ vi: z.string().min(1), en: z.string().min(1) });
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export const SourceSchema = z.object({
  id: z.string().min(1),
  citation: z.string().min(1),
  url: z.url().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

/** Wraps an item schema into the common dataset envelope. */
export function datasetSchema<T extends z.ZodType>(item: T) {
  return z.object({
    dataset: z.string().min(1),
    version: z.number().int().positive(),
    source: SourceSchema,
    generated_by: z.string().optional(),
    items: z.array(item).min(1),
  });
}

/** Parses a dataset and reports the first problem with a readable message. */
export function loadDataset<T extends z.ZodType>(
  name: string,
  item: T,
  raw: unknown,
): z.infer<ReturnType<typeof datasetSchema<T>>> {
  const result = datasetSchema(item).safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid dataset "${name}": ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
