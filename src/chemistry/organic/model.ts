import { z } from 'zod';
import raw from '@data/organic_basics_kntt.json';
import {
  loadDataset,
  LocalizedTextSchema,
  ReviewStatusSchema,
  type Source,
} from '@/core/data/dataset';

/**
 * Hóa học 11 KNTT Chương 3 "Đại cương về hóa học hữu cơ" (Bài 10, 12, 13): functional groups and
 * their IR bands (Bảng 10.1, 10.2), setting up a molecular formula from mass percentages and the
 * molar mass (tr. 72), isomers and boiling points (tr. 75–77). Data: data/organic_basics_kntt.json
 * (scripts/data/gen_organic_basics_kntt.py; review pending, DATA_REVIEW HH11-ORG-1).
 */
const GroupSchema = z.object({
  id: z.string().min(1),
  name: LocalizedTextSchema,
  group: z.string().min(1),
  example: z.string().min(1),
  ir: z.array(z.object({ bond: z.string(), low: z.number(), high: z.number() })),
  book: z.string(),
  review_status: ReviewStatusSchema,
});
const ExtraSchema = z.object({
  atomic_mass: z.object({ values: z.record(z.string(), z.number().positive()), book: z.string() }),
  problems: z.array(
    z.object({
      id: z.string(),
      name: LocalizedTextSchema,
      percent: z.record(z.string(), z.number().positive().nullable()),
      M: z.number().positive(),
      book: z.string(),
    }),
  ),
  ethanol_ms: z.object({ molecular_ion: z.number(), book: z.string() }),
  boiling: z.array(
    z.object({
      formula: z.string(),
      bp_C: z.number(),
      note: LocalizedTextSchema,
      book: z.string(),
    }),
  ),
  isomers: z.array(
    z.object({
      formula: z.string(),
      structures: z.array(z.object({ name: z.string(), smiles: z.string() })).min(2),
      book: z.string(),
    }),
  ),
});

const dataset = loadDataset('organic_basics_kntt', GroupSchema, raw);
const extra = ExtraSchema.parse(raw);

export type Group = z.infer<typeof GroupSchema>;
export const GROUPS: readonly Group[] = dataset.items;
export const ORGANIC_SOURCE: Source = dataset.source;
export const PROBLEMS = extra.problems;
export const BOILING = extra.boiling;
export const ISOMERS = extra.isomers;
export const ETHANOL_MS = extra.ethanol_ms;

/** The atomic masses the book uses for x : y : z (tr. 72). */
export const MASS: Readonly<Record<string, number>> = extra.atomic_mass.values;
export const ELEMENTS = ['C', 'H', 'O'] as const;
export type El = (typeof ELEMENTS)[number];

export interface FormulaInput {
  /** Mass percentages; a null one is "the rest" (100 − the others). */
  percent: Record<El, number | null>;
  /** Molar mass from the mass spectrum's [M⁺] peak (g/mol). */
  M: number;
}

export type FormulaResult =
  | {
      ok: true;
      /** %m of each element, the rest filled in. */
      percent: Record<El, number>;
      /** x : y : z = %C/12 : %H/1 : %O/16, as computed. */
      moles: Record<El, number>;
      /** Divided by the smallest. */
      ratio: Record<El, number>;
      /** The whole multiplier k that makes every ratio a whole number. */
      k: number;
      /** p : q : r, the simplest formula's subscripts. */
      simplest: Record<El, number>;
      simplestMass: number;
      /** M = n · (simplest mass). */
      n: number;
      molecular: Record<El, number>;
    }
  | { ok: false; reason: 'sum' | 'noWhole' | 'notMultiple' | 'empty' };

/** How far from a whole number a ratio may be (the percentages are rounded to two decimals). */
export const WHOLE_TOL = 0.06;

/**
 * Bài 12 (tr. 72): x : y : z = %C/12,0 : %H/1,0 : %O/16,0 → the simplest whole numbers p : q : r
 * (divide by the smallest, then the smallest whole k ≤ 8 that makes all whole) → CpHqOr; n = M /
 * (its mass) must be a whole number, and CxHyOz = (CpHqOr)n.
 */
