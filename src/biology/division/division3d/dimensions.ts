/**
 * Illustrative sizes of condensed chromosomes in the 3D division views (cell units; an animal
 * cell's radius is 5). Not to scale: real chromosomes are a few micrometres long in a cell tens of
 * micrometres across, and their lengths differ by pair in a way these numbers do not copy.
 */

/** Condensed rod radius and the distance of each sister from the shared centromere. */
export const ROD_RADIUS = 0.15;
export const SISTER_OFFSET = 0.17;
/** Sister arms diverge from the centromere (the X shape of a double chromosome). */
export const SPLAY = 0.45;
/** Condensed length per pair (pair 1 longest; cycles past four pairs). */
export const PAIR_LENGTH = [2.2, 1.8, 1.45, 1.15] as const;

/** Condensed length of a chromosome of `pair`, shortened for big sets so the plate holds them. */
export function pairLength(pair: number, chromosomes: number): number {
  const scale = chromosomes > 8 ? Math.sqrt(8 / chromosomes) : 1;
  return (PAIR_LENGTH[pair % PAIR_LENGTH.length] ?? 1) * scale;
}
