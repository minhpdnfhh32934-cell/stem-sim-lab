import { describe, expect, it } from 'vitest';
import { formatCells, formatGenerations } from './format';
import { EXAMPLES, cellsAt, generations, growthCurve, timeToReach } from './growth';
import { PHASES, PHASE_SPAN, illustrativeLevel, phaseAt } from './phases';
import { restoreGrowth, useGrowth } from './store';

describe('Nₜ = N₀ × 2^(t/g) (SGK Sinh học 10 KNTT, tr. 124)', () => {
  it('doubles every generation: n whole numbers give exact powers of two', () => {
    expect(generations(180, 20)).toBe(9);
    expect(cellsAt(100, 180, 20)).toBe(51_200);
    expect(cellsAt(1, 0, 20)).toBe(1);
    for (let n = 0; n <= 60; n++) expect(cellsAt(3, n * 20, 20)).toBe(3 * 2 ** n);
  });

  it('half a generation multiplies by √2', () => {
    expect(cellsAt(100, 10, 20)).toBeCloseTo(100 * Math.SQRT2, 12);
  });

  it('timeToReach is the inverse of cellsAt', () => {
    expect(timeToReach(100, 51_200, 20)).toBeCloseTo(180, 12);
    for (const [n0, t, g] of [
      [1, 37, 13],
      [250, 1440, 720],
      [10_000, 5, 10],
    ] as const)
      expect(timeToReach(n0, cellsAt(n0, t, g), g)).toBeCloseTo(t, 9);
  });

  it('the curve: t from 0 to tEnd, N and log₂N agree, log₂N is a straight line of slope 1/g', () => {
    const c = growthCurve(100, 20, 1440, 240);
    expect(c.t).toHaveLength(241);
    expect(c.t[0]).toBe(0);
    expect(c.t.at(-1)).toBe(1440);
    c.t.forEach((t, i) => {
      expect(Math.log2(c.n[i] ?? 0)).toBeCloseTo(c.log2n[i] ?? NaN, 9);
      expect(c.log2n[i]).toBeCloseTo(Math.log2(100) + t / 20, 12);
    });
    // 72 generations: 100 × 2⁷² stays finite and exact in log₂.
    expect(c.n.at(-1)).toBe(100 * 2 ** 72);
  });

  it('the textbook examples, as printed: E. coli 20 min, the tuberculosis bacterium 12 h', () => {
    expect(EXAMPLES.map((e) => [e.id, e.g, e.page])).toEqual([
      ['ecoli', 20, 124],
      ['tuberculosis', 720, 124],
    ]);
    expect(EXAMPLES.every((e) => e.review_status === 'pending')).toBe(true);
  });
});

describe('the four phases (illustration of H 21.4)', () => {
  it('spans tile 0 … 1 in order, and phaseAt finds them', () => {
    let x = 0;
    for (const p of PHASES) {
      const [a, b] = PHASE_SPAN[p];
      expect(a).toBe(x);
      expect(b).toBeGreaterThan(a);
      expect(phaseAt((a + b) / 2)).toBe(p);
      x = b;
    }
    expect(x).toBe(1);
  });

  it('the curve is continuous: flat, rising, flat, falling', () => {
    for (let i = 0; i < 1000; i++)
      expect(
        Math.abs(illustrativeLevel((i + 1) / 1000) - illustrativeLevel(i / 1000)),
      ).toBeLessThan(0.02);
    const mid = (p: (typeof PHASES)[number]) =>
      illustrativeLevel((PHASE_SPAN[p][0] + PHASE_SPAN[p][1]) / 2);
    expect(mid('lag')).toBeLessThan(mid('log'));
    expect(mid('log')).toBeLessThan(mid('stationary'));
    expect(mid('death')).toBeLessThan(mid('stationary'));
    expect(illustrativeLevel(0.05)).toBe(illustrativeLevel(0.1));
  });
});

describe('numbers on screen', () => {
  it('whole cells below a million, then 3 significant digits × 10ᵏ', () => {
    expect(formatCells('vi', 51_200)).toBe('51.200');
    expect(formatCells('vi', 100 * Math.SQRT2)).toBe('141');
    expect(formatCells('vi', 100 * 2 ** 72)).toBe('4,72 × 10²³');
    expect(formatCells('en', 9.996e6)).toBe('1 × 10⁷');
    expect(formatGenerations('vi', 9)).toBe('9');
    expect(formatGenerations('vi', 0.5)).toBe('0,5');
  });
});

describe('saved inputs', () => {
  it('a file is checked: out-of-range or unknown values are dropped', () => {
    useGrowth.setState({ view: 'formula', n0: 100, g: 20, t: 180, scale: 'linear', phase: 'log' });
    restoreGrowth({ view: 'phases', n0: 50, g: 5, t: 9999, scale: 'log10', phase: 'death' });
    expect(useGrowth.getState()).toMatchObject({
      view: 'phases',
      n0: 50,
      g: 20,
      t: 180,
      scale: 'linear',
      phase: 'death',
    });
  });
});
