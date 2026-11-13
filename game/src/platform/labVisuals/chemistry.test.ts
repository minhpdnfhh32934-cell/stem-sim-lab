import { PRECIPITATES } from '../../simulation/models/precipitation';
import { describe, expect, it } from 'vitest';
import {
  baseFraction,
  chartPosition,
  coneLevel,
  heldBelow,
  indicatorFor,
  indicatorTransmittance,
  INDICATORS,
  levelIn,
  precipitateRgb,
  violetDepth,
  violetOpacity,
  WATER,
} from './chemistry';

describe('chemistry visuals (the old renderer formulas)', () => {
  it('picks the indicator and its base fraction', () => {
    expect(indicatorFor(3.5)).toBe(INDICATORS[0]);
    expect(indicatorFor(9)).toBe(INDICATORS[1]);
    for (const pH of [0, 3.47, 7, 8.2, 9.4, 14]) {
      expect(baseFraction(INDICATORS[1], pH)).toBe(1 / (1 + 10 ** (9.4 - pH)));
    }
    expect(baseFraction(INDICATORS[0], NaN)).toBe(0);
  });

  it('mixes transmittance as absorbance through the water', () => {
    const ind = INDICATORS[1];
    for (const f of [0, 0.06, 0.5, 1]) {
      const [r, g, b] = [0, 0, 0] as [number, number, number];
      const out: [number, number, number] = [r, g, b];
      indicatorTransmittance(ind, f, out);
      const [r2, g2, b2] = out;
      expect(r2).toBe(ind.acid[0] ** (1 - f) * ind.base[0] ** f * WATER[0]);
      expect(g2).toBe(ind.acid[1] ** (1 - f) * ind.base[1] ** f * WATER[1]);
      expect(b2).toBe(ind.acid[2] ** (1 - f) * ind.base[2] ** f * WATER[2]);
    }
  });

  it('places a pH on the chart, clamped', () => {
    const out = { i: -1, t: -1 };
    for (const pH of [7.25, -3, 20, 14, 0, 6.999, 7]) {
      chartPosition(pH, out);
      const x = Math.min(Math.max(pH, 0), 14); // the old renderer's expression
      const i = Math.min(Math.floor(x), 13);
      expect(out).toEqual({ i, t: x - i });
    }
    chartPosition(20, out);
    expect(out).toEqual({ i: 13, t: 1 });
  });

  it('gives a precipitate colour by product index', () => {
    expect(precipitateRgb(0)).toBeNull();
    expect(precipitateRgb(1)).toBe(PRECIPITATES[0]?.rgb);
    expect(precipitateRgb(PRECIPITATES.length + 1)).toBeNull();
  });

  it('crystal violet depth is 1 - 10^-A', () => {
    expect(violetDepth(NaN)).toBe(0);
    expect(violetDepth(-1)).toBe(0);
    for (const a of [0, 0.3, 1, 2.5]) expect(violetDepth(a)).toBe(1 - 10 ** -a);
    expect(violetOpacity(0.5)).toBe(0.3 + 0.6 * 0.5);
  });

  it('cone and profile levels hold the volume', () => {
    const R = 0.04;
    const k = 0.6;
    for (const ml of [0, 25, 75, -5, NaN]) {
      const r = Math.cbrt(Math.max(R ** 3 - (3 * k * (ml > 0 ? ml : 0) * 1e-6) / Math.PI, 0));
      expect(coneLevel(R, k, 0.03, ml)).toBe(Math.min((R - r) / k, 0.03));
    }
    const profile = [
      [0.02, 0],
      [0.02, 0.1],
    ] as const;
    const held = heldBelow(profile);
    expect(held[1]).toBeCloseTo(Math.PI * 0.02 ** 2 * 0.1 * 1e6, 9);
    const out = { y: 0, r: 0 };
    levelIn(profile, held, (held[1] ?? 0) / 2, out);
    expect(out.y).toBeCloseTo(0.05, 12);
    levelIn(profile, held, 1e9, out);
    expect(out).toEqual({ y: 0.1, r: 0.02 });
    // a cone (0.02 -> 0.04 over 0.1 m): the volume below the solved height is the one asked for
    const cone = [
      [0.02, 0],
      [0.04, 0.1],
    ] as const;
    const heldCone = heldBelow(cone);
    for (const ml of [10, 50, 100]) {
      levelIn(cone, heldCone, ml, out);
      const h = out.y;
      const r = out.r;
      expect(r).toBeCloseTo(0.02 + 0.2 * h, 12);
      expect(((Math.PI * h) / 3) * (0.02 ** 2 + 0.02 * r + r * r) * 1e6).toBeCloseTo(ml, 6);
    }
  });
});
