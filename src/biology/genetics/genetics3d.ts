/**
 * Numbers of the drift 3D view (pure, tested), read from the lesson's own Wright–Fisher runs.
 * (Hardy–Weinberg: `hw3d/binding.ts`; Mendel: `mendel3d/binding.ts`.)
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
