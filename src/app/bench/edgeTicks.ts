/** Space kept between two tick names on the track, in px. */
export const TICK_GAP = 8;

/**
 * Which ticks get their name, from the left (#205 B8: measured, so it holds at any font size and
 * track width): a name starts at `left[i]` and is `width[i]` wide (px); it shows only when it starts
 * `gap` after the previous shown name ends and ends inside the track. The marks always show.
 */
export function namedTicks(
  left: readonly number[],
  width: readonly number[],
  track: number,
  gap = TICK_GAP,
): boolean[] {
  let end = -Infinity;
  return left.map((x, i) => {
    const w = width[i] ?? 0;
    const ok = w > 0 && x >= end + gap && x + w <= track;
    if (ok) end = x + w;
    return ok;
  });
}
