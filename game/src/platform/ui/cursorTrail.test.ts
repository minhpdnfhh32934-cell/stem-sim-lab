import { describe, expect, it } from 'vitest';
import { followChain } from './cursorTrail';

const chain = (n: number, x = 0) => [new Float64Array(n).fill(x), new Float64Array(n).fill(0)];

describe('cursor trail: each point follows the one ahead', () => {
  it('leads with the front point, the others further behind in order', () => {
    const [xs, ys] = chain(10);
    followChain(xs!, ys!, 100, 50, 1 / 60, 30);
    for (let i = 1; i < 10; i++) expect(xs![i]).toBeLessThan(xs![i - 1]!);
    expect(xs![0]).toBeGreaterThan(0);
    expect(xs![0]).toBeLessThan(100); // smoothed, never past the pointer
    expect(ys![0]! / 50).toBeCloseTo(xs![0]! / 100, 12); // straight towards it
  });

  it('closes on a still pointer at any frame rate', () => {
    for (const fps of [30, 60, 144]) {
      const [xs, ys] = chain(10);
      for (let frame = 0; frame < 2 * fps; frame++) followChain(xs!, ys!, 200, -80, 1 / fps, 30);
      for (let i = 0; i < 10; i++) {
        expect(Math.abs(xs![i]! - 200)).toBeLessThan(0.1);
        expect(Math.abs(ys![i]! + 80)).toBeLessThan(0.1);
      }
    }
  });

  it('does not move in a frame of no time, and says so', () => {
    const [xs, ys] = chain(4, 7);
    expect(followChain(xs!, ys!, 300, 300, 0, 30)).toBe(0);
    expect([...xs!, ...ys!]).toEqual([7, 7, 7, 7, 0, 0, 0, 0]);
  });

  it('pulls the tail along like a rope: no link longer than the gap, at any speed', () => {
    const [xs, ys] = chain(11);
    // A fast stroke: 2000 px/s to the right for a quarter of a second, then sharply down.
    for (let frame = 1; frame <= 30; frame++) {
      const [x, y] = frame <= 15 ? [frame * 33, 0] : [495, (frame - 15) * 33];
      followChain(xs!, ys!, x, y, 1 / 60, 26, 10);
      let [ax, ay] = [x, y];
      let length = 0;
      for (let i = 0; i < 11; i++) {
        const link = Math.hypot(xs![i]! - ax, ys![i]! - ay);
        expect(link).toBeLessThanOrEqual(10 + 1e-9);
        length += link;
        [ax, ay] = [xs![i]!, ys![i]!];
      }
      expect(length).toBeLessThanOrEqual(110 + 1e-9); // never a long string
    }
  });
});
