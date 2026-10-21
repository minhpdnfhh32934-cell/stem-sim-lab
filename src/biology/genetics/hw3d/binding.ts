/**
 * Numbers of the Hardy–Weinberg 3D habitat (pure, tested), all from the lesson's model
 * (`population.ts`):
 *
 * - the generations of random mating (`matingRun`, one random stream `rng(seed)`): generation 0
 *   is the learner's counts, generation 1 the same draw as the panel's "Cho ngẫu phối 1 thế hệ";
 * - per generation: allele frequencies p, q, the Hardy–Weinberg expectation p²n, 2pqn, q²n and
 *   the χ² test (`testHardyWeinberg`), the gene copies A = 2·AA + Aa, a = Aa + 2·aa;
 * - how many figures and beads the picture draws for them: one figure per `per` individuals and
 *   one bead per `perBead` gene copies — "nice" steps shared by every generation (`drawScale`),
 *   the classes shared out so they add up exactly (`apportion`).
 *
 * Which drawn slot holds which genotype is illustration (stable when a count changes by one).
 */
import { INSTANCE_SHARE } from '@/ui/three/quality3d';
import { ROLES, type BioRole, type Shape } from '../../view3d/palette';
import { apportion, drawScale } from '../../view3d/sampling';
import { matingRun, testHardyWeinberg, type GenotypeCounts } from '../population';
import { rng } from '../stats';
import type { HwState } from '../store';

/** Generations on the time slider after the learner's population (a display range). */
export const HW_GENERATIONS = 10;

export type Genotype = 'AA' | 'Aa' | 'aa';
export type Allele = 'A' | 'a';

export const GENOTYPES: readonly Genotype[] = ['AA', 'Aa', 'aa'];
export const ALLELES: readonly Allele[] = ['A', 'a'];

/** The two gene copies a diploid individual of each genotype carries. */
export const ALLELES_OF: Record<Genotype, readonly [Allele, Allele]> = {
  AA: ['A', 'A'],
  Aa: ['A', 'a'],
  aa: ['a', 'a'],
};

const GENOTYPE_ROLE: Record<Genotype, BioRole> = {
  AA: 'genotypeAA',
  Aa: 'genotypeAa',
  aa: 'genotypeaa',
};
const ALLELE_ROLE: Record<Allele, BioRole> = { A: 'alleleA', a: 'allelea' };

/** Colour token of a genotype: the lesson chart's series (AA, Aa, aa = series 1, 2, 3). */
export const genotypeToken = (g: Genotype): string => ROLES[GENOTYPE_ROLE[g]].token;
/** Colour token of an allele (A as AA, a as aa). */
export const alleleToken = (a: Allele): string => ROLES[ALLELE_ROLE[a]].token;
/** Shape cue of an allele (A a small cube, a a small sphere): readable without colour. */
export const alleleShape = (a: Allele): Shape => ROLES[ALLELE_ROLE[a]].shape;

export interface HwGeneration {
  g: number;
  /** The model's genotype counts. */
  counts: GenotypeCounts;
  n: number;
  p: number;
  q: number;
  /** Hardy–Weinberg expectation from this generation's p: p²n, 2pqn, q²n. */
  expected: GenotypeCounts;
  chi2: number;
  pValue: number;
  /** Gene copies: A = 2·AA + Aa, a = Aa + 2·aa (exact). */
  copies: { A: number; a: number };
  /** Figures drawn per genotype (one per `per` individuals, adding up exactly). */
  figures: GenotypeCounts;
  /** Beads in the gene pool per allele (one per `perBead` gene copies). */
  beads: { A: number; a: number };
}

export interface HwModel3D {
  generations: HwGeneration[];
  /** Individuals one figure stands for (the same in every generation). */
  per: number;
  /** Gene copies one bead stands for. */
  perBead: number;
  /** Most figures any generation draws (slots the scene builds). */
  slots: number;
  /** Most beads any generation draws. */
  beadSlots: number;
  N: number;
  seed: number;
}

/**
 * Most figures drawn: the 3D quality table's instance share of the tier's particle budget, and
 * never more than a figure-sized stage shows legibly (about 250 animals of ~20 px each).
 */
export const LEGIBLE_FIGURES = 250;
export function figureCap(maxParticles: number): number {
  return Math.min(LEGIBLE_FIGURES, Math.max(60, Math.round(maxParticles * INSTANCE_SHARE)));
}

