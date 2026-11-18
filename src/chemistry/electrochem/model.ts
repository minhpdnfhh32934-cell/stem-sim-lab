import { z } from 'zod';
import raw from '@data/electrochem_kntt.json';
import { loadDataset, ReviewStatusSchema, type Source } from '@/core/data/dataset';
import { formatFormula } from '../formula';

/**
 * Hóa học 12 KNTT Bài 15 "Thế điện cực và nguồn điện hóa học": the couples of Bảng 15.1 (tr. 70),
 * which of two couples reacts (the α rule, tr. 72) and the Galvanic cell, E°pin = E°cathode −
 * E°anode (tr. 74). Data: data/electrochem_kntt.json (scripts/data/gen_electrochem_kntt.py;
 * review pending, DATA_REVIEW HH12-ELC-1).
 */
const TermSchema = z.tuple([z.number().int().positive(), z.string().min(1)]);
const CoupleSchema = z.object({
  id: z.string().min(1),
  element: z.string(),
  ox: z.array(TermSchema).min(1),
  red: z.array(TermSchema).min(1),
  n: z.number().int().positive(),
  E_V: z.number(),
  /** Decimals as Bảng 15.1 prints the value. */
  decimals: z.number().int().min(0),
  label: z.tuple([z.string(), z.string()]),
  metal: z.boolean(),
  at_pH7: z.boolean().optional(),
  reacts_with_water_lesson: z.number().int().optional(),
  review_status: ReviewStatusSchema,
});
const ExtraSchema = z.object({
  book_cells: z.array(
    z.object({ anode: z.string(), cathode: z.string(), E_V: z.number(), page: z.number() }),
  ),
  metal_facts: z.array(
    z.object({
      id: z.string(),
      metal: z.string(),
      name: z.object({ vi: z.string(), en: z.string() }),
      value: z.number().nullable(),
      unit: z.string(),
      page: z.number(),
    }),
  ),
  light_metal_max_density: z.number(),
  conductors: z.array(z.string()),
  water_threshold_V: z.number(),
  acid_threshold_V: z.number(),
});

const dataset = loadDataset('electrochem_kntt', CoupleSchema, raw);

export type Couple = z.infer<typeof CoupleSchema>;
export type Term = readonly [number, string];
export const COUPLES: readonly Couple[] = dataset.items;
export const ELECTROCHEM_SOURCE: Source = dataset.source;
const extra = ExtraSchema.parse(raw);
export const BOOK_CELLS = extra.book_cells;
export const METAL_FACTS = extra.metal_facts;
export const LIGHT_METAL_MAX_DENSITY = extra.light_metal_max_density;
export const CONDUCTORS = extra.conductors;

