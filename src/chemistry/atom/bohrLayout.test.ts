import { describe, expect, it } from 'vitest';
import { bohrLayout } from './bohrLayout';

describe('bohrLayout (UI-33: the outer shell count stays below the chip row)', () => {
  it('starts the outer label at the chip row and keeps the picture inside the canvas', () => {
    for (const [w, h, top] of [
      [800, 470, 56],
      [600, 300, 96],
      [1000, 600, 56],
    ] as const) {
      const { cx, cy, rMax } = bohrLayout(w, h, top);
      // Count label: 8 px gap + 12 px text above the outer orbit.
      expect(cy - rMax - 20).toBeGreaterThanOrEqual(top);
      expect(cy + rMax).toBeLessThanOrEqual(h);
      expect(cx - rMax).toBeGreaterThanOrEqual(0);
    }
  });
});
