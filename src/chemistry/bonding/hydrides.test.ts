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
        expect(h.boiling_point.url, h.id).toMatch(/^https:\/\/(webbook\.nist\.gov|pubchem)/);
      } else {
        expect(h.missing, h.id).toBeTruthy();
      }
      expect(h.review_status).toBe('pending');
    }
    expect(HYDRIDES.filter((h) => !h.boiling_point).map((h) => h.id)).toEqual(['snh4', 'h2te']);
  });

  it('kelvin as given, °C plus 273,15', () => {
    expect(k('h2o')).toBe(373.17);
    expect(k('hf')).toBe(292.7);
    expect(k('nh3')).toBeCloseTo(239.8, 6);
    expect(k('snh4')).toBeNull();
  });

  it('a converted value keeps the decimals the source printed (no false precision)', () => {
    const h = (id: string) => HYDRIDES.find((x) => x.id === id) ?? HYDRIDES[0]!;
    expect(sourceDecimals(h('ch4'))).toBe(0);
    expect(boilingPointIn(h('ch4'), 'C')).toBe(-162);
    expect(boilingPointIn(h('ch4'), 'K')).toBe(111);
    expect(boilingPointIn(h('h2o'), 'C')).toBe(100.02);
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
