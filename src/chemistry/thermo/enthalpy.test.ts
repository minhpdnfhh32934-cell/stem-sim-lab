import { describe, expect, it } from 'vitest';
import { REACTIONS } from '../data/reactions';
import { decimalsOf, ENTHALPY_REACTION_IDS, reactionEnthalpy } from './enthalpy';

const dH = (id: string) => {
  const r = reactionEnthalpy(id);
  if (!r?.ok) throw new Error(id);
  return r;
};

describe('reaction enthalpy from formation enthalpies (HH10 Bài 17)', () => {
  it('the book’s examples: 2H2 + O2 → 2H2O(l) is −571,6 kJ; CH4 combustion −890,2 kJ', () => {
    // SGK tr. 82: ΔrH°298 = −571,6 kJ; tr. 83 rounds the methane value to −890 kJ.
    expect(dH('h2-o2')).toMatchObject({ dH: -571.6, kind: 'exothermic', decimals: 1 });
    expect(dH('ch4-combustion')).toMatchObject({ products: -965.1, reactants: -74.9, dH: -890.2 });
  });

  it('SO2 + O2 → SO3(l) with the book’s values: 2 × (−144,2) kJ', () => {
    // SGK tr. 85, Ví dụ 1: SO2(g) + ½O2(g) → SO3(l), −144,2 kJ; the library writes 2SO2 + O2.
    expect(dH('contact').dH).toBe(-288.4);
  });

  it('endothermic decompositions: CaCO3 (book values) and NH4Cl (book + NIST)', () => {
    expect(dH('caco3-decomp')).toMatchObject({ dH: 178.3, kind: 'endothermic' });
    // NH4Cl(s) is not in Bảng 17.1: NIST-JANAF −314,55; NH3, HCl from the book.
    expect(dH('nh4cl-decomp')).toMatchObject({ dH: 176.35, decimals: 2 });
  });

  it('coefficients come from the balancer, each term has its phase and value', () => {
    const r = dH('thermite');
    expect(r.coefficientsBy).toBe('balancer');
    expect(r.terms.map((t) => `${String(t.coef)}${t.formula}(${t.phase})`)).toEqual([
      '2Al(s)',
      '1Fe2O3(s)',
      '1Al2O3(s)',
      '2Fe(s)',
    ]);
    // Al2O3 from CODATA (not in the book's table), Fe2O3 from the book.
    expect(r.terms.map((t) => t.data?.source)).toEqual([
      'definition',
      'sgk',
      'codata',
      'definition',
    ]);
    expect(r.dH).toBe(-850.2);
  });

  it('every offered reaction is in the library and computes', () => {
    for (const id of ENTHALPY_REACTION_IDS) {
      expect(
        REACTIONS.some((r) => r.id === id),
        id,
      ).toBe(true);
      expect(reactionEnthalpy(id)?.ok, id).toBe(true);
    }
    expect(reactionEnthalpy('zn-hcl')).toBeUndefined();
  });

  it('counts decimals as written', () => {
    expect([decimalsOf(-285.8), decimalsOf(-314.55), decimalsOf(0), decimalsOf(-1206.9)]).toEqual([
      1, 2, 0, 1,
    ]);
  });
});