export function couple(id: string): Couple {
  const c = COUPLES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown couple ${id}`);
  return c;
}

/** Couples that can be compared: every row but the 2H₂O/H₂ value, which is at pH 7 (tr. 70). */
export const PAIRABLE: readonly Couple[] = COUPLES.filter((c) => !c.at_pH7);

/** Metal electrodes for a cell: no metal that reacts with water (Bài 24 tr. 110, Bài 25 tr. 119). */
export const ELECTRODES: readonly Couple[] = COUPLES.filter(
  (c) => c.metal && c.reacts_with_water_lesson === undefined,
);

/* ───────── Text ───────── */

/** "2H^+" → "2H⁺": a coefficient kept as written, the rest as a formula. */
export function termText(s: string): string {
  const m = /^(\d*)(.+)$/.exec(s);
  return `${m?.[1] ?? ''}${formatFormula(m?.[2] ?? s)}`;
}

/** The couple as the book writes it: "Cu²⁺/Cu", "2H⁺/H₂", "Cl₂/2Cl⁻". */
export const coupleLabel = (c: Couple): string => `${termText(c.label[0])}/${termText(c.label[1])}`;

export function sideText(terms: readonly Term[]): string {
  return terms.map(([k, s]) => `${k === 1 ? '' : k}${termText(s)}`).join(' + ');
}

/** The half-reaction as in Bảng 15.1: "Cu²⁺ + 2e ⇌ Cu" (one electron written "1e"). */
export const halfText = (c: Couple): string => `${sideText(c.ox)} + ${c.n}e ⇌ ${sideText(c.red)}`;

/* ───────── The α rule ───────── */

export interface Reaction {
  /** The couple with the smaller E°: its reduced form is the reductant. */
  reductant: Couple;
  /** The couple with the larger E°: its oxidised form is the oxidant. */
  oxidant: Couple;
  left: Term[];
  right: Term[];
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function add(map: Map<string, number>, terms: readonly Term[], k: number): void {
  for (const [c, s] of terms) map.set(s, (map.get(s) ?? 0) + c * k);
}

/**
 * Which of two couples reacts (tr. 72): the reduced form of the couple with the smaller E° reacts
 * with the oxidised form of the couple with the larger E°. Electrons are balanced with the least
 * common multiple, a species on both sides is cancelled. Null for the same couple or equal E°.
 */
export function reaction(a: Couple, b: Couple): Reaction | null {
  if (a.id === b.id || a.E_V === b.E_V) return null;
  const [reductant, oxidant] = a.E_V < b.E_V ? [a, b] : [b, a];
  const lcm = (reductant.n * oxidant.n) / gcd(reductant.n, oxidant.n);
  const left = new Map<string, number>();
  const right = new Map<string, number>();
  add(left, reductant.red, lcm / reductant.n);
  add(left, oxidant.ox, lcm / oxidant.n);
  add(right, reductant.ox, lcm / reductant.n);
  add(right, oxidant.red, lcm / oxidant.n);
  for (const [s, k] of left) {
    const r = right.get(s);
    if (r === undefined) continue;
    const m = Math.min(k, r);
    left.set(s, k - m);
    right.set(s, r - m);
  }
  const terms = (m: Map<string, number>): Term[] =>
    [...m].filter(([, k]) => k > 0).map(([s, k]) => [k, s] as const);
  return { reductant, oxidant, left: terms(left), right: terms(right) };
}

export const reactionText = (r: Reaction): string => `${sideText(r.left)} → ${sideText(r.right)}`;

/** Question 4 (tr. 72): a metal reacts with an acid (H⁺) when E°(Mⁿ⁺/M) < E°(2H⁺/H₂) = 0. */
export const reactsWithAcid = (c: Couple): boolean => c.metal && c.E_V < couple('H').E_V;

/* ───────── The Galvanic cell ───────── */

export interface Cell {
  /** The negative electrode, where oxidation happens (the smaller E°). */
  anode: Couple;
  /** The positive electrode, where reduction happens. */
  cathode: Couple;
  /** E°pin = E°cathode − E°anode (tr. 74), rounded to the table's 0,001 V. */
  emf: number;
  reaction: Reaction;
}

export function cell(x: Couple, y: Couple): Cell | null {
  const r = x.metal && y.metal ? reaction(x, y) : null;
  if (!r) return null;
  const emf = Math.round((r.oxidant.E_V - r.reductant.E_V) * 1000) / 1000;
  return { anode: r.reductant, cathode: r.oxidant, emf, reaction: r };
}

/** "Zn → Zn²⁺ + 2e" at the anode, "Cu²⁺ + 2e → Cu" at the cathode (tr. 74). */
export const anodeText = (c: Couple): string => `${sideText(c.red)} → ${sideText(c.ox)} + ${c.n}e`;
export const cathodeText = (c: Couple): string =>
  `${sideText(c.ox)} + ${c.n}e → ${sideText(c.red)}`;

/* ───────── Bài 19: a metal with water, a dilute acid or a salt solution ───────── */

export const REAGENTS = ['water', 'acid', 'salt'] as const;
export type Reagent = (typeof REAGENTS)[number];

/**
 * Metals the reactions part offers: the metal couples of Bảng 15.1 but Cr, whose only row is
 * Cr³⁺/Cr while the book does not say which ion chromium gives with an acid.
 */
export const TEST_METALS: readonly Couple[] = COUPLES.filter((c) => c.metal && c.id !== 'Cr');

/** Salt solutions: ions of the cell electrodes, metals that do not react with water. */
export const SALT_METALS: readonly Couple[] = ELECTRODES.filter((c) => c.id !== 'Cr');

export interface MetalTest {
  metal: Couple;
  /** The couple the metal is compared with: 2H₂O/H₂, 2H⁺/H₂ or the salt's Mⁿ⁺/M. */
  against: Couple;
  reacts: boolean;
  reaction: Reaction | null;
}

/**
 * tr. 92: a metal with E° < −0,414 V (the 2H₂O/H₂ value) can push hydrogen out of water; tr. 93:
 * with E° < 0 it can react with dilute HCl or H₂SO₄ giving H₂, and a more active metal pushes a
 * less active one out of its salt solution. Null when the salt is the metal's own.
 */
export function metalWith(metal: Couple, reagent: Reagent, salt: Couple): MetalTest | null {
  const against = reagent === 'water' ? couple('H2O') : reagent === 'acid' ? couple('H') : salt;
  if (against.id === metal.id) return null;
  const reacts = metal.E_V < against.E_V;
  return { metal, against, reacts, reaction: reacts ? reaction(metal, against) : null };
}
