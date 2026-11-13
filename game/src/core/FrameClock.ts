/** rAF timestamps jitter by a fraction of a millisecond: a frame that early is on time. */
const TOLERANCE_MS = 1;

/**
 * Decides, for each display frame the browser offers (requestAnimationFrame), whether the game
 * runs it and with what time step. With no cap every frame runs; with a cap of n frames per
 * second, frames come no more often than every 1000/n ms, on the cap's own beat (so rounding to
 * display frames does not drift the rate up), and after a stall it starts again from now — never
 * a burst of frames to catch up. A frame that runs gets the real time since the last frame that
 * ran (at most `maxDt`): the simulation advances by real time whatever the cap, so physics steps
 * and experiment runs are the same at 30 FPS as at 144.
 *
 * It also counts, for the F3 overlay (FrameMeter): the display frames offered (the browser's own
 * rate, the display's refresh unless it slows the page), the frames run, and the longest
 * interval between two frames run.
 */
export class FrameClock {
  private last: number;
  private next: number;
  /** Display frames offered since the clock began. */
  offered = 0;
  /** Frames run since the clock began. */
  ran = 0;
  /** The longest interval between two frames run (ms) since `takeLongest`. */
  private longest = 0;

  constructor(
    start: number,
    private readonly maxDt: number,
  ) {
    this.last = start;
    this.next = start;
  }

  /** The time step (s) to run the frame at `now` (ms) with, or null to skip it. `cap` 0: none. */
  tick(now: number, cap: number): number | null {
    this.offered++;
    if (cap > 0) {
      const interval = 1000 / cap;
      if (now < this.next - TOLERANCE_MS) return null;
      this.next = now - this.next >= interval ? now + interval : this.next + interval;
    }
    this.ran++;
    this.longest = Math.max(this.longest, now - this.last);
    // (A first frame's timestamp can come before the clock began: never a negative step.)
    const dt = Math.min(Math.max(0, now - this.last) / 1000, this.maxDt);
    this.last = now;
    return dt;
  }

  /** The longest interval between two frames run (ms) since the last call; starts again. */
  takeLongest(): number {
    const longest = this.longest;
    this.longest = 0;
    return longest;
  }
}
