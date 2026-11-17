import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { BOOK_CELLS_WITH_CROSSOVER, frequencyFromCells, gameteShares } from '../model';
import { COLUMN_MAX, chromatids, columns, gameteOrigin } from './layout';
import { buildLinkageScene } from './scene';

const texts = { percent: (x: number) => `${String(x * 100)} %`, crossover: 'x' };

describe('linkage 3D', () => {
  it('column heights are the model’s gamete shares (complete linkage: no recombinants)', () => {
    for (const f of [0, frequencyFromCells(BOOK_CELLS_WITH_CROSSOVER), 0.5]) {
      const s = gameteShares(f);
      for (const c of columns(f)) expect(c.height).toBeCloseTo(s[c.gamete] * COLUMN_MAX, 12);
      expect(columns(f).reduce((t, c) => t + c.share, 0)).toBeCloseTo(1, 12);
    }
    const none = columns(0);
    expect(none.find((c) => c.gamete === 'Bv')?.height).toBe(0);
    expect(none.find((c) => c.gamete === 'bV')?.height).toBe(0);
  });

  it('the book’s 34 % of cells: 17 % recombinant gametes, 8,5 % each (Hình 11.3)', () => {
    const f = frequencyFromCells(BOOK_CELLS_WITH_CROSSOVER);
    const cols = columns(f);
    expect(cols.find((c) => c.gamete === 'Bv')?.share).toBeCloseTo(0.085, 12);
    expect(cols.find((c) => c.gamete === 'BV')?.share).toBeCloseTo(0.415, 12);
  });

  it('a crossover swaps the lower parts of the two inner, non-sister chromatids only', () => {
    const without = chromatids(0);
    expect(without.map((c) => c.top === c.bottom)).toEqual([true, true, true, true]);
    const withCo = chromatids(0.17);
    expect(withCo.map((c) => `${c.top}/${c.bottom}`)).toEqual([
      'maternal/maternal',
      'maternal/paternal',
      'paternal/maternal',
      'paternal/paternal',
    ]);
    // The recombinant chromatids are the two recombinant gametes' origins.
    expect(gameteOrigin('Bv')).toEqual({ top: 'maternal', bottom: 'paternal' });
    expect(gameteOrigin('bV')).toEqual({ top: 'paternal', bottom: 'maternal' });
  });

  it('builds with and without crossing over, and frees everything', () => {
    for (const f of [0, 0.17]) {
      const { kit, track, start } = testKit();
      const sc = buildLinkageScene(kit, { f, texts });
      expect(sc.state().crossover).toBe(f > 0);
      expect(kit.scene.getObjectByName('linkage-crossover') !== undefined).toBe(f > 0);
      expectAllFreed(kit, track, start);
    }
  });
});
