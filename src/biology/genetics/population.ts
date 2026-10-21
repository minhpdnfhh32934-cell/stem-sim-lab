import { binomial, chiSquare, type ChiSquare } from './stats';

/** Hardy–Weinberg genotype frequencies from the allele frequency p (q = 1 − p). */
export function hardyWeinberg(p: number): { AA: number; Aa: number; aa: number } {
  const q = 1 - p;
  return { AA: p * p, Aa: 2 * p * q, aa: q * q };
}

/** Allele frequency and HW χ² test from observed genotype counts (df = 1). */
export function testHardyWeinberg(
  AA: number,
  Aa: number,
  aa: number,
): {
  n: number;
  p: number;
  q: number;
  expected: [number, number, number];
  test: ChiSquare;
} {
  const n = AA + Aa + aa;
  const p = n ? (2 * AA + Aa) / (2 * n) : 0;
  const hw = hardyWeinberg(p);
  const expected: [number, number, number] = [hw.AA * n, hw.Aa * n, hw.aa * n];
  // One parameter (p) is estimated from the data: df = 3 − 1 − 1 = 1.
  return { n, p, q: 1 - p, expected, test: chiSquare([AA, Aa, aa], expected, 1) };
}

/** One generation of random mating in a population of N diploids with allele frequency p. */
export function randomMating(
  N: number,
  p: number,
  rand: () => number,
): { AA: number; Aa: number; aa: number } {
  let AA = 0;
  let Aa = 0;
  let aa = 0;
  for (let i = 0; i < N; i++) {
    const a = rand() < p;
    const b = rand() < p;
    if (a && b) AA++;
    else if (a || b) Aa++;
    else aa++;
  }
  return { AA, Aa, aa };
}

export interface GenotypeCounts {
  AA: number;
  Aa: number;
  aa: number;
}

/**
 * Several generations of random mating from one stream of random numbers: generation 0 is
 * `start` (the observed counts), generation g + 1 is `randomMating(N, p_g, rand)` with p_g the
 * allele frequency of generation g, (2·AA + Aa) / 2n. Without selection, mutation or migration,
 * p only changes by sampling error in a population of N. With `rand = rng(seed)`, generation 1
 * is the same draw as the lesson's "Cho ngẫu phối 1 thế hệ" with that seed. An empty population
 * (n = 0) has no gene pool to draw from and stays empty in every later generation.
 */
export function matingRun(
  start: GenotypeCounts,
  N: number,
  generations: number,
  rand: () => number,
): GenotypeCounts[] {
  const out: GenotypeCounts[] = [{ AA: start.AA, Aa: start.Aa, aa: start.aa }];
  let prev: GenotypeCounts = { ...start };
  for (let g = 0; g < generations; g++) {
    const t = testHardyWeinberg(prev.AA, prev.Aa, prev.aa);
    // No individuals, no gene pool: nobody mates, so an empty population stays empty (its p = 0
    // is only a guard against 0 / 0, not an allele frequency to breed from).
    const next = t.n > 0 ? randomMating(N, t.p, rand) : { AA: 0, Aa: 0, aa: 0 };
    out.push(next);
    prev = next;
  }
  return out;
}

/**
 * Wright–Fisher genetic drift: each generation draws 2N gene copies binomially from the
 * current allele frequency. Returns the frequency trajectory (length generations + 1).
 */
export function wrightFisher(
  N: number,
  p0: number,
  generations: number,
  rand: () => number,
): number[] {
  const traj = [p0];
  let p = p0;
  for (let t = 0; t < generations; t++) {
    if (p > 0 && p < 1) p = binomial(2 * N, p, rand) / (2 * N);
    traj.push(p);
  }
  return traj;
}

/** Expected heterozygosity after t generations of drift: H₀·(1 − 1/2N)^t. */
export const expectedHeterozygosity = (h0: number, N: number, t: number) =>
  h0 * (1 - 1 / (2 * N)) ** t;
