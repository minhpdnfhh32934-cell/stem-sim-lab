/**
 * Decorative CSS animations advanced a few times a second instead of at the screen's rate (Phú,
 * 2026-11-18: with the menu's still background the integrated GPU stayed busy). A running CSS
 * animation makes the browser draw and present the page every frame — 300 times a second on a
 * 300 Hz screen — even when it moves a star by 0.04 px, and the menu's emblem (SVG parts, on the
 * main thread) a paint and a commit each time. Paused and moved on here at `hz`, their keyframes,
 * delays and easing stay exactly as the stylesheet has them; the page is drawn about `hz` times a
 * second while nothing else changes.
 *
 * Only looping CSS animations (never transitions or entrances: a hover or an entrance stays the
 * browser's), found by
 * `animations` again whenever `refresh` is called (the browser makes them anew when an element is
 * shown again after display: none).
 */
export interface Stepped {
  pause(): void;
  currentTime: CSSNumberish | null;
  /** 'idle' once its CSS took it away (animation: none, display: none): never moved again. */
  readonly playState: AnimationPlayState;
}

export class SteppedMotion {
  private list: readonly Stepped[] = [];
  private stale = true;
  private since = 0;

  constructor(
    /** The animations to step (CSS animations only), looked up again after `refresh`. */
    private readonly animations: () => readonly Stepped[],
    /** Their updates a second at most. */
    private readonly hz: number,
  ) {}

  /** Look the animations up again on the next update (shown again, or the elements changed). */
  refresh(): void {
    this.stale = true;
  }

  /** `dt` s on: each animation paused (once) and moved on by the time since its last step. */
  update(dt: number): void {
    if (this.stale) {
      this.stale = false;
      this.list = this.animations();
      for (const a of this.list) a.pause();
      this.since = 0;
      return; // the browser ran them up to now: stepped from the next frame
    }
    this.since += dt;
    if (this.since < 1 / this.hz) return;
    const ms = this.since * 1000;
    this.since = 0;
    for (const a of this.list) {
      // Cancelled by its CSS (reduced motion, hidden): left alone — moving it would bring it back.
      if (a.playState === 'idle') {
        this.stale = true; // looked up again: what the CSS has now
        continue;
      }
      a.currentTime = (Number(a.currentTime) || 0) + ms;
    }
  }
}

/** The looping CSS animations (not transitions, not one-off entrances) in these elements. */
export function cssAnimationsIn(roots: readonly Element[]): Stepped[] {
  const out: Stepped[] = [];
  for (const root of roots) {
    for (const a of root.getAnimations({ subtree: true })) {
      // Loops only: an entrance plays once at the browser's own rate (and ends as it says).
      if (a instanceof CSSAnimation && a.effect?.getTiming().iterations === Infinity) out.push(a);
    }
  }
  return out;
}
