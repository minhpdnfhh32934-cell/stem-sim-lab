/**
 * Fixed-timestep accumulator (Gaffer on Games, "Fix Your Timestep!").
 *
 * Physics always advances in steps of exactly `dt`; rendering interpolates between the
 * last two states with `alpha`. To avoid the "spiral of death" (each slow frame demanding
 * more steps, making the next frame slower), at most `maxSubsteps` steps run per frame.
 * Time that cannot be simulated is dropped and reported, so the UI can show honest
 * slow motion (e.g. "×0,25") instead of silently losing accuracy.
 */
export interface ClockAdvance {
  /** Number of fixed steps to run this frame. */
  steps: number;
  /** Interpolation factor in [0, 1) between the previous and current state. */
  alpha: number;
  /** Simulated seconds that were dropped because of the substep cap. */
  dropped: number;
}

export class FixedStepClock {
  private accumulator = 0;

  constructor(
    public dt = 1 / 240,
    // The runner's per-frame time budget is the real guard; this only bounds pathological cases.
    public maxSubsteps = 512,
  ) {
    if (!(dt > 0)) throw new RangeError('dt must be positive');
  }

  /** `frameSeconds` is real elapsed time; `speed` the playback factor (×0.1 … ×4). */
  advance(frameSeconds: number, speed = 1): ClockAdvance {
    // Clamp huge gaps (tab hidden, debugger) so we never try to catch up minutes of time.
    const wanted = Math.min(Math.max(frameSeconds, 0), 0.25) * speed;
    this.accumulator += wanted;
    let steps = Math.floor(this.accumulator / this.dt + 1e-9);
    let dropped = 0;
    if (steps > this.maxSubsteps) {
      dropped = (steps - this.maxSubsteps) * this.dt;
      steps = this.maxSubsteps;
    }
    this.accumulator -= steps * this.dt + dropped;
    if (this.accumulator < 0) this.accumulator = 0;
    return { steps, alpha: this.accumulator / this.dt, dropped };
  }

  reset(): void {
    this.accumulator = 0;
  }
}
