import { describe, expect, it } from 'vitest';
import {
  INDICATORS,
  KW,
  PKW,
  curve,
  equivalenceVolume,
  indicatorAt,
  indicatorOf,
  pH,
  type Titration,
} from './titration';

/**
 * Independent solution: bisection on pH of the charge balance [H⁺] − [OH⁻] − ([Cl⁻] − [Na⁺]) = 0,
 * which decreases with pH.
 */
function pHByBisection(t: Titration, vb: number, kw = KW): number {
  const d = (t.ca * t.va - t.cb * vb) / (t.va + vb);
  const f = (p: number) => 10 ** -p - kw * 10 ** p - d;
  let lo = -2;
  let hi = 16;
  expect(f(lo)).toBeGreaterThan(0);
  expect(f(hi)).toBeLessThan(0);
  for (let i = 0; i < 200 && hi - lo > 1e-14; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const CASES: Titration[] = [
  { ca: 0.1, va: 10, cb: 0.1 },
  { ca: 0.1, va: 25, cb: 0.2 },
  { ca: 0.01, va: 20, cb: 0.05 },
  { ca: 1, va: 100, cb: 0.001 },
  { ca: 0.001, va: 1, cb: 1 },
];

describe('strong acid – strong base titration', () => {
  it('matches the bisection solution of the charge balance within 1e-9 pH at every point', () => {
    for (const t of CASES) {
      const veq = equivalenceVolume(t);
      const points = [0, veq / 2, veq * (1 - 1e-6), veq, veq * (1 + 1e-6), 1.5 * veq, 2 * veq];
      for (const vb of points) {
        expect(
          Math.abs(pH(t, vb) - pHByBisection(t, vb)),
          `${JSON.stringify(t)} vb=${String(vb)}`,
        ).toBeLessThan(1e-9);
      }
    }
  });

  it('puts the equivalence point at V = Ca·Va/Cb, where pH = pKw/2', () => {
    for (const t of CASES) {
      const veq = equivalenceVolume(t);
      expect(veq).toBeCloseTo((t.ca * t.va) / t.cb, 12);
      expect(Math.abs(pH(t, veq) - PKW / 2)).toBeLessThan(1e-9);
    }
  });

  it('gives the textbook values far from equivalence (water ions negligible)', () => {
    const t = { ca: 0.1, va: 10, cb: 0.1 };
    expect(pH(t, 0)).toBeCloseTo(1, 9);
    expect(pH(t, 5)).toBeCloseTo(-Math.log10(0.5 / 15), 9);
    expect(pH(t, 20)).toBeCloseTo(PKW + Math.log10(1 / 30), 9);
  });

  it('samples the curve densely around the equivalence point, rising monotonically', () => {
    const t = { ca: 0.1, va: 10, cb: 0.1 };
    const c = curve(t, 20);
    expect(c.v[0]).toBe(0);
    expect(c.v.at(-1)).toBe(20);
    expect(c.v).toContain(10);
    expect(c.v.filter((v) => Math.abs(v - 10) < 0.01).length).toBeGreaterThan(10);
    for (let i = 1; i < c.pH.length; i++) expect(c.pH[i]).toBeGreaterThan(c.pH[i - 1] ?? -Infinity);
  });
});

describe('water and indicator data', () => {
  it('uses the generated pKw at 25 °C (IAPWS), pending review', () => {
    expect(PKW).toBeGreaterThan(13.9);
    expect(PKW).toBeLessThan(14.1);
    expect(KW).toBeCloseTo(10 ** -PKW, 25);
  });

  it('every indicator is pending, cited, and changes colour exactly at its tabulated range', () => {
    expect(INDICATORS.length).toBeGreaterThanOrEqual(2);
    for (const ind of INDICATORS) {
      expect(ind.review_status).toBe('pending');
      expect(ind.source.citation.length).toBeGreaterThan(0);
      const [lo, hi] = ind.range;
      expect(indicatorAt(ind, lo - 1e-9)).toEqual({ phase: 'acid', mix: 0 });
      expect(indicatorAt(ind, lo).phase).toBe('transition');
      const mid = indicatorAt(ind, (lo + hi) / 2);
      expect(mid.phase).toBe('transition');
      expect(mid.mix).toBeCloseTo(0.5, 12);
      expect(indicatorAt(ind, hi).phase).toBe('transition');
      expect(indicatorAt(ind, hi + 1e-9)).toEqual({ phase: 'base', mix: 1 });
    }
  });

  it('phenolphthalein stays colourless at the equivalence pH and turns colour in excess base', () => {
    const ind = indicatorOf('phenolphthalein');
    const t = { ca: 0.1, va: 10, cb: 0.1 };
    expect(indicatorAt(ind, pH(t, 10)).phase).toBe('acid');
    expect(indicatorAt(ind, pH(t, 11)).phase).toBe('base');
  });
});
