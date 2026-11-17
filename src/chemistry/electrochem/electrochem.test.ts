import { describe, expect, it } from 'vitest';
import {
  BOOK_CELLS,
  COUPLES,
  ELECTRODES,
  METAL_FACTS,
  PAIRABLE,
  SALT_METALS,
  TEST_METALS,
  anodeText,
  cathodeText,
  cell,
  couple,
  coupleLabel,
  halfText,
  metalWith,
  reaction,
  reactionText,
  reactsWithAcid,
} from './model';

const WATER_E = couple('H2O').E_V;

const r = (a: string, b: string) => {
  const x = reaction(couple(a), couple(b));
  if (!x) throw new Error('no reaction');
  return reactionText(x);
};

describe('Bảng 15.1 (tr. 70)', () => {
  it('has the 24 couples in increasing E°, as the book prints them', () => {
    expect(COUPLES).toHaveLength(24);
    expect(COUPLES[0]).toMatchObject({ id: 'Li', E_V: -3.04 });
    expect(COUPLES.at(-1)).toMatchObject({ id: 'Au', E_V: 1.52 });
    const e = COUPLES.map((c) => c.E_V);
    expect(e).toEqual([...e].sort((a, b) => a - b));
    expect(halfText(couple('Li'))).toBe('Li⁺ + 1e ⇌ Li');
    expect(halfText(couple('H2O'))).toBe('2H₂O + 2e ⇌ H₂ + 2OH⁻');
    expect(halfText(couple('O'))).toBe('O₂ + 4H⁺ + 4e ⇌ 2H₂O');
    expect(coupleLabel(couple('Cl'))).toBe('Cl₂/2Cl⁻');
  });

  it('leaves the pH 7 water value out of comparisons, and metals that react with water out of cells', () => {
    expect(PAIRABLE.some((c) => c.id === 'H2O')).toBe(false);
    expect(ELECTRODES.map((c) => c.id)).toEqual([
      'Mg',
      'Al',
      'Zn',
      'Cr',
      'Fe',
      'Cd',
      'Ni',
      'Sn',
      'Pb',
      'Cu',
      'Ag',
      'Hg',
      'Au',
    ]);
  });
});

describe('the α rule (tr. 72)', () => {
  it('reactions (1) and (2) and question 5', () => {
    expect(r('Zn', 'Cu')).toBe('Zn + Cu²⁺ → Zn²⁺ + Cu');
    expect(r('Ag', 'Cu')).toBe('Cu + 2Ag⁺ → Cu²⁺ + 2Ag');
    expect(r('Ni', 'H')).toBe('Ni + 2H⁺ → Ni²⁺ + H₂');
    expect(r('Fe', 'Cu')).toBe('Fe + Cu²⁺ → Fe²⁺ + Cu');
    expect(r('Zn', 'Au')).toBe('3Zn + 2Au³⁺ → 3Zn²⁺ + 2Au');
  });

  it('merges and cancels species: Fe with Fe³⁺, hydrogen with oxygen', () => {
    expect(r('Fe', 'Fe3')).toBe('Fe + 2Fe³⁺ → 3Fe²⁺');
    expect(r('H', 'O')).toBe('2H₂ + O₂ → 2H₂O');
    expect(r('Br', 'Cl')).toBe('2Br⁻ + Cl₂(aq) → Br₂(aq) + 2Cl⁻');
    expect(reaction(couple('Cu'), couple('Cu'))).toBeNull();
  });

  it('question 3: decreasing reducing strength is increasing E°', () => {
    const ids = ['Cu', 'Na', 'Ag', 'Zn', 'H', 'Mg', 'Fe', 'Al'];
    const order = ids.map(couple).sort((a, b) => a.E_V - b.E_V);
    expect(order.map((c) => c.id)).toEqual(['Na', 'Mg', 'Al', 'Zn', 'Fe', 'H', 'Cu', 'Ag']);
  });

  it('question 4: a metal reacts with an acid when its E° is below 0', () => {
    expect(reactsWithAcid(couple('Fe'))).toBe(true);
    expect(reactsWithAcid(couple('Cu'))).toBe(false);
    expect(reactsWithAcid(couple('H'))).toBe(false);
  });
});

describe('the Galvanic cell (tr. 73–75)', () => {
  it('Zn – Cu gives 1,102 V and Cu – Ag 0,459 V, as the book', () => {
    for (const b of BOOK_CELLS) {
      const c = cell(couple(b.cathode), couple(b.anode));
      expect(c).toMatchObject({ emf: b.E_V });
      expect(c?.anode.id).toBe(b.anode);
    }
    const zc = cell(couple('Zn'), couple('Cu'));
    if (!zc) throw new Error('no cell');
    expect(anodeText(zc.anode)).toBe('Zn → Zn²⁺ + 2e');
    expect(cathodeText(zc.cathode)).toBe('Cu²⁺ + 2e → Cu');
  });

  it('makes no cell from a non-metal couple or one metal twice', () => {
    expect(cell(couple('Zn'), couple('H'))).toBeNull();
    expect(cell(couple('Zn'), couple('Zn'))).toBeNull();
  });
});

describe('Bài 19: metals with water, dilute acids and salts (tr. 92–93)', () => {
  const t = (m: string, r: 'water' | 'acid' | 'salt', s = 'Cu') => {
    const x = metalWith(couple(m), r, couple(s));
    if (!x) throw new Error('no test');
    return x.reaction ? reactionText(x.reaction) : 'none';
  };
  it('the book’s examples', () => {
    expect(t('Na', 'water')).toBe('2Na + 2H₂O → 2Na⁺ + H₂ + 2OH⁻');
    expect(t('Fe', 'acid')).toBe('Fe + 2H⁺ → Fe²⁺ + H₂');
    expect(t('Cu', 'salt', 'Ag')).toBe('Cu + 2Ag⁺ → Cu²⁺ + 2Ag');
    expect(t('Fe', 'salt', 'Cu')).toBe('Fe + Cu²⁺ → Fe²⁺ + Cu');
  });

  it('question 6: by E° < −0,414 V; question 7: Cu to Au do not react with dilute acids', () => {
    const byRule = COUPLES.filter((c) => c.metal && c.E_V < WATER_E).map((c) => c.id);
    expect(byRule).toEqual(['Li', 'K', 'Ba', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Cr', 'Fe']);
    for (const m of ['Cu', 'Ag', 'Hg', 'Au']) expect(t(m, 'acid')).toBe('none');
    expect(t('Cu', 'water')).toBe('none');
    expect(t('Ag', 'salt', 'Cu')).toBe('none');
    expect(metalWith(couple('Cu'), 'salt', couple('Cu'))).toBeNull();
  });

  it('offers no chromium in the reactions and no water-reactive metal as a salt', () => {
    expect(TEST_METALS.some((c) => c.id === 'Cr')).toBe(false);
    expect(SALT_METALS.some((c) => c.reacts_with_water_lesson !== undefined)).toBe(false);
  });

  it('keeps the book’s physical facts', () => {
    expect(METAL_FACTS.find((f) => f.id === 'lightest')).toMatchObject({
      metal: 'Li',
      value: 0.534,
    });
    expect(METAL_FACTS.find((f) => f.id === 'lowest_mp')).toMatchObject({
      metal: 'Hg',
      value: -39,
    });
  });
});
