import { describe, expect, it } from 'vitest';
import { countsOf, gameteSignature, runDivision } from './division';

/** Textbook table (SGK Sinh học 10), per cell, as functions of n. */
const MITOSIS: Record<string, (n: number) => [number, 'single' | 'double', number, number]> = {
  // [NST, state, chromatids, centromeres]
  g1: (n) => [2 * n, 'single', 0, 2 * n],
  g2: (n) => [2 * n, 'double', 4 * n, 2 * n],
  prophase: (n) => [2 * n, 'double', 4 * n, 2 * n],
  metaphase: (n) => [2 * n, 'double', 4 * n, 2 * n],
  anaphase: (n) => [4 * n, 'single', 0, 4 * n],
  telophase: (n) => [2 * n, 'single', 0, 2 * n],
};
const MEIOSIS: Record<string, (n: number) => [number, 'single' | 'double', number, number]> = {
  g1: (n) => [2 * n, 'single', 0, 2 * n],
  g2: (n) => [2 * n, 'double', 4 * n, 2 * n],
  prophase1: (n) => [2 * n, 'double', 4 * n, 2 * n],
  metaphase1: (n) => [2 * n, 'double', 4 * n, 2 * n],
  anaphase1: (n) => [2 * n, 'double', 4 * n, 2 * n],
  telophase1: (n) => [n, 'double', 2 * n, n],
  prophase2: (n) => [n, 'double', 2 * n, n],
  metaphase2: (n) => [n, 'double', 2 * n, n],
  anaphase2: (n) => [2 * n, 'single', 0, 2 * n],
  telophase2: (n) => [n, 'single', 0, n],
};

describe('cell division bookkeeping', () => {
  for (const n of [2, 4, 23]) {
    it(`mitosis with 2n = ${2 * n} matches the textbook table`, () => {
      for (const s of runDivision('mitosis', n)) {
        const c = countsOf(s);
        const [nst, state, cromatit, tamdong] = MITOSIS[s.stage]!(n);
        expect([c.chromosomes, c.state, c.chromatids, c.centromeres], s.stage).toEqual([
          nst,
          state,
          cromatit,
          tamdong,
        ]);
      }
    });
    it(`meiosis with 2n = ${2 * n} matches the textbook table`, () => {
      for (const s of runDivision('meiosis', n)) {
        const c = countsOf(s);
        const [nst, state, cromatit, tamdong] = MEIOSIS[s.stage]!(n);
        expect([c.chromosomes, c.state, c.chromatids, c.centromeres], s.stage).toEqual([
          nst,
          state,
          cromatit,
          tamdong,
        ]);
      }
    });
  }

  it('cell numbers: mitosis 1 → 2, meiosis 1 → 2 → 4', () => {
    const last = (k: 'mitosis' | 'meiosis') => runDivision(k, 3).at(-1)!.cells.length;
    expect(last('mitosis')).toBe(2);
    expect(last('meiosis')).toBe(4);
    const stages = runDivision('meiosis', 3).map((s) => s.stage);
    expect(stages.indexOf('telophase1')).toBeLessThan(stages.indexOf('prophase2'));
  });

  it('each gamete has exactly one chromosome of every pair', () => {
    const gametes = runDivision('meiosis', 4, { orientation: [true, false, true, false] }).at(
      -1,
    )!.cells;
    for (const g of gametes) expect(g.chromosomes.map((c) => c.pair).sort()).toEqual([0, 1, 2, 3]);
  });

  it('independent assortment: 2ⁿ gamete types over all orientations (no crossing over)', () => {
    const n = 3;
    const types = new Set<string>();
    for (let mask = 0; mask < 2 ** n; mask++) {
      const orientation = Array.from({ length: n }, (_, i) => Boolean(mask & (1 << i)));
      for (const g of runDivision('meiosis', n, { orientation }).at(-1)!.cells)
        types.add(gameteSignature(g));
    }
    expect(types.size).toBe(2 ** n);
  });

  it('crossing over makes 4 different gametes from one meiosis (one pair, n = 1)', () => {
    const plain = runDivision('meiosis', 1).at(-1)!.cells.map(gameteSignature);
    expect(new Set(plain).size).toBe(2);
    const xo = runDivision('meiosis', 1, { crossovers: [{ pair: 0, point: 0.6 }] })
      .at(-1)!
      .cells.map(gameteSignature);
    expect(new Set(xo).size).toBe(4);
    // Mitotic daughters are identical to each other.
    const m = runDivision('mitosis', 3).at(-1)!.cells.map(gameteSignature);
    expect(m[0]).toBe(m[1]);
  });
});
