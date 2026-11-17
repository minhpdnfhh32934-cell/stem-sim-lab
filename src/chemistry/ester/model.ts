import { z } from 'zod';
import raw from '@data/esters_kntt.json';
import {
  loadDataset,
  LocalizedTextSchema,
  ReviewStatusSchema,
  type Source,
} from '@/core/data/dataset';
import { molarMass, parseFormula } from '../formula';

/**
 * Hóa học 12 KNTT Bài 1 "Ester – Lipid" (and the saponification of Bài 2): naming simple esters
 * RCOOR' ("tên gốc R' + tên gốc carboxylic acid", tr. 7), the ester isomers of CnH2nO2 for n ≤ 5,
 * hydrolysis and esterification with its yield (question 7, tr. 9), triglycerides from the fatty
 * acids of tr. 10, their saponification and hydrogenation. Data: data/esters_kntt.json
 * (scripts/data/gen_esters_kntt.py; review pending, DATA_REVIEW HH12-EST-1). Molar masses use the
 * standard atomic weights of data/elements.json: the book prints none.
 */
const FattyAcidSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  chain: z.string().min(1),
  carbons: z.number().int().positive(),
  double_bonds: z.number().int().nonnegative(),
  review_status: ReviewStatusSchema,
});
const ExtraSchema = z.object({
  fat_composition: z.array(
    z.object({
      id: z.string(),
      name: LocalizedTextSchema,
      saturated: z.number(),
      one_double: z.number(),
      several_double: z.number(),
    }),
  ),
  boiling: z.array(
    z.object({ formula: z.string(), kind: z.string(), M: z.number(), bp_C: z.number() }),
  ),
  examples: z.array(z.looseObject({ id: z.string(), lesson: z.number(), page: z.number() })),
});

const dataset = loadDataset('esters_kntt', FattyAcidSchema, raw);
const extra = ExtraSchema.parse(raw);

export type FattyAcid = z.infer<typeof FattyAcidSchema>;
export const FATTY_ACIDS: readonly FattyAcid[] = dataset.items;
export const ESTER_SOURCE: Source = dataset.source;
export const FAT_COMPOSITION = extra.fat_composition;
export const BOILING = extra.boiling;
export const EXAMPLES = extra.examples;

export const fattyAcid = (id: string): FattyAcid => {
  const a = FATTY_ACIDS.find((x) => x.id === id);
  if (!a) throw new Error(`no fatty acid ${id}`);
  return a;
};

/* ───────── Groups ───────── */

/** An alkyl group R' (the alcohol side): its condensed formula, carbons and names. */
export interface Alkyl {
  id: string;
  /** As written after "COO" (CH3, C2H5, CH2CH2CH3 …). */
  condensed: string;
  carbons: number;
  name: string;
  /** The alcohol R'OH. */
  alcohol: string;
  saturated: boolean;
  /** SMILES of R', bonded through its first atom to the ester's O. */
  smiles: string;
}
/** An acyl side R of RCOO– (the acid side): R as written before "COO", and the anion's names. */
export interface Acyl {
  id: string;
  /** R before COO, written towards its attachment: H, CH3, CH3CH2CH2, (CH3)2CH … */
  condensed: string;
  /** Carbons of the whole acid RCOOH. */
  carbons: number;
  /** Substitutive and common names of RCOO–. */
  iupac: string;
  common: string | null;
  acid: string;
  saturated: boolean;
  /** SMILES of R, bonded through its last atom to the carbonyl C (empty for H). */
  smiles: string;
}

