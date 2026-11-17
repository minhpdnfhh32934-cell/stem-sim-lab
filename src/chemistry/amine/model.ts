import { z } from 'zod';
import raw from '@data/nitrogen_organic_kntt.json';
import { loadDataset, ReviewStatusSchema, type Source } from '@/core/data/dataset';
import { ALKYLS, molecular, type Alkyl } from '../ester/model';
import { molarMass } from '../formula';

/**
 * Hóa học 12 KNTT Bài 8 "Amine" and Bài 9 "Amino acid và peptide": naming amines by "gốc – chức"
 * and substitutive names (tr. 36), the amine isomers of CnH2n+3N, Bảng 8.1, the amino acids of
 * Bảng 9.1, glycine in an electric field (tr. 43), peptides, the biuret test and partial
 * hydrolysis (tr. 44–45). Data: data/nitrogen_organic_kntt.json
 * (scripts/data/gen_nitrogen_organic_kntt.py; review pending, DATA_REVIEW HH12-NIT-1).
 */
const AminoAcidSchema = z.object({
  id: z.string().min(1),
  structure: z.string(),
  substitutive: z.string(),
  semi: z.string(),
  common: z.string(),
  formula: z.string(),
  smiles: z.string(),
  review_status: ReviewStatusSchema,
});
const ExtraSchema = z.object({
  amines: z.array(
    z.object({ formula: z.string(), name: z.string(), mp_C: z.number(), bp_C: z.number() }),
  ),
  glycine_neutral_pH: z.number(),
  peptides: z.array(
    z.object({
      id: z.string(),
      lesson: z.number(),
      page: z.number(),
      sequence: z.array(z.string()),
    }),
  ),
});

const dataset = loadDataset('nitrogen_organic_kntt', AminoAcidSchema, raw);
const extra = ExtraSchema.parse(raw);

export type AminoAcid = z.infer<typeof AminoAcidSchema>;
export const AMINO_ACIDS: readonly AminoAcid[] = dataset.items;
export const NITROGEN_SOURCE: Source = dataset.source;
export const AMINE_TABLE = extra.amines;
export const GLYCINE_NEUTRAL_PH = extra.glycine_neutral_pH;
export const BOOK_PEPTIDES = extra.peptides;

/* ───────── Amines ───────── */

/** Alkyl groups up to C4 (the amines of CnH2n+3N, n ≤ 4). */
export const AMINE_ALKYLS: readonly Alkyl[] = ALKYLS.filter((a) => a.saturated && a.carbons <= 4);

/** The alkyl written towards a following N (CH3CH2CH2–, (CH3)2CH– …). */
const LEFT: Record<string, string> = {
  methyl: 'CH3',
  ethyl: 'CH3CH2',
  propyl: 'CH3CH2CH2',
  isopropyl: '(CH3)2CH',
  butyl: 'CH3CH2CH2CH2',
  isobutyl: '(CH3)2CHCH2',
  secButyl: 'CH3CH2CH(CH3)',
  tertButyl: '(CH3)3C',
};
/** Each alkyl as the parent of a substitutive name (the amine R–NH₂). */
const PARENT: Record<string, string> = {
  methyl: 'methanamine',
  ethyl: 'ethanamine',
  propyl: 'propan-1-amine',
  isopropyl: 'propan-2-amine',
  butyl: 'butan-1-amine',
  isobutyl: '2-methylpropan-1-amine',
  secButyl: 'butan-2-amine',
  tertButyl: '2-methylpropan-2-amine',
};

const MULT = ['', '', 'di', 'tri'] as const;
/** Alphabetical key of a group name: italic prefixes (sec-, tert-) do not count. */
const sortKey = (name: string) => name.replace(/^(sec|tert)-/, '');

export interface Amine {
  /** Alkyl ids on the N, largest first. */
  groups: readonly string[];
  /** Bậc: the number of hydrocarbon groups on the N. */
  degree: 1 | 2 | 3;
  condensed: string;
  formula: string;
  radicofunctional: string;
  substitutive: string;
  M: number;
  smiles: string;
}

const alkylOf = (id: string) => {
  const a = AMINE_ALKYLS.find((x) => x.id === id);
  if (!a) throw new Error(`no alkyl ${id}`);
  return a;
};

/** The amine with 1–3 alkyl groups on its N (ids of AMINE_ALKYLS). */
export function amine(ids: readonly string[]): Amine {
  if (ids.length < 1 || ids.length > 3) throw new Error('an amine has 1 to 3 groups');
  const groups = [...ids].sort(
    (a, b) => alkylOf(b).carbons - alkylOf(a).carbons || a.localeCompare(b),
  );
  const [parent = 'methyl', ...rest] = groups;
  const degree = groups.length as 1 | 2 | 3;
  // Condensed formula: the largest group before N, the others after it.
  const right = rest.map((id) => alkylOf(id).condensed);
  let condensed: string;
  if (degree === 1) condensed = `${LEFT[parent]}NH2`;
  else if (degree === 2) condensed = `${LEFT[parent]}NH${right[0]}`;
  else if (groups.every((g) => g === parent)) condensed = `(${LEFT[parent]})3N`;
  else if (right[0] === right[1]) condensed = `${LEFT[parent]}N(${right[0]})2`;
  else condensed = `${LEFT[parent]}N(${right[0]})${right[1]}`;
  // "Gốc – chức": the groups in alphabetical order, repeats with di/tri, then "amine".
  const counts = new Map<string, number>();
  for (const g of groups) counts.set(alkylOf(g).name, (counts.get(alkylOf(g).name) ?? 0) + 1);
  const radicofunctional = `${[...counts.entries()]
    .sort(([a], [b]) => sortKey(a).localeCompare(sortKey(b)))
    .map(([name, n]) => `${MULT[n] ?? ''}${name}`)
    .join('')}amine`;
  // Substitutive: the largest group is the parent amine; the others are N-substituents.
  const subs = new Map<string, number>();
  for (const g of rest) subs.set(alkylOf(g).name, (subs.get(alkylOf(g).name) ?? 0) + 1);
  const prefix = [...subs.entries()]
    .sort(([a], [b]) => sortKey(a).localeCompare(sortKey(b)))
    .map(([name, n]) => `${n === 2 ? 'N,N-di' : 'N-'}${name}`)
    .join('-');
  const substitutive = `${prefix}${PARENT[parent] ?? ''}`;
  const s = groups.map((g) => alkylOf(g).smiles);
  const smiles =
    degree === 1 ? `N${s[0]}` : degree === 2 ? `N(${s[0]})${s[1]}` : `N(${s[0]})(${s[1]})${s[2]}`;
  return {
    groups,
    degree,
    condensed,
    formula: molecular(condensed),
    radicofunctional,
    substitutive,
    M: molarMass(condensed),
    smiles,
  };
}

