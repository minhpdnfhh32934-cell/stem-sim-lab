import type { EngineInput, SimulationEngine } from '@/core/sim/engine';
import { Rk4 } from '@/core/ode/rk4';
import { dragAccel } from '../common/drag';
import type { Params } from '../types';
import { parabola, trackAccel, twoHills, type Track } from './model';

/** State: [x, ẋ, y, speed along the track, off (1 = ran past an end of the track)]. */
export const TS = { x: 0, xd: 1, y: 2, v: 3, off: 4 } as const;

export function trackFor(p: Params): Track {
  return Math.round(p.shape ?? 0) === 1
    ? twoHills(p.H ?? 3, p.H2 ?? 2, p.a ?? 4, p.w ?? 1.5)
    : parabola(p.H ?? 3, p.a ?? 4);
}

/** Initial x: slightly inside the chosen start so the bead starts on the track. */
export const startX = (p: Params) => p.x0 ?? -(p.a ?? 4);

export class TrackEngine implements SimulationEngine<Params> {
  readonly id = 'phys.track';
  readonly stateSize = 5;
  dt = 1 / 240;
  private t = 0;
  private y = new Float64Array(2);
  private tr: Track = parabola(3, 4);
  private g = 9.81;
  private drag: number | null = null;
  private off = false;
  private tEnd = 60;
  private readonly rk = new Rk4((_t, s, d) => {
    const x = s[0] ?? 0;
    const xd = s[1] ?? 0;
    d[0] = xd;
    d[1] =
      trackAccel(this.tr, this.g, x, xd) + (this.drag !== null ? dragAccel(this.drag, x, xd) : 0);
  }, 2);

  reset(p: Params): void {
    this.tr = trackFor(p);
    this.g = p.g ?? 9.81;
    const x0 = Math.min(this.tr.xMax, Math.max(this.tr.xMin, startX(p)));
    const d = this.tr.df(x0);
    this.y[0] = x0;
    this.y[1] = (p.v0 ?? 0) / Math.sqrt(1 + d * d);
    this.t = 0;
    this.off = false;
    this.drag = null;
    this.tEnd = p.tEnd ?? 60;
  }

  step(): void {
    this.t += this.dt;
    if (this.off) return;
    const h = this.dt / 8;
    for (let i = 0; i < 8; i++) this.rk.step(this.t + i * h, this.y, h);
    const x = this.y[0] ?? 0;
    if (x < this.tr.xMin || x > this.tr.xMax) {
      this.y[0] = Math.min(this.tr.xMax, Math.max(this.tr.xMin, x));
      this.off = true;
    }
  }

  time(): number {
    return this.t;
  }

  readState(out: Float64Array): void {
    const x = this.y[0] ?? 0;
    const xd = this.y[1] ?? 0;
    const d = this.tr.df(x);
    out[TS.x] = x;
    out[TS.xd] = xd;
    out[TS.y] = this.tr.f(x);
    out[TS.v] = Math.sign(xd) * Math.abs(xd) * Math.sqrt(1 + d * d);
    out[TS.off] = this.off ? 1 : 0;
  }

  writeState(s: Float64Array, t: number): void {
    this.y[0] = s[TS.x] ?? 0;
    this.y[1] = s[TS.xd] ?? 0;
    this.off = (s[TS.off] ?? 0) > 0.5;
    this.t = t;
  }

  diagnostics() {
    const x = this.y[0] ?? 0;
    const xd = this.y[1] ?? 0;
    const d = this.tr.df(x);
    // Once the bead has run off an end of the track the model no longer applies.
    if (this.off) return { invariants: {} };
    return { invariants: { energy: 0.5 * (1 + d * d) * xd * xd + this.g * this.tr.f(x) } };
  }

  input(msg: EngineInput): boolean {
    switch (msg.kind) {
      case 'dragStart':
        this.off = false;
        this.drag = msg.x;
        return true;
      case 'dragMove':
        if (this.drag !== null) this.drag = Math.min(this.tr.xMax, Math.max(this.tr.xMin, msg.x));
        return this.drag !== null;
      case 'dragEnd':
        this.drag = null;
        return true;
      case 'setParam':
        return false;
    }
  }

  finished(): boolean {
    return this.drag === null && (this.off || this.t >= this.tEnd);
  }
}
