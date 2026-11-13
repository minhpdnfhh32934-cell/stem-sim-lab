import { describe, expect, it } from 'vitest';
import { expectedHeterozygosity, populationGeneticsModel as model } from './populationGenetics';

function run(population: number, generations: number, seed: number, startFrequency = 0.5) {
  const inputs = { population, startFrequency, generations, seed, stepTime: 0.1 };
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 100000 && !model.isComplete?.(state, inputs); i++)
    model.step(state, 0.05, inputs);
  return state;
}

describe('population genetics', () => {
  it('repeats a run exactly from its seed, and differs from another seed', () => {
    expect([...run(50, 30, 7)]).toEqual([...run(50, 30, 7)]);
    expect(run(50, 30, 7)[2]).not.toBe(run(50, 30, 8)[2]);
  });

  it('keeps a large population near Hardy–Weinberg: p ≈ p₀, Aa ≈ 2pq', () => {
    const s = run(5000, 10, 3, 0.3);
    const p = s[2] ?? NaN;
    expect(Math.abs(p - 0.3)).toBeLessThan(0.03);
    expect(Math.abs((s[4] ?? NaN) - 2 * p * (1 - p))).toBeLessThan(0.03);
    expect((s[3] ?? 0) + (s[4] ?? 0) + (s[5] ?? 0)).toBeCloseTo(1, 12);
  });

  it('loses heterozygosity by drift as 2p₀q₀(1 − 1/2N)^t on average', () => {
    const N = 20;
    const T = 40;
    let mean = 0;
    const runs = 300;
    for (let seed = 1; seed <= runs; seed++) {
      const p = run(N, T, seed)[2] ?? NaN;
      mean += (2 * p * (1 - p)) / runs; // the gene pool's heterozygosity after the last breeding
    }
    // 2pq of the gene pool after T + 1 samplings (the first population is drawn too), less the
    // within-sample correction (1 − 1/2N): E[2pq] = H₀(1 − 1/2N)^(T+1).
    const expected = expectedHeterozygosity(0.5, N, T + 1);
    expect(Math.abs(mean - expected)).toBeLessThan(0.03);
  });

  it('fixes or loses an allele in a tiny population, never in a big one over the same time', () => {
    const small = Array.from({ length: 20 }, (_, i) => run(5, 60, i + 1)[2] ?? NaN);
    expect(small.filter((p) => p === 0 || p === 1).length).toBeGreaterThan(15);
    const big = Array.from({ length: 5 }, (_, i) => run(2000, 60, i + 1)[2] ?? NaN);
    expect(big.every((p) => p > 0.3 && p < 0.7)).toBe(true);
  });
});
