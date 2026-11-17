import { describe, expect, it } from 'vitest';
import { niceStep, twoFrames } from './chart2d';

describe('chart2d', () => {
  it('niceStep picks 1, 2 or 5 × 10ⁿ at or above x', () => {
    expect([0.7, 1, 1.3, 3, 7, 0.0042, 2600].map(niceStep)).toEqual([1, 1, 2, 5, 10, 0.005, 5000]);
    expect(niceStep(0)).toBe(1);
  });
  it('twoFrames fills the width without overlap', () => {
    const [a, b] = twoFrames(1000, 600);
    expect(a.x + a.w).toBeLessThan(b.x);
    expect(b.x + b.w).toBeLessThanOrEqual(1000);
    expect(a.h).toBe(b.h);
  });
});
