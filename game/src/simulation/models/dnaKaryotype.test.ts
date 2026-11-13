import { describe, expect, it } from 'vitest';
import { dnaExtractionModel, seenPercent } from './dnaExtraction';
import { chromosomesOf, KARYOTYPES, karyotypeModel, LENGTHS_MB } from './karyotype';

function run(model: typeof karyotypeModel, inputs: Record<string, number>) {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 100000 && !model.isComplete?.(state, inputs); i++)
    model.step(state, 0.02, inputs);
  return state;
}

describe('DNA extraction', () => {
  const all = { detergent: 1, salt: 1, protease: 1, ethanol: 1, stepTime: 1.5 };
  it('shows DNA only with cold ethanol, and less without each other step', () => {
    expect(seenPercent(all)).toBe(100);
    expect(seenPercent({ ...all, ethanol: 0 })).toBe(0);
    expect(seenPercent({ ...all, detergent: 0 })).toBeLessThan(seenPercent({ ...all, salt: 0 }));
    expect(run(dnaExtractionModel, all)[2]).toBeCloseTo(100, 9);
  });
});

describe('karyotype', () => {
  it('counts 46 in a normal cell, 47 in a trisomy, 45 in Turner syndrome', () => {
    const count = (i: number) => karyotypeModel.predict!({ karyotype: i, sortTime: 6 });
    expect(count(0)).toEqual({ chromosomes: 46, autosomes: 44, x: 2, y: 0 });
    expect(count(1)).toEqual({ chromosomes: 46, autosomes: 44, x: 1, y: 1 });
    expect(count(2).chromosomes).toBe(47);
    expect(chromosomesOf(KARYOTYPES[2]!).filter((c) => c === '21')).toHaveLength(3);
    expect(count(5)).toEqual({ chromosomes: 45, autosomes: 44, x: 1, y: 0 });
    expect(count(6)).toEqual({ chromosomes: 47, autosomes: 44, x: 2, y: 1 });
    for (let i = 0; i < KARYOTYPES.length; i++)
      expect(Number(KARYOTYPES[i]!.formula.split(',')[0]), KARYOTYPES[i]!.formula).toBe(
        count(i).chromosomes,
      );
  });

  it('ends the run with every chromosome counted', () => {
    const s = run(karyotypeModel, { karyotype: 2, sortTime: 6 });
    expect([s[2], s[3], s[4], s[5]]).toEqual([47, 45, 1, 1]); // 47,XY,+21
  });

  it('orders the reference lengths as the karyogram does, chromosome 1 longest', () => {
    expect(Math.max(...Object.values(LENGTHS_MB))).toBe(LENGTHS_MB['1']);
    expect(LENGTHS_MB['21']).toBeLessThan(LENGTHS_MB['22'] ?? 0); // 21 is the smallest autosome
  });
});
