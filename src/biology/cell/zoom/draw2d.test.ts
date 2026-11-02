import { describe, expect, it } from 'vitest';
import type { DrawContext } from '@/ui/canvas/useCanvas';
import { RADIUS, TWIST } from '../../central/dogma3d/bdna';
import {
  ANCHOR_2D,
  CHROMATIN_2D,
  LOOP_STEPS,
  MITO_2D,
  MITO_AXES,
  NUCLEOLUS_2D,
  PORES_2D,
  PORE_R,
  drawZoom,
  helixX,
  loopPoint,
} from './draw2d';
import { CORE_RADIUS_NM, DRAWN, LEVELS, LEVEL_PARTS, SIZE, levelInfo } from './levels';

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

  it('every name points at the drawn part it names (review of PR #111)', () => {
    const at = (level: keyof typeof ANCHOR_2D, part: string): readonly [number, number] => {
      const a = (ANCHOR_2D[level] as Record<string, readonly [number, number]>)[part];
      if (!a) throw new Error(`${level}.${part} has no anchor`);
      return a;
    };
    // Mitochondrion: inside the first drawn ellipse (long axis along its angle).
    const [mx, my] = at('cell', 'mitochondrion');
    const m = MITO_2D[0] ?? { x: 0, y: 0, a: 0 };
    const u = (mx - m.x) * Math.cos(m.a) + (my - m.y) * Math.sin(m.a);
    const v = -(mx - m.x) * Math.sin(m.a) + (my - m.y) * Math.cos(m.a);
    expect((u / MITO_AXES[0]) ** 2 + (v / MITO_AXES[1]) ** 2).toBeLessThanOrEqual(1);
    // Pore: inside a drawn pore.
    const [px, py] = at('nucleus', 'pore');
    expect(Math.min(...PORES_2D.map(([x, y]) => Math.hypot(px - x, py - y)))).toBeLessThan(PORE_R);
    // Envelope: between the outer and the inner membrane.
    const re = Math.hypot(...at('nucleus', 'envelope'));
    expect(re).toBeLessThanOrEqual(SIZE.nucleusNm / 2);
    expect(re).toBeGreaterThan(SIZE.nucleusNm / 2 - 90);
    // Nucleolus: on its circle.
    const [nx, ny] = at('nucleus', 'nucleolus');
    expect(Math.hypot(nx - NUCLEOLUS_2D.x, ny - NUCLEOLUS_2D.y)).toBeCloseTo(NUCLEOLUS_2D.r, 9);
    // Chromatin: a vertex of a drawn thread.
    const [cx, cy] = at('nucleus', 'chromatin');
    expect(CHROMATIN_2D.flat().some(([x, y]) => x === cx && y === cy)).toBe(true);
    // Centromere: inside the right sister where the two touch (centre line x = width / 2).
    const [qx] = at('chromosome', 'centromere');
    expect(Math.abs(qx - SIZE.chromatidNm / 2)).toBeLessThan(SIZE.chromatidNm / 2);
    // Fibre: a vertex of a drawn loop.
    const [fx, fy] = at('fibre', 'fibre');
    const loops = Array.from({ length: DRAWN.loopsPerRing }, (_, k) =>
      ([-1, 1] as const).map((side) =>
        Array.from({ length: LOOP_STEPS + 1 }, (_, i) => loopPoint(k, side, i / LOOP_STEPS)),
      ),
    ).flat(2);
    expect(loops.some(([x, y]) => Math.hypot(x - fx, y - fy) < 1e-9)).toBe(true);
    // Wrapped DNA: on the ring between the core (3 nm) and the bead's edge (5 nm).
    const rw = Math.hypot(...at('nucleosome', 'wrappedDna'));
    expect(rw).toBeGreaterThan(CORE_RADIUS_NM);
    expect(rw).toBeLessThanOrEqual(SIZE.fibreNm / 2);
    // Strand: on the coding strand's curve; base pair: on a drawn rung half.
    const [bx, by] = at('dna', 'backbone');
    const t = (bx - helixX(0)) / (helixX(1) - helixX(0));
    expect(by).toBeCloseTo(RADIUS * Math.cos(t * TWIST), 9);
    const [rx, ry] = at('dna', 'basePair');
    const i = Math.round((rx - helixX(0)) / (helixX(1) - helixX(0)));
    expect(rx).toBeCloseTo(helixX(i), 9);
    expect(Math.abs(ry)).toBeLessThanOrEqual(Math.abs(RADIUS * Math.cos(i * TWIST)));
  });
});
