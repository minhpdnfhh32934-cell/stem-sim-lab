/**
 * Numbers of the genetic drift 3D archipelago (pure, tested), all from the lesson's model
 * (`population.ts`): one island per Wright–Fisher run (`driftRuns`, the same seed as the 2D
 * chart), each a population of N diploid individuals = 2N gene copies.
 *
 * - At generation g, island r has A = p_r(g)·2N copies of A (a whole number from generation 1 on;
 *   generation 0 is the frequency p₀ the learner chose, so 2N·p₀ may be a half) and 2N − A of a.
 * - A is fixed on an island once p = 1 and lost once p = 0: Wright–Fisher never leaves those
 *   states, so the first such generation is when the island's habitat changes colour.
 * - The picture draws N / k figures per island, k the smallest divisor of N that keeps the
 *   islands legible (every figure stands for exactly k individuals), with two beads each (one
 *   bead = k gene copies): the A and a beads are the island's copies shared out by the largest
 *   remainder (`apportion`), so they always add up to 2N / k.
 *
 * The model counts gene copies only: which two beads a figure carries (its "genotype") is
 * illustration, stable per island (`pairing`), and never shown as a count.
 */
import { INSTANCE_SHARE } from '@/ui/three/quality3d';
import { apportion } from '../../view3d/sampling';
import { slotClasses } from '../hw3d/binding';
import { expectedHeterozygosity, type DriftInputs } from '../population';
import { rng } from '../stats';

export type Fate = 'fixed' | 'lost' | 'polymorphic';

/** What a frequency of A means for the island: fixed (p = 1), lost (p = 0) or still both. */
export function fateOf(p: number): Fate {
  return p >= 1 ? 'fixed' : p <= 0 ? 'lost' : 'polymorphic';
}

/** The first generation at which a run fixed or lost A (absorbing states), or null. */
export function absorption(
  run: readonly number[],
): { fate: Exclude<Fate, 'polymorphic'>; generation: number } | null {
  for (let g = 0; g < run.length; g++) {
    const f = fateOf(run[g] ?? 0.5);
    if (f !== 'polymorphic') return { fate: f, generation: g };
  }
  return null;
}

/** Most figures over all islands: legible on a stage of 1366 × 768 (about 15 per island at 20). */
export const LEGIBLE_TOTAL = 300;
/** Most figures on one island (a single run of a large population). */
export const LEGIBLE_ISLAND = 60;
/** Fewest figures an island is allowed to fall to by the shared budget (when N is that large). */
export const MIN_ISLAND = 4;

/** The figure budget of the tier: the quality table's instance share, never past LEGIBLE_TOTAL. */
export function figureBudget(maxParticles: number): number {
  return Math.min(LEGIBLE_TOTAL, Math.max(120, Math.round(maxParticles * INSTANCE_SHARE)));
}

/** Most figures one island draws when `runs` islands share the budget. */
export function islandCap(budget: number, runs: number): number {
  return Math.max(
    MIN_ISLAND,
    Math.min(LEGIBLE_ISLAND, Math.floor(budget / Math.max(1, Math.round(runs)))),
  );
}

/**
 * Individuals one figure stands for: the smallest divisor k of N with N / k ≤ cap, so every
 * figure is exactly k individuals and an island's figures add up to N.
 */
export function individualsPerFigure(N: number, cap: number): number {
  const n = Math.max(1, Math.round(N));
  const c = Math.max(1, Math.floor(cap));
  for (let k = 1; k <= n; k++) if (n % k === 0 && n / k <= c) return k;
  return n;
}

/** A gene-copy count with floating-point noise removed (p·2N of a run is a whole number). */
export function copiesOf(p: number, twoN: number): number {
  const v = p * twoN;
  const r = Math.round(v);
  return Math.abs(v - r) < 1e-6 ? r : v;
}

export interface DriftModel3D {
  /** The model's runs (frequency of A per generation), one per island. */
  runs: readonly (readonly number[])[];
  N: number;
  p0: number;
  generations: number;
  seed: number;
  /** Individuals per figure = gene copies per bead (exact divisor of N). */
  per: number;
  /** Figures drawn on every island (N / per). */
  figures: number;
  /** Per island: generation at which A was fixed or lost, or null (still both at the end). */
  absorbed: ({ fate: Exclude<Fate, 'polymorphic'>; generation: number } | null)[];
  /** Per island and generation: A beads drawn (row-major, island r at r·(G + 1) + g). */
  beadsA: Int32Array;
}

export function driftModel3d(st: DriftInputs, runs: readonly (readonly number[])[], cap: number) {
  const N = Math.max(1, Math.round(st.N));
  const per = individualsPerFigure(N, cap);
  const figures = N / per;
  const G = Math.max(0, Math.round(st.generations));
  const beadsA = new Int32Array(runs.length * (G + 1));
  runs.forEach((run, r) => {
    for (let g = 0; g <= G; g++) {
      const A = copiesOf(run[Math.min(g, run.length - 1)] ?? 0, 2 * N);
      beadsA[r * (G + 1) + g] = apportion([A, 2 * N - A], per)[0] ?? 0;
    }
  });
  const model: DriftModel3D = {
    runs,
    N,
    p0: st.p0,
    generations: G,
    seed: st.seed,
    per,
    figures,
    absorbed: runs.map(absorption),
    beadsA,
  };
  return model;
}

