import { describe, expect, it } from 'vitest';
import { HYDRIDES } from '../data/hydrides';
import {
  boilingPointIn,
  boilingPointK,
  HYDRIDE_GROUPS,
  hydrideSeries,
  period2Anomaly,
  PERIODS,
  risesFromPeriod3,
  sourceDecimals,
  valueIn,
} from './hydrides';

const k = (id: string) => {
  const h = HYDRIDES.find((x) => x.id === id);
  if (!h) throw new Error(id);
  return boilingPointK(h);
};

describe('hydride boiling points (Bài 13)', () => {
  it('one hydride per group 14–17 and period 2–5, each value with its source or a reason', () => {
    for (const g of HYDRIDE_GROUPS) {
      expect(hydrideSeries(g).map((p) => p.period)).toEqual([...PERIODS]);
    }
    for (const h of HYDRIDES) {
      if (h.boiling_point) {
        expect(h.boiling_point.reference.length, h.id).toBeGreaterThan(0);
        expect(h.boiling_point.url, h.id).toMatch(
          /^https:\/\/(taphuan\.nxbgd\.vn|webbook\.nist\.gov|pubchem)/,
        );
      } else {
        expect(h.missing, h.id).toBeTruthy();
      }
      expect(h.review_status).toBe('pending');
    }
    expect(HYDRIDES.filter((h) => !h.boiling_point).map((h) => h.id)).toEqual(['snh4', 'h2te']);
  });

  it('the textbook value wherever SGK gives one (Bảng 13.1, 22.2), NIST/PubChem second', () => {
    const book = HYDRIDES.filter((h) => h.boiling_point?.source === 'sgk');
    expect(book.map((h) => h.id).sort()).toEqual(['ch4', 'h2o', 'h2s', 'hbr', 'hcl', 'hf', 'hi']);
    const of = (id: string) => HYDRIDES.find((h) => h.id === id);
    expect(of('h2o')?.boiling_point).toMatchObject({ value: 100, unit: '°C' });
    expect(of('h2s')?.boiling_point).toMatchObject({ value: -60.75, as_given: '−60,75 °C' });
    expect(of('ch4')?.boiling_point).toMatchObject({ value: -161.58 });
    expect(of('hf')?.boiling_point).toMatchObject({ value: 19.5, as_given: '+19,5 °C' });
    expect(of('hcl')?.boiling_point?.reference).toContain('Bảng 22.2, tr. 113');
    expect(of('h2s')?.boiling_point?.reference).toContain('Bảng 13.1, tr. 65');
    for (const h of book) expect(h.second?.source, h.id).toMatch(/^(nist|pubchem)$/);
    expect(of('h2s')?.second).toMatchObject({ source: 'nist', value: 212.87, unit: 'K' });
    // The book's other H₂S value (opening question, p. 64) is said, not hidden.
    expect(of('h2s')?.boiling_point?.note).toContain('−60,28');
    // Hydrides the book does not give keep NIST/PubChem and have no second source.
    expect(of('nh3')?.boiling_point?.source).toBe('pubchem');
    expect(HYDRIDES.filter((h) => h.second && h.boiling_point?.source !== 'sgk')).toEqual([]);
  });

  it('kelvin from °C plus 273,15', () => {
    expect(k('h2o')).toBe(373.15);
    expect(k('hf')).toBeCloseTo(292.65, 9);
    expect(k('nh3')).toBeCloseTo(239.8, 6);
    expect(k('snh4')).toBeNull();
  });

  it('a converted value keeps the decimals the source printed (no false precision)', () => {
    const h = (id: string) => HYDRIDES.find((x) => x.id === id) ?? HYDRIDES[0]!;
    expect(sourceDecimals(h('ch4'))).toBe(2);
    expect(boilingPointIn(h('ch4'), 'C')).toBe(-161.58);
    expect(boilingPointIn(h('ch4'), 'K')).toBe(111.57);
    expect(boilingPointIn(h('h2o'), 'C')).toBe(100);
    expect(boilingPointIn(h('hf'), 'C')).toBe(19.5);
    // The second source keeps its own precision: NIST's "111. ± 2. K" is −162 °C.
    const ch4 = h('ch4').second;
    expect(ch4 && valueIn(ch4, 'C')).toBe(-162);
    expect(boilingPointIn(h('nh3'), 'C')).toBe(-33.35);
    expect(boilingPointIn(h('nh3'), 'K')).toBe(239.8);
    expect(boilingPointIn(h('sbh3'), 'C')).toBe(-17);
    expect(boilingPointIn(h('h2te'), 'C')).toBeNull();
  });

  it('NH₃, H₂O and HF boil higher than the next hydride of their group; CH₄ does not', () => {
    expect(period2Anomaly(15)).toBe(true);
    expect(period2Anomaly(16)).toBe(true);
    expect(period2Anomaly(17)).toBe(true);
    expect(period2Anomaly(14)).toBe(false);
    for (const g of HYDRIDE_GROUPS) expect(risesFromPeriod3(g), String(g)).toBe(true);
  });
});
