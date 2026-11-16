import { describe, expect, it } from 'vitest';
import { groupA, hydroxideFormula, oxideFormula, period3Compounds, romanGroup } from './compounds';

describe('period 3 oxides and hydroxides (HH10 Bài 7)', () => {
  it('formulas from the highest oxidation number', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => oxideFormula('E', n))).toEqual([
      'E2O',
      'EO',
      'E2O3',
      'EO2',
      'E2O5',
      'EO3',
      'E2O7',
    ]);
    expect([1, 2, 3].map((n) => hydroxideFormula('M', n))).toEqual(['MOH', 'M(OH)2', 'M(OH)3']);
    expect([1, 2, 13, 14, 17].map(groupA)).toEqual([1, 2, 3, 4, 7]);
    expect(() => groupA(8)).toThrow();
    expect(romanGroup(6)).toBe('VIA');
  });

  it('the computed formulas equal the book’s Bảng 7.1 wherever the rule decides them', () => {
    const rows = period3Compounds();
    expect(rows.map((r) => r.symbol)).toEqual(['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl']);
    expect(rows.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const r of rows) {
      expect(r.oxide, r.symbol).toBe(r.textbook.oxide);
      expect(r.hydroxide, r.symbol).toBe(r.textbook.hydroxide);
    }
    expect(rows.filter((r) => r.hydroxideFrom === 'rule').map((r) => r.symbol)).toEqual([
      'Na',
      'Mg',
      'Al',
    ]);
  });

  it('every acid from the book is checked by the oxidation-number rules', () => {
    for (const r of period3Compounds()) expect(r.checked, r.symbol).toBe(true);
  });

  it('keeps the book’s character, from basic to very strongly acidic', () => {
    const rows = period3Compounds();
    expect(rows.map((r) => r.oxideCharacter)).toEqual([
      'basic',
      'basic',
      'amphoteric',
      'acidic',
      'acidic',
      'acidic',
      'acidic',
    ]);
    expect(rows.map((r) => r.hydroxideCharacter)).toEqual([
      'strongBase',
      'weakBase',
      'amphoteric',
      'weakAcid',
      'mediumAcid',
      'strongAcid',
      'veryStrongAcid',
    ]);
  });
});
