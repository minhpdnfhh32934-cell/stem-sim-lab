import { describe, expect, it } from 'vitest';
import { angle, MOLECULES, moleculeById } from '../data/molecules';
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

  it('a species linear in 3D is drawn in a straight line; a 3-atom one keeps its 3D angle', () => {
    // 2D angle at atom 1 of a triangle a–b–c, degrees.
    const angle2d = (p: readonly number[], q: readonly number[], r: readonly number[]) => {
      const u = [(p[0] ?? 0) - (q[0] ?? 0), (p[1] ?? 0) - (q[1] ?? 0)];
      const v = [(r[0] ?? 0) - (q[0] ?? 0), (r[1] ?? 0) - (q[1] ?? 0)];
      const cos =
        ((u[0] ?? 0) * (v[0] ?? 0) + (u[1] ?? 0) * (v[1] ?? 0)) /
        (Math.hypot(u[0] ?? 0, u[1] ?? 0) * Math.hypot(v[0] ?? 0, v[1] ?? 0));
      return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    };
    const linear: string[] = [];
    for (const m of MOLECULES) {
      if (m.atoms.length < 3) continue;
      // Linear in 3D: every bond angle is 180°.
      const angles = m.bonds.flatMap((b1, i) =>
        m.bonds.slice(i + 1).flatMap((b2) => {
          const mid = [b1.a, b1.b].find((x) => x === b2.a || x === b2.b);
          if (mid === undefined) return [];
          const ends = [b1.a, b1.b, b2.a, b2.b].filter((x) => x !== mid);
          return [{ a: ends[0] ?? 0, mid, c: ends[1] ?? 0 }];
        }),
      );
      const is3dLinear = angles.every((t) => angle(m, t.a, t.mid, t.c) > 179.5);
      for (const t of angles) {
        const xy = (k: number) => m.atoms[k]?.xy ?? [0, 0];
        const a2 = angle2d(xy(t.a), xy(t.mid), xy(t.c));
        if (is3dLinear) expect(a2, m.id).toBeGreaterThan(179.5);
        if (m.atoms.length === 3) expect(a2, m.id).toBeCloseTo(angle(m, t.a, t.mid, t.c), 0);
      }
      if (is3dLinear) linear.push(m.id);
    }
    expect(linear).toEqual(expect.arrayContaining(['becl2', 'co2', 'hcn', 'c2h2', 'xef2']));
    // The Lewis layout of BeCl₂ is a straight line too (no 120° bend).
    const becl2 = moleculeById('becl2');
    if (!becl2) throw new Error('becl2');
    const [p0, p1, p2] = lewisLayout(becl2).points;
    expect(p0 && p1 && p2 && Math.abs(p0.y - p1.y + (p2.y - p1.y))).toBeLessThan(0.5);
  });
});
