import { describe, expect, it } from 'vitest';
import { hcCard } from './card';
import {
  CLASSES,
  HC_REACTIONS,
  MEMBERS,
  balancedCombustion,
  classOf,
  combustion,
  formulaOf,
  molarMass,
} from './model';
import { setHc, useHcStore } from './store';

describe('hydrocarbons (HH11 Bài 15–17)', () => {
  it('the general formulas: CnH2n+2, CnH2n, CnH2n−2, CnH2n−6', () => {
    expect(formulaOf(classOf('alkane'), 3)).toBe('C3H8');
    expect(formulaOf(classOf('alkene'), 2)).toBe('C2H4');
    expect(formulaOf(classOf('alkyne'), 2)).toBe('C2H2');
    expect(formulaOf(classOf('arene'), 6)).toBe('C6H6');
    expect(formulaOf(classOf('alkane'), 1)).toBe('CH4');
    expect(CLASSES.map((c) => c.n_min)).toEqual([1, 2, 2, 6]);
  });

  it('the book’s tables: every member fits its series; Bảng 15.2 as printed', () => {
    for (const m of MEMBERS.filter((x) => x.in_series))
      expect(formulaOf(classOf(m.class), m.carbons), m.name).toBe(m.formula);
    expect(MEMBERS.filter((m) => !m.in_series).map((m) => m.name)).toEqual([
      'styrene',
      'naphthalene',
    ]);
    const bp = Object.fromEntries(MEMBERS.map((m) => [m.name, m.bp_C]));
    expect([bp.methane, bp.butane, bp.decane, bp.benzene, bp['pent-1-yne']]).toEqual([
      -161.5, -0.5, 174.0, 80.1, 40.2,
    ]);
    // Question 4 (tr. 85): along the straight alkanes the boiling point rises with the molar mass.
    const straight = MEMBERS.filter((m) => m.class === 'alkane' && m.straight);
    for (let i = 1; i < straight.length; i++)
      expect(straight[i]?.bp_C ?? 0).toBeGreaterThan(straight[i - 1]?.bp_C ?? 0);
  });

  it('combustion from the general formula matches the book (tr. 88, 106) and the balancer', () => {
    expect(combustion(classOf('alkane'), 1)).toMatchObject({ fuel: 1, o2: 2, co2: 1, h2o: 2 });
    expect(combustion(classOf('alkane'), 3)).toMatchObject({ fuel: 1, o2: 5, co2: 3, h2o: 4 });
    expect(combustion(classOf('arene'), 7)).toMatchObject({ fuel: 1, o2: 9, co2: 7, h2o: 4 });
    // Ethane: 2C₂H₆ + 7O₂ (the book's (3n+1)/2 = 7/2 doubled).
    expect(combustion(classOf('alkane'), 2)).toMatchObject({ fuel: 2, o2: 7, co2: 4, h2o: 6 });
    for (const c of CLASSES)
      for (let n = c.n_min; n <= 10; n++) {
        const r = combustion(c, n);
        expect(balancedCombustion(c, n), `${c.id} ${String(n)}`).toEqual([
          r.fuel,
          r.o2,
          r.co2,
          r.h2o,
        ]);
      }
  });

  it('molar masses with the book’s C 12, H 1: propane 44, benzene 78', () => {
    expect(molarMass(classOf('alkane'), 3)).toBe(44);
    expect(molarMass(classOf('arene'), 6)).toBe(78);
  });

  it('the book’s reactions with ΔrH°: methane −890 kJ, propane −2 216 kJ (tr. 88)', () => {
    const dh = HC_REACTIONS.filter((r) => r.dH_kJ !== null).map((r) => r.dH_kJ);
    expect(dh).toEqual([-890, -2216]);
    expect(HC_REACTIONS.filter((r) => r.class === 'arene')).toHaveLength(5);
  });

  it('the store keeps n inside the series, and the card cites chapter 4', () => {
    setHc({ cls: 'arene', n: 2 });
    expect(useHcStore.getState()).toEqual({ cls: 'arene', n: 6 });
    setHc({ cls: 'alkane', n: 99 });
    expect(useHcStore.getState().n).toBe(10);
    setHc({ n: 3 });
    expect(hcCard().sources[0]?.citation).toContain('Bảng 15.1');
  });
});
