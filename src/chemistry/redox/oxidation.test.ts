import { describe, expect, it } from 'vitest';
import { POLYATOMIC_IONS } from '../data/polyatomicIons';
import { canonicalFormulaText, parseFormula } from '../formula';
import { oxidationNumbers, signed, type OxResult } from './oxidation';

const values = (r: OxResult) => (r.ok ? Object.fromEntries(r.values) : r);

describe('oxidation numbers by the textbook rules (HH10 Bài 15)', () => {
  it('rule 1 and 4: free elements are 0, single-element ions carry their charge', () => {
    for (const f of ['Na', 'H2', 'O2', 'Cl2', 'C']) {
      const r = oxidationNumbers(f);
      expect(r.ok && [...r.values.values()].every((v) => Object.is(v, 0)), f).toBe(true);
    }
    expect(values(oxidationNumbers('Cu^2+'))).toEqual({ Cu: 2 });
    expect(values(oxidationNumbers('Cl^-'))).toEqual({ Cl: -1 });
    expect(values(oxidationNumbers('O2^2-'))).toEqual({ O: -1 });
  });

  it('the textbook examples: NaCl, H2O, Al2O3, NH4+, CaCO3', () => {
    expect(values(oxidationNumbers('NaCl'))).toEqual({ Na: 1, Cl: -1 });
    expect(values(oxidationNumbers('H2O'))).toEqual({ H: 1, O: -2 });
    expect(values(oxidationNumbers('Al2O3'))).toEqual({ Al: 3, O: -2 });
    expect(values(oxidationNumbers('NH4+'))).toEqual({ N: -3, H: 1 });
    expect(values(oxidationNumbers('CaCO3'))).toEqual({ Ca: 2, C: 4, O: -2 });
  });

  it('solves the one unknown element from the sum', () => {
    expect(values(oxidationNumbers('KMnO4'))).toEqual({ K: 1, Mn: 7, O: -2 });
    expect(values(oxidationNumbers('MnO4^-'))).toEqual({ Mn: 7, O: -2 });
    expect(values(oxidationNumbers('H2SO4'))).toEqual({ H: 1, S: 6, O: -2 });
    expect(values(oxidationNumbers('SO4^2-'))).toEqual({ S: 6, O: -2 });
    expect(values(oxidationNumbers('HNO3'))).toEqual({ H: 1, N: 5, O: -2 });
    expect(values(oxidationNumbers('NH3'))).toEqual({ N: -3, H: 1 });
    expect(values(oxidationNumbers('Fe2O3'))).toEqual({ Fe: 3, O: -2 });
    expect(values(oxidationNumbers('CO'))).toEqual({ C: 2, O: -2 });
    expect(values(oxidationNumbers('CH4'))).toEqual({ C: -4, H: 1 });
    expect(values(oxidationNumbers('H3O^+'))).toEqual({ H: 1, O: -2 });
    expect(values(oxidationNumbers('OH^-'))).toEqual({ O: -2, H: 1 });
  });

  it('the exceptions: F −1, peroxides, OF2, metal hydrides, metal halides', () => {
    const h2o2 = oxidationNumbers('H2O2');
    expect(values(h2o2)).toEqual({ H: 1, O: -1 });
    expect(h2o2.ok && h2o2.notes).toEqual(['peroxide']);
    expect(values(oxidationNumbers('Na2O2'))).toEqual({ Na: 1, O: -1 });
    expect(values(oxidationNumbers('BaO2'))).toEqual({ Ba: 2, O: -1 });
    const of2 = oxidationNumbers('OF2');
    expect(values(of2)).toEqual({ O: 2, F: -1 });
    expect(of2.ok && of2.notes).toEqual(['oxygenFluoride']);
    const nah = oxidationNumbers('NaH');
    expect(values(nah)).toEqual({ Na: 1, H: -1 });
    expect(nah.ok && nah.notes).toEqual(['hydride']);
    expect(values(oxidationNumbers('CaH2'))).toEqual({ Ca: 2, H: -1 });
    expect(values(oxidationNumbers('LiAlH4'))).toEqual({ Li: 1, Al: 3, H: -1 });
    const zncl2 = oxidationNumbers('ZnCl2');
    expect(values(zncl2)).toEqual({ Zn: 2, Cl: -1 });
    expect(zncl2.ok && zncl2.notes).toEqual(['halide']);
    expect(values(oxidationNumbers('MnCl2'))).toEqual({ Mn: 2, Cl: -1 });
    expect(values(oxidationNumbers('FeBr3'))).toEqual({ Fe: 3, Br: -1 });
    expect(values(oxidationNumbers('HF'))).toEqual({ H: 1, F: -1 });
  });

  it('rule 4 with the polyatomic ion table reads salts with two unknowns', () => {
    expect(values(oxidationNumbers('CuSO4'))).toEqual({ Cu: 2, S: 6, O: -2 });
    expect(values(oxidationNumbers('FeSO4'))).toEqual({ Fe: 2, S: 6, O: -2 });
    expect(values(oxidationNumbers('Fe2(SO4)3'))).toEqual({ Fe: 3, S: 6, O: -2 });
    expect(values(oxidationNumbers('Cu(NO3)2'))).toEqual({ Cu: 2, N: 5, O: -2 });
    expect(values(oxidationNumbers('AgNO3'))).toEqual({ Ag: 1, N: 5, O: -2 });
    expect(values(oxidationNumbers('NH4Cl'))).toEqual({ N: -3, H: 1, Cl: -1 });
    expect(values(oxidationNumbers('(NH4)2SO4'))).toEqual({ N: -3, H: 1, S: 6, O: -2 });
    expect(values(oxidationNumbers('CuSO4·5H2O'))).toEqual({ S: 6, O: -2, Cu: 2, H: 1 });
    expect(values(oxidationNumbers('Ag3PO4'))).toEqual({ P: 5, O: -2, Ag: 1 });
    expect(values(oxidationNumbers('CuCO3'))).toEqual({ C: 4, O: -2, Cu: 2 });
    const r = oxidationNumbers('Cu(NO3)2');
    expect(r.ok && r.ions).toEqual(['NO3^-']);
    // Without an ion of the table the rules still refuse, never guess.
    for (const f of ['CH3Cl', 'CuS', 'FeS2']) {
      const x = oxidationNumbers(f);
      expect(!x.ok && x.reason, f).toBe('twoUnknown');
    }
    // A formula the rules alone decide is not read through the table.
    const h2so4 = oxidationNumbers('H2SO4');
    expect(h2so4.ok && h2so4.ions).toBeUndefined();
  });

  it('every ion of the table solves by the rules; NH4+ as the book (tr. 72)', () => {
    expect(POLYATOMIC_IONS.map((i) => i.formula)).toEqual([
      'NH4^+',
      'CO3^2-',
      'NO3^-',
      'SO4^2-',
      'PO4^3-',
    ]);
    for (const ion of POLYATOMIC_IONS) {
      expect(oxidationNumbers(ion.formula).ok, ion.id).toBe(true);
      expect(parseFormula(ion.formula).charge, ion.id).toBe(ion.charge);
      expect(canonicalFormulaText(ion.formula).startsWith(ion.body), ion.id).toBe(true);
    }
    expect(values(oxidationNumbers('NH4^+'))).toEqual({ N: -3, H: 1 });
  });

  it('refuses organic molecules: the rules give only the mean of different C atoms', () => {
    for (const f of ['C2H5OH', 'C3H8', 'CH3COOH', 'C6H12O6', 'C2H4Br2', 'CH3COO^-']) {
      const r = oxidationNumbers(f);
      expect(!r.ok && r.reason, f).toBe('organic');
    }
    // One carbon atom: no difference between atoms, the rules decide.
    expect(values(oxidationNumbers('CH3OH'))).toEqual({ C: -2, H: 1, O: -2 });
  });

  it('refuses averages that hide different atoms, fractions and impossible values', () => {
    // NH4NO3: N is −3 in NH4+ and +5 in NO3−; the formula alone gives only +1.
    const nh4no3 = oxidationNumbers('NH4NO3');
    expect(!nh4no3.ok && nh4no3.reason).toBe('mixed');
    // Fe3O4 (+8/3 on average) and KO2 (superoxide, −1/2).
    expect(!oxidationNumbers('Fe3O4').ok && values(oxidationNumbers('Fe3O4'))).toMatchObject({
      reason: 'fractional',
      elements: ['Fe'],
    });
    expect(values(oxidationNumbers('KO2'))).toMatchObject({ reason: 'fractional' });
    // H2SO5 hides a peroxide group: S would be +8, above group 16's +6.
    expect(values(oxidationNumbers('H2SO5'))).toMatchObject({
      reason: 'outOfRange',
      elements: ['S'],
    });
    expect(values(oxidationNumbers('MgH'))).toMatchObject({ reason: 'inconsistent' });
  });

  it('writes signed numbers with a typographic minus', () => {
    expect([signed(3), signed(-2), signed(0)]).toEqual(['+3', '−2', '0']);
  });
});
