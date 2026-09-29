import { describe, expect, it } from 'vitest';
import { cross, parseGenotype, ratio, sampleOffspring, type Locus } from './mendel';
import {
  expectedHeterozygosity,
  hardyWeinberg,
  randomMating,
  testHardyWeinberg,
  wrightFisher,
} from './population';
import { chiSquare, chiSquarePValue, rng } from './stats';

const A: Locus = { letter: 'A', dominance: 'complete' };
const B: Locus = { letter: 'B', dominance: 'complete' };
const R: Locus = { letter: 'R', dominance: 'incomplete' };

const phen = (c: ReturnType<typeof cross>) =>
  ratio([...c.phenotypes.values()]).sort((a, b) => b - a);

describe('Mendel', () => {
  it('Aa × Aa: 1 AA : 2 Aa : 1 aa and 3 : 1 phenotypes', () => {
    const c = cross('Aa', 'Aa', [A]);
    expect(c.genotypes.get('AA')).toBe(0.25);
    expect(c.genotypes.get('Aa')).toBe(0.5);
    expect(c.genotypes.get('aa')).toBe(0.25);
    expect(phen(c)).toEqual([3, 1]);
    expect(c.punnett.cells).toEqual([
      ['AA', 'Aa'],
      ['Aa', 'aa'],
    ]);
  });
  it('test cross Aa × aa: 1 : 1', () => {
    expect(phen(cross('Aa', 'aa', [A]))).toEqual([1, 1]);
  });
  it('dihybrid AaBb × AaBb: 9 : 3 : 3 : 1', () => {
    const c = cross('AaBb', 'AaBb', [A, B]);
    expect(phen(c)).toEqual([9, 3, 3, 1]);
    expect(c.genotypes.size).toBe(9);
    expect(c.punnett.rows).toHaveLength(4);
  });
  it('incomplete dominance Rr × Rr: 1 : 2 : 1 phenotypes', () => {
    expect(phen(cross('Rr', 'Rr', [R]))).toEqual([2, 1, 1]);
  });
  it('rejects malformed genotypes', () => {
    expect(() => parseGenotype('Ab', [A])).toThrow();
    expect(() => parseGenotype('AaB', [A, B])).toThrow();
  });
  it('Monte Carlo agrees with 9 : 3 : 3 : 1 (χ² p > 0.001)', () => {
    const counts = sampleOffspring('AaBb', 'AaBb', [A, B], 16000, rng(42));
    const theory = cross('AaBb', 'AaBb', [A, B]).phenotypes;
    const keys = [...theory.keys()];
    const test = chiSquare(
      keys.map((k) => counts.get(k) ?? 0),
      keys.map((k) => (theory.get(k) ?? 0) * 16000),
    );
    expect(test.df).toBe(3);
    expect(test.p).toBeGreaterThan(0.001);
  });
});

describe('χ² distribution', () => {
  it('critical values at α = 0.05', () => {
    expect(chiSquarePValue(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(5.991, 2)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(7.815, 3)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(0, 2)).toBe(1);
  });
});

describe('population genetics', () => {
  it('Hardy–Weinberg frequencies sum to 1', () => {
    const f = hardyWeinberg(0.7);
    expect(f.AA + f.Aa + f.aa).toBeCloseTo(1, 12);
    expect(f.Aa).toBeCloseTo(0.42, 12);
  });
  it('χ² test from counts (textbook MN blood-group style example)', () => {
    const t = testHardyWeinberg(360, 480, 160);
    expect(t.p).toBeCloseTo(0.6, 12);
    expect(t.test.chi2).toBeCloseTo(0, 10); // exactly in equilibrium
    const off = testHardyWeinberg(500, 200, 300);
    expect(off.test.p).toBeLessThan(0.001);
  });
  it('one generation of random mating gives HW proportions', () => {
    const g = randomMating(20000, 0.3, rng(1));
    const t = testHardyWeinberg(g.AA, g.Aa, g.aa);
    expect(Math.abs(t.p - 0.3)).toBeLessThan(0.01);
    expect(t.test.p).toBeGreaterThan(0.001);
  });
  it('drift: fixation probability ≈ p₀ and heterozygosity decays as (1 − 1/2N)^t', () => {
    const rand = rng(7);
    const N = 20;
    const runs = 3000;
    let fixed = 0;
    let hSum = 0;
    const t = 20;
    for (let r = 0; r < runs; r++) {
      const traj = wrightFisher(N, 0.3, 400, rand);
      if (traj.at(-1) === 1) fixed++;
      const p = traj[t] ?? 0;
      hSum += 2 * p * (1 - p);
    }
    expect(Math.abs(fixed / runs - 0.3)).toBeLessThan(0.03);
    expect(Math.abs(hSum / runs - expectedHeterozygosity(0.42, N, t))).toBeLessThan(0.02);
  });
});
