import { z } from 'zod';
import raw from '@data/complexes_kntt.json';
import { loadDataset, ReviewStatusSchema, type Source } from '@/core/data/dataset';
import type { Atom, Bond, Molecule } from '../data/molecules';
import { formatFormula } from '../formula';

/**
 * Hóa học 12 KNTT Bài 28 "Sơ lược về phức chất" and Bài 29 "Một số tính chất và ứng dụng của
 * phức chất": the complexes the books name, their central atom, ligands, charge, coordination
 * number and geometry (Bảng 28.1, only where the book states it), colours (tr. 138–139) and ligand
 * substitutions (tr. 140). Data: data/complexes_kntt.json (scripts/data/gen_complexes_kntt.py;
 * review pending, DATA_REVIEW HH12-CPX-1).
 */
const ComplexSchema = z.object({
  id: z.string().min(1),
  metal: z.string(),
  metal_charge: z.number().int(),
  ligands: z.array(z.object({ ligand: z.string(), count: z.number().int().positive() })).min(1),
  charge: z.number().int(),
  geometry: z.enum(['octahedral', 'square_planar']).nullable(),
  colour: z.object({ vi: z.string(), en: z.string() }).nullable(),
  page: z.number().int(),
  geometry_from: z.string().nullable(),
  review_status: ReviewStatusSchema,
});
const ExtraSchema = z.object({
  ligands: z.record(z.string(), z.object({ charge: z.number().int(), donor: z.string() })),
  substitutions: z.array(
    z.object({
      id: z.string(),
      before: z.string(),
      entering: z.string(),
      entering_count: z.number().int().positive(),
      after: z.string(),
      leaving: z.string(),
      leaving_count: z.number().int().positive(),
      page: z.number().int(),
    }),
  ),
});

const dataset = loadDataset('complexes_kntt', ComplexSchema, raw);
const extra = ExtraSchema.parse(raw);

export type Complex = z.infer<typeof ComplexSchema>;
export type Geometry = NonNullable<Complex['geometry']>;
export type Substitution = (typeof extra.substitutions)[number];
export const COMPLEXES: readonly Complex[] = dataset.items;
export const COMPLEXES_SOURCE: Source = dataset.source;
export const LIGANDS = extra.ligands;
export const SUBSTITUTIONS: readonly Substitution[] = extra.substitutions;

