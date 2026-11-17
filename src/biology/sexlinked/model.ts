/**
 * Sinh học 12 KNTT Bài 10 "Di truyền giới tính và di truyền liên kết với giới tính" (tr. 50–53):
 * XX – XY sex determination gives sons and daughters 1 : 1 (Bảng 10.1), and Morgan's eye colour of
 * Drosophila, a gene on X with no allele on Y (Hình 10.2): A red is dominant over a white. A
 * cross is worked out from the parents' gametes (each 1/2), as the book's diagrams do.
 */

export type XAllele = 'A' | 'a';
/** The mother's two X: "AA" = XᴬXᴬ, "Aa" = XᴬXᵃ, "aa" = XᵃXᵃ. */
export type Mother = 'AA' | 'Aa' | 'aa';
/** The father's X: "A" = XᴬY, "a" = XᵃY. */
export type Father = XAllele;

export const MOTHERS: readonly Mother[] = ['AA', 'Aa', 'aa'];
export const FATHERS: readonly Father[] = ['A', 'a'];

export interface Child {
  sex: 'female' | 'male';
  /** Alleles on X: two for a daughter (dominant first), one for a son. */
  alleles: string;
  /** Share of all children (0–1). */
  fraction: number;
  /** Shows the dominant trait (red eyes). */
  dominant: boolean;
}

/** Gametes of each parent, 1/2 each: the mother's two X; the father's X and Y. */
export function motherGametes(m: Mother): [XAllele, XAllele] {
  return [m[0] as XAllele, m[1] as XAllele];
}

export function cross(mother: Mother, father: Father): Child[] {
  const out = new Map<string, Child>();
  for (const egg of motherGametes(mother)) {
    for (const sperm of [father, 'Y'] as const) {
      const sex = sperm === 'Y' ? 'male' : 'female';
      const alleles = sperm === 'Y' ? egg : [egg, sperm].sort().join('');
      const key = `${sex}:${alleles}`;
      const prev = out.get(key);
      if (prev) prev.fraction += 0.25;
      else out.set(key, { sex, alleles, fraction: 0.25, dominant: alleles.includes('A') });
    }
  }
  return [...out.values()].sort((p, q) =>
    p.sex === q.sex ? (p.alleles < q.alleles ? -1 : 1) : p.sex === 'female' ? -1 : 1,
  );
}

/** The mother of the next generation, when a daughter is crossed back (F1 × F1). */
export const asMother = (alleles: string): Mother =>
  alleles.length === 2 ? (alleles as Mother) : 'AA';

/** Share of sons among all children: always 1/2 with XX × XY (Bảng 10.1). */
export const sonShare = (children: readonly Child[]): number =>
  children.filter((c) => c.sex === 'male').reduce((s, c) => s + c.fraction, 0);

/** The book's crosses (Hình 10.2): forward and reciprocal, P and F1 × F1. */
export const BOOK_CROSSES = [
  { id: 'forward-p', mother: 'AA', father: 'a' },
  { id: 'forward-f1', mother: 'Aa', father: 'A' },
  { id: 'reciprocal-p', mother: 'aa', father: 'A' },
  { id: 'reciprocal-f1', mother: 'Aa', father: 'a' },
] as const satisfies readonly { id: string; mother: Mother; father: Father }[];
