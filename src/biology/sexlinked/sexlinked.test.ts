import { describe, expect, it } from 'vitest';
import { BOOK_CROSSES, cross, sonShare } from './model';

const show = (m: Parameters<typeof cross>[0], f: Parameters<typeof cross>[1]) =>
  cross(m, f).map((c) => `${c.sex}:${c.alleles}:${c.fraction}:${c.dominant ? 'đỏ' : 'trắng'}`);

describe('X-linked eye colour (SH12 Bài 10, Hình 10.2)', () => {
  it('forward cross: F1 all red, F2 white only in males', () => {
    expect(show('AA', 'a')).toEqual(['female:Aa:0.5:đỏ', 'male:A:0.5:đỏ']);
    expect(show('Aa', 'A')).toEqual([
      'female:AA:0.25:đỏ',
      'female:Aa:0.25:đỏ',
      'male:A:0.25:đỏ',
      'male:a:0.25:trắng',
    ]);
  });

  it('reciprocal cross: F1 red females, white males; F2 a quarter of each', () => {
    expect(show('aa', 'A')).toEqual(['female:Aa:0.5:đỏ', 'male:a:0.5:trắng']);
    expect(show('Aa', 'a')).toEqual([
      'female:Aa:0.25:đỏ',
      'female:aa:0.25:trắng',
      'male:A:0.25:đỏ',
      'male:a:0.25:trắng',
    ]);
  });

  it('sons and daughters are always 1 : 1 (Bảng 10.1)', () => {
    for (const c of BOOK_CROSSES) expect(sonShare(cross(c.mother, c.father))).toBe(0.5);
  });
});
