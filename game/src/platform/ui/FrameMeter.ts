import type { FrameClock } from '../../core/FrameClock';

/**
 * The frame rate as the F3 overlay shows it (Phú 2026-11-08: "it says 60 FPS", "capped at 60 it
 * runs higher"), measured from the game's one frame loop (FrameClock) over the last refresh:
 * - fps: frames the game ran (and drew) a second;
 * - displayHz: frames the browser offered a second — the display's refresh, unless the browser
 *   slows the page (a background tab, a battery saver): a game held at 60 with no cap is the
 *   browser's doing, not the game's;
 * - frameMs: the mean interval between frames run, and slowestMs the longest one.
 */
export interface FrameReading {
  readonly fps: number;
  readonly displayHz: number;
  readonly frameMs: number;
  readonly slowestMs: number;
}

export class FrameMeter {
  private offered: number;
  private ran: number;
  private at: number;
  reading: FrameReading = { fps: 0, displayHz: 0, frameMs: 0, slowestMs: 0 };

  constructor(
    private readonly clock: FrameClock,
    now: number,
  ) {
    this.offered = clock.offered;
    this.ran = clock.ran;
    this.at = now;
  }

  /** Takes a new reading if `every` s have passed since the last; returns whether it did. */
  sample(now: number, every: number): boolean {
    const elapsed = (now - this.at) / 1000;
    if (elapsed < every) return false;
    const ran = this.clock.ran - this.ran;
    this.reading = {
      fps: ran / elapsed,
      displayHz: (this.clock.offered - this.offered) / elapsed,
      frameMs: ran > 0 ? (elapsed * 1000) / ran : 0,
      slowestMs: this.clock.takeLongest(),
    };
    this.offered = this.clock.offered;
    this.ran = this.clock.ran;
    this.at = now;
    return true;
  }
}

/** The overlay's frame lines (English, as the debug panel: not translated). */
export function frameLines(
  r: FrameReading,
  cap: number,
  graphics: string,
  gpu: string,
): readonly string[] {
  return [
    `FPS:          ${r.fps.toFixed(0)} (cap ${cap === 0 ? 'none' : cap}, graphics ${graphics})`,
    `Frame:        ${r.frameMs.toFixed(1)} ms mean · ${r.slowestMs.toFixed(1)} ms slowest`,
    `Display:      ${r.displayHz.toFixed(0)} Hz offered by the browser`,
    `GPU:          ${gpu || '—'}`,
  ];
}
