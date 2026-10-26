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

  it('keeps labels at least one line apart inside the stage', () => {
    const ys = stack([100, 101, 102, 590, 595], 30, 560);
    for (let i = 1; i < ys.length; i++)
      expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeGreaterThanOrEqual(22);
    expect(Math.max(...ys)).toBeLessThanOrEqual(560);
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
