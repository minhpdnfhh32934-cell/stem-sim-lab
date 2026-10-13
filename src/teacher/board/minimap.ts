/** Pure geometry for the board minimap (BoardMinimap.tsx). */

export interface View {
  top: number;
  height: number;
}

/** Visible part of the scrolled board, in board units (scale undone). */
export function visibleBand(scrollTop: number, clientHeight: number, scale: number): View {
  return { top: scrollTop / scale, height: clientHeight / scale };
}

/** Scroll position that centres board row `y` in the viewport, clamped to the board. */
export function scrollForRow(
  y: number,
  scale: number,
  clientHeight: number,
  scrollHeight: number,
): number {
  const top = y * scale - clientHeight / 2;
  return Math.max(0, Math.min(scrollHeight - clientHeight, top));
}