/** One island at generation g: the model's numbers and what the picture draws for them. */
export interface IslandAt {
  island: number;
  g: number;
  /** Frequency of A (the run's value). */
  p: number;
  /** Gene copies of A and a (A + a = 2N). */
  copies: { A: number; a: number };
  /** Heterozygosity 2pq of this island. */
  H: number;
  fate: Fate;
  /** Beads drawn (A + a = 2·figures). */
  beads: { A: number; a: number };
}

export function generationOf(model: DriftModel3D, g: number): number {
  return Math.max(0, Math.min(model.generations, Math.round(g)));
}

export function islandAt(model: DriftModel3D, island: number, g: number): IslandAt | null {
  const run = model.runs[island];
  if (!run) return null;
  const gg = generationOf(model, g);
  const p = run[Math.min(gg, run.length - 1)] ?? 0;
  const A = copiesOf(p, 2 * model.N);
  const bA = model.beadsA[island * (model.generations + 1) + gg] ?? 0;
  return {
    island,
    g: gg,
    p,
    copies: { A, a: 2 * model.N - A },
    H: 2 * p * (1 - p),
    fate: fateOf(p),
    beads: { A: bA, a: 2 * model.figures - bA },
  };
}

/** All islands at generation g: how many fixed or lost A by then, the mean H and its theory. */
export function summaryAt(
  model: DriftModel3D,
  g: number,
): { g: number; fixed: number; lost: number; polymorphic: number; meanH: number; theoryH: number } {
  const gg = generationOf(model, g);
  let fixed = 0;
  let lost = 0;
  let h = 0;
  model.runs.forEach((_, r) => {
    const x = islandAt(model, r, gg);
    if (!x) return;
    if (x.fate === 'fixed') fixed++;
    else if (x.fate === 'lost') lost++;
    h += x.H;
  });
  const n = model.runs.length;
  return {
    g: gg,
    fixed,
    lost,
    polymorphic: n - fixed - lost,
    // The same mean as the lesson's chart under the picture (`DriftBottom`).
    meanH: h / Math.max(1, n),
    theoryH: expectedHeterozygosity(2 * model.p0 * (1 - model.p0), model.N, gg),
  };
}

/** The generation shown at playback time `t` (whole generations, clamped). */
export function generationAt(t: number, generations: number): number {
  return Math.max(0, Math.min(Math.max(0, generations), Math.floor(t + 1e-6)));
}

/** One key in [0, 1) per bead slot of an island (the same for every generation of that island). */
export function beadKeys(island: number, slots: number): Float64Array {
  const r = rng(104729 * (island + 1) + 7);
  const out = new Float64Array(Math.max(0, slots));
  for (let i = 0; i < out.length; i++) out[i] = r();
  return out;
}

/**
 * Which two beads each figure of an island carries (0 = A A, 1 = A a, 2 = a a): the island's bead
 * slots, ranked by a fixed key, take the A beads first; figure f holds slots 2f and 2f + 1. The
 * counts of A and a beads are the model's; the pairing is illustration, and it moves at most one
 * bead when the island's A beads change by one.
 */
export function pairing(beadsA: number, figures: number, keys: ArrayLike<number>): Uint8Array {
  const slots = 2 * Math.max(0, figures);
  const a = Math.max(0, Math.min(slots, beadsA));
  const cls = slotClasses([a, slots - a], keys);
  const out = new Uint8Array(Math.max(0, figures));
  for (let f = 0; f < out.length; f++) out[f] = (cls[2 * f] ?? 0) + (cls[2 * f + 1] ?? 0);
  return out;
}

/** Selection of the 3D view: a figure (its slot over all islands) or an island. */
export type DriftSelection = { kind: 'figure'; slot: number } | { kind: 'island'; island: number };

export function selectionId(s: DriftSelection | null): string | null {
  if (!s) return null;
  return s.kind === 'island' ? `island:${String(s.island)}` : `figure:${String(s.slot)}`;
}

export function parseSelection(id: string | null): DriftSelection | null {
  const m = id ? /^(figure|island):(\d+)$/.exec(id) : null;
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === 'island' ? { kind: 'island', island: n } : { kind: 'figure', slot: n };
}

/** The island a selection belongs to. */
export function islandOf(model: DriftModel3D, s: DriftSelection): number {
  return s.kind === 'island' ? s.island : Math.floor(s.slot / Math.max(1, model.figures));
}

/** The two beads (0 AA, 1 Aa, 2 aa) a figure slot carries at generation g, or null. */
export function figureAlleles(model: DriftModel3D, slot: number, g: number): 0 | 1 | 2 | null {
  const island = Math.floor(slot / Math.max(1, model.figures));
  const x = islandAt(model, island, g);
  if (!x || slot < 0) return null;
  const f = slot - island * model.figures;
  const cls = pairing(x.beads.A, model.figures, beadKeys(island, 2 * model.figures));
  const c = cls[f];
  return c === 0 || c === 1 || c === 2 ? c : null;
}
