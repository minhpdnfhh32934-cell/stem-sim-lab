import { describe, expect, it } from 'vitest';
import { phasorAmplitude, scanSegment } from './engine';
import { amplitudeAt, beatFrequency, maximaBetween, minimaBetween, orderAt } from './model';

describe('interference model', () => {
  it('counts maxima and minima strictly between the sources (sources excluded)', () => {
    // [d/λ, maxima, minima]
    const cases: [number, number, number][] = [
      [0.4, 1, 0],
      [0.5, 1, 0],
      [0.6, 1, 2],
      [1, 1, 2],
      [10 / 3, 7, 6],
      [6, 11, 12],
      [6.5, 13, 12],
      [20 / 3, 13, 14],
    ];
    for (const [r, max, min] of cases) {
      expect(maximaBetween(r * 0.015, 0.015), `maxima at d/λ = ${r}`).toBe(max);
      expect(minimaBetween(r * 0.015, 0.015), `minima at d/λ = ${r}`).toBe(min);
    }
  });

  it('a ratio that is whole only up to round-off is whole (d = 7λ written as 0,07 / 0,01)', () => {
    expect(0.07 / 0.01).not.toBe(7);
    expect(0.3 / 0.1).not.toBe(3);
    expect(maximaBetween(0.07, 0.01)).toBe(13);
    expect(maximaBetween(0.3, 0.1)).toBe(5);
    expect(minimaBetween(0.075, 0.01)).toBe(14);
  });

  it('formula counts = peaks and dips counted by scanning the segment S₁S₂', () => {
    const ratios = [0.3, 0.55, 1, 1.25, 2.5, 3.7, 6, 6.5, 12.01, 12.99, 25.5, 49.97, 99.5];
    for (let i = 1; i < 120; i++) ratios.push(i * 0.83);
    for (const r of ratios) {
      for (const lambda of [0.015, 0.03, 0.2]) {
        const d = r * lambda;
        const scan = scanSegment(d, lambda);
        expect(scan.maxima, `maxima at d/λ = ${r}`).toBe(maximaBetween(d, lambda));
        expect(scan.minima, `minima at d/λ = ${r}`).toBe(minimaBetween(d, lambda));
      }
    }
  });

  it('the scan finds a peak just inside a source (d/λ = n + 10⁻⁵)', () => {
    const d = (6 + 1e-5) * 0.01;
    expect(scanSegment(d, 0.01).maxima).toBe(13);
    expect(maximaBetween(d, 0.01)).toBe(13);
  });

  it('amplitude 2a|cos(πΔr/λ)| = length of the sum of the two phasors', () => {
    const lambda = 0.03;
    const k = (2 * Math.PI) / lambda;
    for (let i = 0; i < 50; i++) {
      const r1 = 0.01 + 0.007 * i;
      const r2 = 0.2 - 0.003 * i;
      expect(amplitudeAt(0.002, r2 - r1, lambda)).toBeCloseTo(phasorAmplitude(0.002, k, r1, r2), 14);
    }
    // On a maximum (Δr = kλ) 2a, on a minimum (Δr = (k + ½)λ) 0.
    expect(amplitudeAt(1, 2 * lambda, lambda)).toBeCloseTo(2, 14);
    expect(amplitudeAt(1, 1.5 * lambda, lambda)).toBeCloseTo(0, 14);
    expect(orderAt(0.03, lambda)).toBeCloseTo(1, 14);
  });

  it('beat frequency |f₁ − f₂|', () => {
    expect(beatFrequency(10, 11)).toBeCloseTo(1, 14);
    expect(beatFrequency(22, 20)).toBeCloseTo(2, 14);
  });
});
