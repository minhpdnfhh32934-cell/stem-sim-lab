import { z } from 'zod';
import raw from '@data/molecules.json';
import {
  LocalizedTextSchema,
  ReviewStatusSchema,
  loadDataset,
  type LocalizedText,
  type Source,
} from '@/core/data/dataset';
import { normalizeForSearch } from '@/app/catalog';
import { elementBySymbol } from './elements';

const AtomSchema = z.object({
  el: z.string(),
  sym: z.number().int(),
  xyz: z.tuple([z.number(), z.number(), z.number()]),
  charge: z.number().int(),
});
const BondSchema = z.object({
  a: z.number().int(),
  b: z.number().int(),
  order: z.number().int().min(1).max(3),
  aromatic: z.boolean(),
});
const MoleculeSchema = z.object({
  id: z.string(),
  name: LocalizedTextSchema,
  aliases: z.array(z.string()),
  category: z.enum(['inorganic', 'organic', 'ion']),
  smiles: z.string(),
  formula: z.string(),
  /** Formula as written in textbooks, e.g. "C2H5OH" (same atoms as `formula`). */
  display_formula: z.string(),
  molar_mass: z.number().positive(),
  atoms: z.array(AtomSchema).min(1),
  bonds: z.array(BondSchema),
  geometry_method: z.enum(['mmff94', 'uff', 'experimental', 'vsepr-ideal']),
  reference: z
    .object({
      bonds: z.record(z.string(), z.number()).optional(),
      angles: z.record(z.string(), z.number()).optional(),
    })
    .nullable(),
  experimental: z.object({ r: z.number(), angle: z.number().optional() }).nullable(),
  review_status: ReviewStatusSchema,
});
export type Molecule = z.infer<typeof MoleculeSchema>;
export type Atom = z.infer<typeof AtomSchema>;
export type Bond = z.infer<typeof BondSchema>;

const dataset = loadDataset('molecules', MoleculeSchema, raw);
export const MOLECULES: readonly Molecule[] = dataset.items;
export const MOLECULES_SOURCE: Source = dataset.source;

export function moleculeById(id: string): Molecule | undefined {
  return MOLECULES.find((m) => m.id === id);
}

export type Vec3 = readonly [number, number, number];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3) => Math.sqrt(dot(a, a));
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const unit = (a: Vec3): Vec3 => scale(a, 1 / (norm(a) || 1));

/** Distance between atoms i and j (Å). */
export function distance(m: Molecule, i: number, j: number): number {
  const a = m.atoms[i];
  const b = m.atoms[j];
  return a && b ? norm(sub(a.xyz, b.xyz)) : NaN;
}

