import { describe, expect, it } from 'vitest';
import { axisLabel, yTickSpace } from './axes';

describe('chart axes', () => {
  it('an axis title carries its unit when there is one', () => {
    expect(axisLabel('[S]', 'mM')).toBe('[S] (mM)');
    expect(axisLabel('Tốc độ v', 'mM/phút')).toBe('Tốc độ v (mM/phút)');
    expect(axisLabel('Thế hệ')).toBe('Thế hệ');
    expect(axisLabel('Thế hệ', '')).toBe('Thế hệ');
  });

  it('a short plot still gets at least three y ticks; a tall one keeps uPlot’s spacing', () => {
    // The bottom panel's chart area measured 40–80 px high in the audit.
    for (const h of [42, 60, 80, 100])
      expect(Math.floor(h / yTickSpace(h))).toBeGreaterThanOrEqual(3);
    expect(yTickSpace(400)).toBe(30);
    // Never so close that the numbers touch.
    expect(yTickSpace(20)).toBe(14);
    expect(yTickSpace(0)).toBe(30);
    expect(yTickSpace(Number.NaN)).toBe(30);
  });
});
