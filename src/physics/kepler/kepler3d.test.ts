import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { KE } from './engine';
import { slices, sliceAt, toWorld } from './kepler3d';
import { orbit, sectorArea, stateAt } from './model';
import { buildKeplerScene } from './scene3d';

function buffer(o: ReturnType<typeof orbit>, t: number) {
  const s = stateAt(o, t);
  const b = new Float64Array(7);
  b[KE.x] = s.x;
  b[KE.y] = s.y;
  return b;
}

describe('Kepler 3D', () => {
  it('N slices of equal area, each the model’s arc over T/N', () => {
    for (const p of [
      { e: 0.5, T: 12, N: 6 },
      { e: 0.9, T: 5, N: 8 },
      { e: 0, T: 3, N: 4 },
    ]) {
      const o = orbit(p);
      const sl = slices(o);
      expect(sl).toHaveLength(o.N);
      sl.forEach((pts, k) => {
        const first = pts[0];
        const s0 = stateAt(o, (k * o.T) / o.N);
        expect(first?.x).toBeCloseTo(s0.x, 12);
        expect(first?.y).toBeCloseTo(s0.y, 12);
      });
      const areas = sl.map((_, k) => sectorArea(o, (k * o.T) / o.N, ((k + 1) * o.T) / o.N, 400));
      for (const a of areas) expect(a).toBeCloseTo(areas[0] ?? 0, 6);
    }
  });

  it('the slice being swept, and again one period later', () => {
    const o = orbit({ e: 0.5, T: 12, N: 6 });
    expect(sliceAt(o, 0)).toBe(0);
    expect(sliceAt(o, 1.99)).toBe(0);
    expect(sliceAt(o, 2.01)).toBe(1);
    expect(sliceAt(o, 11.99)).toBe(5);
    expect(sliceAt(o, 12 + 5)).toBe(2);
  });

  it('the planet where the engine is; the highlight follows t; frees all', () => {
    const o = orbit({ e: 0.6, T: 10, N: 5 });
    const { kit, track, start } = testKit();
    let t = 0.5;
    const sc = buildKeplerScene(kit, { o, texts: { sun: 'Sun' }, read: () => buffer(o, t) });
    for (t of [0.5, 3.3, 7.9]) {
      sc.setTime?.(t);
      const m = stateAt(o, t);
      expect(sc.state().at).toEqual(toWorld(m.x, m.y));
      expect(sc.state().slice).toBe(sliceAt(o, t));
    }
    expectAllFreed(kit, track, start);
  });
});
