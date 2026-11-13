import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const ELAPSED = 0;
const COUNTED = 1;
/** The four phenotype counts, in class order: yellow round, yellow wrinkled, green round, green wrinkled. */
const CLASSES = 2;
const YELLOW = 6;
const ROUND = 7;
const YELLOW_PROPORTION = 8;
const ROUND_PROPORTION = 9;
const CHI_SQUARE = 10;
const DEGREES_OF_FREEDOM = 11;
const P_VALUE = 12;
const SMALLEST_EXPECTED = 13;
const LAST_GENOTYPE = 14;

/** A genotype code, 10·(dominant Y alleles) + (dominant R alleles): YYRR 22, YyRr 11, yyrr 0. */
const isGenotype = (code: number) =>
  Number.isInteger(code) && code >= 0 && code <= 22 && code % 10 <= 2;
const GENOTYPE_RULE =
  'a genotype code 10·(Y alleles) + (R alleles): 0, 1, 2, 10, 11, 12, 20, 21 or 22';
const yAlleles = (code: number) => Math.floor(code / 10);
const rAlleles = (code: number) => code % 10;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['parent1', isGenotype, GENOTYPE_RULE],
  ['parent2', isGenotype, GENOTYPE_RULE],
  ['offspring', (n) => Number.isInteger(n) && n >= 1 && n <= 1e6, 'a whole number from 1 to 1e6'],
  [
    'sample',
    (s) => Number.isInteger(s) && s >= 0 && s <= 0xffffffff,
    'a whole number from 0 to 4294967295',
  ],
  ['countTime', (t) => t > 0 && t <= 1e4, 'above 0 and at most 1e4 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Genetics input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Genetics input "${id}" must be ${rule}, got ${value}`);
  }
}

/**
 * P(yellow) of an offspring: 1 − P(both gametes carry y). A parent passes Y with probability
 * (its Y alleles)/2: 1, ½ or 0 (Mendel's first law, segregation). Exact: multiples of ¼.
 */
const yellowProbability = (inputs: Inputs) =>
  1 - (1 - yAlleles(inputs.parent1 ?? NaN) / 2) * (1 - yAlleles(inputs.parent2 ?? NaN) / 2);
const roundProbability = (inputs: Inputs) =>
  1 - (1 - rAlleles(inputs.parent1 ?? NaN) / 2) * (1 - rAlleles(inputs.parent2 ?? NaN) / 2);

/**
 * P of phenotype class i (0 yellow round, 1 yellow wrinkled, 2 green round, 3 green wrinkled):
 * the two genes assort independently (second law), so the product. Exact: multiples of 1/16.
 */
const classProbability = (i: number, yellow: number, round: number) =>
  (i < 2 ? yellow : 1 - yellow) * (i % 2 === 0 ? round : 1 - round);

