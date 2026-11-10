import { describe, expect, it } from 'vitest';
import { equalScales, niceTicks, phaseBounds, splitAtWraps } from './phasePlot';

describe('phase chart helpers', () => {
  it('ticks at 1, 2 or 5 × 10ⁿ, without float noise', () => {
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(-0.05, 0.05, 4)).toEqual([-0.05, 0, 0.05]);
    expect(niceTicks(-7, 7, 4)).toEqual([-5, 0, 5]);
    expect(niceTicks(1, 1)).toEqual([]);
  });

  it('bounds with a margin; the phase circle keeps the origin inside', () => {
    const pts: [number, number][] = [
      [1, 2],
      [3, 4],
    ];
    const b = phaseBounds([pts], false);
    expect(b.xMin).toBeCloseTo(0.88, 12);
    expect(b.xMax).toBeCloseTo(3.12, 12);
    expect(b.yMin).toBeCloseTo(1.88, 12);
    expect(b.yMax).toBeCloseTo(4.12, 12);
    const o = phaseBounds([pts], true);
    expect(o.xMin).toBeLessThan(0);
    expect(o.yMin).toBeLessThan(0);
    expect(phaseBounds([], false).xMax).toBeCloseTo(1.12, 12);
  });

  it('equal scales widen one axis around its centre (a circle stays round)', () => {
    expect(equalScales({ xMin: -1, xMax: 1, yMin: -2, yMax: 2 }, 200, 100)).toEqual({
      xMin: -4,
      xMax: 4,
      yMin: -2,
      yMax: 2,
    });
  });

  it('a wrapped angle breaks the curve where it jumps across ±π', () => {
    const pts: [number, number][] = [
      [3.0, 1],
      [3.1, 1],
      [-3.1, 1],
      [-3.0, 1],
    ];
    expect(splitAtWraps(pts, 2 * Math.PI)).toEqual([pts.slice(0, 2), pts.slice(2)]);
    expect(splitAtWraps(pts, undefined)).toEqual([pts]);
  });
});
