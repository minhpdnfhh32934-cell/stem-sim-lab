import { describe, expect, it } from 'vitest';
import { elementByZ } from '../data/elements';
import { ISOTOPE_ELEMENTS, ISOTOPE_REFERENCES, isotopesOf } from '../data/isotopes';
import { abundanceGap, averageMass, twoIsotopeAbundances } from './average';

const iso = (z: number) => isotopesOf(z)?.isotopes ?? [];

describe('isotope data (data/isotopes.json)', () => {
  it('Cl: ³⁵Cl 75,8 % and ³⁷Cl 24,2 %, with their CIAAW masses', () => {
    expect(iso(17)).toEqual([
      { a: 35, mass_u: 34.968852694, abundance_pct: 75.8 },
      { a: 37, mass_u: 36.965902573, abundance_pct: 24.2 },
    ]);
  });

  it('84 elements, sorted by mass number, cites CIAAW and NUBASE2020, all pending', () => {
    expect(ISOTOPE_ELEMENTS).toHaveLength(84);
    expect(isotopesOf(43)).toBeUndefined(); // Tc: no natural isotope
    for (const e of ISOTOPE_ELEMENTS) {
      expect(e.symbol).toBe(elementByZ(e.z)?.symbol);
      expect(e.review_status).toBe('pending');
      const as = e.isotopes.map((i) => i.a);
      expect(as).toEqual([...as].sort((x, y) => x - y));
    }
    expect(ISOTOPE_REFERENCES.map((r) => r.id)).toEqual(['ciaaw-atomic-masses', 'nubase2020']);
  });
});

describe('average atomic mass Ā = Σ xᵢAᵢ / 100 (HH10 Bài 2)', () => {
  it('Cl by mass numbers: (35 × 75,8 + 37 × 24,2) / 100 = 35,484', () => {
    const avg = averageMass(iso(17), 'massNumber');
    expect(avg.value).toBeCloseTo(35.484, 12);
    expect(avg.abundanceSum).toBeCloseTo(100, 12);
  });

  it('Cl by isotope masses: 34,968852694 × 0,758 + 36,965902573 × 0,242', () => {
    expect(averageMass(iso(17), 'mass').value).toBeCloseTo(
      34.968852694 * 0.758 + 36.965902573 * 0.242,
      12,
    );
  });

  it('from the real masses, every element lands near its IUPAC atomic weight', () => {
    for (const e of ISOTOPE_ELEMENTS) {
      const weight = elementByZ(e.z)?.atomic_weight ?? NaN;
      // Li, Pb: IUPAC's conventional value differs from these representative abundances.
      expect(Math.abs(averageMass(e.isotopes, 'mass').value - weight), e.symbol).toBeLessThan(0.03);
    }
  });

  it('Mg, S (rounded data) and Ta (¹⁸⁰ᵐTa not in the data) do not add up to 100 %', () => {
    const gaps = ISOTOPE_ELEMENTS.filter((e) =>
      abundanceGap(averageMass(e.isotopes, 'mass').abundanceSum),
    ).map((e) => e.symbol);
    expect(gaps).toEqual(['Mg', 'S', 'Ta']);
    expect(averageMass(iso(73), 'mass').value).toBeCloseTo(iso(73)[0]?.mass_u ?? NaN, 12);
  });
});

describe('reverse problem: two isotopes and Ā give the abundances', () => {
  it('Cl, Ā = 35,5 → 75 % ³⁵Cl and 25 % ³⁷Cl; Ā = 35,484 → 75,8 %', () => {
    expect(twoIsotopeAbundances(35, 37, 35.5)).toEqual({ ok: true, x1: 75, x2: 25 });
    const back = twoIsotopeAbundances(35, 37, 35.484);
    expect(back.ok && back.x1).toBeCloseTo(75.8, 10);
  });

  it('Cu, Ā = 63,54 → 73 % ⁶³Cu', () => {
    const r = twoIsotopeAbundances(63, 65, 63.54);
    expect(r.ok && r.x1).toBeCloseTo(73, 10);
    expect(r.ok && r.x2).toBeCloseTo(27, 10);
  });

  it('Ā at or outside the two mass numbers has no answer', () => {
    for (const avg of [34, 35, 37, 38]) {
      expect(twoIsotopeAbundances(35, 37, avg)).toEqual({ ok: false, reason: 'outside' });
    }
    expect(twoIsotopeAbundances(35, 37, NaN)).toEqual({ ok: false, reason: 'notFinite' });
  });
});
