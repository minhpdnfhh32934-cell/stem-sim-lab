import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'population',
    (n) => Number.isInteger(n) && n >= 4 && n <= 5000,
    'a whole number from 4 to 5000',
  ],
  ['startFrequency', (p) => p > 0 && p < 1, 'between 0 and 1'],
  ['generations', (g) => Number.isInteger(g) && g >= 1 && g <= 200, 'a whole number from 1 to 200'],
  ['seed', (s) => Number.isInteger(s) && s >= 1 && s <= 1000, 'a whole number from 1 to 1000'],
  ['stepTime', (t) => t > 0 && t <= 2, 'above 0 and at most 2 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Population genetics input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Population genetics input "${id}" must be ${rule}, got ${value}`);
  }
}

const TIME = 0;
const GENERATION = 1;
const P = 2;
const AA = 3;
const AB = 4;
const BB = 5;
const RNG = 6;
const HW = 7;

/** mulberry32: the next uniform in [0, 1) and the state after it. */
function next(state: Float64Array): number {
  let a = ((state[RNG] ?? 0) + 0x6d2b79f5) >>> 0;
  state[RNG] = a;
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

/**
 * One generation by random mating: each of the N individuals takes two alleles drawn at random
 * from the parents' gene pool (A with probability p). Writes the genotype shares and the new p.
 */
function breed(state: Float64Array, n: number, p: number): void {
  state[HW] = 2 * p * (1 - p); // the share of Aa random mating gives from this gene pool
  let aa = 0;
  let ab = 0;
  for (let i = 0; i < n; i++) {
    const a1 = next(state) < p;
    const a2 = next(state) < p;
    if (a1 && a2) aa++;
    else if (a1 || a2) ab++;
  }
  state[AA] = aa / n;
  state[AB] = ab / n;
  state[BB] = (n - aa - ab) / n;
  state[P] = (2 * aa + ab) / (2 * n);
}

/** The heterozygosity expected after t generations of drift: 2p₀q₀ (1 − 1/2N)^t. */
export const expectedHeterozygosity = (p0: number, n: number, t: number) =>
  2 * p0 * (1 - p0) * (1 - 1 / (2 * n)) ** t;

/**
 * Population genetics — Hardy–Weinberg and genetic drift (the Wright–Fisher model): a population of
 * `population` diploid individuals with one gene of two alleles, A and a, starting at A's
 * frequency `startFrequency`. Each generation (one every `stepTime` s, for `generations`) is bred
 * by random mating: every individual draws two alleles from the gene pool of the one before. With
 * no selection, mutation or migration, the genotypes are near p², 2pq, q² (Hardy–Weinberg) and p
 * only changes by chance — a little in a large population, a lot in a small one, until an allele
 * may be lost (drift). The draws are pseudo-random from `seed`, so a run repeats exactly.
 *
 * Variables: `time` (s), `generation`, `p` (frequency of A), `homozygousA`, `heterozygous`,
 * `homozygousB` (shares of AA, Aa, aa), `rng` (the generator's state), `hardyWeinberg` (2pq of
 * the parents' gene pool: the share of Aa Hardy–Weinberg expects).
 */
export const populationGeneticsModel: SimulationModel = {
  id: 'biology.population-genetics',
  inputs: ['population', 'startFrequency', 'generations', 'seed', 'stepTime'],
  variables: [
    'time',
    'generation',
    'p',
    'homozygousA',
    'heterozygous',
    'homozygousB',
    'rng',
    'hardyWeinberg',
  ],
  predictions: ['p', 'heterozygosity'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    state[RNG] = ((inputs.seed ?? 1) * 2654435761) >>> 0;
    breed(state, inputs.population ?? NaN, inputs.startFrequency ?? NaN);
  },

  step(state, dt, inputs) {
    const per = inputs.stepTime ?? NaN;
    const end = (inputs.generations ?? NaN) * per;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    state[TIME] = t;
    const due = Math.min(inputs.generations ?? 0, Math.floor(t / per + 1e-9));
    while ((state[GENERATION] ?? 0) < due) {
      breed(state, inputs.population ?? NaN, state[P] ?? 0);
      state[GENERATION] = (state[GENERATION] ?? 0) + 1;
    }
    return h;
  },

  isComplete: (state, inputs) => (state[GENERATION] ?? 0) >= (inputs.generations ?? NaN),

  predict(inputs) {
    refuseInvalid(inputs);
    const p0 = inputs.startFrequency ?? NaN;
    return {
      p: p0, // the expected p: drift has no direction
      // The expected share of Aa in the last generation, bred from the gene pool before it.
      heterozygosity: expectedHeterozygosity(
        p0,
        inputs.population ?? NaN,
        inputs.generations ?? NaN,
      ),
    };
  },
};
