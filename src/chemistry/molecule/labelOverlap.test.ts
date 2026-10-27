import { describe, expect, it } from 'vitest';
import { visibleLabels } from './labelOverlap';

describe('visibleLabels (UI-38: atom labels never cover each other)', () => {
  it('hides the farther of two touching labels and keeps labels that are apart', () => {
    const c = { x: 703, y: 316, w: 12, h: 14, z: 0.4 };
    const h = { x: 714, y: 320, w: 12, h: 14, z: 0.6 };
    const far = { x: 600, y: 260, w: 12, h: 14, z: 0.5 };
    expect(visibleLabels([c, h, far])).toEqual([true, false, true]);
    // Order does not matter: the nearer one wins.
    expect(visibleLabels([h, c])).toEqual([false, true]);
    // Not touching but 5 px apart (ethanol's second carbon in the audit): still reads "CH".
    const h5 = { x: 722, y: 323, w: 14, h: 14, z: 0.6 };
    expect(visibleLabels([{ ...c, w: 13 }, h5])).toEqual([true, false]);
    // Hidden atoms (null) are never shown.
    expect(visibleLabels([null, c])).toEqual([false, true]);
  });
});
