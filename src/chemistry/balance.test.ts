import { describe, expect, it } from 'vitest';
import { balance, checkCoefficients, nullSpace, parseEquation } from './balance';

const coeffs = (s: string) => {
  const r = balance(parseEquation(s));
  if (r.kind !== 'balanced') throw new Error(`${s}: ${r.kind}`);
  return r.coefficients;
};

describe('equation balancer (null space, exact arithmetic)', () => {
  it('balances textbook equations', () => {
    expect(coeffs('CH4 + O2 -> CO2 + H2O')).toEqual([1, 2, 1, 2]);
    expect(coeffs('Fe + O2 -> Fe2O3')).toEqual([4, 3, 2]);
    expect(coeffs('Al + HCl -> AlCl3 + H2')).toEqual([2, 6, 2, 3]);
    expect(coeffs('C2H5OH + O2 → CO2 + H2O')).toEqual([1, 3, 2, 3]);
    expect(coeffs('KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O')).toEqual([2, 16, 2, 2, 5, 8]);
    expect(coeffs('Cu + HNO3 -> Cu(NO3)2 + NO + H2O')).toEqual([3, 8, 3, 2, 4]);
    expect(coeffs('N2 + H2 ⇌ NH3')).toEqual([1, 3, 2]);
    expect(coeffs('Ca(OH)2 + H3PO4 = Ca3(PO4)2 + H2O')).toEqual([3, 2, 1, 6]);
  });

  it('balances ionic equations including charge', () => {
    expect(coeffs('MnO4^- + Fe^2+ + H^+ -> Mn^2+ + Fe^3+ + H2O')).toEqual([1, 5, 8, 1, 5, 4]);
    expect(coeffs('Cr2O7^2- + I^- + H^+ -> Cr^3+ + I2 + H2O')).toEqual([1, 6, 14, 2, 3, 7]);
    expect(coeffs('Cu^2+ + e- -> Cu')).toEqual([1, 2, 1]);
  });

  it('reports impossible and ambiguous equations honestly', () => {
    expect(balance(parseEquation('H2O -> H2O2'))).toMatchObject({ kind: 'impossible' });
    expect(balance(parseEquation('NaCl -> KCl'))).toMatchObject({ kind: 'impossible' });
    // Two independent reactions mixed together: no unique balance.
    expect(balance(parseEquation('H2 + O2 -> H2O + H2O2'))).toMatchObject({
      kind: 'ambiguous',
      dimension: 2,
    });
  });

  it('keeps coefficients the user typed for checking', () => {
    const eq = parseEquation('2H2 + O2 -> 2H2O');
    expect(eq.reactants.map((s) => s.given)).toEqual([2, null]);
    expect(checkCoefficients(eq, [2, 1, 2]).ok).toBe(true);
    expect(checkCoefficients(eq, [1, 1, 1])).toEqual({ ok: false, unbalanced: ['O'] });
    expect(checkCoefficients(eq, [1, 1, 2])).toEqual({ ok: false, unbalanced: ['H'] });
  });

  it('rejects malformed input', () => {
    expect(() => parseEquation('H2 + O2')).toThrow();
    expect(() => parseEquation('Xy -> H2')).toThrow();
  });

  it('null space of a simple matrix', () => {
    const ns = nullSpace([[1, -1]], 2);
    expect(ns).toHaveLength(1);
  });
});
