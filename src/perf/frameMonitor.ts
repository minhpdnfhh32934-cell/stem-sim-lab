/**
 * Tracks frame times with an exponential moving average and detects sustained overload
 * (N consecutive frames over budget) for the degradation ladder (MASTER_PROMPT §5).
 */
export class FrameMonitor {
  private ema = 1 / 60;
  private over = 0;
  private samples = 0;

  constructor(
    /** Frame budget in seconds (1/60 for 2D, 1/30 for 3D). */
    public budget = 1 / 60,
    /** Consecutive over-budget frames before `overloaded` becomes true. */
    public patience = 45,
    private readonly smoothing = 0.1,
  ) {}

  record(frameSeconds: number): void {
    if (!(frameSeconds > 0) || frameSeconds > 1) return; // ignore pauses / hidden tabs
    this.samples++;
    this.ema += this.smoothing * (frameSeconds - this.ema);
    // 20% tolerance so vsync jitter does not count as overload.
    this.over = frameSeconds > this.budget * 1.2 ? this.over + 1 : 0;
  }

  get fps(): number {
    return 1 / this.ema;
  }

  get overloaded(): boolean {
    return this.over >= this.patience;
  }

  get sampleCount(): number {
    return this.samples;
  }

  resetOverload(): void {
    this.over = 0;
  }
}
