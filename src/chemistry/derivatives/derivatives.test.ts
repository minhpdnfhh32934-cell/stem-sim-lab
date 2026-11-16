import { describe, expect, it } from 'vitest';
import { molarMass, parseFormula } from '../formula';
import { caCard, hapCard } from './card';
import {
  ACIDS,
  COMPARISONS,
  COMPOUNDS,
  C_MAX,
  C_MIN,
  DER_REACTIONS,
  ELIMINATIONS,
  weakAcid,
  weakAcidBisect,
  zaitsev,
} from './model';
import { setCa, setHap, useCaStore, useHapStore } from './store';

const atoms = (terms: readonly { coef: number; formula: string }[]) => {
  const out = new Map<string, number>();
  for (const t of terms)
    for (const [el, k] of parseFormula(t.formula).counts)
      out.set(el, (out.get(el) ?? 0) + t.coef * k);
  return Object.fromEntries([...out].sort(([a], [b]) => a.localeCompare(b)));
};

describe('derivatives (HH11 Bài 19–24)', () => {
  it('the book’s tables as printed: Bảng 20.3, 23.1, 24.2 and phenol (tr. 130)', () => {
    const bp = Object.fromEntries(COMPOUNDS.map((c) => [c.id, c.bp_C]));
    expect([bp.methanol, bp.ethanol, bp.glycerol, bp.phenol]).toEqual([64.7, 78.3, 290, 181.8]);
    expect([bp.methanal, bp.propanone, bp['pentan-3-one']]).toEqual([-21, 56, 101]);
    expect([bp['methanoic-acid'], bp['ethanoic-acid'], bp['decanoic-acid']]).toEqual([
      101, 118, 270,
    ]);
    // Question 4 (tr. 123): along the open-chain alcohols the boiling point rises with C.
    for (const cls of ['alcohol', 'aldehyde', 'ketone', 'acid'] as const) {
      const s = COMPOUNDS.filter((c) => c.class === cls && c.series).sort(
        (a, b) => a.carbons - b.carbons,
      );
      for (let i = 1; i < s.length; i++)
        expect(s[i]?.bp_C ?? 0).toBeGreaterThan(s[i - 1]?.bp_C ?? 0);
    }
    for (const c of COMPOUNDS)
      expect(parseFormula(c.formula).counts.get('C'), c.id).toBe(c.carbons);
  });

  it('each comparison: printed M matches the formula, and boiling points follow the book’s order', () => {
    expect(COMPARISONS.map((c) => c.page)).toEqual([122, 147]);
    for (const cmp of COMPARISONS) {
      for (const r of cmp.rows)
        if (r.M !== null) expect(Math.round(molarMass(r.formula)), r.name).toBe(r.M);
      const bps = cmp.rows.map((r) => r.bp_C);
      expect([...bps].sort((a, b) => a - b)).toEqual(bps);
    }
    // tr. 147: alkane < aldehyde < alcohol < carboxylic acid.
    expect(COMPARISONS[1]?.rows.map((r) => r.class)).toEqual([
      'alkane',
      'aldehyde',
      'alcohol',
      'acid',
    ]);
  });

  it('every equation written with actual formulas conserves every element', () => {
    const checked = DER_REACTIONS.filter((r) => !r.general);
    expect(checked.length).toBeGreaterThan(25);
    for (const r of checked) expect(atoms(r.reactants), r.kind.vi).toEqual(atoms(r.products));
    // The iodoform reaction of ethanal: the book prints "+ H2O", which does not balance.
    const iodo = DER_REACTIONS.filter((r) => r.products.some((p) => p.formula === 'CHI3'));
    expect(iodo).toHaveLength(2);
    expect(iodo.find((r) => r.note)?.products.at(-1)).toEqual({ coef: 3, formula: 'H2O' });
    expect(DER_REACTIONS.find((r) => r.dH_kJ !== null)?.dH_kJ).toBe(-1367);
  });

  it('Zaitsev’s rule reproduces the book’s main products (tr. 116, 124)', () => {
    for (const e of ELIMINATIONS) {
      const z = zaitsev(e);
      if (e.book_main && !z.single) expect(z.main?.name, e.id).toBe(e.book_main);
      // Each product is the starting compound minus HX or H2O.
      const lost = e.kind === 'H2O' ? { H: 2, O: 1 } : { H: 1, [e.group]: 1 };
      for (const o of e.options) {
        const a = parseFormula(e.molecular).counts;
        const b = parseFormula(o.molecular).counts;
        const diff = Object.fromEntries(
          [...a].map(([el, k]) => [el, k - (b.get(el) ?? 0)] as const).filter(([, d]) => d !== 0),
        );
        expect(diff, `${e.id} → ${o.name}`).toEqual(lost);
      }
    }
    const byId = (id: string) => {
      const e = ELIMINATIONS.find((x) => x.id === id);
      if (!e) throw new Error(id);
      return zaitsev(e);
    };
    expect(byId('2-bromobutane').main?.name).toBe('but-2-ene');
    expect(byId('pentan-2-ol').main?.name).toBe('pent-2-ene');
    expect(byId('2-bromo-2-methylbutane').main?.name).toBe('2-methylbut-2-ene');
    expect(byId('2-bromo-2-methylbutane').minor).toEqual(['2-methylbut-1-ene']);
    expect(byId('2-chloropropane').single).toBe(true);
  });

  it('weak acids: exact root agrees with bisection; at 0,1 M matches Bảng 24.3 within its rounding', () => {
    for (const a of ACIDS) {
      for (const C of [C_MIN, 0.01, 0.1, C_MAX]) {
        const r = weakAcid(a.Ka, C);
        expect(r.h).toBeCloseTo(weakAcidBisect(a.Ka, C), 12);
        expect(r.h).toBeGreaterThan(1e-6); // the water's own H+ is negligible
        expect(r.alpha).toBeGreaterThan(0);
        expect(r.alpha).toBeLessThan(1);
      }
      const p = 100 * weakAcid(a.Ka, 0.1).alpha;
      expect(Math.abs(p - a.percent_01M), a.name).toBeLessThan(0.11);
    }
    // Acetic acid 0,1 M: about 1,3 % dissociated, pH ≈ 2,9.
    expect(100 * weakAcid(1.8e-5, 0.1).alpha).toBeCloseTo(1.33, 2);
    expect(weakAcid(1.8e-5, 0.1).pH).toBeCloseTo(2.88, 2);
    // Propanoic acid: the book prints 1,2 %, its Kₐ gives 1,1 % (DATA_REVIEW HH11-DER-1).
    expect(100 * weakAcid(1.3e-5, 0.1).alpha).toBeCloseTo(1.13, 2);
  });

  it('stores keep their choices inside the offered values; cards cite chapters 5 and 6', () => {
    setHap({ tab: 'zaitsev', elimination: 'pentan-2-ol' });
    expect(useHapStore.getState()).toEqual({ tab: 'zaitsev', elimination: 'pentan-2-ol' });
    setHap({ tab: 'nope', elimination: 'nope' });
    expect(useHapStore.getState().tab).toBe('zaitsev');
    setCa({ C: 50, acid: 'HCOOH' });
    expect(useCaStore.getState()).toMatchObject({ C: C_MAX, acid: 'HCOOH' });
    setCa({ C: 0, acid: 'HCl' });
    expect(useCaStore.getState()).toMatchObject({ C: C_MIN, acid: 'HCOOH' });
    setCa({ C: 0.1, acid: 'CH3COOH', tab: 'compare' });
    setHap({ tab: 'compare', elimination: '2-bromobutane' });
    expect(hapCard().sources[0]?.citation).toContain('Chương 5');
    expect(caCard().sources[0]?.citation).toContain('Chương 6');
  });
});
