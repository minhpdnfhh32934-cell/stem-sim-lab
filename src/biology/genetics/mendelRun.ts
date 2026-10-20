/**
 * The Monte Carlo run of "Di truyền Mendel" (pure): one function for the 2D table and the 3D
 * offspring field, so both show the same counts for the same seed — `sampleOffspring(p1, p2,
 * loci, n, rng(seed))`, phenotypes in the sorted order of the exact cross, χ² against it.
 */
import { cross, sampleOffspring } from './mendel';
import { chiSquare, rng, type ChiSquare } from './stats';
import { lociOf, type MendelState } from './store';

export interface MendelDraw {
  /** Offspring drawn. */
  n: number;
  /** Seed of this draw (the store's, incremented by each "Tạo ngẫu nhiên"). */
  seed: number;
  /** Phenotype keys, sorted (the exact cross's classes). */
  keys: string[];
  /** Observed offspring of each phenotype. */
  obs: number[];
  /** Expected offspring of each phenotype: probability × n. */
  exp: number[];
  test: ChiSquare;
}

export type MendelRunInputs = Pick<
  MendelState,
  'ran' | 'seed' | 'n' | 'p1' | 'p2' | 'loci' | 'dominance'
>;

/** The lesson's random offspring now: null before the first draw or for an invalid genotype. */
export function mendelDraw(st: MendelRunInputs): MendelDraw | null {
  if (!st.ran) return null;
  const loci = lociOf(st);
  try {
    const theory = cross(st.p1, st.p2, loci).phenotypes;
    const keys = [...theory.keys()].sort();
    const counts = sampleOffspring(st.p1, st.p2, loci, st.n, rng(st.seed));
    const obs = keys.map((k) => counts.get(k) ?? 0);
    const exp = keys.map((k) => (theory.get(k) ?? 0) * st.n);
    return { n: st.n, seed: st.seed, keys, obs, exp, test: chiSquare(obs, exp) };
  } catch {
    return null;
  }
}
