import type { GraphicsQuality } from '../../persistence/settings';

/**
 * Graphics built into the processor (a laptop's Intel HD/UHD/Iris, an AMD APU's Radeon Graphics or
 * Vega): Low is their default (quality.ts), unless the player picked a preset. Not Intel Arc, nor
 * the larger APUs (Radeon 680M/780M), which hold Medium.
 */
export const INTEGRATED_GPU =
  /Intel\(R\) (HD|UHD|Iris)|Intel.*\b(HD|UHD|Iris)\b.*Graphics|Radeon\(TM\) (Vega \d+ )?Graphics|Radeon Vega|Mali|Adreno|PowerVR/i;

/** Below this many frames a second (the window's median), a lower preset is taken. */
export const SLOW_FPS = 40;
/** The window a median is taken over (s of play). */
export const WINDOW_S = 5;
/** Not counted after a scene comes in or the preset changes (s): its programs and uploads. */
export const SETTLE_S = 3;

/** The preset one step below `quality`, or null at Low. */
export function lowerQuality(quality: GraphicsQuality): GraphicsQuality | null {
  switch (quality) {
    case 'ultra':
      return 'high';
    case 'high':
      return 'medium';
    case 'medium':
      return 'low';
    case 'low':
      return null;
  }
}

/**
 * Watches the frame intervals while the player plays (the renderer feeds it): when the median over
 * WINDOW_S is slower than SLOW_FPS, `frame` says so once and starts over. A median, so a door's or a
 * first program's hitch alone never counts; the first SETTLE_S after a start are left out.
 * Allocation-free per frame.
 */
export class QualityWatch {
  private readonly frames = new Float32Array(1024);
  private count = 0;
  private time = 0;
  private settle = SETTLE_S;

  /** Starts over, settling first (a scene came in, the preset changed, play paused). */
  reset(): void {
    this.count = 0;
    this.time = 0;
    this.settle = SETTLE_S;
  }

  /** One frame's interval (s) in play; true when the window just ended too slow. */
  frame(dt: number): boolean {
    if (this.settle > 0) {
      this.settle -= dt;
      return false;
    }
    if (this.count < this.frames.length) this.frames[this.count++] = dt;
    this.time += dt;
    if (this.time < WINDOW_S) return false;
    const window = this.frames.subarray(0, this.count).sort();
    const median = window[window.length >> 1] ?? 0;
    this.count = 0;
    this.time = 0;
    return median > 1 / SLOW_FPS;
  }
}
