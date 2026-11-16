import { z } from 'zod';
import raw from '@data/period3_compounds.json';
import { loadDataset, ReviewStatusSchema, SourceSchema, type Source } from '@/core/data/dataset';

export const OXIDE_CHARACTERS = ['basic', 'amphoteric', 'acidic'] as const;
export const HYDROXIDE_CHARACTERS = [
  'strongBase',
  'weakBase',
  'amphoteric',
  'weakAcid',
  'mediumAcid',
  'strongAcid',
  'veryStrongAcid',
] as const;
export type OxideCharacter = (typeof OXIDE_CHARACTERS)[number];
export type HydroxideCharacter = (typeof HYDROXIDE_CHARACTERS)[number];

const RowSchema = z.object({
  z: z.number().int().min(11).max(17),
  symbol: z.string().min(1).max(2),
  /** Formulas as SGK Bảng 7.1 prints them (the app computes its own and a test compares). */
  oxide_textbook: z.string(),
  hydroxide_textbook: z.string(),
  oxide_character: z.enum(OXIDE_CHARACTERS),
  hydroxide_character: z.enum(HYDROXIDE_CHARACTERS),
  review_status: ReviewStatusSchema,
});
export type Period3Row = z.infer<typeof RowSchema>;

const dataset = loadDataset('period3_compounds', RowSchema, raw);

/** Na…Cl: textbook formulas and acid–base character (data/period3_compounds.json). */
export const PERIOD3_ROWS: readonly Period3Row[] = dataset.items;
export const PERIOD3_SOURCE: Source = dataset.source;
/** Standard text the oxides' character was checked against. */
export const PERIOD3_CROSS_CHECK: Source = SourceSchema.parse(raw.cross_check);
