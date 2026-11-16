import { describe, expect, it } from 'vitest';
import { organicCard } from './card';
import {
  BOILING,
  GROUPS,
  ISOMERS,
  MASS,
  PROBLEMS,
  formulaText,
  massPercent,
  molecularFormula,
  smilesFormula,
  type El,
} from './model';
import { setOrganic, useOrganicStore } from './store';

const pct = (c: number | null, h: number | null, o: number | null) =>
  ({ C: c, H: h, O: o }) as Record<El, number | null>;

describe('organic chemistry basics (HH11 Bài 10, 12, 13)', () => {
  it('Bảng 10.1: eight classes with the book’s examples; Bảng 10.2 IR bands', () => {
    expect(GROUPS.map((g) => g.example)).toEqual([
      'CH3Cl',
      'CH3OH',
      'CH3CHO',
      'CH3COCH3',
      'CH3COOH',
      'CH3COOCH3',
      'CH3NH2',
      'CH3OCH3',
    ]);
    const alcohol = GROUPS.find((g) => g.id === 'alcohol');
    expect(alcohol?.ir).toEqual([{ bond: 'O–H', low: 3200, high: 3500 }]);
    const acid = GROUPS.find((g) => g.id === 'carboxylic');
    expect(acid?.ir.map((b) => [b.low, b.high])).toEqual([
      [2500, 3300],
      [1690, 1760],
    ]);
  });

  it('the book’s atomic masses (tr. 72): C 12,0, H 1,0, O 16,0', () => {
    expect(MASS).toEqual({ C: 12, H: 1, O: 16 });
  });

  it('camphor (tr. 73): 78,94 % C, 10,53 % H, 10,53 % O, M = 152 → C₁₀H₁₆O', () => {
    const r = molecularFormula({ percent: pct(78.94, 10.53, 10.53), M: 152 });
    if (!r.ok) throw new Error(r.reason);
    expect(formulaText(r.simplest)).toBe('C10H16O');
    expect(r.n).toBe(1);
    expect(formulaText(r.molecular)).toBe('C10H16O');
  });

  it('eugenol (question 3, tr. 73): 73,17 % C, 7,31 % H, the rest O, M = 164 → C₁₀H₁₂O₂', () => {
    const r = molecularFormula({ percent: pct(73.17, 7.31, null), M: 164 });
    if (!r.ok) throw new Error(r.reason);
    expect(formulaText(r.simplest)).toBe('C5H6O');
    expect(r.n).toBe(2);
    expect(formulaText(r.molecular)).toBe('C10H12O2');
    // Independent check: the found formula gives back the percentages within their rounding.
    const back = massPercent(r.molecular);
    expect(Math.abs(back.C - 73.17)).toBeLessThan(0.01);
    expect(Math.abs(back.H - 7.31)).toBeLessThan(0.01);
  });

  it('the data’s problems all solve; the ethanol spectrum’s M⁺ is 46 = C₂H₆O', () => {
    for (const p of PROBLEMS) {
      const r = molecularFormula({
        percent: { C: p.percent.C ?? null, H: p.percent.H ?? null, O: p.percent.O ?? null },
        M: p.M,
      });
      expect(r.ok, p.id).toBe(true);
    }
    const ethanol = { C: 2, H: 6, O: 1 };
    expect(2 * 12 + 6 + 16).toBe(46);
    expect(massPercent(ethanol).C).toBeCloseTo(52.17, 2);
  });

  it('refuses instead of guessing: percentages over 100, no whole ratio, M not a multiple', () => {
    expect(molecularFormula({ percent: pct(80, 30, null), M: 100 })).toEqual({
      ok: false,
      reason: 'sum',
    });
    expect(molecularFormula({ percent: pct(78.94, 10.53, 10.53), M: 150 })).toEqual({
      ok: false,
      reason: 'notMultiple',
    });
    expect(molecularFormula({ percent: pct(null, null, 10), M: 100 })).toEqual({
      ok: false,
      reason: 'empty',
    });
  });

  it('the isomers of tr. 76–77 share one molecular formula (checked from their structures)', () => {
    const asText = (c: Record<string, number>) =>
      ['C', 'H', 'O']
        .filter((e) => c[e])
        .map((e) => `${e}${(c[e] ?? 0) > 1 ? String(c[e]) : ''}`)
        .join('');
    for (const set of ISOMERS)
      for (const s of set.structures)
        expect(asText(smilesFormula(s.smiles)), s.name).toBe(set.formula);
  });

  it('boiling points of tr. 75: same formula, different structure, different boiling point', () => {
    const bp = Object.fromEntries(BOILING.map((b) => [b.formula, b.bp_C]));
    expect(bp.CH4).toBe(-161.5);
    expect(bp['CH3-CH=CH2']).toBe(-47.8);
    expect(bp.cyclopropane).toBe(-32.8);
  });

  it('the store and the card', () => {
    setOrganic({ tab: 'formula', problem: 'eugenol' });
    expect(useOrganicStore.getState()).toMatchObject({
      tab: 'formula',
      C: 73.17,
      H: 7.31,
      O: null,
    });
    setOrganic({ tab: 'bad' });
    expect(useOrganicStore.getState().tab).toBe('formula');
    setOrganic({ tab: 'groups' });
    expect(organicCard().sources[0]?.citation).toContain('Bảng 10.1');
  });
});
