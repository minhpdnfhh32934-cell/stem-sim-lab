import { describe, expect, it } from 'vitest';
import {
  antinodes,
  harmonicFrequency,
  harmonicRatio,
  incident,
  isWhole,
  nearestResonances,
  nodes,
  reflected,
  speedForHarmonic,
  standing,
  waveSpeed,
  wavelength,
} from './model';

/** Mode n of a string of length L: k = nπ/L. */
const waveOf = (A: number, L: number, n: number) => ({ A, k: (n * Math.PI) / L });

describe('standing wave formulas', () => {
  it('v = √(T/μ), λ = v/f, f_n = n·v/(2L), v = 2Lf/n', () => {
    expect(waveSpeed(2, 0.005)).toBeCloseTo(20, 12);
    expect(wavelength(20, 25)).toBeCloseTo(0.8, 12);
    expect(harmonicFrequency(3, 20, 1.2)).toBeCloseTo(25, 12);
    expect(speedForHarmonic(3, 25, 1.2)).toBeCloseTo(20, 12);
    expect(harmonicRatio(1.2, 25, 20)).toBeCloseTo(3, 12);
  });

  it('L = nλ/2 for every harmonic', () => {
    for (let n = 1; n <= 12; n++) {
      const f = harmonicFrequency(n, 20, 1.2);
      expect((n * wavelength(20, f)) / 2).toBeCloseTo(1.2, 12);
    }
  });

  it('the sum of the two travelling waves equals 2A·sin(kx)·sin(ωt) on a (x, t) grid', () => {
    const w = waveOf(0.013, 1.2, 3);
    const omega = 2 * Math.PI * harmonicFrequency(3, 20, 1.2);
    const wave = { ...w, omega };
    let worst = 0;
    for (let i = 0; i <= 60; i++) {
      for (let j = 0; j <= 60; j++) {
        const x = (1.2 * i) / 60;
        const t = (0.2 * j) / 60;
        const sum = incident(wave, x, t) + reflected(wave, x, t);
        worst = Math.max(worst, Math.abs(sum - standing(wave, x, t)));
      }
    }
    expect(worst).toBeLessThan(1e-12);
  });

  it('nodes x = jλ/2 stay at rest, antinodes x = (2j+1)λ/4 reach 2A', () => {
    const L = 1.2;
    const n = 3;
    const A = 0.01;
    const wave = { ...waveOf(A, L, n), omega: 2 * Math.PI * 25 };
    const lambda = (2 * L) / n;
    const N = nodes(L, n);
    const B = antinodes(L, n);
    expect(N).toHaveLength(n + 1);
    expect(B).toHaveLength(n);
    N.forEach((x, j) => expect(x).toBeCloseTo((j * lambda) / 2, 12));
    B.forEach((x, j) => expect(x).toBeCloseTo(((2 * j + 1) * lambda) / 4, 12));
    for (let j = 0; j <= 400; j++) {
      const t = (0.2 * j) / 400;
      for (const x of N) expect(Math.abs(standing(wave, x, t))).toBeLessThan(1e-12);
    }
    // At an antinode the displacement peaks at 2A when sin(ωt) = 1 (t = T/4).
    for (const x of B) expect(Math.abs(standing(wave, x, 1 / 100))).toBeCloseTo(2 * A, 12);
  });

  it('both clamped ends stay at y = 0 at all times', () => {
    for (const n of [1, 2, 5, 17]) {
      const wave = { ...waveOf(0.02, 0.75, n), omega: 2 * Math.PI * 40 };
      for (let j = 0; j <= 200; j++) {
        const t = j / 997;
        expect(Math.abs(standing(wave, 0, t))).toBe(0);
        expect(Math.abs(standing(wave, 0.75, t))).toBeLessThan(1e-12);
      }
    }
  });
});

describe('whole number of half wavelengths (trap 5: never rounded)', () => {
  it('accepts only round-off away from a whole number', () => {
    expect(isWhole(3)).toBe(true);
    // 2·0.7·50/35 is 2 up to round-off.
    expect(isWhole(harmonicRatio(0.7, 50, 35))).toBe(true);
    expect(isWhole(3 + 2e-9)).toBe(true);
    expect(isWhole(3 + 1e-6)).toBe(false);
    expect(isWhole(2.5)).toBe(false);
    expect(isWhole(1000 + 5e-7)).toBe(true);
    expect(isWhole(1000 + 5e-6)).toBe(false);
  });

  it('suggests the resonance just below and just above, without changing f', () => {
    // L = 1.2 m, v = 20 m/s: f_n = n·8.333… Hz; f = 30 Hz gives m = 3.6.
    const r = nearestResonances(1.2, 30, 20);
    expect(r.m).toBeCloseTo(3.6, 12);
    expect(r.below).toEqual({ n: 3, f: harmonicFrequency(3, 20, 1.2) });
    expect(r.above).toEqual({ n: 4, f: harmonicFrequency(4, 20, 1.2) });
  });

  it('below the fundamental (m < 1) only f₁ is suggested', () => {
    const r = nearestResonances(1.2, 5, 20);
    expect(r.m).toBeCloseTo(0.6, 12);
    expect(r.below).toBeNull();
    expect(r.above).toEqual({ n: 1, f: harmonicFrequency(1, 20, 1.2) });
  });
});
