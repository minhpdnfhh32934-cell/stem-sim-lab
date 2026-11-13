import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  BEAKER_250,
  chartLinear,
  CLEAR_TINT,
  CONICAL_FLASK_250,
  conicalFlaskLevel,
  coneLevel,
  CRYSTAL_VIOLET,
  deliveredShown,
  FLASKS,
  flaskLevel,
  hexToLinear,
  iceHeight,
  INDICATOR_CHART,
  indicatorFor,
  indicatorTint,
  indicatorTransmittance,
  baseFraction,
  linearCss,
  linearToSrgb,
  precipitateOpacity,
  srgbToLinear,
  thermometerFraction,
  timerShown,
  violetLinear,
  waterLevel,
} from './chemistry';

// The maps the 2D workspace pieces and the 3D benches share: the same numbers as the colours and
// levels three.js computes from the same inputs.

describe('colour spaces', () => {
  it('convert sRGB and linear light both ways, as three.js does', () => {
    for (const hex of ['#6a1fa8', '#dfeaf0', '#c0152b', '#5aae45']) {
      const out: [number, number, number] = [0, 0, 0];
      hexToLinear(hex, out);
      const c = new THREE.Color(hex);
      expect(out[0]).toBeCloseTo(c.r, 9);
      expect(out[1]).toBeCloseTo(c.g, 9);
      expect(out[2]).toBeCloseTo(c.b, 9);
      expect(linearCss(out)).toBe(hex);
    }
    for (const x of [0, 0.002, 0.04, 0.5, 1])
      expect(linearToSrgb(srgbToLinear(x))).toBeCloseTo(x, 12);
    expect(linearToSrgb(2)).toBeCloseTo(1, 12);
    expect(linearToSrgb(-1)).toBe(0);
  });

  it('give the dye colour the 3D benches mix: the clear tint to violet by the depth', () => {
    const clear = new THREE.Color(CLEAR_TINT);
    const violet = new THREE.Color(CRYSTAL_VIOLET);
    const out: [number, number, number] = [0, 0, 0];
    for (const a of [0, 0.2, 1, 3, NaN]) {
      const opacity = violetLinear(a, out);
      const depth = Number.isFinite(a) ? 1 - 10 ** -a : 0;
      const want = new THREE.Color().lerpColors(clear, violet, depth);
      expect(out[0]).toBeCloseTo(want.r, 9);
      expect(out[1]).toBeCloseTo(want.g, 9);
      expect(out[2]).toBeCloseTo(want.b, 9);
      expect(opacity).toBe(0.3 + 0.6 * depth);
    }
  });

  it('give the universal indicator colour the pH meter bench mixes, clamped to the chart', () => {
    const chart = INDICATOR_CHART.map((hex) => new THREE.Color(hex));
    const out: [number, number, number] = [0, 0, 0];
    for (const pH of [0, 3.25, 7, 9.9, 14, -2, 20]) {
      chartLinear(pH, out);
      const x = Math.min(Math.max(pH, 0), 14);
      const i = Math.min(Math.floor(x), 13);
      const want = new THREE.Color().lerpColors(chart[i]!, chart[i + 1]!, x - i);
      expect(out[0]).toBeCloseTo(want.r, 9);
      expect(out[1]).toBeCloseTo(want.g, 9);
      expect(out[2]).toBeCloseTo(want.b, 9);
    }
  });

  it('give an indicator colour through the water at the base fraction of the pH', () => {
    const ind = indicatorFor(8.2);
    const a: [number, number, number] = [0, 0, 0];
    const b: [number, number, number] = [0, 0, 0];
    indicatorTint(ind, 9, a);
    indicatorTransmittance(ind, baseFraction(ind, 9), b);
    expect(a).toEqual(b);
  });

  it('turn the share of the test ion that came out into an opacity', () => {
    expect(precipitateOpacity(0)).toBe(0);
    expect(precipitateOpacity(100)).toBeCloseTo(0.9, 12);
    expect(precipitateOpacity(250)).toBeCloseTo(0.9, 12);
    expect(precipitateOpacity(NaN)).toBe(0);
  });
});

describe('levels', () => {
  it('hold the volume in the 250 mL conical flask, up to the height it is drawn at', () => {
    const R = CONICAL_FLASK_250.base - CONICAL_FLASK_250.wall - 0.0004;
    const k =
      (CONICAL_FLASK_250.base - CONICAL_FLASK_250.neck) /
      (CONICAL_FLASK_250.shoulder - CONICAL_FLASK_250.wall);
    for (const ml of [0, 10, 25, 46.25, 75, NaN])
      expect(conicalFlaskLevel(ml)).toBe(coneLevel(R, k, 0.03, ml));
    const level = conicalFlaskLevel(46.25);
    const r = R - k * level;
    expect(((Math.PI * level) / 3) * (R * R + R * r + r * r) * 1e6).toBeCloseTo(46.25, 6);
  });

  it('hold the volume in a volumetric flask, reaching its mark at its nominal volume', () => {
    for (const f of FLASKS) {
      expect(flaskLevel(f, f.ml)).toBeCloseTo(f.mark, 12);
      expect(flaskLevel(f, 0)).toBe(0);
      expect(flaskLevel(f, 1e9)).toBe(f.top);
    }
  });

  it('hold water and ice in the beaker by mass, never past the brim', () => {
    const inner = BEAKER_250.radius - BEAKER_250.wall;
    expect(waterLevel(0.1)).toBeCloseTo(0.1 / 1000 / (Math.PI * inner * inner), 12);
    expect(waterLevel(100)).toBe(BEAKER_250.height - BEAKER_250.base - 0.004);
    expect(iceHeight(0.1)).toBeGreaterThan(waterLevel(0.1)); // ice is less dense: it stands higher
    expect(iceHeight(1e6)).toBe(waterLevel(1e6));
  });

  it('read a burette from the 0 mark, and a column from its scale', () => {
    expect(deliveredShown(12.5)).toBe(12.5);
    for (const ml of [-1, 0, NaN]) expect(deliveredShown(ml)).toBe(0);
    expect(thermometerFraction(10, 10, 60)).toBe(0);
    expect(thermometerFraction(35, 10, 60)).toBe(0.5);
    expect(thermometerFraction(99, 10, 60)).toBe(1);
    expect(thermometerFraction(NaN, 10, 60)).toBe(0);
  });
});

describe('a timer', () => {
  it('counts whole steps of its resolution while running and the nearest step once stopped', () => {
    expect(timerShown(12.37, 0.1, true)).toBeCloseTo(12.3, 12);
    expect(timerShown(12.37, 0.1, false)).toBeCloseTo(12.4, 12);
    expect(timerShown(0.3, 0.1, true)).toBeCloseTo(0.3, 12); // not 0.2 from rounding
    expect(timerShown(NaN, 0.1, false)).toBe(0);
    expect(timerShown(5.55, NaN, false)).toBe(5.55);
  });
});
