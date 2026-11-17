import { HEREDITY, HEREDITY_ITEMS } from '../heredityData';

/**
 * Sinh học 12 KNTT Bài 11 "Liên kết gene và hoán vị gene" (tr. 54–59): Morgan's testcrosses of
 * Drosophila with body colour (B grey, b black) and wing size (V long, v vestigial) on one
 * chromosome. The F1 male BV/bv × bv/bv gives two classes, 50 % each (complete linkage, Hình 11.1);
 * the F1 female gives 41,5 % : 41,5 % : 8,5 % : 8,5 % (Hình 11.2): crossing over in 34 % of the cells
 * makes 17 % recombinant gametes (Hình 11.3). The recombination frequency is the percentage of
 * recombinant gametes and is never above 50 % (tr. 57).
 */

/** The four gametes of BV/bv, parental first. */
export const GAMETES = ['BV', 'bv', 'Bv', 'bV'] as const;
export type Gamete = (typeof GAMETES)[number];
export const PARENTAL: readonly Gamete[] = ['BV', 'bv'];

/** Recombination frequency (0–0,5) from the share of meiotic cells with a crossover (0–1). */
export const frequencyFromCells = (cellsWithCrossover: number): number => cellsWithCrossover / 2;

/** Gamete shares of a BV/bv parent with recombination frequency f (0 = complete linkage). */
export function gameteShares(f: number): Record<Gamete, number> {
  const rec = f / 2;
  const par = (1 - f) / 2;
  return { BV: par, bv: par, Bv: rec, bV: rec };
}

/** Testcross with bv/bv: each offspring class shows the heterozygous parent's gamete. */
export const PHENOTYPE: Record<Gamete, { vi: string; en: string }> = {
  BV: { vi: 'thân xám, cánh dài', en: 'grey body, long wings' },
  bv: { vi: 'thân đen, cánh cụt', en: 'black body, vestigial wings' },
  Bv: { vi: 'thân xám, cánh cụt', en: 'grey body, vestigial wings' },
  bV: { vi: 'thân đen, cánh dài', en: 'black body, long wings' },
};

/**
 * Question 2 (tr. 59): the recombination frequency from the counts of a testcross, recombinants
 * being the two smaller classes. Null when nothing was counted.
 */
export function frequencyFromCounts(counts: readonly number[]): number | null {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total <= 0 || counts.length !== 4) return null;
  const sorted = [...counts].sort((a, b) => a - b);
  return ((sorted[0] ?? 0) + (sorted[1] ?? 0)) / total;
}

/** The book's numbers: 34 % of cells (Hình 11.3) and the counts of question 2 (tr. 59). */
export const BOOK_CELLS_WITH_CROSSOVER = HEREDITY.cells_with_crossover;
export const BOOK_COUNTS: readonly number[] = HEREDITY_ITEMS.map((c) => c.count);
export const COUNT_LABELS = HEREDITY_ITEMS.map((c) => c.label);