/** lowbias32 (C. Wellons, "Prospecting for hash functions", 2018): a bijective 32-bit mixer. */
function mix32(x: number): number {
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/**
 * The 32 random bits of seed k (from 1) of a sample: the k-th output of a SplitMix-style
 * counter generator, mix(key + k·0x9E3779B9) with key = mix(sample). Seed k is the same whatever
 * N, the step or the frame rate, so a sample is reproducible from (parents, sample) alone.
 */
export function seedBits(sample: number, k: number): number {
  return mix32((mix32(sample) + Math.imul(k, 0x9e3779b9)) | 0);
}

/** The allele a parent passes for one gene: dominant always (2), never (0), or on a fair bit (1). */
const passes = (dominant: number, bit: number) => (dominant === 2 ? 1 : dominant === 0 ? 0 : bit);

/**
 * The genotype code of an offspring of two parents (codes) from 4 fair bits: bit 0 picks
 * parent 1's Y-gene allele, bit 1 its R-gene allele, bits 2 and 3 parent 2's. The 16 bit patterns
 * are the 16 equally likely cells of the dihybrid Punnett square.
 */
export function offspringGenotype(parent1: number, parent2: number, bits: number): number {
  const y = passes(yAlleles(parent1), bits & 1) + passes(yAlleles(parent2), (bits >>> 2) & 1);
  const r =
    passes(rAlleles(parent1), (bits >>> 1) & 1) + passes(rAlleles(parent2), (bits >>> 3) & 1);
  return 10 * y + r;
}

/** The coefficients of `erfc`, constant term first. */
const ERFC = [
  -1.26551223, 1.00002368, 0.37409196, 0.09678418, -0.18628806, 0.27886807, -1.13520398, 1.48851587,
  -0.82215223, 0.17087277,
];

/**
 * erfc(z) for z ≥ 0, fractional error below 1.2e-7 everywhere (Press et al., Numerical Recipes in
 * C, 2nd ed., §6.2, `erfcc`).
 */
function erfc(z: number): number {
  const t = 1 / (1 + 0.5 * z);
  let poly = 0;
  for (let i = ERFC.length - 1; i >= 0; i--) poly = (ERFC[i] ?? NaN) + t * poly;
  return t * Math.exp(-z * z + poly);
}

/**
 * The upper tail of the χ² distribution, Q(χ² | ν) = P(X ≥ χ²), for ν = 0 to 3 (four phenotype
 * classes at most), in closed form (Abramowitz & Stegun 26.4.4–5): ν = 1 erfc(√(χ²/2)), ν = 2
 * e^(−χ²/2), ν = 3 erfc(√(χ²/2)) + √(2χ²/π)·e^(−χ²/2). ν = 0 (a single class) gives 1: χ² is
 * then 0 and nothing can be more extreme. NaN for a χ² that is not ≥ 0.
 */
export function chiSquareTail(chiSquare: number, df: number): number {
  if (!(chiSquare >= 0)) return NaN;
  if (df === 0 || chiSquare === 0) return 1; // exact: erfc's fit gives 1 + 3e-8 at 0
  if (df === 2) return Math.exp(-chiSquare / 2);
  const tail = erfc(Math.sqrt(chiSquare / 2));
  if (df === 1) return tail;
  if (df === 3) return tail + Math.sqrt((2 * chiSquare) / Math.PI) * Math.exp(-chiSquare / 2);
  return NaN;
}

/** Totals, proportions and Pearson's χ² of the counts so far against the parents' ratio. */
function derive(state: Float64Array, inputs: Inputs): void {
  const n = state[COUNTED] ?? 0;
  const yellow = yellowProbability(inputs);
  const round = roundProbability(inputs);
  let chiSquare = 0;
  let classes = 0;
  let smallest = 1;
  for (let i = 0; i < 4; i++) {
    const p = classProbability(i, yellow, round);
    if (p === 0) continue; // a class that cannot occur: never observed, left out of χ²
    const expected = n * p;
    if (n > 0) chiSquare += ((state[CLASSES + i] ?? 0) - expected) ** 2 / expected;
    classes++;
    smallest = Math.min(smallest, p);
  }
  const yellowCount = (state[CLASSES] ?? 0) + (state[CLASSES + 1] ?? 0);
  const roundCount = (state[CLASSES] ?? 0) + (state[CLASSES + 2] ?? 0);
  state[YELLOW] = yellowCount;
  state[ROUND] = roundCount;
  // 0 until a seed is counted: the runtime fails a run whose state is not finite.
  state[YELLOW_PROPORTION] = n > 0 ? yellowCount / n : 0;
  state[ROUND_PROPORTION] = n > 0 ? roundCount / n : 0;
  state[CHI_SQUARE] = chiSquare;
  state[DEGREES_OF_FREEDOM] = classes - 1;
  state[P_VALUE] = chiSquareTail(chiSquare, classes - 1);
  state[SMALLEST_EXPECTED] = n * smallest;
}

/** Counts seed k: its genotype from its own bits, its phenotype class from that. */
function countSeed(state: Float64Array, k: number, inputs: Inputs): void {
  const bits = seedBits(inputs.sample ?? NaN, k);
  const genotype = offspringGenotype(inputs.parent1 ?? NaN, inputs.parent2 ?? NaN, bits);
  const i = (yAlleles(genotype) > 0 ? 0 : 2) + (rAlleles(genotype) > 0 ? 0 : 1);
  state[CLASSES + i] = (state[CLASSES + i] ?? 0) + 1;
  state[LAST_GENOTYPE] = genotype;
}

/**
 * A Mendelian dihybrid cross in garden pea (Pisum sativum): a teaching model of Mendel's laws,
 * not of a real pea crop. Two genes, each with complete dominance: seed colour, Y yellow over
 * y green (Mendel's I/i, the stay-green gene SGR), and seed shape, R round over r wrinkled (the
 * starch-branching enzyme gene SBEI). Each parent is a genotype code, 10·(Y alleles) + (R alleles)
 * — YYRR 22, YyRr 11, yyrr 0 — chosen at the desk. Every seed is one offspring, scored by its
 * own colour and shape (both are seed traits, seen in the pods).
 *
 * Inheritance: each parent passes one allele of each gene, the dominant one with probability
 * (its dominant alleles)/2 (segregation, first law), the two genes independently of each other
 * (independent assortment, second law: I and R lie on different chromosomes). So
 * P(yellow) = 1 − (1 − Y₁/2)(1 − Y₂/2), the same for round, and each of the four phenotype
 * classes has the product of its two traits' probabilities: 9:3:3:1 for YyRr × YyRr, 1:1:1:1 for
 * the test cross YyRr × yyrr, 3:1 for YyRR × YyRR. Assumed: every gamete and seed is equally
 * viable, fertilisation is random, no mutation, no linkage, every seed is scored correctly.
 *
 * Sampling: seed k (k = 1…N) takes its 4 meiosis choices from fair bits of a seeded generator
 * (`seedBits`), never Math.random: one sample (`sample`) gives the same N seeds every time, and
 * its first n seeds are the same whatever N. The sample is a run input, so it is recorded with
 * the run. Counts scatter about N·p as a multinomial sample does; the analysis of several runs
 * recovers p.
 *
 * Pearson's χ² compares the counts with the parents' expected ratio over the classes that can
 * occur: χ² = Σ (O − E)²/E, ν = classes − 1 degrees of freedom, p = Q(χ² | ν) (`chiSquareTail`).
 * The test is an approximation valid when every expected count E ≥ 5 (`smallestExpected`). The
 * hypothesis is the model's own ratio, so p ≤ 0.05 here is a chance event: about 1 sample in 20.
 *
 * Time only paces the count: seed k is counted at (k − 1)·T/N run seconds (T `countTime`), so the
 * first at once, all N before T; the run ends at T exactly, the last step taking only the time it
 * needs. The step size changes when a seed appears, never which seeds the sample has.
 *
 * Variables: `elapsed` (s of counting), `counted` n, the class counts `yellowRound`,
 * `yellowWrinkled`, `greenRound`, `greenWrinkled`, the trait totals `yellow` and `round`, their
 * proportions of n, `chiSquare`, `degreesOfFreedom`, `pValue`, `smallestExpected` n·min p, and
 * `lastGenotype`, the code of the latest seed. Before the first seed every value is finite (the
 * runtime fails a run whose state is not): the proportions and χ² 0, p 1 (no count, nothing to
 * test against) and `lastGenotype` −1 (no seed).
 */
export const geneticsModel: SimulationModel = {
  id: 'biology.genetics',
  inputs: ['parent1', 'parent2', 'offspring', 'sample', 'countTime'],
  variables: [
    'elapsed',
    'counted',
    'yellowRound',
    'yellowWrinkled',
    'greenRound',
    'greenWrinkled',
    'yellow',
    'round',
    'yellowProportion',
    'roundProportion',
    'chiSquare',
    'degreesOfFreedom',
    'pValue',
    'smallestExpected',
    'lastGenotype',
  ],
  predictions: [
    'probabilityYellow',
    'probabilityRound',
    'probabilityYellowRound',
    'probabilityYellowWrinkled',
    'probabilityGreenRound',
    'probabilityGreenWrinkled',
    'expectedYellow',
    'expectedRound',
    'expectedYellowRound',
    'expectedYellowWrinkled',
    'expectedGreenRound',
    'expectedGreenWrinkled',
    'degreesOfFreedom',
    'smallestExpected',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    state[LAST_GENOTYPE] = -1;
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    const total = inputs.countTime ?? NaN;
    const n = inputs.offspring ?? NaN;
    const elapsed = state[ELAPSED] ?? 0;
    if (!(elapsed < total)) return 0; // the count is over
    const reached = elapsed + dt >= total;
    const now = reached ? total : elapsed + dt;
    // Seed k is counted at (k − 1)·T/N: the first at once, every one by T.
    const due = Math.min(n, Math.floor((now * n) / total) + 1);
    for (let k = (state[COUNTED] ?? 0) + 1; k <= due; k++) countSeed(state, k, inputs);
    state[COUNTED] = Math.max(state[COUNTED] ?? 0, due);
    state[ELAPSED] = now;
    derive(state, inputs);
    return reached ? total - elapsed : dt;
  },

  isComplete: (state, inputs) => (state[ELAPSED] ?? 0) >= (inputs.countTime ?? NaN),

  /**
   * The theory, exact: P(yellow), P(round), the four class probabilities (their products), the
   * expected counts N·p, the degrees of freedom of the χ² test (classes that can occur − 1) and
   * the smallest expected count N·min p, which the test needs ≥ 5.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const n = inputs.offspring ?? NaN;
    const yellow = yellowProbability(inputs);
    const round = roundProbability(inputs);
    const yr = classProbability(0, yellow, round);
    const yw = classProbability(1, yellow, round);
    const gr = classProbability(2, yellow, round);
    const gw = classProbability(3, yellow, round);
    const possible = [yr, yw, gr, gw].filter((p) => p > 0);
    return {
      probabilityYellow: yellow,
      probabilityRound: round,
      probabilityYellowRound: yr,
      probabilityYellowWrinkled: yw,
      probabilityGreenRound: gr,
      probabilityGreenWrinkled: gw,
      expectedYellow: n * yellow,
      expectedRound: n * round,
      expectedYellowRound: n * yr,
      expectedYellowWrinkled: n * yw,
      expectedGreenRound: n * gr,
      expectedGreenWrinkled: n * gw,
      degreesOfFreedom: possible.length - 1,
      smallestExpected: n * Math.min(...possible),
    };
  },
};
