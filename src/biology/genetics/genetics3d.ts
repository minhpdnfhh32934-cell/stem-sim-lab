/**
 * Numbers of the genetics 3D views (pure, tested), all read from the lessons' own models:
 * Wright–Fisher runs (drift), genotype counts (Hardy–Weinberg) and the Punnett square (Mendel).
 */

export type Fate = 'fixed' | 'lost' | 'polymorphic';

/** What became of allele A in a run by its last generation. */
export function fateOf(run: readonly number[]): Fate {
  const last = run.at(-1) ?? 0;
  return last >= 1 ? 'fixed' : last <= 0 ? 'lost' : 'polymorphic';
}

/** Allele frequencies of every run at generation g, and how many runs had fixed / lost A by then. */
export function driftAt(
  runs: readonly (readonly number[])[],
  g: number,
): { p: number[]; fixed: number; lost: number } {
  const p = runs.map((r) => r[Math.max(0, Math.min(r.length - 1, Math.round(g)))] ?? 0);
  return {
    p,
    fixed: p.filter((v) => v >= 1).length,
    lost: p.filter((v) => v <= 0).length,
  };
}

export interface HwPopulation {
  AA: number;
  Aa: number;
  aa: number;
}

/** Gene copies in a population of diploids: A = 2·AA + Aa, a = Aa + 2·aa (exact counts). */
export function allelePool(g: HwPopulation): { A: number; a: number } {
  return { A: 2 * g.AA + g.Aa, a: g.Aa + 2 * g.aa };
}

/**
 * Figures for each genotype when at most `max` can be drawn: one per individual, or one per
 * `per` individuals for all three (rounded, the view says so).
 */
export function genotypeFigures(
  g: HwPopulation,
  max: number,
): { per: number; AA: number; Aa: number; aa: number } {
  const n = g.AA + g.Aa + g.aa;
  const per = n <= max ? 1 : Math.ceil(n / max);
  return {
    per,
    AA: Math.round(g.AA / per),
    Aa: Math.round(g.Aa / per),
    aa: Math.round(g.aa / per),
  };
}
