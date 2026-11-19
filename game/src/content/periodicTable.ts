import { z } from 'zod';
import { formatIssues } from '../core/schema';

/**
 * The hub's periodic table (2026-11-14, Phú: "like a real periodic table"): every element's
 * reference data as its sources give it (`periodic-table.json`'s `source`), shown as read — never
 * computed, rounded into another value or filled in. A value a source does not give is null and
 * shown as missing. Element names are IUPAC's in every language (Phú: as the 2018 Vietnamese
 * textbooks write them). The chemistry workspace's lens (`elements.json`) is apart: its weights
 * only where a model uses them; the two are checked against each other (periodicTable.test.ts).
 */

export const CATEGORIES = [
  'alkali-metal',
  'alkaline-earth-metal',
  'transition-metal',
  'post-transition-metal',
  'metalloid',
  'nonmetal',
  'halogen',
  'noble-gas',
  'lanthanide',
  'actinide',
] as const;
export type Category = (typeof CATEGORIES)[number];

const ElementSchema = z.strictObject({
  z: z.number().int().min(1).max(118),
  symbol: z.string().regex(/^[A-Z][a-z]?$/),
  name: z.string().min(1),
  category: z.enum(CATEGORIES),
  /** CIAAW's abridged standard atomic weight as printed (its digits kept), or null if none. */
  weight: z
    .string()
    .regex(/^\d+\.\d+$/)
    .nullable(),
  weightPlusMinus: z
    .string()
    .regex(/^\d+\.\d+$/)
    .nullable(),
  /** Without a standard atomic weight: the mass number of the isotope the source gives. */
  massNumber: z.number().int().positive().nullable(),
  /** Ground state, as the source writes it ("[Ar]4s2 3d6"); `Predicted`: calculated, not measured. */
  configuration: z.string().min(1),
  configurationPredicted: z.boolean(),
  /** Pauling scale. */
  electronegativity: z.number().positive().nullable(),
  oxidationStates: z.string(),
  /** At room conditions; `Predicted`: expected, not observed. */
  state: z.enum(['solid', 'liquid', 'gas']),
  statePredicted: z.boolean(),
  meltingK: z.number().positive().nullable(),
  boilingK: z.number().positive().nullable(),
  /** g/cm³. */
  density: z.number().positive().nullable(),
  ionizationEnergyEv: z.number().positive().nullable(),
  electronAffinityEv: z.number().nullable(),
  vanDerWaalsRadiusPm: z.number().positive().nullable(),
  discovered: z.union([z.literal('ancient'), z.number().int().min(1000).max(2100)]),
});

const TableSchema = z
  .strictObject({
    source: z.string().min(1),
    elements: z.array(ElementSchema).length(118),
  })
  .superRefine((t, ctx) => {
    t.elements.forEach((e, i) => {
      if (e.z !== i + 1) ctx.addIssue({ code: 'custom', message: `element ${i + 1} is Z=${e.z}` });
      if ((e.weight === null) === (e.massNumber === null)) {
        ctx.addIssue({ code: 'custom', message: `${e.symbol}: a weight or a mass number, one` });
      }
      if ((e.weight === null) !== (e.weightPlusMinus === null)) {
        ctx.addIssue({ code: 'custom', message: `${e.symbol}: a weight has its uncertainty` });
      }
    });
  });

export type PeriodicElement = z.output<typeof ElementSchema>;
export type PeriodicTable = z.output<typeof TableSchema>;

/** The table checked, or its problems. */
export function parsePeriodicTable(raw: unknown): PeriodicTable {
  const parsed = TableSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(`periodic-table.json: ${formatIssues(parsed.error).join('; ')}`);
  return parsed.data;
}

/** 1 eV per particle in kJ/mol (CODATA: e × N_A / 1000), the unit Vietnamese textbooks use. */
export const KJ_PER_MOL_PER_EV = 96.485_332_12;
