import type { EngineInput, SimulationEngine } from '@/core/sim/engine';
import { dragAccel } from '../common/drag';
import type { Params } from '../types';
import { propagate, type Oscillator } from './model';

/** State: [x (from equilibrium), v, a, extension Δl, spring force (along +x)]. */
export const SP = { x: 0, v: 1, a: 2, ext: 3, F: 4 } as const;

export interface SpringInput extends Oscillator {
  vertical: boolean;
  g: number;
  l0: number;
  x0: number;
  v0: number;
}

export function springInput(p: Params): SpringInput {
  return {
    m: p.m ?? 1,
    k: p.k ?? 100,
    b: p.b ?? 0,
    vertical: (p.vertical ?? 0) > 0.5,
    g: p.g ?? 9.81,
    l0: p.l0 ?? 0.3,
    x0: p.x0 ?? 0.05,
    v0: p.v0 ?? 0,
  };
}

/** Static extension at equilibrium (vertical: m g / k; horizontal: 0). */
export const staticExtension = (q: SpringInput) => (q.vertical ? (q.m * q.g) / q.k : 0);

/**
 * Spring–mass oscillator stepped with the exact transition map (no truncation error).
 * For a vertical spring x is measured upward from equilibrium; the extension is
 * Δl = m g / k − x. While the user drags the mass a damped spring constraint applies.
 */
export class SpringEngine implements SimulationEngine<Params> {
  readonly id = 'phys.spring';
  readonly stateSize = 5;
  dt = 1 / 240;
  /** Time = start + steps × dt (#205 C1): the free motion is the closed form from the start. */
  private t0 = 0;
  private steps = 0;
  private x0 = 0;
  private v0 = 0;
  private x = 0;
  private v = 0;
  private q: SpringInput = springInput({});
  private drag: number | null = null;
  /** No end of its own (#205 C1): it runs until paused. Only a caller (a test) sets one. */
  private tEnd: number | undefined;

  reset(p: Params): void {
    this.q = springInput(p);
    this.x = this.x0 = this.q.x0;
    this.v = this.v0 = this.q.v0;
    this.t0 = 0;
    this.steps = 0;
    this.drag = null;
    this.tEnd = p.tEnd;
  }

  private accel(x: number, v: number) {
    return (-this.q.k * x - this.q.b * v) / this.q.m;
  }

  step(): void {
    const h = this.dt;
    if (this.drag !== null) {
      // Hand + spring: semi-implicit Euler (numerical while held).
      const a = this.accel(this.x, this.v) + dragAccel(this.drag, this.x, this.v);
      this.v += a * h;
      this.x += this.v * h;
      // The hand moved the mass: the free motion starts again from here.
      this.t0 = this.time() + h;
      this.steps = 0;
      this.x0 = this.x;
      this.v0 = this.v;
    } else {
      this.steps++;
      // Exact in t from the start, never stepped on: no error builds up however long it runs.
      [this.x, this.v] = propagate(this.q, this.x0, this.v0, this.steps * h);
    }
  }

  time(): number {
    return this.t0 + this.steps * this.dt;
  }

  readState(out: Float64Array): void {
    const ext = staticExtension(this.q) + (this.q.vertical ? -this.x : this.x);
    out[SP.x] = this.x;
    out[SP.v] = this.v;
    out[SP.a] = this.accel(this.x, this.v);
    out[SP.ext] = ext;
    // Spring force component along +x (restoring for horizontal; upward pull k·Δl for vertical).
    out[SP.F] = this.q.vertical ? this.q.k * ext : -this.q.k * this.x;
  }

  writeState(s: Float64Array, t: number): void {
    this.x = this.x0 = s[SP.x] ?? 0;
    this.v = this.v0 = s[SP.v] ?? 0;
    this.t0 = t;
    this.steps = 0;
  }

  diagnostics() {
    // Mechanical energy about equilibrium (gravity folds into the shifted spring potential).
    return {
      invariants:
        this.q.b === 0
          ? { energy: 0.5 * this.q.m * this.v ** 2 + 0.5 * this.q.k * this.x ** 2 }
          : {},
    };
  }

  input(msg: EngineInput): boolean {
    const toX = (x: number, y: number) => (this.q.vertical ? y : x);
    switch (msg.kind) {
      case 'dragStart':
        this.drag = toX(msg.x, msg.y);
        return true;
      case 'dragMove':
        if (this.drag !== null) this.drag = toX(msg.x, msg.y);
        return this.drag !== null;
      case 'dragEnd':
        this.drag = null;
        return true;
      case 'setParam':
        return false;
    }
  }

  finished(): boolean {
    return this.drag === null && this.tEnd !== undefined && this.time() >= this.tEnd;
  }
}