export function complex(id: string): Complex {
  const c = COMPLEXES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown complex ${id}`);
  return c;
}

const ligandCharge = (l: string): number => LIGANDS[l]?.charge ?? 0;

/** Charge = the central atom's + the ligands' (tr. 134). */
export const computedCharge = (c: Complex): number =>
  c.metal_charge + c.ligands.reduce((s, l) => s + ligandCharge(l.ligand) * l.count, 0);

/** The number of ligands around the central atom. */
export const coordination = (c: Complex): number => c.ligands.reduce((s, l) => s + l.count, 0);

/* ───────── Text ───────── */

const chargeSuffix = (q: number): string =>
  q === 0 ? '' : `^${Math.abs(q) === 1 ? '' : Math.abs(q)}${q > 0 ? '+' : '-'}`;

/** A ligand as written inside the brackets: "Cl3", "(NH3)6", "(NH3)" (one atom: no brackets). */
function ligandPart(l: string, n: number): string {
  const single = /^[A-Z][a-z]?$/.test(l);
  const body = single ? l : `(${l})`;
  return n === 1 ? body : `${body}${n}`;
}

/** "[Co(NH₃)₆]³⁺", "[PtCl₂(NH₃)₂]", "[Fe(CO)₅]". */
export function complexText(c: Complex): string {
  const inside = c.ligands.map((l) => ligandPart(l.ligand, l.count)).join('');
  return formatFormula(`[${c.metal}${inside}]${chargeSuffix(c.charge)}`);
}

/** A ligand as an ion or molecule: "NH₃", "OH⁻", "CN⁻". */
export const ligandText = (l: string): string =>
  formatFormula(`${l}${chargeSuffix(ligandCharge(l))}`);

/** The central atom: "Co³⁺", "Fe" (charge 0). */
export const metalText = (c: Complex): string =>
  formatFormula(`${c.metal}${chargeSuffix(c.metal_charge)}`);

/** "(+3) + 6 × (0) = +3": the charge worked out. */
export function chargeSum(c: Complex): string {
  const signed = (q: number) => (q > 0 ? `+${q}` : q === 0 ? '0' : `−${Math.abs(q)}`);
  const parts = [`(${signed(c.metal_charge)})`].concat(
    c.ligands.map((l) => `${l.count} × (${signed(ligandCharge(l.ligand))})`),
  );
  return `${parts.join(' + ')} = ${signed(computedCharge(c))}`;
}

/** A substitution as the book writes it (tr. 140), the leaving ligand on the right. */
export function substitutionText(s: Substitution): string {
  const term = (n: number, l: string) => `${n === 1 ? '' : n}${ligandText(l)}`;
  return `${complexText(complex(s.before))} + ${term(s.entering_count, s.entering)} → ${complexText(complex(s.after))} + ${term(s.leaving_count, s.leaving)}`;
}

/** Charge is kept: before + entering ligands = after + leaving ligands. */
export const substitutionBalanced = (s: Substitution): boolean =>
  computedCharge(complex(s.before)) + ligandCharge(s.entering) * s.entering_count ===
  computedCharge(complex(s.after)) + ligandCharge(s.leaving) * s.leaving_count;

/* ───────── Geometry (Bảng 28.1) ───────── */

const DIRECTIONS: Record<Geometry, readonly (readonly [number, number, number])[]> = {
  octahedral: [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ],
  // cis order: the first two ligands sit side by side (cisplatin's two Cl, tr. 140).
  square_planar: [
    [1, 0, 0],
    [0, 1, 0],
    [-1, 0, 0],
    [0, -1, 0],
  ],
};
/** Illustrative M–L distance (Å): the book gives none; only the arrangement is drawn. */
const ML_DISTANCE = 2;

/** A fixed turn (25° about x, then 35° about y) so the first view shows depth; shape unchanged. */
function turn([x, y, z]: readonly [number, number, number]): [number, number, number] {
  const a = (25 * Math.PI) / 180;
  const b = (35 * Math.PI) / 180;
  const y1 = y * Math.cos(a) - z * Math.sin(a);
  const z1 = y * Math.sin(a) + z * Math.cos(a);
  return [x * Math.cos(b) + z1 * Math.sin(b), y1, -x * Math.sin(b) + z1 * Math.cos(b)];
}

/**
 * A ball-and-stick model of a complex whose geometry the book states: the central atom at the
 * origin and each ligand drawn as its donor atom on Bảng 28.1's ideal directions. Null otherwise.
 */
export function complexModel(c: Complex): Molecule | null {
  if (!c.geometry) return null;
  const dirs = DIRECTIONS[c.geometry];
  const donors = c.ligands.flatMap((l) =>
    Array.from({ length: l.count }, () => LIGANDS[l.ligand]?.donor ?? 'X'),
  );
  if (donors.length !== dirs.length) return null;
  const atoms: Atom[] = [{ el: c.metal, sym: 0, xyz: [0, 0, 0], xy: [0, 0], charge: 0 }];
  const bonds: Bond[] = [];
  donors.forEach((el, i) => {
    const d = turn(dirs[i] ?? [0, 0, 0]);
    atoms.push({
      el,
      sym: 1,
      xyz: [d[0] * ML_DISTANCE, d[1] * ML_DISTANCE, d[2] * ML_DISTANCE],
      xy: [d[0], d[1]],
      charge: 0,
    });
    bonds.push({ a: 0, b: i + 1, order: 1, aromatic: false });
  });
  return {
    id: `complex.${c.id}`,
    name: { vi: complexText(c), en: complexText(c) },
    aliases: [],
    category: 'ion',
    smiles: '',
    formula: c.metal,
    display_formula: complexText(c),
    molar_mass: 1,
    atoms,
    bonds,
    geometry_method: 'vsepr-ideal',
    reference: null,
    experimental: null,
    review_status: 'pending',
  };
}
