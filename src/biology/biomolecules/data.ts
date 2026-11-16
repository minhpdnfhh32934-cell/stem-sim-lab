/**
 * "Các phân tử sinh học" (SH10 KNTT Bài 5, #255): the four groups with their monomer, and one
 * PubChem molecule per group in 3D (data/biomolecules.json, scripts/data/gen_biomolecules.py:
 * PubChem CID → RDKit ETKDG v3 + MMFF94; parts of the monomer found by SMARTS). Teaching texts are
 * short paraphrases of the textbook (pages given), DATA_REVIEW SH10-BIOMOL-*. Pure, no state.
 */
import { z } from 'zod';
import raw from '@data/biomolecules.json';
import {
  loadDataset,
  LocalizedTextSchema,
  ReviewStatusSchema,
  type LocalizedText,
  type Source,
} from '@/core/data/dataset';
import { L } from '../common';

const GROUP_IDS = ['carbohydrate', 'lipid', 'protein', 'nucleicAcid'] as const;
export type GroupId = (typeof GROUP_IDS)[number];
export const GROUPS: readonly GroupId[] = GROUP_IDS;
export const isGroup = (v: unknown): v is GroupId =>
  typeof v === 'string' && (GROUPS as readonly string[]).includes(v);

export type PartId =
  | 'amino'
  | 'carboxyl'
  | 'alphaC'
  | 'rGroup'
  | 'phosphate'
  | 'base'
  | 'sugar'
  | 'chain'
  | 'hydroxyl'
  | 'backbone';
const PART_IDS = [
  'amino',
  'carboxyl',
  'alphaC',
  'rGroup',
  'phosphate',
  'base',
  'sugar',
  'chain',
  'hydroxyl',
  'backbone',
] as const satisfies readonly PartId[];

const AtomSchema = z.object({
  el: z.string().min(1).max(2),
  xyz: z.tuple([z.number(), z.number(), z.number()]),
});
const BondSchema = z.object({
  a: z.number().int().nonnegative(),
  b: z.number().int().nonnegative(),
  order: z.number().int().min(1).max(3),
  aromatic: z.boolean(),
});
const BiomoleculeSchema = z.object({
  id: z.string().min(1),
  group: z.enum(GROUP_IDS),
  name: LocalizedTextSchema,
  cid: z.number().int().positive(),
  pubchem_title: z.string().min(1),
  formula: z.string().min(1),
  display_formula: z.string().min(1),
  molar_mass: z.number().positive(),
  atoms: z.array(AtomSchema).min(1),
  bonds: z.array(BondSchema),
  geometry_method: z.enum(['mmff94', 'uff']),
  parts: z.array(z.object({ id: z.enum(PART_IDS), atoms: z.array(z.number().int()).min(1) })),
  review_status: ReviewStatusSchema,
});
export type Biomolecule = z.infer<typeof BiomoleculeSchema>;
export type BioAtom = Biomolecule['atoms'][number];
export type BioBond = Biomolecule['bonds'][number];

const dataset = loadDataset('biomolecules', BiomoleculeSchema, raw);
export const BIOMOLECULES: readonly Biomolecule[] = dataset.items;
export const BIOMOLECULES_SOURCE: Source = dataset.source;

export function moleculesOf(group: GroupId): Biomolecule[] {
  return BIOMOLECULES.filter((m) => m.group === group);
}

export function biomolecule(id: string): Biomolecule | undefined {
  return BIOMOLECULES.find((m) => m.id === id);
}

/** The part atom `i` belongs to, or null (a molecule without named parts). */
export function partOfAtom(m: Biomolecule, i: number): PartId | null {
  return m.parts.find((p) => p.atoms.includes(i))?.id ?? null;
}

/** PubChem's page of a compound. */
export const pubchemUrl = (cid: number) =>
  `https://pubchem.ncbi.nlm.nih.gov/compound/${String(cid)}`;

export const PART_NAME: Record<PartId, LocalizedText> = {
  amino: L('Nhóm amino (–NH₂)', 'Amino group (–NH₂)'),
  carboxyl: L('Nhóm carboxyl (–COOH)', 'Carboxyl group (–COOH)'),
  alphaC: L('Carbon trung tâm và H', 'Central carbon and H'),
  rGroup: L('Chuỗi bên (nhóm R)', 'Side chain (R group)'),
  phosphate: L('Gốc phosphate', 'Phosphate group'),
  sugar: L('Đường deoxyribose (đường 5 carbon)', 'Deoxyribose (five-carbon sugar)'),
  base: L('Nitrogenous base (base): adenine', 'Nitrogenous base: adenine'),
  chain: L('Chuỗi hydrocarbon (không phân cực)', 'Hydrocarbon chain (non-polar)'),
  hydroxyl: L('Ba nhóm –OH', 'Three –OH groups'),
  backbone: L('Khung 3 carbon', 'Three-carbon backbone'),
};

