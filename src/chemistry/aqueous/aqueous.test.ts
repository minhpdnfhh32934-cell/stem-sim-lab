import { describe, expect, it } from 'vitest';
import { aqueousCard } from './card';
import {
  EVERYDAY,
  KW,
  PH_PAPER,
  PH_RANGES,
  bisectedH,
  hOf,
  litmusOf,
  mediumOf,
  ohOf,
  phOf,
  phenolphthaleinOf,
  strongSolutionH,
} from './model';
import { setAqueous, setFromH, setFromOH, useAqueousStore } from './store';

describe('equilibria in aqueous solution (HH11 Bài 2)', () => {
  it('the textbook’s numbers: Kw = 10⁻¹⁴ (tr. 20), Hình 2.1 pH 2…14, Hình 2.4 ranges', () => {
    expect(KW).toBe(1e-14);
    expect(EVERYDAY.map((e) => e.pH)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(EVERYDAY[0]?.name.vi).toBe('Nước chanh ép');
    const blood = PH_RANGES.find((r) => r.id === 'blood');
    expect([blood?.low, blood?.high]).toEqual([7.3, 7.4]);
    expect(PH_PAPER).toHaveLength(14);
    for (const r of PH_RANGES) expect(r.review_status).toBe('pending');
  });

  it('pH = −lg[H⁺] and [H⁺][OH⁻] = Kw (tr. 20–21): [H⁺] = 10⁻² → pH 2; pure water pH 7', () => {
    expect(phOf(1e-2)).toBeCloseTo(2, 12);
    expect(hOf(7)).toBeCloseTo(1e-7, 20);
    expect(ohOf(1e-7)).toBeCloseTo(1e-7, 20);
    // Question 3 (tr. 21): a shampoo with [OH⁻] = 10^−5,17 has pH 8,83, a base.
    const h = KW / 10 ** -5.17;
    expect(phOf(h)).toBeCloseTo(8.83, 10);
    expect(mediumOf(phOf(h))).toBe('base');
    // Question 6 (tr. 22): lemon juice of pH 2,4 has [H⁺] = 10^−2,4, not 0,24 mol/L.
    expect(hOf(2.4)).toBeCloseTo(10 ** -2.4, 15);
    expect(mediumOf(7)).toBe('neutral');
    expect(mediumOf(6.99)).toBe('acid');
  });

  it('Bảng 2.1: litmus red ≤ 6, violet 7, blue ≥ 8; phenolphthalein colourless < 8, pink > 8', () => {
    expect([2, 6, 6.5, 7, 7.5, 8, 13].map(litmusOf)).toEqual([
      'red',
      'red',
      'between',
      'violet',
      'between',
      'blue',
      'blue',
    ]);
    expect([1, 7.99, 8, 8.01, 14].map(phenolphthaleinOf)).toEqual([
      'colourless',
      'colourless',
      'edge',
      'pink',
      'pink',
    ]);
  });

  it('strong acid and base (question 5, tr. 21): HCl 0,1 M pH 1, NaOH 0,01 M pH 12', () => {
    expect(phOf(strongSolutionH('HCl', 0.1))).toBeCloseTo(1, 10);
    expect(phOf(strongSolutionH('NaOH', 0.01))).toBeCloseTo(12, 10);
    // Very dilute: the water's own ions keep the pH on the right side of 7.
    expect(phOf(strongSolutionH('HCl', 1e-8))).toBeLessThan(7);
    expect(phOf(strongSolutionH('NaOH', 1e-8))).toBeGreaterThan(7);
  });

  it('the closed form agrees with a bisection of the charge balance', () => {
    for (const solute of ['HCl', 'NaOH'] as const)
      for (const c of [1, 0.1, 1e-3, 1e-6, 1e-8]) {
        const a = strongSolutionH(solute, c);
        expect(Math.abs(bisectedH(solute, c) / a - 1), `${solute} ${String(c)}`).toBeLessThan(1e-9);
      }
  });

  it('the store: pH on 0–14, [H⁺] and [OH⁻] typed in, a strong solution sets the pH', () => {
    setAqueous({ given: 'pH', pH: 20 });
    expect(useAqueousStore.getState().pH).toBe(14);
    setFromH(1e-3);
    expect(useAqueousStore.getState().pH).toBeCloseTo(3, 12);
    setFromOH(1e-3);
    expect(useAqueousStore.getState().pH).toBeCloseTo(11, 12);
    setAqueous({ given: 'solution', solute: 'HCl', c: 0.1 });
    expect(useAqueousStore.getState().pH).toBeCloseTo(1, 10);
    setAqueous({ solute: 'bad', c: -1, given: 'x' });
    expect(useAqueousStore.getState()).toMatchObject({ given: 'solution', solute: 'HCl', c: 0.1 });
    setAqueous({ given: 'pH', pH: 7 });
  });

  it('the card cites Bài 2 with its pages', () => {
    const ids = aqueousCard().sources.map((s) => s.id);
    expect(ids).toContain('sgk-hh11-b2');
    expect(aqueousCard().sources[0]?.citation).toContain('tr. 16–26');
  });
});