/** Most beads in the gene pool jar (also kept legible). */
export const LEGIBLE_BEADS = 200;
export function beadCap(maxParticles: number): number {
  return Math.min(LEGIBLE_BEADS, Math.max(60, Math.round(maxParticles * INSTANCE_SHARE)));
}

const total = (c: GenotypeCounts) => c.AA + c.Aa + c.aa;

export function hwModel3d(
  st: Pick<HwState, 'AA' | 'Aa' | 'aa' | 'N' | 'seed'>,
  cap: number,
  beads: number,
  generations = HW_GENERATIONS,
): HwModel3D {
  const run = matingRun(st, st.N, generations, rng(st.seed));
  const most = Math.max(0, ...run.map(total));
  const per = drawScale(most, cap);
  const perBead = drawScale(2 * most, beads);
  const gens = run.map((c, g): HwGeneration => {
    const t = testHardyWeinberg(c.AA, c.Aa, c.aa);
    const [eAA, eAa, eaa] = t.expected;
    const copies = { A: 2 * c.AA + c.Aa, a: c.Aa + 2 * c.aa };
    const [fAA = 0, fAa = 0, faa = 0] = apportion([c.AA, c.Aa, c.aa], per);
    const [bA = 0, ba = 0] = apportion([copies.A, copies.a], perBead);
    return {
      g,
      counts: { AA: c.AA, Aa: c.Aa, aa: c.aa },
      n: t.n,
      p: t.p,
      q: t.q,
      expected: { AA: eAA, Aa: eAa, aa: eaa },
      chi2: t.test.chi2,
      pValue: t.test.p,
      copies,
      figures: { AA: fAA, Aa: fAa, aa: faa },
      beads: { A: bA, a: ba },
    };
  });
  return {
    generations: gens,
    per,
    perBead,
    slots: Math.max(0, ...gens.map((x) => total(x.figures))),
    beadSlots: Math.max(0, ...gens.map((x) => x.beads.A + x.beads.a)),
    N: st.N,
    seed: st.seed,
  };
}

/** The generation shown at playback time `t` (whole generations, clamped). */
export function generationAt(t: number, generations = HW_GENERATIONS): number {
  return Math.max(0, Math.min(generations, Math.floor(t + 1e-6)));
}

/**
 * One key in [0, 1) per drawn slot for a generation (the slot's place in the mix): the same
 * keys for the first slots whatever the count, so a new count keeps most figures where they were.
 */
export function slotKeys(count: number, generation: number): Float64Array {
  const r = rng(7919 * (generation + 1));
  const out = new Float64Array(Math.max(0, count));
  for (let i = 0; i < out.length; i++) out[i] = r();
  return out;
}

/**
 * Which class each of the first `counts.reduce(+)` slots shows: the slots ranked by key take the
 * classes in order (the first `counts[0]` the first class…), so the classes are mixed over the
 * habitat and a count that changes by one moves at most two existing slots to another class.
 */
export function slotClasses(counts: readonly number[], keys: ArrayLike<number>): Uint8Array {
  const n = Math.min(
    keys.length,
    counts.reduce((s, c) => s + Math.max(0, Math.floor(c)), 0),
  );
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => (keys[a] ?? 0) - (keys[b] ?? 0) || a - b,
  );
  const out = new Uint8Array(n);
  let rank = 0;
  counts.forEach((c, cls) => {
    for (let k = 0; k < Math.max(0, Math.floor(c)) && rank < n; k++) {
      out[order[rank] ?? 0] = cls;
      rank++;
    }
  });
  return out;
}

/** Selection of the 3D view: a figure (its slot) or the gene pool. */
export type HwSelection = { kind: 'figure'; slot: number } | { kind: 'pool' };

export function selectionId(s: HwSelection | null): string | null {
  if (!s) return null;
  return s.kind === 'pool' ? 'pool' : `figure:${String(s.slot)}`;
}

export function parseSelection(id: string | null): HwSelection | null {
  if (id === 'pool') return { kind: 'pool' };
  const m = id ? /^figure:(\d+)$/.exec(id) : null;
  return m ? { kind: 'figure', slot: Number(m[1]) } : null;
}

/** The genotype a figure slot shows in a generation, or null when that slot is empty. */
export function slotGenotype(model: HwModel3D, g: number, slot: number): Genotype | null {
  const gen = model.generations[g];
  if (!gen) return null;
  const f = gen.figures;
  if (slot < 0 || slot >= f.AA + f.Aa + f.aa) return null;
  const classes = slotClasses([f.AA, f.Aa, f.aa], slotKeys(model.slots, g));
  return GENOTYPES[classes[slot] ?? 0] ?? null;
}
