import { describe, expect, it } from 'vitest';
import type { DrawContext } from '@/ui/canvas/useCanvas';
import { BIOMOLECULES } from './biomolecules/data';
import { drawMolecule } from './biomolecules/draw2d';
import { drawPhases } from './microbes/drawPhases';
import { PHASES } from './microbes/phases';
import { drawVirus } from './virus/draw2d';
import { partsShown } from './virus/parts';

/** A 2D context that accepts every call and records the texts and arc centres drawn. */
function fakeContext(width = 900, height = 600) {
  const texts: string[] = [];
  const arcs: [number, number][] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === 'fillText') return (s: string) => texts.push(s);
        if (key === 'arc') return (x: number, y: number) => arcs.push([x, y]);
        if (key === 'measureText') return (s: string) => ({ width: s.length * 7 });
        return () => undefined;
      },
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  const d: DrawContext = { ctx, width, height, time: 0, css: () => '#000' };
  return { d, texts, arcs, width, height };
}

const inside = (arcs: [number, number][], w: number, h: number) =>
  arcs.every(([x, y]) => x >= 0 && x <= w && y >= 0 && y <= h);

describe('2D pictures (when the 3D view cannot be shown)', () => {
  it('a molecule: every atom on the canvas, element letters, and the part names asked for', () => {
    for (const m of BIOMOLECULES) {
      const names = Object.fromEntries(m.parts.map((p) => [p.id, `#${p.id}`]));
      const f = fakeContext();
      drawMolecule(f.d, m, names, m.parts[0]?.id ?? null);
      expect(f.arcs, m.id).toHaveLength(m.atoms.length);
      expect(inside(f.arcs, f.width, f.height), m.id).toBe(true);
      expect(f.texts).toEqual(expect.arrayContaining(m.parts.map((p) => `#${p.id}`)));
      expect(f.texts).toContain('C');
      expect(f.texts).not.toContain('H');
    }
  });

  it('the virus: names only of the parts it has, inside the canvas', () => {
    for (const enveloped of [true, false]) {
      const names = Object.fromEntries(partsShown(enveloped).map((p) => [p, `#${p}`]));
      const f = fakeContext();
      drawVirus(f.d, enveloped, names, 'capsomere');
      expect(f.texts.sort()).toEqual(
        partsShown(enveloped)
          .map((p) => `#${p}`)
          .sort(),
      );
      expect(inside(f.arcs, f.width, f.height)).toBe(true);
    }
  });

  it('the four phases: each name written once, plus the two axis titles', () => {
    const names = Object.fromEntries(PHASES.map((p) => [p, `#${p}`])) as Record<
      (typeof PHASES)[number],
      string
    >;
    const f = fakeContext();
    drawPhases(f.d, names, { x: 'x', y: 'y' }, 'lag');
    expect(f.texts.sort()).toEqual([...PHASES.map((p) => `#${p}`), 'x', 'y'].sort());
  });
});
