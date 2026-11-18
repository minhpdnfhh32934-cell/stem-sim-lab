/**
 * What the 3D view of "Di truyền giới tính và liên kết với giới tính" draws (pure, no three.js;
 * tested against `cross()`): the parents' sex chromosomes, their gametes (each 1/2) and the four
 * cells of the cross (each 1/4), with which chromosome came from whom — a son's X is always his
 * mother's. The gene is on X only (no allele on Y, Hình 10.2).
 */
import { motherGametes, type Father, type Mother, type XAllele } from '../model';

export type Vec3 = [number, number, number];
export type Origin = 'maternal' | 'paternal';

export interface Chrom {
  kind: 'X' | 'Y';
  /** The allele on X (none on Y). */
  allele: XAllele | null;
  from: Origin;
}

export interface Cell {
  egg: XAllele;
  sperm: XAllele | 'Y';
  sex: 'female' | 'male';
  /** As `cross()` writes them: two for a daughter (sorted), one for a son. */
  alleles: string;
  dominant: boolean;
  fraction: number;
  chroms: [Chrom, Chrom];
  at: Vec3;
}

/** Column x of each sperm, row y of each egg (the grid of the 2D picture's table). */
export const COLS = [0, 3.4] as const;
export const ROWS = [1.6, -1.8] as const;
export const EGG_X = -3.4;
export const SPERM_Y = 4.6;
export const PARENT_Y = 8;

export function cells(mother: Mother, father: Father): Cell[] {
  const eggs = motherGametes(mother);
  const sperms = [father, 'Y'] as const;
  const out: Cell[] = [];
  eggs.forEach((egg, i) => {
    sperms.forEach((sperm, j) => {
      const male = sperm === 'Y';
      const alleles = male ? egg : [egg, sperm].sort().join('');
      out.push({
        egg,
        sperm,
        sex: male ? 'male' : 'female',
        alleles,
        dominant: alleles.includes('A'),
        fraction: 0.25,
        chroms: [
          { kind: 'X', allele: egg, from: 'maternal' },
          male
            ? { kind: 'Y', allele: null, from: 'paternal' }
            : { kind: 'X', allele: sperm, from: 'paternal' },
        ],
        at: [COLS[j] ?? 0, ROWS[i] ?? 0, 0],
      });
    });
  });
  return out;
}
