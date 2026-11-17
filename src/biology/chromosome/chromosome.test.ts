import { describe, expect, it } from 'vitest';
import {
  BOOK_ALLOPOLYPLOID,
  DOWN_BY_AGE,
  HUMAN_2N,
  allopolyploid,
  chromosomeCount,
  structureChange,
} from './model';

describe('chromosome mutations (SH12 Bài 12)', () => {
  it('structural mutations as the letters of Hình 12.1', () => {
    expect(structureChange('deletion')).toEqual({ before: ['abcdefg'], after: ['abcg'] });
    expect(structureChange('duplication').after).toEqual(['abcdefdefg']);
    expect(structureChange('inversion').after).toEqual(['abcfedg']);
    expect(structureChange('translocation')).toEqual({
      before: ['abcdefg', '123456'],
      after: ['123defg', 'abc456'],
    });
  });

  it('counts in humans (2n = 46, tr. 65): Down 47, Turner 45', () => {
    expect(HUMAN_2N).toBe(46);
    expect(chromosomeCount(46, 'trisomy')).toBe(47);
    expect(chromosomeCount(46, 'monosomy')).toBe(45);
    expect(chromosomeCount(46, 'nullisomy')).toBe(44);
    expect(chromosomeCount(46, 'triploid')).toBe(69);
    expect(chromosomeCount(46, 'tetraploid')).toBe(92);
  });

  it('Hình 12.3c: 2nA = 4 and 2nB = 6 give a hybrid of 5 and an allopolyploid of 10', () => {
    expect(allopolyploid(BOOK_ALLOPOLYPLOID.a_2n, BOOK_ALLOPOLYPLOID.b_2n)).toEqual({
      hybrid: 5,
      doubled: 10,
    });
  });

  it('the rate of Down syndrome rises with the mother’s age (tr. 67)', () => {
    expect(DOWN_BY_AGE.map((d) => d.births_per_case)).toEqual([
      2300, 1600, 1200, 880, 290, 100, 46,
    ]);
  });
});
