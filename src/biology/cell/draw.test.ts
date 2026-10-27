import { beforeEach, describe, expect, it } from 'vitest';
import type { DrawContext } from '@/ui/canvas/useCanvas';
import { cellStructure } from '../modules';
import { FIGURES, drawCell, stack } from './draw';
import { CELL_KINDS, PARTS, partsFor } from './parts';
import { useCell } from './store';

/** A 2D context that accepts every call and records the label texts. */
function fakeContext() {
  const texts: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === 'fillText') return (s: string) => texts.push(s);
        if (key === 'measureText') return (s: string) => ({ width: s.length * 7 });
        return () => undefined;
      },
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  const d: DrawContext = { ctx, width: 900, height: 600, time: 0, css: () => '#000' };
  return { d, texts };
}

/** A 2D context that records the path calls with their (pixel) arguments. */
function recordingContext(width: number, height: number) {
  const calls: { name: string; args: number[] }[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === 'measureText') return (s: string) => ({ width: s.length * 7 });
        return (...args: unknown[]) => {
          calls.push({ name: String(key), args: args.filter((a) => typeof a === 'number') });
        };
      },
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  const d: DrawContext = { ctx, width, height, time: 0, css: () => '#000' };
  return { d, calls };
}

describe('Cell2D picture', () => {
  it('draws exactly the parts of each cell (labels name only real parts)', () => {
    for (const kind of CELL_KINDS)
      expect(Object.keys(FIGURES[kind].parts).sort()).toEqual([...partsFor(kind)].sort());
  });

  it('"Hiện tên" labels every part; otherwise only the selected one', () => {
    for (const kind of CELL_KINDS) {
      const names = Object.fromEntries(partsFor(kind).map((id) => [id, PARTS[id].name.vi]));
      const all = fakeContext();
      drawCell(all.d, kind, names, null, true);
      expect(all.texts.sort()).toEqual(Object.values(names).sort());
      const one = fakeContext();
      drawCell(one.d, kind, names, 'ribosome', false);
      expect(one.texts).toEqual(['Ribosome']);
    }
  });

  it('no name pointer runs through another part’s round organelle (UI-46)', () => {
    const crossings: string[] = [];
    for (const [width, height] of [
      [900, 600],
      [640, 460],
    ] as const)
      for (const kind of CELL_KINDS) {
        const names = Object.fromEntries(partsFor(kind).map((id) => [id, PARTS[id].name.vi]));
        const { d, calls } = recordingContext(width, height);
        drawCell(d, kind, names, null, true);
        // A pointer is moveTo(anchor), lineTo(label), stroke, then its 2.5 px anchor dot.
        const pointers: [number, number, number, number][] = [];
        const circles: [number, number, number][] = [];
        calls.forEach((c, i) => {
          if (c.name !== 'arc') return;
          const [x = 0, y = 0, r = 0, , end = 0] = c.args;
          const from = calls[i - 4];
          const to = calls[i - 3];
          if (r === 2.5 && from?.name === 'moveTo' && to?.name === 'lineTo') {
            const [ax = 0, ay = 0] = from.args;
            const [bx = 0, by = 0] = to.args;
            pointers.push([ax, ay, bx, by]);
          }
          // Round organelles: whole circles only (no ribosome dots, no ER arcs).
          else if (r > 6 && end === 2 * Math.PI) circles.push([x, y, r]);
        });
        expect(pointers.length).toBe(partsFor(kind).length);
        for (const [ax, ay, bx, by] of pointers)
          for (const [cx, cy, r] of circles) {
            if (Math.hypot(ax - cx, ay - cy) <= r) continue; // its own part
            const along =
              ((cx - ax) * (bx - ax) + (cy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2);
            const t = Math.max(0, Math.min(1, along));
            // A pointer that grazes the circle reads as pointing at it too: keep 2 px clear.
            if (Math.hypot(ax + t * (bx - ax) - cx, ay + t * (by - ay) - cy) < r + 2)
              crossings.push(
                `${kind} ${width}×${height}: (${ax.toFixed(0)}, ${ay.toFixed(0)}) → circle at (${cx.toFixed(0)}, ${cy.toFixed(0)})`,
              );
          }
      }
    expect(crossings).toEqual([]);
  });

  it('keeps labels at least one line apart inside the stage', () => {
    const ys = stack([100, 101, 102, 590, 595], 30, 560);
    for (let i = 1; i < ys.length; i++)
      expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeGreaterThanOrEqual(22);
    expect(Math.max(...ys)).toBeLessThanOrEqual(560);
    // A stage too short for the column: labels may crowd, but never leave [lo, hi].
    const tight = stack([10, 20, 30, 40, 50, 60], 30, 100);
    expect(Math.min(...tight)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...tight)).toBeLessThanOrEqual(100);
  });
});

describe('cellStructure module state', () => {
  beforeEach(() => {
    useCell.setState({ kind: 'animal', selected: null });
  });

  it('saves only the cell kind', () => {
    useCell.setState({ kind: 'plant', selected: 'chloroplast' });
    expect(cellStructure.state?.get()).toEqual({ kind: 'plant' });
  });

  it('restores a valid kind and ignores anything else from a file', () => {
    useCell.setState({ selected: 'nucleus' });
    cellStructure.state?.set({ kind: 'bacterium' });
    expect(useCell.getState()).toMatchObject({ kind: 'bacterium', selected: null });
    for (const bad of ['fungus', '', 'constructor', 3, null])
      cellStructure.state?.set({ kind: bad });
    expect(useCell.getState().kind).toBe('bacterium');
  });
});
