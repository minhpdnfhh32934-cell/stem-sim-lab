import { type Clip, weightOf } from './poses';
import { random } from './random';

/*
 * Who does what when (Phase W-4): each person rests, then after a gap takes an action from what
 * fits the hour (day or night menu), never the same twice running; an event (the blast) cuts in.
 * Pure and seeded (tested): the same start gives the same afternoon.
 */

export interface Playing<A extends string> {
  readonly clip: Clip<A>;
  /** Progress 0–1. */
  readonly u: number;
  /** How much of it shows (eased in and out). */
  readonly w: number;
}

export class Director<A extends string> {
  private current: { clip: Clip<A>; start: number } | null = null;
  private nextAt: number;
  private last: A | null = null;
  private readonly rnd: () => number;
  /** What `update` hands back: one object, rewritten (nothing allocated per frame). */
  private readonly now: { clip: Clip<A>; u: number; w: number } = {
    clip: null as unknown as Clip<A>,
    u: 0,
    w: 0,
  };

  constructor(
    private readonly clips: Readonly<Record<A, Clip<A>>>,
    seed: number,
    private readonly gap: readonly [number, number],
    firstAt: number,
  ) {
    this.rnd = random(seed);
    this.nextAt = firstAt;
  }

  /** What plays at `time`, starting the next action from `menu` when its time comes. */
  update(time: number, menu: readonly A[]): Playing<A> | null {
    if (this.current && time >= this.current.start + this.current.clip.length) {
      this.current = null;
      this.nextAt = time + this.gap[0] + this.rnd() * (this.gap[1] - this.gap[0]);
    }
    if (!this.current && time >= this.nextAt && menu.length > 0) {
      // Never the same twice running (picked among the others, no list made).
      const skip = menu.length > 1 && this.last !== null && menu.includes(this.last) ? 1 : 0;
      let i = Math.floor(this.rnd() * (menu.length - skip));
      if (skip && i >= menu.indexOf(this.last as A)) i++;
      const name = menu[i] ?? menu[0];
      if (name !== undefined) this.play(name, time);
    }
    if (!this.current) return null;
    const u = (time - this.current.start) / this.current.clip.length;
    this.now.clip = this.current.clip;
    this.now.u = u;
    this.now.w = weightOf(this.current.clip, u);
    return this.now;
  }

  /** Starts an action now, cutting the one playing (an event). */
  play(name: A, time: number): void {
    this.current = { clip: this.clips[name], start: time };
    this.last = name;
  }

  /** The action playing, if any. */
  get playing(): A | null {
    return this.current?.clip.name ?? null;
  }
}
