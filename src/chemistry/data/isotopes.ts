import { z } from 'zod';
import raw from '@data/isotopes.json';
import { loadDataset, ReviewStatusSchema, SourceSchema, type Source } from '@/core/data/dataset';

const IsotopeSchema = z.object({
  /** Mass number A. */
  a: z.number().int().positive(),
  /** Isotope (atomic) mass in u, IUPAC-CIAAW. */
  mass_u: z.number().positive(),
  /** Natural abundance, % of the element's atoms (NUBASE2020). */
  abundance_pct: z.number().positive().max(100),
});
export type Isotope = z.infer<typeof IsotopeSchema>;

const ElementIsotopesSchema = z.object({
  z: z.number().int().min(1).max(118),
  symbol: z.string().min(1).max(3),
  isotopes: z.array(IsotopeSchema).min(1),
  review_status: ReviewStatusSchema,
});
export type ElementIsotopes = z.infer<typeof ElementIsotopesSchema>;

const dataset = loadDataset('isotopes', ElementIsotopesSchema, raw);

/** Naturally occurring isotopes, per element (data/isotopes.json, scripts/data/gen_isotopes.py). */
export const ISOTOPE_ELEMENTS: readonly ElementIsotopes[] = dataset.items;
export const ISOTOPES_SOURCE: Source = dataset.source;
/** The primary sources mendeleev cites: isotope masses (CIAAW) and abundances (NUBASE2020). */
export const ISOTOPE_REFERENCES: readonly Source[] = z.array(SourceSchema).parse(raw.references);

const BY_Z = new Map(ISOTOPE_ELEMENTS.map((e) => [e.z, e]));

/** The element's natural isotopes, or undefined when it has none in the data (Tc, Pm…). */
export function isotopesOf(z: number): ElementIsotopes | undefined {
  return BY_Z.get(z);
}

/** One naturally occurring nuclide (Z, A), or undefined when it is not in the data. */
export function naturalNuclide(z: number, a: number): Isotope | undefined {
  return BY_Z.get(z)?.isotopes.find((i) => i.a === a);
}
