/** Room a tick's name needs on the track, in percent of its width (about 7 letters at 10 px). */
export const TICK_ROOM = 12;

/**
 * Which ticks get their name (positions in percent, in order), from the left: a name only `room`
 * after the previous name and not in the track's last half-room; the marks always show.
 */
export function namedTicks(at: readonly number[], room = TICK_ROOM): boolean[] {
  let last = -Infinity;
  return at.map((x) => {
    const ok = x - last >= room && x <= 100 - room / 2;
    if (ok) last = x;
    return ok;
  });
}
