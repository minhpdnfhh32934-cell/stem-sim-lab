/** Room drawn above each shell for its electron count (gap + 12 px label). */
const LABEL = 20;

/**
 * Where the Bohr picture goes in a canvas whose top `top` px are taken by the chip row: the
 * outermost shell's count label starts at `top`, never under the chips (UI-33, #70).
 */
export function bohrLayout(
  width: number,
  height: number,
  top: number,
): { cx: number; cy: number; rMax: number } {
  const avail = Math.max(2 * (LABEL + 30), height - top - 12);
  const rMax = Math.max(30, Math.min(width / 2 - 40, avail / 2 - LABEL));
  return { cx: width / 2, cy: top + LABEL + rMax, rMax };
}