/** Angle i–j–k at atom j (degrees). */
export function angle(m: Molecule, i: number, j: number, k: number): number {
  const a = m.atoms[i];
  const b = m.atoms[j];
  const c = m.atoms[k];
  if (!a || !b || !c) return NaN;
  const u = sub(a.xyz, b.xyz);
  const v = sub(c.xyz, b.xyz);
  const cos = dot(u, v) / (norm(u) * norm(v));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export function neighbors(m: Molecule, i: number): number[] {
  const out: number[] = [];
  for (const b of m.bonds) {
    if (b.a === i) out.push(b.b);
    else if (b.b === i) out.push(b.a);
  }
  return out;
}

/** Valence electrons of a main-group element (group 1–2 → group, 13–18 → group − 10). */
export function valenceElectrons(symbol: string): number | null {
  const e = elementBySymbol(symbol);
  if (!e || e.group === null) return null;
  if (e.group <= 2) return e.group;
  if (e.group >= 13) return e.group - 10;
  return null;
}

/** Lone pairs on atom i from its valence electrons, formal charge and bond orders (Lewis). */
export function lonePairs(m: Molecule, i: number): number {
  const a = m.atoms[i];
  if (!a || a.el === 'H') return 0;
  const v = valenceElectrons(a.el);
  if (v === null) return 0;
  const bonded = m.bonds.filter((b) => b.a === i || b.b === i).reduce((s, b) => s + b.order, 0);
  return Math.max(0, Math.floor((v - a.charge - bonded) / 2));
}

export type GeometryId =
  | 'linear'
  | 'trigonalPlanar'
  | 'bent'
  | 'tetrahedral'
  | 'trigonalPyramidal'
  | 'trigonalBipyramidal'
  | 'seesaw'
  | 'tShaped'
  | 'octahedral'
  | 'squarePyramidal'
  | 'squarePlanar';

export const GEOMETRY: Record<GeometryId, { name: LocalizedText; ideal: string }> = {
  linear: { name: { vi: 'Đường thẳng', en: 'Linear' }, ideal: '180°' },
  trigonalPlanar: { name: { vi: 'Tam giác phẳng', en: 'Trigonal planar' }, ideal: '120°' },
  bent: { name: { vi: 'Gấp khúc (chữ V)', en: 'Bent (V-shaped)' }, ideal: '< 120° / < 109,5°' },
  tetrahedral: { name: { vi: 'Tứ diện', en: 'Tetrahedral' }, ideal: '109,5°' },
  trigonalPyramidal: {
    name: { vi: 'Chóp tam giác', en: 'Trigonal pyramidal' },
    ideal: '< 109,5°',
  },
  trigonalBipyramidal: {
    name: { vi: 'Lưỡng chóp tam giác', en: 'Trigonal bipyramidal' },
    ideal: '90°, 120°',
  },
  seesaw: { name: { vi: 'Cái bập bênh', en: 'Seesaw' }, ideal: '< 90°, < 120°' },
  tShaped: { name: { vi: 'Chữ T', en: 'T-shaped' }, ideal: '< 90°' },
  octahedral: { name: { vi: 'Bát diện', en: 'Octahedral' }, ideal: '90°' },
  squarePyramidal: { name: { vi: 'Chóp vuông', en: 'Square pyramidal' }, ideal: '< 90°' },
  squarePlanar: { name: { vi: 'Vuông phẳng', en: 'Square planar' }, ideal: '90°' },
};

/** VSEPR class AXₙEₘ → molecular shape (standard VSEPR table). */
const SHAPES: Record<string, GeometryId> = {
  '2,0': 'linear',
  '3,0': 'trigonalPlanar',
  '2,1': 'bent',
  '4,0': 'tetrahedral',
  '3,1': 'trigonalPyramidal',
  '2,2': 'bent',
  '5,0': 'trigonalBipyramidal',
  '4,1': 'seesaw',
  '3,2': 'tShaped',
  '2,3': 'linear',
  '6,0': 'octahedral',
  '5,1': 'squarePyramidal',
  '4,2': 'squarePlanar',
};

export interface Vsepr {
  atom: number;
  n: number;
  e: number;
  label: string;
  geometry: GeometryId | null;
}

/** VSEPR description of atom i (only meaningful when it has ≥ 2 neighbours). */
export function vsepr(m: Molecule, i: number): Vsepr {
  const n = neighbors(m, i).length;
  const e = lonePairs(m, i);
  const label = `AX${n > 1 ? sub2(n) : n === 1 ? '' : '₀'}${e ? `E${e > 1 ? sub2(e) : ''}` : ''}`;
  return { atom: i, n, e, label, geometry: SHAPES[`${n},${e}`] ?? null };
}
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
function sub2(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBS[Number(d)] ?? d)
    .join('');
}

/** The atom with the most neighbours (first in case of a tie): the molecule's "centre". */
export function centralAtom(m: Molecule): number {
  let best = 0;
  let bestN = -1;
  m.atoms.forEach((_, i) => {
    const n = neighbors(m, i).length;
    if (n > bestN) {
      best = i;
      bestN = n;
    }
  });
  return best;
}

export type BondPolarity = 'nonpolar' | 'polar' | 'ionic';

/**
 * Bond type from the Pauling electronegativity difference, with the thresholds used in
 * Vietnamese textbooks (Hóa học 10): Δχ < 0.4 non-polar covalent, 0.4 ≤ Δχ < 1.7 polar
 * covalent, Δχ ≥ 1.7 ionic.
 */
export function bondPolarity(deltaEn: number): BondPolarity {
  if (deltaEn < 0.4) return 'nonpolar';
  if (deltaEn < 1.7) return 'polar';
  return 'ionic';
}

export function deltaEn(m: Molecule, b: Bond): number | null {
  const x = elementBySymbol(m.atoms[b.a]?.el ?? '')?.en_pauling ?? null;
  const y = elementBySymbol(m.atoms[b.b]?.el ?? '')?.en_pauling ?? null;
  return x === null || y === null ? null : Math.abs(x - y);
}

export type MolecularPolarity = 'nonpolar' | 'weak' | 'polar' | 'ion' | 'unknown';

/**
 * Qualitative molecular polarity: vector sum of bond dipoles (Δχ along each bond, towards
 * the more electronegative atom) plus, for neutral molecules, the dipole of the formal
 * charges averaged over resonance-equivalent atoms. Result is in "Δχ·unit-vector" units —
 * a qualitative indicator, not a dipole moment in debye.
 */
