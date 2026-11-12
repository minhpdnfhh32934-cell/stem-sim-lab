import { describe, expect, it } from 'vitest';
import { namedTicks } from './edgeTicks';

describe('named ticks on a bench scrubber (#205 B8: measured)', () => {
  it('names a mark only where its name has room; close marks keep only the first name', () => {
    // Names 60 px wide on a 400 px track: the second (at 40) would overlap the first (0…60).
    expect(namedTicks([0, 40, 70, 200, 300], [60, 60, 60, 60, 60], 400)).toEqual([
      true,
      false,
      true,
      true,
      true,
    ]);
    // The gap counts: a name starting 4 px after the previous end waits for the next mark.
    expect(namedTicks([0, 64, 140], [60, 60, 60], 400)).toEqual([true, false, true]);
  });

  it('a name that would run past the track end, or that is not laid out yet, stays hidden', () => {
    expect(namedTicks([0, 350], [60, 60], 400)).toEqual([true, false]);
    // Not measured (no layout): nothing named rather than names on top of each other.
    expect(namedTicks([0, 100], [0, 0], 0)).toEqual([false, false]);
    expect(namedTicks([], [], 400)).toEqual([]);
  });

  it('a larger font (wider names) names fewer marks on the same track', () => {
    const left = [0, 70, 140, 210, 280];
    const at100 = namedTicks(left, [60, 60, 60, 60, 60], 400).filter(Boolean).length;
    const at140 = namedTicks(left, [84, 84, 84, 84, 84], 400).filter(Boolean).length;
    expect(at100).toBe(5);
    expect(at140).toBeLessThan(at100);
  });
});
