import { describe, expect, it } from 'vitest';
import { Camera } from '@/physics/render/camera';
import { CAPTION_ROWS, drawGrid } from '@/physics/render/draw';
import type { ThemeColors } from '@/physics/types';

/** y labels drawn by drawGrid: [x, sy] of every left-aligned fillText. */
function yLabels(labelLeft?: number) {
  const out: [number, number][] = [];
  let align = '';
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) =>
        k === 'fillText'
          ? (_s: string, x: number, y: number) => {
              if (align === 'left') out.push([x, y]);
            }
          : () => undefined,
      set: (_t, k, v) => {
        if (k === 'textAlign') align = String(v);
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  const cam = new Camera();
  cam.resize(800, 400);
  cam.fit({ xMin: -1, xMax: 10, yMin: -2, yMax: 5 });
  const colors = new Proxy({}, { get: () => '#000' }) as ThemeColors;
  drawGrid(ctx, cam, colors, 'en', 1, labelLeft);
  return out;
}

describe('y-axis numbers beside the tool palette (UI-02)', () => {
  it('start right of the palette, leaving the caption rows to the scene', () => {
    const moved = yLabels(56);
    expect(moved.length).toBeGreaterThan(2);
    for (const [x, sy] of moved) {
      expect(x).toBe(56);
      expect(sy).toBeGreaterThanOrEqual(CAPTION_ROWS);
    }
  });

  it('without a palette offset nothing changes (other callers)', () => {
    const plain = yLabels();
    expect(plain.every(([x]) => x === 4)).toBe(true);
    expect(plain.some(([, sy]) => sy < CAPTION_ROWS)).toBe(true);
  });
});
