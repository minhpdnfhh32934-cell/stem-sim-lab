import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { FATHERS, MOTHERS, cross } from '../model';
import { cells } from './layout';
import { buildSexLinkedScene } from './scene';

const texts = { red: 'red', white: 'white', mother: '♀', father: '♂', quarter: '1/4' };

describe('sex-linked cross 3D', () => {
  it('the four cells add up to cross(), for every pair of parents', () => {
    for (const m of MOTHERS)
      for (const f of FATHERS) {
        const all = cells(m, f);
        expect(all).toHaveLength(4);
        const sum = new Map<string, number>();
        for (const c of all) {
          const k = `${c.sex}:${c.alleles}`;
          sum.set(k, (sum.get(k) ?? 0) + c.fraction);
        }
        for (const child of cross(m, f)) {
          expect(sum.get(`${child.sex}:${child.alleles}`)).toBeCloseTo(child.fraction, 12);
          expect(
            all.find((c) => c.alleles === child.alleles && c.sex === child.sex)?.dominant,
          ).toBe(child.dominant);
        }
      }
  });

  it('a son’s X is his mother’s; his Y carries no allele', () => {
    for (const m of MOTHERS)
      for (const f of FATHERS)
        for (const c of cells(m, f)) {
          expect(c.chroms[0]).toEqual({ kind: 'X', allele: c.egg, from: 'maternal' });
          if (c.sex === 'male')
            expect(c.chroms[1]).toEqual({ kind: 'Y', allele: null, from: 'paternal' });
          else expect(c.chroms[1]).toEqual({ kind: 'X', allele: f, from: 'paternal' });
        }
  });

  it('builds every cross and frees everything', () => {
    for (const m of MOTHERS)
      for (const f of FATHERS) {
        const { kit, track, start } = testKit();
        const sc = buildSexLinkedScene(kit, { mother: m, father: f, texts });
        expect(sc.state().cells).toHaveLength(4);
        expectAllFreed(kit, track, start);
      }
  });
});
