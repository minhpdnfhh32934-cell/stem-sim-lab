/**
 * Recorded simulation states for graphs, the data table and scrubbing ("tua"). Every sample is
 * a state the engine computed (never interpolated). Samples are at least `baseSpacing` of
 * screen time apart: that much simulated time × the playback speed, so slow motion (×0,1) keeps
 * ten times more samples per second of simulation (UI-22: a 25 Hz wave got ~5 per period).
 * When the buffer is full, every other sample is dropped (long runs keep their overall shape),
 * except in a run with no end of its own (#205 C1): it keeps its latest stretch at full
 * resolution and lets the oldest samples go.
 */
export class History {
  readonly times: number[] = [];
  readonly states: Float64Array[] = [];
  /** Playback speed (×0,1 … ×1000) the spacing follows. */
  private timeScale = 1;
  /** 2ⁿ after n decimations. */
  private level = 1;
  /** A run with no end: drop the oldest samples instead of thinning the whole run. */
  private windowed = false;
  private dropped = false;

  constructor(
    private readonly baseSpacing = 1 / 120,
    private readonly maxSamples = 12000,
  ) {}

  /** Minimum simulated time between two samples. */
  private get spacing(): number {
    return this.baseSpacing * this.timeScale * this.level;
  }

  /** Follows the playback speed from the next sample on (samples already kept stay). */
  setTimeScale(speed: number): void {
    if (Number.isFinite(speed) && speed > 0) this.timeScale = speed;
  }

  get length(): number {
    return this.times.length;
  }

  get duration(): number {
    return this.times.at(-1) ?? 0;
  }

  /** Time of the oldest sample kept (0 until a windowed run lets samples go). */
  get start(): number {
    return this.times[0] ?? 0;
  }

  /** True once the oldest samples of a windowed run went: the data is its latest stretch. */
  get trimmed(): boolean {
    return this.dropped;
  }

  setWindowed(on: boolean): void {
    this.windowed = on;
  }

  clear(): void {
    this.times.length = 0;
    this.states.length = 0;
    this.level = 1;
    this.dropped = false;
  }

  /** Adds a sample if enough simulated time has passed since the previous one. */
  push(t: number, state: Float64Array, force = false): void {
    const last = this.times.at(-1);
    if (last !== undefined) {
      if (t < last - 1e-12) this.truncateAfter(t);
      else if (!force && t - last < this.spacing - 1e-12) return;
      else if (t === last) return;
    }
    this.times.push(t);
    this.states.push(Float64Array.from(state));
    if (this.times.length <= this.maxSamples) return;
    if (!this.windowed) {
      this.decimate();
      return;
    }
    // A quarter at a time: amortised O(1) per sample, never more than maxSamples kept.
    const drop = Math.ceil(this.maxSamples / 4);
    this.times.splice(0, drop);
    this.states.splice(0, drop);
    this.dropped = true;
  }

  /** Keeps every other sample (also used by the memory watchdog to free memory). */
  decimate(): void {
    const keepT: number[] = [];
    const keepS: Float64Array[] = [];
    for (let i = 0; i < this.times.length; i += 2) {
      const t = this.times[i];
      const s = this.states[i];
      if (t === undefined || !s) continue;
      keepT.push(t);
      keepS.push(s);
    }
    this.times.splice(0, this.times.length, ...keepT);
    this.states.splice(0, this.states.length, ...keepS);
    this.level *= 2;
  }

  /** Removes samples after time t (used when resuming from a scrubbed point). */
  truncateAfter(t: number): void {
    let n = this.times.length;
    while (n > 0 && (this.times[n - 1] ?? 0) > t + 1e-12) n--;
    this.times.length = n;
    this.states.length = n;
  }

  /** Index of the last sample with time ≤ t (−1 if none). */
  indexAt(t: number): number {
    let lo = 0;
    let hi = this.times.length - 1;
    if (hi < 0 || t < (this.times[0] ?? 0)) return -1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.times[mid] ?? 0) <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** Linearly interpolated state at time t (clamped to the recorded range). */
  stateAt(t: number): Float64Array | null {
    const n = this.times.length;
    if (n === 0) return null;
    const i = this.indexAt(t);
    if (i < 0) return Float64Array.from(this.states[0] ?? []);
    if (i >= n - 1) return Float64Array.from(this.states[n - 1] ?? []);
    const t0 = this.times[i] ?? 0;
    const t1 = this.times[i + 1] ?? t0;
    const a = this.states[i];
    const b = this.states[i + 1];
    if (!a || !b) return null;
    const w = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    const out = new Float64Array(a.length);
    for (let k = 0; k < a.length; k++) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * w;
    return out;
  }
}
