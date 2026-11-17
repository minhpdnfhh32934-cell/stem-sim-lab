import { HEREDITY } from '../heredityData';

/**
 * Sinh học 12 KNTT Bài 12 "Đột biến nhiễm sắc thể" (tr. 60–67): structural mutations as the gene
 * orders of Hình 12.1; numerical ones as chromosome counts — aneuploids 2n + 1, 2n − 1, 2n − 2
 * (tr. 63), polyploids 3n, 4n (tr. 64), the allopolyploid 2nA + 2nB of Hình 12.3c — and the rate of
 * Down syndrome by the mother's age ("Em có biết", tr. 67).
 */

export const STRUCTURES = ['deletion', 'duplication', 'inversion', 'translocation'] as const;
export type Structure = (typeof STRUCTURES)[number];

/** The chromosome(s) before and after, as the letters of Hình 12.1. */
export function structureChange(s: Structure): { before: string[]; after: string[] } {
  const original = HEREDITY.structure.original ?? [];
  const after = HEREDITY.structure[s] ?? [];
  // A translocation joins two chromosomes: the other one (1 2 3 4 5 6) is drawn before too.
  const before = s === 'translocation' ? [...original, '123456'] : original;
  return { before, after };
}

export const NUMBER_TYPES = ['trisomy', 'monosomy', 'nullisomy', 'triploid', 'tetraploid'] as const;
export type NumberType = (typeof NUMBER_TYPES)[number];

/** Chromosome count of the mutant from the species' 2n (an even number). */
export function chromosomeCount(twoN: number, t: NumberType): number {
  const n = twoN / 2;
  switch (t) {
    case 'trisomy':
      return twoN + 1;
    case 'monosomy':
      return twoN - 1;
    case 'nullisomy':
      return twoN - 2;
    case 'triploid':
      return 3 * n;
    case 'tetraploid':
      return 4 * n;
  }
}

/** Hình 12.3c: a hybrid of species A and B has nA + nB; doubled, 2nA + 2nB. */
export function allopolyploid(aTwoN: number, bTwoN: number): { hybrid: number; doubled: number } {
  return { hybrid: aTwoN / 2 + bTwoN / 2, doubled: aTwoN + bTwoN };
}

export const HUMAN_2N = HEREDITY.human_2n;
export const CHIMP_2N = HEREDITY.chimp_2n;
export const BOOK_ALLOPOLYPLOID = HEREDITY.allopolyploid;
export const DOWN_BY_AGE = HEREDITY.down_by_age;
