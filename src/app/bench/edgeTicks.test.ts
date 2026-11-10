import { describe, expect, it } from 'vitest';
import { namedTicks } from './edgeTicks';

describe('named ticks on a bench scrubber', () => {
  it('names a mark only where its name has room; close marks keep only the first name', () => {
    expect(namedTicks([0, 3, 6, 30, 55, 80])).toEqual([true, false, false, true, true, true]);
    // The last one needs half its room before the track's end.
    expect(namedTicks([0, 50, 97])).toEqual([true, true, false]);
    expect(namedTicks([])).toEqual([]);
  });
});
