import { z } from 'zod';
import raw from '@data/nitrogen_sulfur_kntt.json';
import {
  loadDataset,
  LocalizedTextSchema,
  ReviewStatusSchema,
  type Source,
} from '@/core/data/dataset';
import { analyzeRedox, type RedoxAnalysis } from '../redox/redox';
import { oxidationNumbers, type OxRefusal } from '../redox/oxidation';

/**
 * Hóa học 11 KNTT Chương 2 "Nitrogen – sulfur" (Bài 4–8): the substances the lessons describe,
 * the oxidation-number axes of N and S (tr. 30, 43) and the lessons' reactions, all from
 * data/nitrogen_sulfur_kntt.json (scripts/data/gen_nitrogen_sulfur_kntt.py; review pending,
 * DATA_REVIEW HH11-NS-1). Oxidation numbers are never stored: the textbook's rules compute them
 * (`oxidation.ts`), as the book asks the learner to do.
 */
export type Element = 'N' | 'S';

const FactSchema = z.object({ text: LocalizedTextSchema, page: z.number().int().positive() });
const SubstanceSchema = z.object({
  id: z.string().min(1),
  element: z.enum(['N', 'S']),
  formula: z.string().min(1),
  name: LocalizedTextSchema,
  lesson: z.number().int().min(4).max(8),
  facts: z.array(FactSchema).min(1),
  review_status: ReviewStatusSchema,
});
const TermSchema = z.object({ coef: z.number().int().positive(), formula: z.string().min(1) });
const ExtraSchema = z.object({
  axes: z.record(
    z.enum(['N', 'S']),
    z.object({
      min: z.number().int(),
      max: z.number().int(),
      species: z.array(z.string().min(1)).min(2),
      page: z.number().int(),
    }),
  ),
  reactions: z.array(
    z.object({
      id: z.string().min(1),
      element: z.enum(['N', 'S']),
      reactants: z.array(TermSchema).min(1),
      products: z.array(TermSchema).min(1),
      reversible: z.boolean(),
      conditions: LocalizedTextSchema,
      dH_kJ: z.number().nullable(),
      page: z.number().int().positive(),
    }),
  ),
});

const dataset = loadDataset('nitrogen_sulfur_kntt', SubstanceSchema, raw);
const extra = ExtraSchema.parse(raw);

export type Substance = z.infer<typeof SubstanceSchema>;
export type NsReaction = z.infer<typeof ExtraSchema>['reactions'][number];

export const SUBSTANCES: readonly Substance[] = dataset.items;
export const AXES = extra.axes;
export const NS_REACTIONS: readonly NsReaction[] = extra.reactions;
export const NS_SOURCE: Source = dataset.source;

/** The element's role from where it sits on its axis (SGK tr. 30, 35, 39, 46). */
export type Role = 'reducing' | 'oxidising' | 'both';

export type Placement =
  | { ok: true; formula: string; value: number; role: Role }
  | { ok: false; formula: string; reason: OxRefusal | 'absent' | 'unreadable' };

/**
 * Where a formula goes on the element's axis: its oxidation number by the textbook's rules. At the
 * lowest number the element can only go up (it gives electrons: reducing), at the highest only down
 * (oxidising), in between both ways.
 */
export function place(el: Element, formula: string): Placement {
  let r;
  try {
    r = oxidationNumbers(formula);
  } catch {
    return { ok: false, formula, reason: 'unreadable' };
  }
  if (!r.ok) return { ok: false, formula, reason: r.reason };
  const value = r.values.get(el);
  if (value === undefined) return { ok: false, formula, reason: 'absent' };
  const axis = AXES[el];
  const role: Role = value <= axis.min ? 'reducing' : value >= axis.max ? 'oxidising' : 'both';
  return { ok: true, formula, value, role };
}

/** The redox reading of each reaction of the lessons (the book's questions on tr. 31, 35, 45, 46). */
export const analyse = (r: NsReaction): RedoxAnalysis => analyzeRedox(r);
