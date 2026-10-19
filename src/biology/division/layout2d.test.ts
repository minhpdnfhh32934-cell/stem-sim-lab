import { describe, expect, it } from 'vitest';
import { rng } from '../genetics/stats';
import { scatterLayout } from './layout2d';

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const overlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe('2D chromosome slots (prophase, telophase)', () => {
  it('no two chromosomes overlap and each stays inside the cell, 2n = 1–8, several canvases', () => {
    const problems: string[] = [];
    // Half-sizes of the box inside the drawn cell, and the largest chromosome (w × h), in px.
    const cells: [number, number, number, number][] = [
      [190, 120, 30, 90],
      [110, 80, 30, 90],
      [60, 45, 20, 70],
      [300, 150, 40, 120],
    ];
    for (const [hw, hh, iw, ih] of cells) {
      for (let n = 1; n <= 8; n++) {
        for (const seed of [1, 2, 3]) {
          const lay = scatterLayout(n, 400, 250, hw, hh, iw, ih, rng(seed));
          expect(lay.slots).toHaveLength(n);
          expect(lay.fit).toBeGreaterThan(0);
          expect(lay.fit).toBeLessThanOrEqual(1);
          const boxes = lay.slots.map((p): Box => ({
            x0: p.x - (iw * lay.fit) / 2,
            x1: p.x + (iw * lay.fit) / 2,
            y0: p.y - (ih * lay.fit) / 2,
            y1: p.y + (ih * lay.fit) / 2,
          }));
          const at = `${String(hw)}×${String(hh)} n=${String(n)} seed=${String(seed)}`;
          boxes.forEach((b, i) => {
            if (b.x0 < 400 - hw - 1e-9 || b.x1 > 400 + hw + 1e-9) problems.push(`${at}: x out`);
            if (b.y0 < 250 - hh - 1e-9 || b.y1 > 250 + hh + 1e-9) problems.push(`${at}: y out`);
            for (let j = 0; j < i; j++) {
              const other = boxes[j];
              if (other && overlap(b, other))
                problems.push(`${at}: ${String(i)} overlaps ${String(j)}`);
            }
          });
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('is deterministic for a seed (the picture does not jump between redraws)', () => {
    const a = scatterLayout(6, 0, 0, 100, 60, 20, 50, rng(4));
    const b = scatterLayout(6, 0, 0, 100, 60, 20, 50, rng(4));
    expect(a).toEqual(b);
  });
});