export interface GroupInfo {
  name: LocalizedText;
  /** The building unit ("đơn phân"), or how the group is built when it is not a polymer. */
  monomer: LocalizedText;
  /** Is it a polymer built from many monomers (SGK tr. 28)? */
  polymer: boolean;
  text: LocalizedText;
  pages: string;
}

/** The four groups (SGK Sinh học 10 KNTT, Bài 5), paraphrased. */
export const GROUP_INFO: Record<GroupId, GroupInfo> = {
  carbohydrate: {
    name: L('Carbohydrate (chất đường bột)', 'Carbohydrates (sugars and starches)'),
    monomer: L(
      'Đường đơn (glucose, fructose, galactose…)',
      'Monosaccharides (glucose, fructose, galactose…)',
    ),
    polymer: true,
    text: L(
      'Gồm đường đơn (glucose, fructose, galactose), đường đôi (hai đường đơn liên kết, loại đi một phân tử nước) và đường đa (tinh bột, glycogen, cellulose, chitin) gồm hàng trăm tới hàng nghìn đường đơn. Đường đơn cung cấp năng lượng và là nguyên liệu tạo các phân tử khác; tinh bột, glycogen dự trữ năng lượng; cellulose cấu tạo thành tế bào thực vật.',
      'Monosaccharides (glucose, fructose, galactose), disaccharides (two monosaccharides joined, losing one water molecule) and polysaccharides (starch, glycogen, cellulose, chitin) of hundreds to thousands of monosaccharides. Monosaccharides supply energy and raw material for other molecules; starch and glycogen store energy; cellulose builds plant cell walls.',
    ),
    pages: '28–30',
  },
  lipid: {
    name: L('Lipid (chất béo)', 'Lipids (fats)'),
    monomer: L(
      'Không cấu tạo theo nguyên tắc đa phân; mỡ và dầu gồm 1 glycerol liên kết với 3 acid béo',
      'Not built from monomers; fats and oils are 1 glycerol joined to 3 fatty acids',
    ),
    polymer: false,
    text: L(
      'Rất đa dạng về cấu trúc nhưng đều kị nước, vì có nhiều liên kết C–H không phân cực và ít oxygen. Ở nhiệt độ phòng, mỡ ở thể rắn vì chứa acid béo no, dầu ở thể lỏng vì chứa acid béo không no. Mỡ và dầu dự trữ năng lượng; lớp mỡ dưới da cách nhiệt; cholesterol là thành phần của màng tế bào.',
      'Very varied in structure but all water-repelling, because they have many non-polar C–H bonds and little oxygen. At room temperature fats are solid because they hold saturated fatty acids, oils liquid because they hold unsaturated ones. Fats and oils store energy; fat under the skin insulates; cholesterol is part of the cell membrane.',
    ),
    pages: '31–33',
  },
  protein: {
    name: L('Protein (chất đạm)', 'Proteins'),
    monomer: L('Amino acid', 'Amino acids'),
    polymer: true,
    text: L(
      'Mỗi amino acid gồm một carbon trung tâm gắn với nhóm amino (–NH₂), nhóm carboxyl (–COOH), một nguyên tử H và nhóm R. Hai amino acid nối nhau bằng liên kết peptide, loại đi một phân tử nước. Protein tham gia cấu trúc tế bào, xúc tác (enzyme), bảo vệ (kháng thể), vận động, tiếp nhận thông tin và điều hòa.',
      'Each amino acid has a central carbon bonded to an amino group (–NH₂), a carboxyl group (–COOH), one H atom and an R group. Two amino acids join by a peptide bond, losing one water molecule. Proteins build cell structures, catalyse (enzymes), defend (antibodies), move, receive signals and regulate.',
    ),
    pages: '34–36',
  },
  nucleicAcid: {
    name: L('Nucleic acid (DNA, RNA)', 'Nucleic acids (DNA, RNA)'),
    monomer: L('Nucleotide', 'Nucleotides'),
    polymer: true,
    text: L(
      'Mỗi nucleotide gồm gốc phosphate, đường deoxyribose (đường 5 carbon) và một nitrogenous base; DNA có bốn loại base A, G, C, T. Các nucleotide nối nhau bằng liên kết phosphodiester thành chuỗi polynucleotide. DNA mang, bảo quản và truyền đạt thông tin di truyền.',
      'Each nucleotide has a phosphate group, a five-carbon sugar and a nitrogenous base; DNA has four bases A, G, C, T. Nucleotides join by phosphodiester bonds into a polynucleotide chain. DNA carries, stores and passes on genetic information.',
    ),
    pages: '36–37',
  },
};
