import { describe, expect, it } from 'vitest';
import { MOLECULES } from './data/molecules';
import { formatEquationText, formatFormula, molarMass, parseFormula } from './formula';

const counts = (f: string) => Object.fromEntries(parseFormula(f).counts);

describe('formula parser', () => {
  it('parses counts, brackets and hydrates', () => {
    expect(counts('H2SO4')).toEqual({ H: 2, S: 1, O: 4 });
    expect(counts('Ca(OH)2')).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(counts('Al2(SO4)3')).toEqual({ Al: 2, S: 3, O: 12 });
    expect(counts('K4[Fe(CN)6]')).toEqual({ K: 4, Fe: 1, C: 6, N: 6 });
    expect(counts('CuSO4·5H2O')).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(counts('(CH3)2C=CH2')).toEqual({ C: 4, H: 8 });
    expect(counts('C₂H₅OH')).toEqual({ C: 2, H: 6, O: 1 });
    expect(counts('Co')).toEqual({ Co: 1 });
    expect(counts('CO')).toEqual({ C: 1, O: 1 });
  });

  it('parses charges in the usual notations', () => {
    expect(parseFormula('Fe^3+').charge).toBe(3);
    expect(parseFormula('Fe{3+}').charge).toBe(3);
    expect(counts('Fe^3+')).toEqual({ Fe: 1 });
    expect(parseFormula('SO4^2-').charge).toBe(-2);
    expect(counts('SO4^2-')).toEqual({ S: 1, O: 4 });
    expect(counts('NH4+')).toEqual({ N: 1, H: 4 });
    expect(parseFormula('O--').charge).toBe(-2);
    expect(parseFormula('SO4{2-}').charge).toBe(-2);
    expect(parseFormula('CO3-2').charge).toBe(-2);
    expect(parseFormula('NH4+').charge).toBe(1);
    expect(parseFormula('OH-').charge).toBe(-1);
    expect(parseFormula('Cr2O7^2-').charge).toBe(-2);
    expect(counts('Cr2O7^2-')).toEqual({ Cr: 2, O: 7 });
    expect(parseFormula('e-')).toEqual({ counts: new Map(), charge: -1 });
    expect(parseFormula('Cu²⁺').charge).toBe(2);
  });

  it('rejects unknown elements and bad brackets', () => {
    expect(() => parseFormula('Xx2')).toThrow();
    expect(() => parseFormula('Ca(OH2')).toThrow();
    expect(() => parseFormula('')).toThrow();
  });

  it('formats formulas and computes molar masses', () => {
    expect(formatFormula('H2SO4')).toBe('H₂SO₄');
    expect(formatFormula('SO4^2-')).toBe('SO₄²⁻');
    expect(formatFormula('Fe^3+')).toBe('Fe³⁺');
    expect(formatFormula('NH4+')).toBe('NH₄⁺');
    expect(molarMass('H2O')).toBeCloseTo(18.015, 3);
    expect(molarMass('NaCl')).toBeCloseTo(58.44, 2);
  });

  it('every molecule’s textbook formula has the same atoms and charge as its Hill formula', () => {
    for (const m of MOLECULES) {
      const a = parseFormula(m.display_formula);
      const b = parseFormula(m.formula);
      expect(Object.fromEntries(a.counts), m.id).toEqual(Object.fromEntries(b.counts));
      expect(a.charge, m.id).toBe(b.charge);
      expect(a.charge, m.id).toBe(m.atoms.reduce((s, x) => s + x.charge, 0));
    }
  });

  it('a cited molecular formula (#192) has the Hill formula’s atoms and a source', () => {
    const cited = MOLECULES.filter((m) => m.molecular_formula !== undefined);
    expect(cited.map((m) => m.id)).toEqual(['hcn']);
    for (const m of cited) {
      const a = parseFormula(m.molecular_formula ?? '');
      const b = parseFormula(m.formula);
      expect(Object.fromEntries(a.counts), m.id).toEqual(Object.fromEntries(b.counts));
      expect(a.charge, m.id).toBe(b.charge);
      expect(m.molecular_formula_source, m.id).toMatch(/PubChem CID \d+/);
      expect(m.review_status, m.id).toBe('pending');
    }
  });
});

describe('hydrate separator', () => {
  it('rejects a formula that starts or ends with "." (not a hydrate)', () => {
    expect(() => parseFormula('.5O2')).toThrow();
    expect(() => parseFormula('CuSO4.')).toThrow();
    expect(parseFormula('CuSO4·5H2O').counts.get('H')).toBe(10);
  });
});

describe('formatEquationText (UI-36: sample chips without raw ^ and ->)', () => {
  it('writes charges as superscripts and the arrow as →', () => {
    expect(formatEquationText('MnO4^- + Fe^2+ + H^+ -> Mn^2+ + Fe^3+ + H2O')).toBe(
      'MnO₄⁻ + Fe²⁺ + H⁺ → Mn²⁺ + Fe³⁺ + H₂O',
    );
    expect(formatEquationText('Fe + O2 -> Fe2O3')).toBe('Fe + O₂ → Fe₂O₃');
    expect(formatEquationText('2H2 + O2 = 2H2O')).toBe('2H₂ + O₂ → 2H₂O');
    expect(formatEquationText('Cu + HNO3 -> Cu(NO3)2 + NO + H2O')).toBe(
      'Cu + HNO₃ → Cu(NO₃)₂ + NO + H₂O',
    );
  });

  it('keeps a reversible arrow reversible (#192)', () => {
    expect(formatEquationText('N2 + 3H2 <=> 2NH3')).toBe('N₂ + 3H₂ ⇌ 2NH₃');
    expect(formatEquationText('N2O4 ⇌ 2NO2')).toBe('N₂O₄ ⇌ 2NO₂');
    expect(formatEquationText('H2 + I2 <-> 2HI')).toBe('H₂ + I₂ ⇌ 2HI');
    expect(formatEquationText('CaCO3 = CaO + CO2')).toBe('CaCO₃ → CaO + CO₂');
    expect(formatEquationText('CH4 + 2O2 -> CO2 + 2H2O')).toBe('CH₄ + 2O₂ → CO₂ + 2H₂O');
    expect(formatEquationText('Zn + 2HCl => ZnCl2 + H2')).toBe('Zn + 2HCl → ZnCl₂ + H₂');
    expect(formatEquationText('2Na + Cl2 ⟶ 2NaCl')).toBe('2Na + Cl₂ → 2NaCl');
  });
});
