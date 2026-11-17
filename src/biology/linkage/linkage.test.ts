import { describe, expect, it } from 'vitest';
import {
  BOOK_CELLS_WITH_CROSSOVER,
  BOOK_COUNTS,
  frequencyFromCells,
  frequencyFromCounts,
  gameteShares,
} from './model';

describe('linkage and crossing over (SH12 Bài 11)', () => {
  it('complete linkage: the F1 male gives two classes, 50 % each (Hình 11.1)', () => {
    expect(gameteShares(0)).toEqual({ BV: 0.5, bv: 0.5, Bv: 0, bV: 0 });
  });

  it('34 % of cells crossing over: 41,5 % : 41,5 % : 8,5 % : 8,5 % (Hình 11.2, 11.3)', () => {
    const f = frequencyFromCells(BOOK_CELLS_WITH_CROSSOVER);
    expect(f).toBeCloseTo(0.17, 12);
    const g = gameteShares(f);
    expect(g.BV).toBeCloseTo(0.415, 12);
    expect(g.bv).toBeCloseTo(0.415, 12);
    expect(g.Bv).toBeCloseTo(0.085, 12);
    expect(g.bV).toBeCloseTo(0.085, 12);
  });

  it('never above 50 %: every cell crossing over gives 50 %', () => {
    expect(frequencyFromCells(1)).toBe(0.5);
  });

  it('question 2 (tr. 59): 94 recombinants out of 1 566 flies', () => {
    expect(frequencyFromCounts(BOOK_COUNTS)).toBeCloseTo(94 / 1566, 12);
    expect(frequencyFromCounts([0, 0, 0, 0])).toBeNull();
  });
});
