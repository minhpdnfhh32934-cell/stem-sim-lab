import { z } from 'zod';
import raw from '@data/formation_enthalpy.json';
import { loadDataset, ReviewStatusSchema, SourceSchema, type Source } from '@/core/data/dataset';

export const PHASES = ['g', 'l', 's'] as const;
export type Phase = (typeof PHASES)[number];
const PhaseSchema = z.enum(PHASES);

const ReferenceSchema = z.enum(['sgk', 'codata', 'janaf', 'definition']);
export type EnthalpyReference = z.infer<typeof ReferenceSchema>;

const NistSchema = z.object({
  dfh_kj_mol: z.number(),
  uncertainty_kj_mol: z.number().positive().nullable(),
  source: z.enum(['codata', 'janaf']),
  /** The WebBook page the value was read from. */
  url: z.url(),
  /** Crystal form the value is for (hematite, corundum). */
  form: z.string().optional(),
});

const SpeciesSchema = z.object({
  formula: z.string().min(1),
  phase: PhaseSchema,
  /** ΔfH° at 298 K, 1 bar, kJ/mol: the book's Bảng 17.1 first, else the NIST WebBook. */
  dfh_kj_mol: z.number(),
  uncertainty_kj_mol: z.number().positive().nullable(),
  source: ReferenceSchema,
  /** Printed page of the book (the table, or the definition of the zero). */
  page: z.number().int().positive().optional(),
  url: z.url().optional(),
  form: z.string().optional(),
  /** The NIST value of a species the book also gives (named on the Science Card). */
  other: NistSchema.optional(),
  review_status: ReviewStatusSchema,
});
export type FormationEnthalpy = z.infer<typeof SpeciesSchema>;

const dataset = loadDataset('formation_enthalpy', SpeciesSchema, raw);

/** ΔfH° values (data/formation_enthalpy.json, scripts/data/gen_enthalpy.py). */
export const FORMATION_ENTHALPIES: readonly FormationEnthalpy[] = dataset.items;
export const ENTHALPY_SOURCE: Source = dataset.source;
export const ENTHALPY_REFERENCES = z.record(ReferenceSchema, SourceSchema).parse(raw.references);

/** Library reactions the enthalpy topic computes, with each species' phase at 298 K. */
export const ENTHALPY_REACTIONS = z
  .array(z.object({ id: z.string(), phases: z.record(z.string(), PhaseSchema) }))
  .parse(raw.reactions);

const key = (formula: string, phase: Phase) => `${formula}(${phase})`;
const BY_KEY = new Map(FORMATION_ENTHALPIES.map((s) => [key(s.formula, s.phase), s]));

export function formationEnthalpy(formula: string, phase: Phase): FormationEnthalpy | undefined {
  return BY_KEY.get(key(formula, phase));
}

/** The NIST WebBook value of a species (its own row, or the cross-check of a book value). */
export function nistEnthalpy(formula: string, phase: Phase): number | undefined {
  const s = formationEnthalpy(formula, phase);
  if (s?.other) return s.other.dfh_kj_mol;
  return s && (s.source === 'codata' || s.source === 'janaf') ? s.dfh_kj_mol : undefined;
}
