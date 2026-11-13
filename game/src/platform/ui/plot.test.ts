import { describe, expect, it } from 'vitest';
import { extent, niceAxis, scale, tickLabel } from './plot';

describe('plot helpers', () => {
  it('picks round tick steps that cover the data', () => {
    expect(niceAxis(0, 1.73)).toEqual({
      min: 0,
      max: 2,
      step: 0.5,
      ticks: [0, 0.5, 1, 1.5, 2],
    });
    expect(niceAxis(0, 14.68).ticks).toEqual([0, 5, 10, 15]); // raw step 2.9 → 5
    expect(niceAxis(0, 11).ticks).toEqual([0, 2.5, 5, 7.5, 10, 12.5]); // raw step 2.2 → 2.5
    expect(niceAxis(-8.4, 8.4).ticks).toEqual([-10, -5, 0, 5, 10]);
    const tiny = niceAxis(0.002, 0.0093);
    expect(tiny.min).toBeLessThanOrEqual(0.002);
    expect(tiny.max).toBeGreaterThanOrEqual(0.0093);
  });

  it('gives a flat or broken series a usable axis', () => {
    const flat = niceAxis(5.66, 5.66);
    expect(flat.min).toBeLessThan(5.66);
    expect(flat.max).toBeGreaterThan(5.66);
    expect(niceAxis(0, 0).ticks.length).toBeGreaterThan(1);
    expect(niceAxis(Number.NaN, 3).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('finds the extent of the recorded part of a buffer only', () => {
    expect(extent(new Float64Array([3, -1, 7, 99, 99]), 3)).toEqual([-1, 7]);
  });

  it('labels ticks without float noise', () => {
    expect(tickLabel(0.30000000000000004, 0.1)).toBe('0.3');
    expect(tickLabel(7.5, 2.5)).toBe('7.5');
    expect(tickLabel(10, 5)).toBe('10');
    expect(tickLabel(0.25, 0.05)).toBe('0.25');
    expect(tickLabel(-0, 1)).toBe('0');
  });

  it('maps linearly, with a flat input range not dividing by zero', () => {
    const x = scale(0, 10, 40, 340);
    expect(x(0)).toBe(40);
    expect(x(5)).toBe(190);
    expect(scale(2, 2, 0, 100)(2)).toBe(0);
  });
});