export function polarity(m: Molecule): {
  verdict: MolecularPolarity;
  magnitude: number;
  /** Direction of the net dipole arrow (towards δ−), in molecule coordinates. */
  vector: Vec3;
} {
  const net = m.atoms.reduce((s, a) => s + a.charge, 0);
  if (net !== 0) return { verdict: 'ion', magnitude: NaN, vector: [0, 0, 0] };
  let sum: Vec3 = [0, 0, 0];
  for (const b of m.bonds) {
    const A = m.atoms[b.a];
    const B = m.atoms[b.b];
    const xa = elementBySymbol(A?.el ?? '')?.en_pauling ?? null;
    const xb = elementBySymbol(B?.el ?? '')?.en_pauling ?? null;
    if (!A || !B) continue;
    if (xa === null || xb === null)
      return { verdict: 'unknown', magnitude: NaN, vector: [0, 0, 0] };
    sum = add(sum, scale(unit(sub(B.xyz, A.xyz)), xb - xa));
  }
  // Formal charges averaged over symmetry-equivalent atoms (resonance).
  const classes = new Map<number, { q: number; count: number }>();
  for (const a of m.atoms) {
    const c = classes.get(a.sym) ?? { q: 0, count: 0 };
    classes.set(a.sym, { q: c.q + a.charge, count: c.count + 1 });
  }
  for (const a of m.atoms) {
    const c = classes.get(a.sym);
    const q = c ? c.q / c.count : 0;
    // Negative charge attracts the dipole arrow (chemistry convention: arrow → δ−).
    sum = add(sum, scale(a.xyz, -q));
  }
  const mag = norm(sum);
  return {
    verdict: mag < 0.05 ? 'nonpolar' : mag < 0.3 ? 'weak' : 'polar',
    magnitude: mag,
    vector: sum,
  };
}

/**
 * Directions of the lone pairs on atom i (unit vectors), placed by minimising repulsion
 * with the bonds on the unit sphere. Illustration only.
 */
export function lonePairDirections(m: Molecule, i: number): Vec3[] {
  const count = lonePairs(m, i);
  const center = m.atoms[i];
  if (!count || !center) return [];
  const bonds = neighbors(m, i).map((j) => unit(sub(m.atoms[j]?.xyz ?? center.xyz, center.xyz)));
  const base = unit(scale(bonds.reduce<Vec3>(add, [0, 0, 0]), -1));
  const seed: Vec3 = norm(base) > 0.1 ? base : [0, 0, 1];
  // Deterministic initial spread around the seed direction.
  let lps: Vec3[] = Array.from({ length: count }, (_, k) => {
    const a = (2 * Math.PI * k) / count;
    const perp = unit(Math.abs(seed[0]) < 0.9 ? [0, -seed[2], seed[1]] : [-seed[2], 0, seed[0]]);
    const perp2: Vec3 = [
      seed[1] * perp[2] - seed[2] * perp[1],
      seed[2] * perp[0] - seed[0] * perp[2],
      seed[0] * perp[1] - seed[1] * perp[0],
    ];
    return unit(add(seed, add(scale(perp, 0.6 * Math.cos(a)), scale(perp2, 0.6 * Math.sin(a)))));
  });
  for (let it = 0; it < 300; it++) {
    lps = lps.map((u, k) => {
      let f: Vec3 = [0, 0, 0];
      const push = (v: Vec3, w: number) => {
        const d = sub(u, v);
        const r = norm(d) || 1e-6;
        f = add(f, scale(d, w / (r * r * r)));
      };
      bonds.forEach((b) => {
        push(b, 1);
      });
      lps.forEach((v, j) => {
        if (j !== k) push(v, 1.3);
      });
      const tangential = sub(f, scale(u, dot(f, u)));
      return unit(add(u, scale(tangential, 0.05)));
    });
  }
  return lps;
}

/** "C2H4O2" → "C₂H₄O₂", "CO3-2" → "CO₃²⁻" (RDKit formula format). */
export function prettyFormula(f: string): string {
  const m = /^(.*?)([+-])(\d*)$/.exec(f);
  const body = m?.[1] ?? f;
  const charge = m ? `${m[3] && m[3] !== '1' ? toSup(m[3]) : ''}${m[2] === '+' ? '⁺' : '⁻'}` : '';
  return body.replace(/\d+/g, (d) => sub2(Number(d))) + charge;
}
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function toSup(s: string): string {
  return s
    .split('')
    .map((d) => SUPS[Number(d)] ?? d)
    .join('');
}

/** Search by Vietnamese/English name, alias, formula (with or without subscripts) or SMILES. */
export function findMolecules(query: string): Molecule[] {
  const q = normalizeForSearch(query.replace(/[₀-₉]/g, (c) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c))));
  if (!q) return [...MOLECULES];
  return MOLECULES.filter(
    (m) =>
      normalizeForSearch(m.name.vi).includes(q) ||
      normalizeForSearch(m.name.en).includes(q) ||
      m.aliases.some((a) => normalizeForSearch(a).includes(q)) ||
      m.formula.toLowerCase() === q.replace(/\s/g, '') ||
      m.smiles === query.trim(),
  );
}
