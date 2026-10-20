/** Smallest scale a display equation is shrunk to (below it, it scrolls sideways instead). */
export const MIN_EQUATION_SCALE = 0.62;

/**
 * Font scale that fits an equation `needed` px wide into `available` px: 1 when it fits, never
 * below MIN_EQUATION_SCALE (still readable). Unknown sizes (0) leave it at 1.
 */
export function fitScale(available: number, needed: number): number {
  if (!(available > 0) || !(needed > 0) || needed <= available) return 1;
  return Math.max(MIN_EQUATION_SCALE, Math.floor((available / needed) * 100) / 100);
}
