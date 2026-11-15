import { describe, expect, it } from 'vitest';
import { moleculeById } from '../data/molecules';
import { COVALENT_MOLECULES } from './covalent';
import { lewisLayout, placeGroups } from './lewis';
import { OCTET_MOLECULES } from './octet';

const deg = (r: number) => Math.round((r * 180) / Math.PI);

describe('Lewis drawing layout (illustration)', () => {
  it('electron groups go away from the bonds and from each other', () => {
    // A terminal Cl bonded to the right: three pairs left, up and down.
    expect(
      placeGroups([0], 3)
        .map(deg)
        .sort((a, b) => a - b),
    ).toEqual([90, 180, 270]);
    // A free atom: four sides.
    expect(
      placeGroups([], 4)
        .map(deg)
        .sort((a, b) => a - b),
    ).toEqual([0, 90, 180, 270]);
  });

  it('every drawn species fits its box, bonds are not shorter than 72 px, groups match the count', () => {
    for (const id of new Set([...OCTET_MOLECULES, ...COVALENT_MOLECULES])) {
      const m = moleculeById(id);
      if (!m) throw new Error(id);
      const l = lewisLayout(m);
      for (const p of l.points) {
        expect(p.x, id).toBeGreaterThan(0);
        expect(p.y, id).toBeGreaterThan(0);
        expect(p.x, id).toBeLessThan(l.width);
        expect(p.y, id).toBeLessThan(l.height);
      }
      for (const b of m.bonds) {
        const p = l.points[b.a];
        const q = l.points[b.b];
        expect(p && q && Math.hypot(p.x - q.x, p.y - q.y), id).toBeGreaterThanOrEqual(71.9);
      }
      // Atoms never overlap in the drawing.
      l.points.forEach((p, i) => {
        l.points.forEach((q, j) => {
          if (i < j) expect(Math.hypot(p.x - q.x, p.y - q.y), id).toBeGreaterThan(40);
        });
      });
    }
    const no = moleculeById('no');
    if (!no) throw new Error('no');
    const n = lewisLayout(no).dots[0] ?? [];
    expect(n.map((g) => g.electrons).sort()).toEqual([1, 2]);
  });
});