export const ALKYLS: readonly Alkyl[] = [
  {
    id: 'methyl',
    smiles: 'C',
    condensed: 'CH3',
    carbons: 1,
    name: 'methyl',
    alcohol: 'methanol',
    saturated: true,
  },
  {
    id: 'ethyl',
    smiles: 'CC',
    condensed: 'C2H5',
    carbons: 2,
    name: 'ethyl',
    alcohol: 'ethanol',
    saturated: true,
  },
  {
    id: 'propyl',
    smiles: 'CCC',
    condensed: 'CH2CH2CH3',
    carbons: 3,
    name: 'propyl',
    alcohol: 'propan-1-ol',
    saturated: true,
  },
  {
    id: 'isopropyl',
    smiles: 'C(C)C',
    condensed: 'CH(CH3)2',
    carbons: 3,
    name: 'isopropyl',
    alcohol: 'propan-2-ol',
    saturated: true,
  },
  {
    id: 'butyl',
    smiles: 'CCCC',
    condensed: 'CH2CH2CH2CH3',
    carbons: 4,
    name: 'butyl',
    alcohol: 'butan-1-ol',
    saturated: true,
  },
  {
    id: 'isobutyl',
    smiles: 'CC(C)C',
    condensed: 'CH2CH(CH3)2',
    carbons: 4,
    name: 'isobutyl',
    alcohol: '2-methylpropan-1-ol',
    saturated: true,
  },
  {
    id: 'secButyl',
    smiles: 'C(C)CC',
    condensed: 'CH(CH3)CH2CH3',
    carbons: 4,
    name: 'sec-butyl',
    alcohol: 'butan-2-ol',
    saturated: true,
  },
  {
    id: 'tertButyl',
    smiles: 'C(C)(C)C',
    condensed: 'C(CH3)3',
    carbons: 4,
    name: 'tert-butyl',
    alcohol: '2-methylpropan-2-ol',
    saturated: true,
  },
  {
    id: 'isoamyl',
    smiles: 'CCC(C)C',
    condensed: 'CH2CH2CH(CH3)2',
    carbons: 5,
    name: 'isoamyl',
    alcohol: 'isoamyl alcohol',
    saturated: true,
  },
  {
    id: 'benzyl',
    smiles: 'Cc1ccccc1',
    condensed: 'CH2C6H5',
    carbons: 7,
    name: 'benzyl',
    alcohol: 'benzyl alcohol',
    saturated: false,
  },
];

export const ACYLS: readonly Acyl[] = [
  {
    id: 'formic',
    smiles: '',
    condensed: 'H',
    carbons: 1,
    iupac: 'methanoate',
    common: 'formate',
    acid: 'formic acid',
    saturated: true,
  },
  {
    id: 'acetic',
    smiles: 'C',
    condensed: 'CH3',
    carbons: 2,
    iupac: 'ethanoate',
    common: 'acetate',
    acid: 'acetic acid',
    saturated: true,
  },
  {
    id: 'propanoic',
    smiles: 'CC',
    condensed: 'C2H5',
    carbons: 3,
    iupac: 'propanoate',
    common: 'propionate',
    acid: 'propanoic acid',
    saturated: true,
  },
  {
    id: 'butanoic',
    smiles: 'CCC',
    condensed: 'CH3CH2CH2',
    carbons: 4,
    iupac: 'butanoate',
    common: 'butyrate',
    acid: 'butanoic acid',
    saturated: true,
  },
  {
    id: 'isobutyric',
    smiles: 'CC(C)',
    condensed: '(CH3)2CH',
    carbons: 4,
    iupac: '2-methylpropanoate',
    common: 'isobutyrate',
    acid: '2-methylpropanoic acid',
    saturated: true,
  },
  {
    id: 'acrylic',
    smiles: 'C=C',
    condensed: 'CH2=CH',
    carbons: 3,
    iupac: 'propenoate',
    common: 'acrylate',
    acid: 'acrylic acid',
    saturated: false,
  },
  {
    id: 'benzoic',
    smiles: 'c1ccccc1',
    condensed: 'C6H5',
    carbons: 7,
    iupac: 'benzoate',
    common: null,
    acid: 'benzoic acid',
    saturated: false,
  },
];

export const alkyl = (id: string) => ALKYLS.find((a) => a.id === id) ?? ALKYLS[0];
export const acyl = (id: string) => ACYLS.find((a) => a.id === id) ?? ACYLS[0];

/** Hill-style molecular formula from a condensed one (C first, H second, then by symbol). */
export function molecular(condensed: string): string {
  const counts = parseFormula(condensed.replace(/=/g, '')).counts;
  const order = [...counts.keys()].sort((a, b) =>
    a === 'C' ? -1 : b === 'C' ? 1 : a === 'H' ? -1 : b === 'H' ? 1 : a.localeCompare(b),
  );
  return order
    .map((el) => `${el}${(counts.get(el) ?? 0) === 1 ? '' : (counts.get(el) ?? 0)}`)
    .join('');
}

export interface Ester {
  acyl: Acyl;
  alkyl: Alkyl;
  /** RCOOR' as the book writes it (CH3COOC2H5). */
  condensed: string;
  formula: string;
  /** "ethyl ethanoate" and "ethyl acetate". */
  iupac: string;
  common: string | null;
  M: number;
  /** SMILES for the structural formula: R C(=O) O R'. */
  smiles: string;
}

/** The ester RCOOR' of an acid and an alcohol, named "tên gốc R' + tên gốc carboxylic acid". */
export function ester(acylId: string, alkylId: string): Ester {
  const a = acyl(acylId);
  const r = alkyl(alkylId);
  if (!a || !r) throw new Error('unknown group');
  const condensed = `${a.condensed}COO${r.condensed}`;
  return {
    acyl: a,
    alkyl: r,
    condensed,
    formula: molecular(condensed),
    iupac: `${r.name} ${a.iupac}`,
    common: a.common ? `${r.name} ${a.common}` : null,
    M: molarMass(condensed.replace(/=/g, '')),
    smiles: `${a.smiles}C(=O)O${r.smiles}`,
  };
}

