import { z } from 'zod';
import raw from '@data/reactions.json';
import {
  LocalizedTextSchema,
  ReviewStatusSchema,
  SourceSchema,
  loadDataset,
  type Source,
} from '@/core/data/dataset';
import { normalizeForSearch } from '@/app/catalog';
import { parseFormula } from '../formula';

const TermSchema = z.object({ coef: z.number().int().positive(), formula: z.string() });
const FrameAtomSchema = z.object({
  map: z.number().int().positive(),
  el: z.string(),
  xyz: z.tuple([z.number(), z.number(), z.number()]),
  charge: z.number().int(),
  radical: z.number().int().min(0),
});
const FrameSchema = z.object({
  kind: z.enum(['reactants', 'ts', 'intermediate', 'products']),
  label: LocalizedTextSchema,
  description: LocalizedTextSchema,
  atoms: z.array(FrameAtomSchema),
  bonds: z.array(z.object({ a: z.number(), b: z.number(), order: z.number().int().min(1).max(3) })),
  partial: z.array(z.object({ a: z.number(), b: z.number() })),
  arrows: z.array(z.object({ from: z.array(z.number()), to: z.array(z.number()) })),
  /** Net charge of the whole frame (a transition state shows only partial charges). */
  total_charge: z.number().int(),
});
const ReactionSchema = z.object({
  id: z.string(),
  category: z.enum([
    'synthesis',
    'combustion',
    'acidBase',
    'precipitation',
    'redox',
    'decomposition',
    'equilibrium',
    'organic',
  ]),
  level: z.enum(['10', '11', '12']),
  name: LocalizedTextSchema,
  reactants: z.array(TermSchema).min(1),
  products: z.array(TermSchema).min(1),
  reversible: z.boolean(),
  conditions: LocalizedTextSchema,
  observation: LocalizedTextSchema,
  sources: z.array(SourceSchema).min(1),
  mechanism: z
    .object({
      type: LocalizedTextSchema,
      note: LocalizedTextSchema,
      frames: z.array(FrameSchema).min(2),
    })
    .nullable(),
  no_mechanism_reason: LocalizedTextSchema.nullable(),
  review_status: ReviewStatusSchema,
});
export type Reaction = z.infer<typeof ReactionSchema>;
export type MechanismFrame = z.infer<typeof FrameSchema>;
export type Mechanism = NonNullable<Reaction['mechanism']>;
export type ReactionCategory = Reaction['category'];

const dataset = loadDataset('reactions', ReactionSchema, raw);
export const REACTIONS: readonly Reaction[] = dataset.items;
export const REACTIONS_SOURCE: Source = dataset.source;

export function reactionById(id: string): Reaction | undefined {
  return REACTIONS.find((r) => r.id === id);
}

/** Element and charge totals of one side (coefficients applied). */
export function sideTotals(terms: Reaction['reactants']): {
  counts: Map<string, number>;
  charge: number;
} {
  const counts = new Map<string, number>();
  let charge = 0;
  for (const t of terms) {
    const f = parseFormula(t.formula);
    for (const [el, n] of f.counts) counts.set(el, (counts.get(el) ?? 0) + n * t.coef);
    charge += f.charge * t.coef;
  }
  return { counts, charge };
}

/** True when atoms of every element and the total charge are conserved. */
export function isBalanced(r: Pick<Reaction, 'reactants' | 'products'>): boolean {
  const a = sideTotals(r.reactants);
  const b = sideTotals(r.products);
  if (a.charge !== b.charge) return false;
  const els = new Set([...a.counts.keys(), ...b.counts.keys()]);
  return [...els].every((el) => (a.counts.get(el) ?? 0) === (b.counts.get(el) ?? 0));
}

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export type BondChange = 'kept' | 'broken' | 'formed' | 'orderChanged';

/** Bonds that break, form or change order between two consecutive key frames. */
export function bondChanges(from: MechanismFrame, to: MechanismFrame): Map<string, BondChange> {
  const A = new Map(from.bonds.map((b) => [key(b.a, b.b), b.order]));
  const B = new Map(to.bonds.map((b) => [key(b.a, b.b), b.order]));
  const out = new Map<string, BondChange>();
  for (const [k, o] of A)
    out.set(k, !B.has(k) ? 'broken' : B.get(k) === o ? 'kept' : 'orderChanged');
  for (const k of B.keys()) if (!A.has(k)) out.set(k, 'formed');
  return out;
}

/** Net charge of a key frame (must be the same in every frame). */
export function frameCharge(f: MechanismFrame): number {
  return f.atoms.reduce((s, a) => s + a.charge, 0);
}

export function findReactions(query: string): Reaction[] {
  const q = normalizeForSearch(query);
  if (!q) return [...REACTIONS];
  return REACTIONS.filter(
    (r) =>
      normalizeForSearch(r.name.vi).includes(q) ||
      normalizeForSearch(r.name.en).includes(q) ||
      [...r.reactants, ...r.products].some((t) => normalizeForSearch(t.formula).includes(q)),
  );
}

/** Library reaction with exactly the same set of species (order and coefficients ignored). */
export function matchLibrary(formulas: string[]): Reaction | undefined {
  const sig = (fs: string[]) =>
    fs
      .map((f) => {
        const p = parseFormula(f);
        return `${[...p.counts]
          .sort()
          .map(([e, n]) => `${e}${n}`)
          .join('')}${p.charge}`;
      })
      .sort()
      .join('|');
  const target = sig(formulas);
  return REACTIONS.find(
    (r) => sig([...r.reactants, ...r.products].map((t) => t.formula)) === target,
  );
}
