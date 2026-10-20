import { describe, expect, it } from 'vitest';
import { analyzeMutation, mutate, mutatedTranslation, type Mutation } from '../dogma';
import {
  beadNames,
  changedBeads,
  changedCodons,
  codonSpan,
  mutationModel3d,
  proteinText,
  windowFor,
} from './binding';

/** The lesson's default gene: ATG GCT TTC AAA GGC TGG TAA after "TAC". */
const CODING = 'TACATGGCTTTCAAAGGCTGGTAAGC';

const sub = (pos: number, base: string): Mutation => ({ kind: 'substitution', pos, base });
const ins = (pos: number, bases: string): Mutation => ({ kind: 'insertion', pos, bases });
const del = (pos: number, count: number): Mutation => ({ kind: 'deletion', pos, count });

describe('3D point-mutation model', () => {
  it('the outline is at the mutation: 1 pair, the inserted pairs, or the deleted pairs', () => {
    expect(mutationModel3d(CODING, sub(12, 'T')).marks).toEqual([{ helix: 'mutated', index: 12 }]);
    expect(mutationModel3d(CODING, ins(9, 'GC')).marks).toEqual([
      { helix: 'mutated', index: 9 },
      { helix: 'mutated', index: 10 },
    ]);
    expect(mutationModel3d(CODING, del(9, 3)).marks).toEqual([
      { helix: 'normal', index: 9 },
      { helix: 'normal', index: 10 },
      { helix: 'normal', index: 11 },
    ]);
    for (const m of [sub(4, 'C'), ins(7, 'ATGCA'), del(20, 2), ins(0, 'G'), del(0, 1)]) {
      const model = mutationModel3d(CODING, m);
      const n = m.kind === 'substitution' ? 1 : m.kind === 'insertion' ? m.bases.length : m.count;
      expect(model.marks, JSON.stringify(m)).toHaveLength(n);
      expect(model.marks[0]?.index).toBe(m.pos);
    }
  });

  it('the mutated helix is mutate(); its translation is mutatedTranslation()', () => {
    for (const m of [sub(12, 'T'), sub(8, 'C'), ins(9, 'G'), ins(9, 'GCA'), del(9, 1), del(3, 3)]) {
      const model = mutationModel3d(CODING, m);
      expect(model.normal.coding).toBe(CODING);
      expect(model.mutated.coding).toBe(mutate(CODING, m));
      const mt = mutatedTranslation(CODING, m);
      expect(model.mutated.mrna).toBe(mt.mrna);
      expect(model.mutated.t).toEqual(mt.t);
      const a = analyzeMutation(CODING, m);
      expect(model.effect).toBe(a.effect);
      expect(model.firstChange).toBe(a.firstChange);
    }
  });

  it('unchanged base pairs keep their slot; inserted bases bulge between neighbours; deletions leave a gap', () => {
    const i = mutationModel3d(CODING, ins(9, 'GC'));
    expect(Array.from(i.mutated.slot.slice(0, 9))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(i.mutated.slot[9]).toBeCloseTo(8 + 1 / 3);
    expect(i.mutated.slot[10]).toBeCloseTo(8 + 2 / 3);
    expect(Array.from(i.mutated.slot.slice(11))).toEqual(
      Array.from({ length: CODING.length - 9 }, (_, k) => 9 + k),
    );
    expect(i.bulge).toEqual({ from: 9, to: 11 });
    const d = mutationModel3d(CODING, del(9, 2));
    expect(d.gap).toEqual({ from: 9, to: 11 });
    expect(d.mutated.slot[8]).toBe(8);
    expect(d.mutated.slot[9]).toBe(11);
    // Every unchanged base sits under the same base of the normal DNA.
    for (let j = 0; j < d.mutated.coding.length; j++)
      expect(d.mutated.coding[j]).toBe(CODING[d.mutated.slot[j] ?? -1]);
  });

  it('the changed-codon highlight starts at the first changed amino acid', () => {
    for (const m of [sub(12, 'T'), sub(6, 'A'), ins(9, 'G'), del(9, 1), del(9, 3)]) {
      const model = mutationModel3d(CODING, m);
      const hot = changedCodons(model);
      if (model.firstChange < 0) expect(hot).toEqual([]);
      else {
        // 2D rule: from firstChange on, stop codons excepted.
        expect(hot[0] ?? model.firstChange).toBe(model.firstChange);
        expect(hot.every((c) => c >= model.firstChange)).toBe(true);
        expect(hot.some((c) => model.mutated.t.codons[c]?.entry?.stop)).toBe(false);
      }
    }
  });

  it('silent: identical chains, nothing highlighted', () => {
    // GCT → GCC (Ala → Ala).
    const model = mutationModel3d(CODING, sub(8, 'C'));
    expect(model.effect).toBe('silent');
    expect(beadNames(model.mutated.t)).toEqual(beadNames(model.normal.t));
    expect(changedBeads(model, 'normal')).toEqual([]);
    expect(changedBeads(model, 'mutated')).toEqual([]);
    expect(changedCodons(model)).toEqual([]);
  });

  it('nonsense: the mutated chain is as long as the mutated translation; the lost tail is marked', () => {
    // AAA → TAA at position 13: the lesson's default.
    const model = mutationModel3d(CODING, sub(12, 'T'));
    expect(model.effect).toBe('nonsense');
    expect(beadNames(model.mutated.t)).toHaveLength(model.mutated.t.protein.length);
    expect(proteinText(model.mutated.t)).toBe('Met–Ala–Phe');
    expect(proteinText(model.normal.t)).toBe('Met–Ala–Phe–Lys–Gly–Trp');
    expect(changedBeads(model, 'normal')).toEqual([3, 4, 5]);
    expect(changedBeads(model, 'mutated')).toEqual([]);
  });

  it('frameshift: brackets after the first change sit elsewhere than the normal ones', () => {
    for (const m of [del(9, 1), ins(9, 'G'), ins(10, 'AT')]) {
      const model = mutationModel3d(CODING, m);
      expect(model.effect).toBe('frameshift');
      const f = model.firstChange;
      for (let c = 0; c < f; c++)
        expect(codonSpan(model, 'mutated', c)).toEqual(codonSpan(model, 'normal', c));
      const after = model.mutated.t.codons.filter((c) => c.index >= f).map((c) => c.index);
      expect(after.length).toBeGreaterThan(0);
      for (const c of after) {
        const a = codonSpan(model, 'mutated', c);
        const b = codonSpan(model, 'normal', c);
        expect(a, `codon ${String(c)}`).not.toEqual(b);
      }
    }
    // In frame: brackets after the indel line up again with the normal ones.
    const inFrame = mutationModel3d(CODING, del(9, 3));
    expect(inFrame.effect).toBe('inFrameIndel');
    expect(codonSpan(inFrame, 'mutated', 3)).toEqual(codonSpan(inFrame, 'normal', 4));
  });

  it('a long sequence draws a window around the site', () => {
    expect(windowFor(26, 12, 600)).toEqual({ from: 0, to: 26 });
    const w = windowFor(3000, 1500, 600);
    expect(w.to - w.from).toBe(600);
    expect(w.from).toBeLessThanOrEqual(1500);
    expect(w.to).toBeGreaterThan(1500);
    expect(windowFor(3000, 2990, 600)).toEqual({ from: 2400, to: 3000 });
  });
});
