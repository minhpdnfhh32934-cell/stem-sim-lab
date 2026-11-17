import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { STRUCTURES, structureChange } from '../model';
import { structure3d } from './layout';
import { buildChromosomeScene } from './scene';

const linksOf = (s: (typeof STRUCTURES)[number], g: string) =>
  structure3d(s).links.filter((l) => l.gene === g).length;

describe('chromosome mutations 3D', () => {
  it('the beads are the book’s letters, before and after', () => {
    for (const s of STRUCTURES) {
      const d = structure3d(s);
      const { before, after } = structureChange(s);
      expect(d.top.map((b) => b.gene).join('')).toBe(before.join(''));
      expect(d.bottom.map((b) => b.gene).join('')).toBe(after.join(''));
    }
  });

  it('links: a deleted gene has none, a duplicated one two, an inversion crosses', () => {
    // Hình 12.1: abcdefg → abcg (def lost), abcdefdefg (def twice), abcfedg (def turned).
    for (const g of ['d', 'e', 'f']) expect(linksOf('deletion', g)).toBe(0);
    for (const g of ['d', 'e', 'f']) expect(linksOf('duplication', g)).toBe(2);
    const inv = structure3d('inversion').links;
    const d = inv.find((l) => l.gene === 'd');
    const f = inv.find((l) => l.gene === 'f');
    // d is left of f before and right of it after: their links cross.
    expect((d?.from[0] ?? 0) < (f?.from[0] ?? 0)).toBe(true);
    expect((d?.to[0] ?? 0) > (f?.to[0] ?? 0)).toBe(true);
  });

  it('a translocation links genes across chromosomes and marks them new, as the 2D does', () => {
    const d = structure3d('translocation');
    const moved = d.links.filter((l) => {
      const from = d.top.find((b) => b.at === l.from);
      const to = d.bottom.find((b) => b.at === l.to);
      return from?.chrom !== to?.chrom;
    });
    // 123defg + abc456: 1, 2, 3 and a, b, c changed chromosome, as in Hình 12.1.
    expect(moved.map((l) => l.gene).sort()).toEqual(['1', '2', '3', 'a', 'b', 'c']);
    expect(
      d.bottom
        .filter((b) => b.isNew)
        .map((b) => b.gene)
        .sort(),
    ).toEqual(['1', '2', '3', 'a', 'b', 'c']);
  });

  it('builds every mutation and frees everything', () => {
    for (const s of STRUCTURES) {
      const { kit, track, start } = testKit();
      const sc = buildChromosomeScene(kit, { structure: s, texts: { before: 'B', after: 'A' } });
      expect(sc.state().links).toBe(structure3d(s).links.length);
      expectAllFreed(kit, track, start);
    }
  });
});
