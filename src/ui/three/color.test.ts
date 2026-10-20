import { describe, expect, it } from 'vitest';
import {
  deltaEOK,
  fromOklab,
  kelvinLinear,
  mixLinear,
  muted,
  oklab,
  oklch,
  parseHex,
  toHex,
} from './color';

describe('3D colour helpers', () => {
  it('parses and prints hex colours', () => {
    expect(parseHex('#fff')).toEqual([1, 1, 1]);
    expect(toHex(parseHex('#0072b2') ?? [0, 0, 0])).toBe('#0072b2');
    expect(parseHex('rgb(1, 2, 3)')).toBeNull();
    expect(parseHex('')).toBeNull();
  });

  it('mixes in linear light: the ends are exact, the middle is brighter than an sRGB average', () => {
    expect(mixLinear('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixLinear('#000000', '#ffffff', 1)).toBe('#ffffff');
    // Linear 0.5 is sRGB 188 (an sRGB average would be 128).
    expect(mixLinear('#000000', '#ffffff', 0.5)).toBe('#bcbcbc');
    expect(mixLinear('not a colour', '#ffffff', 0.5)).toBe('not a colour');
  });

  it('OKLab round trip and distance', () => {
    for (const hex of ['#0072b2', '#e69f00', '#009e73', '#fbfcfe', '#10151d']) {
      const lab = oklab(hex);
      expect(lab).not.toBeNull();
      expect(fromOklab(lab ?? [0, 0, 0])).toBe(hex);
      expect(deltaEOK(hex, hex)).toBe(0);
    }
    expect(deltaEOK('#000000', '#ffffff')).toBeCloseTo(1, 2);
  });

  it('muted: towards the stage colour, chroma × 0.6 (structures recede, data pops)', () => {
    const bio = '#16804a';
    const m = muted(bio, '#fbfcfe');
    const a = oklch(bio);
    const b = oklch(m);
    expect(a && b).toBeTruthy();
    // Lighter (towards the light stage), much less saturated, same family of hue.
    expect(b!.L).toBeGreaterThan(a!.L);
    expect(b!.C).toBeLessThan(a!.C * 0.6);
    expect(Math.abs(b!.h - a!.h)).toBeLessThan(12);
  });

  it('light temperatures: 5200 K is warm, 7500 K is cool, 6600 K is about white', () => {
    const [r5, g5, b5] = kelvinLinear(5200);
    expect(r5).toBe(1);
    expect(g5).toBeLessThan(1);
    expect(b5).toBeLessThan(g5);
    const [r7, , b7] = kelvinLinear(7500);
    expect(b7).toBe(1);
    expect(r7).toBeLessThan(1);
    const white = kelvinLinear(6600);
    for (const c of white) expect(c).toBeGreaterThan(0.85);
  });
});
