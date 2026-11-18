import { describe, expect, it } from 'vitest';
import { molarMass } from '../formula';
import {
  ACYL_SMILES,
  BOILING,
  FATTY_ACIDS,
  FAT_COMPOSITION,
  ester,
  esterIsomers,
  esterificationYield,
  hydrogenNeeded,
  hydrolysis,
  saponify,
  triglyceride,
  triglycerideSmiles,
} from './model';

describe('esters and fats (HH12 Bài 1–2)', () => {
  it('names as the book does (tr. 7): tên gốc R′ + tên gốc carboxylic acid', () => {
    const ea = ester('acetic', 'ethyl');
    expect(ea).toMatchObject({
      condensed: 'CH3COOC2H5',
      formula: 'C4H8O2',
      iupac: 'ethyl ethanoate',
      common: 'ethyl acetate',
    });
    expect(ea.M).toBeCloseTo(molarMass('C4H8O2'), 9);
    expect(ea.smiles).toBe('CC(=O)OCC');
    expect(ester('formic', 'methyl').smiles).toBe('C(=O)OC');
    expect(ester('formic', 'propyl')).toMatchObject({
      condensed: 'HCOOCH2CH2CH3',
      iupac: 'propyl methanoate',
      common: 'propyl formate',
    });
    expect(ester('acrylic', 'methyl')).toMatchObject({
      condensed: 'CH2=CHCOOCH3',
      formula: 'C4H6O2',
      iupac: 'methyl propenoate',
      common: 'methyl acrylate',
    });
    expect(ester('benzoic', 'ethyl')).toMatchObject({
      formula: 'C9H10O2',
      iupac: 'ethyl benzoate',
    });
  });

  it('question 1, tr. 7: C4H8O2 has four esters; CnH2nO2 has 1, 2, 4, 9 for n = 2…5', () => {
    expect(esterIsomers(4).map((e) => e.common)).toEqual(
      expect.arrayContaining([
        'propyl formate',
        'isopropyl formate',
        'ethyl acetate',
        'methyl propionate',
      ]),
    );
    expect([2, 3, 4, 5].map((n) => esterIsomers(n).length)).toEqual([1, 2, 4, 9]);
    for (const n of [2, 3, 4, 5])
      for (const e of esterIsomers(n)) expect(e.formula, e.condensed).toBe(`C${n}H${2 * n}O2`);
    expect(esterIsomers(6)).toEqual([]);
  });

  it('question 2, tr. 7: the formulas of four named esters', () => {
    expect(ester('formic', 'methyl').condensed).toBe('HCOOCH3');
    expect(ester('acetic', 'isopropyl').condensed).toBe('CH3COOCH(CH3)2');
    expect(ester('propanoic', 'ethyl').condensed).toBe('C2H5COOC2H5');
    expect(ester('butanoic', 'methyl').condensed).toBe('CH3CH2CH2COOCH3');
    expect(ester('isobutyric', 'methyl').condensed).toBe('(CH3)2CHCOOCH3');
  });

  it('hydrolysis: reversible in acid, one way with NaOH (tr. 8)', () => {
    const e = ester('acetic', 'methyl');
    expect(hydrolysis(e, 'acid')).toEqual({
      left: ['CH3COOCH3', 'H2O'],
      right: ['CH3COOH', 'CH3OH'],
      reversible: true,
    });
    expect(hydrolysis(e, 'base')).toMatchObject({
      right: ['CH3COONa', 'CH3OH'],
      reversible: false,
    });
  });

  it('question 7, tr. 9: 16,2 g acid, 15,2 g isoamyl alcohol, 14,16 g ester → about 63 %', () => {
    const r = esterificationYield(ester('acetic', 'isoamyl'), 16.2, 15.2, 14.16);
    expect(r.limiting).toBe('alcohol');
    expect(r.yield).toBeGreaterThan(0.63);
    expect(r.yield).toBeLessThan(0.632);
  });

  it('fats: tristearin, tripalmitin, the H₂ of trilinolein (question 9) and mass balance', () => {
    const stearin = triglyceride(['stearic', 'stearic', 'stearic']);
    expect(stearin.formula).toBe('C57H110O6');
    expect(triglyceride(['palmitic', 'palmitic', 'palmitic']).formula).toBe('C51H98O6');
    const linolein: [string, string, string] = ['linoleic', 'linoleic', 'linoleic'];
    expect(triglyceride(linolein).doubleBonds).toBe(6);
    expect(hydrogenNeeded(linolein, triglyceride(linolein).M)).toBeCloseTo(6, 12);
    const s = saponify(['stearic', 'stearic', 'stearic'], stearin.M);
    expect(s.mol).toBeCloseTo(1, 12);
    // fat + NaOH = glycerol + soap
    expect(stearin.M + s.naoh).toBeCloseTo(s.glycerol + s.soap, 6);
  });

  it('the book’s tables add up: Hình 1.2 rows are 100 %; esters boil lowest at M = 60 (tr. 7)', () => {
    for (const f of FAT_COMPOSITION)
      expect(f.saturated + f.one_double + f.several_double).toBe(100);
    const ester60 = BOILING.find((b) => b.kind === 'ester');
    expect(ester60?.bp_C).toBe(Math.min(...BOILING.map((b) => b.bp_C)));
  });
});

describe('triglyceride structures', () => {
  it('each acyl SMILES has the fatty acid’s carbons and C=C (cis for oleic, linoleic)', () => {
    for (const a of FATTY_ACIDS) {
      const smi = ACYL_SMILES[a.id] ?? '';
      expect((smi.match(/C/g) ?? []).length, a.id).toBe(a.carbons);
      expect((smi.match(/=/g) ?? []).length - 1, a.id).toBe(a.double_bonds);
      expect(smi.includes('\\'), a.id).toBe(a.double_bonds > 0);
    }
    expect(triglycerideSmiles(['stearic', 'stearic', 'stearic']).match(/C/g)?.length).toBe(57);
  });
});
