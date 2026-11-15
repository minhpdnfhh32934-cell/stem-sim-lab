import { z } from 'zod';
import raw from '@data/formation_enthalpy.json';
import {
  loadDataset,
  LocalizedTextSchema,
  ReviewStatusSchema,
  SourceSchema,
  type Source,
} from '@/core/data/dataset';

export const PHASES = ['g', 'l', 's'] as const;
export type Phase = (typeof PHASES)[number];
const PhaseSchema = z.enum(PHASES);

const ReferenceSchema = z.enum(['codata', 'janaf', 'definition']);
export type EnthalpyReference = z.infer<typeof ReferenceSchema>;

const SpeciesSchema = z.object({
  formula: z.string().min(1),
  phase: PhaseSchema,
  /** ΔfH° at 298.15 K, 1 bar, kJ/mol (NIST Chemistry WebBook). */
  dfh_kj_mol: z.number(),
  uncertainty_kj_mol: z.number().positive().nullable(),
  reference: ReferenceSchema,
  /** The WebBook page the value was read from (none for an element's reference state). */
  url: z.url().optional(),
  /** Crystal form the value is for (hematite, corundum). */
  form: z.string().optional(),
  review_status: ReviewStatusSchema,
});
export type FormationEnthalpy = z.infer<typeof SpeciesSchema>;

const dataset = loadDataset('formation_enthalpy', SpeciesSchema, raw);

/** ΔfH° values (data/formation_enthalpy.json, scripts/data/gen_enthalpy.py). */
export const FORMATION_ENTHALPIES: readonly FormationEnthalpy[] = dataset.items;
export const ENTHALPY_SOURCE: Source = dataset.source;
export const ENTHALPY_REFERENCES = z
  .record(ReferenceSchema, SourceSchema)
  .parse(raw.references) as Record<EnthalpyReference, Source>;

/** Species the WebBook and CODATA give no value for, with the reason. */
export const ENTHALPY_MISSING = z
  .array(z.object({ formula: z.string(), phase: PhaseSchema, note: LocalizedTextSchema }))
  .parse(raw.missing);

/** Library reactions the enthalpy topic computes, with each species' phase at 298.15 K. */
export const ENTHALPY_REACTIONS = z
  .array(z.object({ id: z.string(), phases: z.record(z.string(), PhaseSchema) }))
  .parse(raw.reactions);

const key = (formula: string, phase: Phase) => `${formula}(${phase})`;
const BY_KEY = new Map(FORMATION_ENTHALPIES.map((s) => [key(s.formula, s.phase), s]));

export function formationEnthalpy(formula: string, phase: Phase): FormationEnthalpy | undefined {
  return BY_KEY.get(key(formula, phase));
}
