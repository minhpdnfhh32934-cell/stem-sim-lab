import { describe, expect, it } from 'vitest';
import { cellDivisionModel as model, MEIOSIS, MITOSIS } from './cellDivision';

// The textbook counts: a human cell (2n = 46) after mitosis → 2 cells of 46, after meiosis → 4 of
// 23; 92 single chromosomes in mitotic anaphase; DNA 2C → 4C (S) → 2C, or → 1C after meiosis II.

function run(division: number, diploid: number) {
  const inputs = { division, diploid, stageTime: 0.5 };
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  const seen: number[][] = [];
  for (let i = 0; i < 10000 && !model.isComplete?.(state, inputs); i++) {
    model.step(state, 0.05, inputs);
    seen.push([...state]);
  }
  return { state, seen, inputs };
}

describe('cell division', () => {
  it('mitosis: two cells with 2n chromosomes and 2C each, 4n single chromosomes in anaphase', () => {
    const p = model.predict!({ division: 0, diploid: 46, stageTime: 0.5 });
    expect(p).toEqual({ cells: 2, chromosomes: 46, dna: 2, peakChromosomes: 92, identical: 1 });
    const { state, seen } = run(0, 46);
    expect([state[2], state[3], state[5]]).toEqual([2, 46, 2]);
    expect(Math.max(...seen.map((s) => s[5] ?? 0))).toBe(4); // DNA doubled in S
  });

  it('meiosis: four cells with n chromosomes and 1C each; never more than 2n chromosomes', () => {
    const p = model.predict!({ division: 1, diploid: 46, stageTime: 0.5 });
    expect(p).toEqual({ cells: 4, chromosomes: 23, dna: 1, peakChromosomes: 46, identical: 0 });
    const { state } = run(1, 46);
    expect([state[2], state[3], state[4], state[5]]).toEqual([4, 23, 23, 1]);
  });

  it('keeps the DNA in step with the chromatids: one chromatid is 1 C per n', () => {
    for (const s of [...MITOSIS, ...MEIOSIS]) {
      expect(s.chromatids, s.id).toBe(s.dna);
      expect(s.chromatids % s.chromosomes, s.id).toBe(0); // one or two chromatids each
    }
    // The total DNA over all cells is kept through each division, halved only between cells.
    expect((MITOSIS.at(-1)?.cells ?? 0) * (MITOSIS.at(-1)?.dna ?? 0)).toBe(4);
    expect((MEIOSIS.at(-1)?.cells ?? 0) * (MEIOSIS.at(-1)?.dna ?? 0)).toBe(4);
  });

  it('refuses an odd chromosome number', () => {
    expect(() => model.predict!({ division: 0, diploid: 7, stageTime: 0.5 })).toThrow(/even/);
  });
});
