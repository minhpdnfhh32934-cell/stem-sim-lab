import { useEffect, useLayoutEffect, type RefObject } from 'react';

/**
 * The board's toolbar stays on one row whatever the width of the UI font (Segoe UI on Windows,
 * wider fonts on Linux, a larger font scale), so the board keeps its height and nothing on it
 * moves when a button changes. When the buttons do not fit, the lower-priority ones show their
 * icon only (their name stays for screen readers and in the tooltip), one level at a time, until
 * they do. A button marked `data-compact-from="n"` drops its name from level n on; board.css holds
 * what each level does. "Khoanh để hỏi" and "Viết nhanh" always keep their names (on touch there
 * is no tooltip): a board too narrow even for them lets the toolbar wrap to a second row.
 */
export const MAX_COMPACT_LEVEL = 2;

/** The vertical extent of one toolbar item, as `getBoundingClientRect()` gives it. */
export interface RowBox {
  readonly top: number;
  readonly bottom: number;
}

/**
 * True when the drawn boxes sit on one row: each starts above the bottom of the box that starts
 * highest (that box is on the first row, and a box on a second row starts below it). Boxes with
 * no height (the flexible gap, anything hidden) are on no row.
 */
export function onOneRow(boxes: readonly RowBox[]): boolean {
  const drawn = boxes.filter((b) => b.bottom > b.top);
  const first = drawn.reduce<RowBox | null>((a, b) => (a === null || b.top < a.top ? b : a), null);
  return first === null || drawn.every((b) => b.top < first.bottom);
}

/**
 * The first level from `floor` up to `max` at which `fits(level)` holds; `max` when none does
 * (`max` itself is not tried: nothing more can be folded, the toolbar wraps).
 */
export function chooseLevel(floor: number, max: number, fits: (level: number) => boolean): number {
  for (let level = Math.max(0, Math.min(floor, max)); level < max; level += 1)
    if (fits(level)) return level;
  return max;
}

/** The toolbar's levels as CSS reads them: level 2 → "1 2" (`[data-compact~='1']`). */
export function compactAttr(level: number): string {
  return Array.from({ length: level }, (_, i) => String(i + 1)).join(' ');
}

/** The level a narrow board starts from (`--board-compact-floor`, set by a container query). */
function floorOf(toolbar: HTMLElement): number {
  const floor = Number.parseInt(
    getComputedStyle(toolbar).getPropertyValue('--board-compact-floor'),
    10,
  );
  return Number.isFinite(floor) ? floor : 0;
}

/** Folds the toolbar's names until it fits on one row, as few as possible; returns the level. */
export function fitToolbar(toolbar: HTMLElement): number {
  const level = chooseLevel(floorOf(toolbar), MAX_COMPACT_LEVEL, (l) => {
    toolbar.dataset.compact = compactAttr(l);
    return onOneRow(Array.from(toolbar.children, (c) => c.getBoundingClientRect()));
  });
  toolbar.dataset.compact = compactAttr(level);
  return level;
}

/**
 * Keeps the toolbar in `ref` fitted. After every render of its owner (a button appears, a name
 * changes) it is fitted before the frame is drawn, and before the board below it measures
 * itself (the toolbar comes first in the tree). After a change of its size (a narrower window,
 * a wider font) it is fitted on the next frame: fitting inside the ResizeObserver would change
 * the size it has just reported, which the browser reports as a resize loop.
 */
export function useToolbarFit(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    if (ref.current) fitToolbar(ref.current);
  });
  useEffect(() => {
    const toolbar = ref.current;
    if (
      !toolbar ||
      typeof ResizeObserver === 'undefined' ||
      typeof requestAnimationFrame === 'undefined'
    )
      return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        fitToolbar(toolbar);
      });
    });
    observer.observe(toolbar);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}
