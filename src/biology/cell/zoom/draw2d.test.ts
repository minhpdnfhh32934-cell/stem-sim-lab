import { describe, expect, it } from 'vitest';
import type { DrawContext } from '@/ui/canvas/useCanvas';
import { drawZoom } from './draw2d';
import { LEVELS, LEVEL_PARTS, levelInfo } from './levels';

/** A 2D context that accepts every call and records the texts and the bar's line ends. */
function fakeContext(width = 900, height = 600) {
  const texts: string[] = [];
  const lines: number[][] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === 'fillText') return (s: string) => texts.push(s);
        if (key === 'lineTo') return (x: number, y: number) => lines.push([x, y]);
        if (key === 'measureText') return (s: string) => ({ width: s.length * 7 });
        return () => undefined;
      },
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  const d: DrawContext = { ctx, width, height, time: 0, css: () => '#000' };
  return { d, texts, lines };
}

describe('cell → DNA zoom, 2D pictures', () => {
  it.each(LEVELS.map((id, i) => [id, i] as const))(
    '%s: the scale bar is barNm at the picture’s scale, with its text and the names',
    (id, i) => {
      const { d, texts } = fakeContext();
      const names = Object.fromEntries(LEVEL_PARTS[id].map((p) => [p, `name:${p}`]));
      const out = drawZoom(d, i, names, 'BAR');
      expect(out.barPx).toBeCloseTo(levelInfo(i).barNm * out.pxPerNm, 9);
      // A readable bar: between a twentieth and half of the canvas width.
      expect(out.barPx).toBeGreaterThan(900 / 20);
      expect(out.barPx).toBeLessThan(900 / 2);
      expect(texts).toContain('BAR');
      for (const p of LEVEL_PARTS[id]) expect(texts).toContain(`name:${p}`);
    },
  );

  it('without names only the scale bar’s text is written', () => {
    const { d, texts } = fakeContext();
    drawZoom(d, 2, null, 'BAR');
    expect(texts).toEqual(['BAR']);
  });

  it('a narrow stage keeps the picture inside the canvas (fit by width)', () => {
    const { d } = fakeContext(400, 700);
    const out = drawZoom(d, 0, null, 'BAR');
    expect(out.pxPerNm * levelInfo(0).fieldNm).toBeLessThanOrEqual(400);
  });
});
