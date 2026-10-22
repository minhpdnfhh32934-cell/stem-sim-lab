/**
 * Illustrative sizes of condensed chromosomes in the 3D division views (cell units; an animal
 * cell's radius is 5). Not to scale: real chromosomes are a few micrometres long in a cell tens of
 * micrometres across, and their lengths differ by pair in a way these numbers do not copy.
 */

/**
 * Drawing scale of the chromosomes (0.7.1): 1.25 × the 0.7.0 sizes, so metaphase rods can be read
 * in the overview. Illustration only (the Science Card says sizes are not to scale); no count,
 * order or colour depends on it.
 */
export const ILLUSTRATIVE_SCALE = 1.25;

/** Condensed rod radius and the distance of each sister from the shared centromere. */
export const ROD_RADIUS = 0.15 * ILLUSTRATIVE_SCALE;
export const SISTER_OFFSET = 0.17 * ILLUSTRATIVE_SCALE;
/** Sister arms diverge from the centromere (the X shape of a double chromosome). */
export const SPLAY = 0.45;
/** Condensed length per pair (pair 1 longest; cycles past four pairs). */
export const PAIR_LENGTH: readonly number[] = [2.2, 1.8, 1.45, 1.15].map(
  (l) => l * ILLUSTRATIVE_SCALE,
);

/**
 * Rings per unit length of a condensed arm: 0.7.0's 7 (and 4 for big sets) over the drawing
 * scale, so a longer rod keeps the same number of rings (same triangles).
 */
export const TUBE_RINGS_PER_UNIT = 7 / ILLUSTRATIVE_SCALE;
export const TUBE_RINGS_PER_UNIT_MANY = 4 / ILLUSTRATIVE_SCALE;

/** Condensed length of a chromosome of `pair`, shortened for big sets so the plate holds them. */
export function pairLength(pair: number, chromosomes: number): number {
  const scale = chromosomes > 8 ? Math.sqrt(8 / chromosomes) : 1;
  return (PAIR_LENGTH[pair % PAIR_LENGTH.length] ?? 1) * scale;
}
