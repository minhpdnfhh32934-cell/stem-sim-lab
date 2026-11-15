import { describe, expect, it } from 'vitest';
import { pickTex } from '@/core/data/dataset';
import { ELEMENTS_CARD, WATER_CARD } from './card';
import {
  BODY_WATER_PCT,
  CHON,
  SLICES,
  WATER,
  evaporationWarmEquivalent,
  groupShare,
  heatToEvaporate,
  heatToWarm,
  shareOf,
  sliceName,
} from './data';
import { restoreElements, useElements } from './store';

describe('figure 4.1 (SGK Sinh học 10 KNTT, tr. 24), as printed', () => {
  it('the slices and their shares; K, S, Na, Mg, Cl stay one slice', () => {
    expect(SLICES.map((s) => [s.id, s.share_pct, s.group])).toEqual([
      ['O', 65, 'macro'],
      ['C', 18, 'macro'],
      ['H', 10, 'macro'],
      ['N', 3, 'macro'],
      ['Ca', 1.5, 'macro'],
      ['P', 1.1, 'macro'],
      ['KSNaMgCl', 0.8, 'macro'],
      ['trace', 0.6, 'trace'],
    ]);
    expect(SLICES.find((s) => s.id === 'KSNaMgCl')?.symbols).toEqual(['K', 'S', 'Na', 'Mg', 'Cl']);
    expect(SLICES.every((s) => s.review_status === 'pending')).toBe(true);
  });

  it('the book’s sums: C, H, O, N ≈ 96 %, the other macroelements 3,4 %, trace 0,6 %', () => {
    expect(shareOf(CHON)).toBeCloseTo(96, 12);
    expect(groupShare('macro') - shareOf(CHON)).toBeCloseTo(3.4, 12);
    expect(groupShare('trace')).toBeCloseTo(0.6, 12);
    expect(groupShare('macro') + groupShare('trace')).toBeCloseTo(100, 12);
    expect(BODY_WATER_PCT).toBe(70);
  });

  it('names as the figure labels them, from the element table', () => {
    const name = (id: string) => {
      const s = SLICES.find((x) => x.id === id);
      if (!s) throw new Error(id);
      return sliceName(s).vi;
    };
    expect(name('O')).toBe('Oxygen (O)');
    expect(name('P')).toBe('Phosphorus (P)');
    expect(name('KSNaMgCl')).toBe('K, S, Na, Mg, Cl');
    expect(name('trace')).toBe('Các nguyên tố vi lượng');
  });
});

describe('water (NIST Chemistry WebBook)', () => {
  it('c = Cp/M from the liquid Shomate equation at 298.15 K; L = ΔvapH/M from CODATA', () => {
    const t = WATER.t_ref_k / 1000;
    const cp = -203.606 + 1523.29 * t - 3196.413 * t ** 2 + 2474.455 * t ** 3 + 3.855326 / t ** 2;
    expect(WATER.cp_molar_j_mol_k).toBeCloseTo(cp, 3);
    expect(WATER.molar_mass_g_mol).toBeCloseTo(2 * 1.008 + 15.999, 9);
    expect(WATER.c_specific_j_g_k).toBeCloseTo(cp / WATER.molar_mass_g_mol, 4);
    expect(WATER.dvap_h_kj_mol).toBeCloseTo(-241.826 + 285.83, 9);
    expect(WATER.l_vap_j_g).toBeCloseTo((WATER.dvap_h_kj_mol * 1000) / WATER.molar_mass_g_mol, 1);
    // The familiar 4,18 J/(g·°C) and 2,44 kJ/g at 25 °C.
    expect(WATER.c_specific_j_g_k).toBeCloseTo(4.184, 3);
    expect(WATER.l_vap_j_g).toBeCloseTo(2442.6, 1);
  });

  it('Q₁ = m·c·ΔT, Q₂ = m·L, and the warming equivalent L/c', () => {
    expect(heatToWarm(100, 1)).toBeCloseTo(100 * WATER.c_specific_j_g_k, 9);
    expect(heatToWarm(2, 10)).toBeCloseTo(heatToWarm(20, 1), 9);
    expect(heatToEvaporate(1)).toBe(WATER.l_vap_j_g);
    expect(heatToWarm(evaporationWarmEquivalent(), 1)).toBeCloseTo(heatToEvaporate(1), 9);
    expect(evaporationWarmEquivalent()).toBeCloseTo(583.8, 1);
  });
});

describe('Science Cards', () => {
  it('elements: approx, the 96 % computed from the data, the textbook as source', () => {
    expect(ELEMENTS_CARD.confidence).toBe('approx');
    expect(ELEMENTS_CARD.equations.map((e) => pickTex(e.tex, 'vi')).join(' ')).toContain('= 96\\%');
    expect(ELEMENTS_CARD.sources[0]?.citation).toMatch(/Hình 4\.1 \(tr\. 24\)/);
    expect(ELEMENTS_CARD.reviewStatus).toBe('pending');
  });

  it('water: approx, NIST as source, no Vietnamese inside \\text{}', () => {
    expect(WATER_CARD.confidence).toBe('approx');
    expect(WATER_CARD.sources[0]?.url).toContain('webbook.nist.gov');
    for (const e of [...ELEMENTS_CARD.equations, ...WATER_CARD.equations])
      expect(pickTex(e.tex, 'vi')).not.toContain('\\text{');
  });
});

describe('saved inputs', () => {
  it('a file is checked against the controls', () => {
    useElements.setState({ view: 'elements', mass: 100, dT: 1 });
    restoreElements({ view: 'water', mass: 5000, dT: 20 });
    expect(useElements.getState()).toMatchObject({ view: 'water', mass: 100, dT: 20 });
    restoreElements({ view: 'fire', dT: 'hot' });
    expect(useElements.getState()).toMatchObject({ view: 'water', dT: 20 });
  });
});
