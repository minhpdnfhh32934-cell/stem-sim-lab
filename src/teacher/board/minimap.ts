/** Pure geometry for the board's view: the minimap (BoardMinimap.tsx), resize and zoom. */

export interface View {
  top: number;
  height: number;
}

/** Visible part of the scrolled board, in board units (scale undone). */
export function visibleBand(scrollTop: number, clientHeight: number, scale: number): View {
  return { top: scrollTop / scale, height: clientHeight / scale };
}

/** Visible columns of the board when zoomed in, in board units (scale undone). */
export function visibleColumns(
  scrollLeft: number,
  clientWidth: number,
  scale: number,
): { left: number; width: number } {
  return { left: scrollLeft / scale, width: clientWidth / scale };
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

/**
 * A scroll position kept inside the content (px). Content smaller than the viewport is content
 * not laid out yet (an engine without layout, such as jsdom): the position is then kept as asked.
 */
export function clampScroll(value: number, content: number, client: number): number {
  const limit = content - client;
  return Math.max(0, limit >= 0 ? Math.min(limit, value) : value);
}

/**
 * The scroll position that keeps the board point that was in the middle of the viewport in the
 * middle after the sheet's scale changed (a window resize, a zoom), clamped to the content: the
 * learner keeps looking at the same part of the board. Works for either axis.
 *
 * @param scroll  scroll position before (px)
 * @param client  viewport size before (px)
 * @param content scroll size of the content at the new scale (px)
 * @param newClient viewport size after (px; the same by default)
 */
export function rescaleScroll(
  scroll: number,
  client: number,
  oldScale: number,
  newScale: number,
  content: number,
  newClient = client,
): number {
  const row = (scroll + client / 2) / oldScale;
  return scrollForRow(row, newScale, newClient, content);
}
