import { describe, expect, it } from 'vitest';
import { layoutLabels, overlaps, type LabelAnchor } from './labels';

const anchor = (id: string, x: number, y: number, h = 20): LabelAnchor => ({
  id,
  x,
  y,
  visible: true,
  w: 80,
  h,
});

describe('layoutLabels', () => {
  it('a full column hands its least important labels to the other column before dropping any', () => {
    // Four tall labels on the left (they cannot all stack in 200 px), four short ones on the right.
    const left = [0, 1, 2, 3].map((i) => anchor(`L${String(i)}`, 250, 60 + 30 * i, 60));
    const right = [0, 1, 2, 3].map((i) => anchor(`R${String(i)}`, 350, 60 + 30 * i));
    const all = [...left, ...right];
    const safe = { left: 0, top: 0, right: 600, bottom: 200 };
    const placed = layoutLabels(all, safe);
    expect(placed.map((p) => p.id).sort()).toEqual(all.map((a) => a.id).sort());
    // The least important tall label (L3, last in priority among the left ones) moved right.
    expect(placed.find((p) => p.id === 'L3')?.side).toBe('right');
    const size = (id: string) => all.find((a) => a.id === id)!;
    for (const a of placed) {
      expect(a.y).toBeGreaterThanOrEqual(safe.top);
      expect(a.y + size(a.id).h).toBeLessThanOrEqual(safe.bottom);
      for (const b of placed) if (a !== b) expect(overlaps(a, b, size)).toBe(false);
    }
  });
});
