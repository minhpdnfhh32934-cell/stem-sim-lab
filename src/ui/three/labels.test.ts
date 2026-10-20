import { describe, expect, it } from 'vitest';
import {
  boxCovers,
  layoutLabels,
  leaderCrosses,
  overlaps,
  type LabelAnchor,
  type Rect,
} from './labels';

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

  it('two cells: a part keeps its label on its own cell side, clear of every chromosome', () => {
    // Meiosis II from the front, as on screen: a chromosome of the RIGHT cell near that cell's
    // left edge (left of the parts' mean x). Its label must not go over the left cell.
    const leftCell: Rect = { left: 265, top: 150, right: 385, bottom: 285 };
    const rightCell: Rect = { left: 415, top: 150, right: 550, bottom: 285 };
    const chromosomes: Rect[] = [
      { left: 300, top: 205, right: 312, bottom: 236 },
      { left: 340, top: 200, right: 352, bottom: 240 },
      { left: 450, top: 205, right: 462, bottom: 240 },
      { left: 500, top: 200, right: 512, bottom: 238 },
    ];
    const anchors = [
      { ...anchor('doubleChromosome', 456, 222), w: 116, h: 22 },
      { ...anchor('centromere', 506, 215), h: 22 },
      { ...anchor('spindle', 335, 245), w: 100, h: 22 },
      { ...anchor('centrosome', 480, 160), h: 22 },
      { ...anchor('membrane', 540, 200), w: 90, h: 22 },
    ];
    const safe = { left: 10, top: 60, right: 790, bottom: 340 };
    const placed = layoutLabels(anchors, safe, {
      avoid: chromosomes,
      regions: [leftCell, rightCell],
    });
    expect(placed.map((p) => p.id).sort()).toEqual(anchors.map((a) => a.id).sort());
    expect(placed.find((p) => p.id === 'doubleChromosome')?.side).toBe('right');
    const size = (id: string) => anchors.find((a) => a.id === id)!;
    for (const p of placed) {
      for (const r of chromosomes) expect(boxCovers(p, size(p.id), r), p.id).toBe(false);
      for (const cell of [leftCell, rightCell]) expect(leaderCrosses(p, cell), p.id).toBe(false);
      for (const q of placed) if (p !== q) expect(overlaps(p, q, size)).toBe(false);
    }
    // Without the cells and chromosomes, the old placement put that label over the left cell.
    const old = layoutLabels(anchors, safe).find((p) => p.id === 'doubleChromosome');
    expect(old?.side).toBe('left');
    expect(chromosomes.some((r) => boxCovers(old!, size('doubleChromosome'), r))).toBe(true);
  });

  it('a label never covers data: it moves outwards, else to the other column, else it is left out', () => {
    const data: Rect = { left: 150, top: 80, right: 290, bottom: 160 };
    const safe = { left: 0, top: 0, right: 600, bottom: 300 };
    // Left column edge would be at 300 − 28 − 80 = 192: inside the data. It moves left of it.
    const placed = layoutLabels(
      [anchor('a', 300, 120), anchor('b', 420, 120), anchor('c', 430, 200)],
      safe,
      { avoid: [data] },
    );
    const a = placed.find((p) => p.id === 'a');
    expect(a?.side).toBe('left');
    expect(a!.x + 80).toBeLessThanOrEqual(data.left);
    // No room on the left: it goes right instead.
    const tight = layoutLabels([anchor('a', 300, 120), anchor('b', 420, 120)], safe, {
      avoid: [{ ...data, left: 20 }],
    });
    expect(tight.find((p) => p.id === 'a')?.side).toBe('right');
    // Data on both sides and nowhere free: left out rather than drawn over the data.
    const none = layoutLabels([anchor('a', 300, 120)], safe, {
      avoid: [{ left: 0, top: 0, right: 600, bottom: 300 }],
    });
    expect(none).toEqual([]);
  });
});
