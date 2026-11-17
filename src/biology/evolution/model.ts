import { z } from 'zod';
import raw from '@data/evolution_kntt.json';
import {
  loadDataset,
  LocalizedTextSchema,
  ReviewStatusSchema,
  type LocalizedText,
  type Source,
} from '@/core/data/dataset';

/**
 * Sinh học 12 KNTT Bài 19 "Các bằng chứng tiến hoá" (Bảng 19.1: cytochrome C) and Bài 22 "Tiến hoá
 * lớn và quá trình phát sinh chủng loại" (Bảng 22.1: the geologic timescale; Hình 22.4: the hominin
 * stages). Data: data/evolution_kntt.json (scripts/data/gen_evolution_kntt.py; review pending,
 * DATA_REVIEW SH12-EVO-1).
 */
const SpeciesSchema = z.object({
  id: z.string().min(1),
  name: LocalizedTextSchema,
  cytochrome_c_diff: z.number().int().nonnegative(),
  review_status: ReviewStatusSchema,
});
const ExtraSchema = z.object({
  geologic: z.array(
    z.object({
      eon: z.string(),
      era: z.string().nullable(),
      id: z.string(),
      name: LocalizedTextSchema,
      from_mya: z.number(),
      to_mya: z.number().nullable(),
      event: LocalizedTextSchema,
    }),
  ),
  names: z.record(z.string(), z.string()),
  earth_formed_mya: z.number(),
  prokaryote_fossils_mya: z.number(),
  eukaryote_fossils_mya: z.number(),
  hominins: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      from_mya: z.number(),
      to_mya: z.number().nullable(),
    }),
  ),
});

const dataset = loadDataset('evolution_kntt', SpeciesSchema, raw);
const extra = ExtraSchema.parse(raw);

export type Species = z.infer<typeof SpeciesSchema>;
export type Period = (typeof extra.geologic)[number];
export const CYTOCHROME_C: readonly Species[] = dataset.items;
export const EVOLUTION_SOURCE: Source = dataset.source;
export const GEOLOGIC: readonly Period[] = extra.geologic;
export const GEO_NAMES = extra.names;
export const EARTH_FORMED_MYA = extra.earth_formed_mya;
export const PROKARYOTE_FOSSILS_MYA = extra.prokaryote_fossils_mya;
export const EUKARYOTE_FOSSILS_MYA = extra.eukaryote_fossils_mya;
export const HOMININS = extra.hominins;

/** The species closest to humans by cytochrome C: the fewest differing amino acids. */
export function closest(species: readonly Species[]): Species | undefined {
  return [...species].sort((a, b) => a.cytochrome_c_diff - b.cytochrome_c_diff)[0];
}

/** The period that contains a time (million years ago); periods run from `from` to `to`. */
export function periodAt(mya: number): Period | undefined {
  return GEOLOGIC.find((p) => mya <= p.from_mya && mya >= (p.to_mya ?? 0));
}

/** How long a period lasted (million years). */
export const duration = (p: Period): number => p.from_mya - (p.to_mya ?? 0);

/** The eon or era name as Bảng 22.1 prints it. */
export const geoName = (id: string | null): LocalizedText | null =>
  id === null ? null : { vi: GEO_NAMES[id] ?? id, en: id };