/**
 * Every open-chain saturated ester of CnH2nO2 (2 ≤ n ≤ 5, the book's "số nguyên tử C ≤ 5"): an
 * acid with a carbons and an alkyl with n − a carbons.
 */
export function esterIsomers(n: number): Ester[] {
  if (n < 2 || n > 5) return [];
  const out: Ester[] = [];
  for (const a of ACYLS.filter((x) => x.saturated))
    for (const r of ALKYLS.filter((x) => x.saturated && x.id !== 'isoamyl'))
      if (a.carbons + r.carbons === n) out.push(ester(a.id, r.id));
  return out;
}

/* ───────── Reactions ───────── */

/** Hydrolysis in acid (reversible) or with NaOH (one way, saponification), as condensed formulas. */
export function hydrolysis(e: Ester, medium: 'acid' | 'base') {
  const acidF = `${e.acyl.condensed}COOH`;
  const saltF = `${e.acyl.condensed}COONa`;
  const alcoholF = `${e.alkyl.condensed}OH`;
  return medium === 'acid'
    ? { left: [e.condensed, 'H2O'], right: [acidF, alcoholF], reversible: true }
    : { left: [e.condensed, 'NaOH'], right: [saltF, alcoholF], reversible: false };
}

/**
 * Esterification RCOOH + R'OH ⇌ RCOOR' + H₂O: the limiting reagent, the theoretical mass of
 * ester and the yield (question 7, tr. 9).
 */
export function esterificationYield(e: Ester, acidG: number, alcoholG: number, esterG: number) {
  const nAcid = acidG / molarMass(`${e.acyl.condensed}COOH`.replace(/=/g, ''));
  const nAlcohol = alcoholG / molarMass(`${e.alkyl.condensed}OH`);
  const n = Math.min(nAcid, nAlcohol);
  const theoretical = n * e.M;
  return {
    nAcid,
    nAlcohol,
    limiting: nAcid <= nAlcohol ? 'acid' : 'alcohol',
    theoretical,
    yield: esterG / theoretical,
  };
}

/* ───────── Fats ───────── */

/**
 * SMILES of each acyl group RCO– from the carbonyl carbon outwards, with the cis double bonds of
 * tr. 10: oleic CH₃[CH₂]₇CH=CH[CH₂]₇CO–, linoleic CH₃[CH₂]₄CH=CHCH₂CH=CH[CH₂]₇CO–.
 */
export const ACYL_SMILES: Readonly<Record<string, string>> = {
  palmitic: `C(=O)${'C'.repeat(15)}`,
  stearic: `C(=O)${'C'.repeat(17)}`,
  oleic: 'C(=O)CCCCCCC/C=C\\CCCCCCCC',
  linoleic: 'C(=O)CCCCCCC/C=C\\C/C=C\\CCCCC',
};

/** SMILES of the triglyceride of three fatty acids (glycerol positions 1, 2, 3). */
export const triglycerideSmiles = (ids: readonly [string, string, string]) =>
  `C(O${ACYL_SMILES[ids[0]] ?? ''})C(O${ACYL_SMILES[ids[1]] ?? ''})CO${ACYL_SMILES[ids[2]] ?? ''}`;

/** A triglyceride of glycerol with three fatty acids: (RCOO)₃C₃H₅. */
export function triglyceride(ids: readonly [string, string, string]) {
  const acids = ids.map(fattyAcid);
  const condensed = `C3H5${acids.map((a) => `(${a.chain}COO)`).join('')}`;
  const M = molarMass(condensed);
  const doubleBonds = acids.reduce((s, a) => s + a.double_bonds, 0);
  return { acids, condensed, formula: molecular(condensed), M, doubleBonds };
}

/** Saponification of `fatG` grams: fat + 3NaOH → glycerol + 3 RCOONa. */
export function saponify(ids: readonly [string, string, string], fatG: number) {
  const t = triglyceride(ids);
  const n = fatG / t.M;
  const soap = t.acids.reduce((s, a) => s + n * molarMass(`${a.chain}COONa`), 0);
  return {
    mol: n,
    naoh: 3 * n * molarMass('NaOH'),
    glycerol: n * molarMass('C3H5(OH)3'),
    soap,
  };
}

/** Moles of H₂ to saturate every C=C of `fatG` grams of the fat. */
export function hydrogenNeeded(ids: readonly [string, string, string], fatG: number) {
  const t = triglyceride(ids);
  return (fatG / t.M) * t.doubleBonds;
}
