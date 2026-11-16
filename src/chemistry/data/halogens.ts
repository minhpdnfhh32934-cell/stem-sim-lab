import { z } from 'zod';
import raw from '@data/halogens.json';
import {
  loadDataset,
  LocalizedTextSchema,
  ReviewStatusSchema,
  SourceSchema,
  type Source,
} from '@/core/data/dataset';

const HalogenSchema = z.object({
  z: z.number().int(),
  symbol: z.string().min(1).max(2),
  /** SGK Hình 6.2 (pm). */
  radius_pm: z.number().positive(),
  /** SGK Bảng 6.2 (Pauling). */
  en_pauling: z.number().positive(),
  /** SGK Bảng 21.2: state at room conditions, colour, t_nc, t_s (°C), solubility (mol/L, 25 °C). */
  state: z.enum(['gas', 'liquid', 'solid']),
  colour: LocalizedTextSchema,
  melting_c: z.number(),
  boiling_c: z.number(),
  solubility_mol_l: z.number().positive().nullable(),
  /** SGK Bảng 22.1 (bond length pm, bond energy kJ/mol) and Bảng 22.2 (t_s °C). */
  hx: z.object({
    formula: z.string(),
    bond_length_pm: z.number().positive(),
    bond_energy_kj_mol: z.number().positive(),
    boiling_c: z.number(),
  }),
  review_status: ReviewStatusSchema,
});
export type Halogen = z.infer<typeof HalogenSchema>;

const dataset = loadDataset('halogens', HalogenSchema, raw);

/** F, Cl, Br, I as SGK Hóa học 10 KNTT gives them (data/halogens.json). */
export const HALOGENS: readonly Halogen[] = dataset.items;
export const HALOGENS_SOURCE: Source = dataset.source;
/** The book's table or figure behind each group of values. */
export const HALOGEN_SOURCES = z
  .object({
    radius: SourceSchema,
    en: SourceSchema,
    physical: SourceSchema,
    bond: SourceSchema,
    hxBoiling: SourceSchema,
  })
  .parse(raw.sources);

export const halogenByZ = (z: number) => HALOGENS.find((h) => h.z === z);