/** Every saturated open-chain amine of CnH2n+3N (1 ≤ n ≤ 4), primary first. */
export function amineIsomers(n: number): Amine[] {
  if (n < 1 || n > 4) return [];
  const ids = AMINE_ALKYLS.map((a) => a.id);
  const c = (id: string) => alkylOf(id).carbons;
  const seen = new Set<string>();
  const out: Amine[] = [];
  const add = (g: string[]) => {
    const key = [...g].sort().join(',');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(amine(g));
  };
  for (const a of ids) if (c(a) === n) add([a]);
  for (const a of ids) for (const b of ids) if (c(a) + c(b) === n) add([a, b]);
  for (const a of ids)
    for (const b of ids) for (const d of ids) if (c(a) + c(b) + c(d) === n) add([a, b, d]);
  return out;
}

/* ───────── Amino acids and peptides ───────── */

/** Side chain R of H₂N–CH(R)–COOH as SMILES ('' for glycine), from the book's structures. */
export const SIDE_CHAIN: Readonly<Record<string, string>> = {
  Gly: '',
  Ala: 'C',
  Val: 'C(C)C',
  Lys: 'CCCCN',
  Glu: 'CCC(=O)O',
};
export const aminoAcid = (id: string) => AMINO_ACIDS.find((a) => a.id === id);

/**
 * Glycine in an electric field (tr. 43): a zwitterion near pH 6 that hardly moves; a cation below
 * that moves to the cathode (−); an anion above that moves to the anode (+).
 */
export function glycineMigration(pH: number): 'cathode' | 'none' | 'anode' {
  if (Math.abs(pH - GLYCINE_NEUTRAL_PH) < 0.5) return 'none';
  return pH < GLYCINE_NEUTRAL_PH ? 'cathode' : 'anode';
}

const PREFIX = ['', '', 'di', 'tri', 'tetra', 'penta', 'hexa'] as const;

export interface Peptide {
  sequence: readonly string[];
  name: string;
  /** dipeptide, tripeptide … */
  kind: string;
  bonds: number;
  /** The biuret test: two or more peptide bonds (tr. 45). */
  biuret: boolean;
  /** Null when a residue's structure is not in Bảng 9.1 (Tyr in the book's example). */
  formula: string | null;
  M: number | null;
  smiles: string | null;
}

/** A peptide from its N-terminal to its C-terminal residue. */
export function peptide(sequence: readonly string[]): Peptide {
  const n = sequence.length;
  const known = sequence.every((s) => aminoAcid(s));
  let formula: string | null = null;
  let M: number | null = null;
  let smiles: string | null = null;
  if (known) {
    const counts = new Map<string, number>();
    for (const s of sequence) {
      const f = aminoAcid(s)?.formula ?? '';
      for (const [, el, k] of f.matchAll(/([A-Z][a-z]?)(\d*)/g))
        if (el) counts.set(el, (counts.get(el) ?? 0) + (k ? Number(k) : 1));
    }
    // n − 1 molecules of water leave as the peptide bonds form.
    counts.set('H', (counts.get('H') ?? 0) - 2 * (n - 1));
    counts.set('O', (counts.get('O') ?? 0) - (n - 1));
    formula = ['C', 'H', 'N', 'O']
      .filter((el) => (counts.get(el) ?? 0) > 0)
      .map((el) => `${el}${counts.get(el) === 1 ? '' : (counts.get(el) ?? 0)}`)
      .join('');
    M = molarMass(formula);
    smiles = `N${sequence
      .map((s) => {
        const r = SIDE_CHAIN[s] ?? '';
        return `${r ? `C(${r})` : 'C'}C(=O)`;
      })
      .join('N')}O`;
  }
  const bonds = Math.max(0, n - 1);
  return {
    sequence,
    name: sequence.join('-'),
    kind: n >= 2 && n <= 6 ? `${PREFIX[n]}peptide` : 'polypeptide',
    bonds,
    biuret: bonds >= 2,
    formula,
    M,
    smiles,
  };
}

/** Partial hydrolysis (tr. 44): every shorter peptide made of neighbouring residues, longest first. */
export function fragments(sequence: readonly string[]): string[][] {
  const out: string[][] = [];
  for (let len = sequence.length - 1; len >= 2; len--)
    for (let i = 0; i + len <= sequence.length; i++) out.push(sequence.slice(i, i + len));
  return out;
}