export function molecularFormula(input: FormulaInput): FormulaResult {
  const given = ELEMENTS.filter((e) => input.percent[e] !== null);
  const sum = given.reduce((s, e) => s + (input.percent[e] ?? 0), 0);
  const rest = ELEMENTS.filter((e) => input.percent[e] === null);
  if (rest.length > 1) return { ok: false, reason: 'empty' };
  if (sum > 100 + 0.05 || (rest.length === 0 && Math.abs(sum - 100) > 0.05))
    return { ok: false, reason: 'sum' };
  const percent = Object.fromEntries(
    ELEMENTS.map((e) => [e, input.percent[e] ?? Math.max(0, 100 - sum)]),
  ) as Record<El, number>;
  const present = ELEMENTS.filter((e) => percent[e] > 0);
  const moles = Object.fromEntries(
    ELEMENTS.map((e) => [e, percent[e] / (MASS[e] ?? Number.NaN)]),
  ) as Record<El, number>;
  const least = Math.min(...present.map((e) => moles[e]));
  const ratio = Object.fromEntries(ELEMENTS.map((e) => [e, moles[e] / least])) as Record<
    El,
    number
  >;
  let k = 0;
  for (let m = 1; m <= 8 && !k; m++)
    if (present.every((e) => Math.abs(ratio[e] * m - Math.round(ratio[e] * m)) <= WHOLE_TOL)) k = m;
  if (!k) return { ok: false, reason: 'noWhole' };
  const simplest = Object.fromEntries(ELEMENTS.map((e) => [e, Math.round(ratio[e] * k)])) as Record<
    El,
    number
  >;
  const simplestMass = ELEMENTS.reduce((s, e) => s + simplest[e] * (MASS[e] ?? 0), 0);
  const nRaw = input.M / simplestMass;
  const n = Math.round(nRaw);
  // M from the spectrum and the book's atomic masses are whole numbers: n·(CpHqOr) must give M.
  if (n < 1 || Math.abs(input.M - n * simplestMass) > 0.5)
    return { ok: false, reason: 'notMultiple' };
  const molecular = Object.fromEntries(ELEMENTS.map((e) => [e, simplest[e] * n])) as Record<
    El,
    number
  >;
  return { ok: true, percent, moles, ratio, k, simplest, simplestMass, n, molecular };
}

/** "C10H16O" from subscripts (Hill order, C then H then O; zero counts left out). */
export const formulaText = (f: Record<El, number>) =>
  ELEMENTS.filter((e) => f[e] > 0)
    .map((e) => `${e}${f[e] > 1 ? String(f[e]) : ''}`)
    .join('');

/** Independent check: the mass percentages of a formula, from the book's atomic masses. */
export function massPercent(f: Record<El, number>): Record<El, number> {
  const M = ELEMENTS.reduce((s, e) => s + f[e] * (MASS[e] ?? 0), 0);
  return Object.fromEntries(ELEMENTS.map((e) => [e, (100 * f[e] * (MASS[e] ?? 0)) / M])) as Record<
    El,
    number
  >;
}

const VALENCE: Record<string, number> = { C: 4, N: 3, O: 2, Cl: 1, Br: 1, F: 1 };

/**
 * Molecular formula of a simple SMILES (non-aromatic C, N, O, halogens; bonds -, =, #; branches and
 * ring digits), hydrogens from the usual valences. Used only to check the book's isomer lists.
 */
export function smilesFormula(smiles: string): Record<string, number> {
  const atoms: { el: string; bonds: number }[] = [];
  const stack: number[] = [];
  const rings = new Map<string, number>();
  let prev = -1;
  let order = 1;
  const re = /(Cl|Br|[CNOF])|([=#-])|(\()|(\))|(\d)/g;
  for (const m of smiles.matchAll(re)) {
    if (m[1]) {
      atoms.push({ el: m[1], bonds: 0 });
      const i = atoms.length - 1;
      const a = atoms[prev];
      const b = atoms[i];
      if (a && b) {
        a.bonds += order;
        b.bonds += order;
      }
      prev = i;
      order = 1;
    } else if (m[2]) order = m[2] === '=' ? 2 : m[2] === '#' ? 3 : 1;
    else if (m[3]) stack.push(prev);
    else if (m[4]) prev = stack.pop() ?? prev;
    else if (m[5]) {
      const open = rings.get(m[5]);
      if (open === undefined) rings.set(m[5], prev);
      else {
        const a = atoms[open];
        const b = atoms[prev];
        if (a && b) {
          a.bonds += order;
          b.bonds += order;
        }
        rings.delete(m[5]);
        order = 1;
      }
    }
  }
  const counts: Record<string, number> = {};
  let h = 0;
  for (const a of atoms) {
    counts[a.el] = (counts[a.el] ?? 0) + 1;
    h += Math.max(0, (VALENCE[a.el] ?? 0) - a.bonds);
  }
  if (h) counts.H = h;
  return counts;
}
