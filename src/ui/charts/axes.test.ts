import { describe, expect, it } from 'vitest';
import { X_AXIS_SIZE, axisLabel, yTickSpace } from './axes';

describe('chart axes', () => {
  it('an axis title carries its unit when there is one', () => {
    expect(axisLabel('[S]', 'mM')).toBe('[S] (mM)');
    expect(axisLabel('Tốc độ v', 'mM/phút')).toBe('Tốc độ v (mM/phút)');
    expect(axisLabel('Thế hệ')).toBe('Thế hệ');
    expect(axisLabel('Thế hệ', '')).toBe('Thế hệ');
  });

  it('a label that already ends with its unit in brackets does not get it twice', () => {
    expect(axisLabel('r (pm)', 'pm')).toBe('r (pm)');
    expect(axisLabel('Tốc độ v (m/s) ', 'm/s')).toBe('Tốc độ v (m/s) ');
    // A different unit in brackets is not the same unit: it is still added.
    expect(axisLabel('f(v) (s/m)', 'm/s')).toBe('f(v) (s/m) (m/s)');
    expect(axisLabel('f(v)', 'v')).toBe('f(v) (v)');
  });

  it('a short plot still gets at least three y ticks; a tall one keeps uPlot’s spacing', () => {
    // uPlot picks the smallest nice step (1, 2, 5 × 10ᵏ) whose ticks are at least `space` apart.
    const ticks = (range: number, height: number) => {
      const space = yTickSpace(height);
      for (let k = -3; k <= 6; k++)
        for (const m of [1, 2, 5]) {
          const step = m * 10 ** k;
          if ((step / range) * height >= space) return Math.floor(range / step) + 1;
        }
      return 1;
    };
    // The bottom panel's plot measured 77 px; ranges as in the lessons (e.g. dN/dt −55…125).
    for (const range of [1, 1.2, 45, 180, 200, 250, 1000])
      expect(ticks(range, 77), `range ${String(range)}`).toBeGreaterThanOrEqual(3);
    expect(yTickSpace(400)).toBe(30);
    // Never so close that the numbers touch.
    expect(yTickSpace(20)).toBe(14);
    expect(yTickSpace(0)).toBe(30);
    expect(yTickSpace(Number.NaN)).toBe(30);
  });

  it('the x axis is compact (values and title in about 50 px, not uPlot’s 80)', () => {
    expect(X_AXIS_SIZE.size + X_AXIS_SIZE.labelSize).toBeLessThanOrEqual(56);
  });
});
