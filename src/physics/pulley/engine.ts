import type { EngineInput, SimulationEngine } from '@/core/sim/engine';
import { advance1D, accel1D, type Coulomb1D } from '../common/coulomb1d';
import { dragAccel } from '../common/drag';
import type { Params } from '../types';

/** Configurations: 0 = Atwood (both hanging), 1 = m1 on a table, 2 = m1 on an incline. */
export type PulleyConfig = 0 | 1 | 2;

/** State: [s (m2 displacement downward), v, a, T (tension), friction, ended]. */
export const PU = { s: 0, v: 1, a: 2, T: 3, friction: 4, ended: 5 } as const;

export interface PulleyInput {
  config: PulleyConfig;
  m1: number;
  m2: number;
  g: number;
  theta: number;
  muS: number;
  muK: number;
  /** Maximum travel of m2 in either direction before something hits (m). */
  travel: number;
}

export function pulleyInput(p: Params): PulleyInput {
  const config = Math.round(p.config ?? 0);
  return {
    config: config === 1 || config === 2 ? config : 0,
    m1: p.m1 ?? 1,
    m2: p.m2 ?? 1,
    g: p.g ?? 9.81,
    theta: p.theta ?? 0,
    muS: p.muS ?? p.mu ?? 0,
    muK: p.muK ?? p.mu ?? 0,
    travel: p.travel ?? 1.5,
  };
}

/**
 * Reduces the two-body system (massless inextensible string, ideal pulley) to one
 * coordinate s: M = m1 + m2, driving force D, friction on m1 only.
 */
export function reduce(q: PulleyInput): Coulomb1D & { N: number } {
  const M = q.m1 + q.m2;
  switch (q.config) {
    case 0:
      return { M, D: (q.m2 - q.m1) * q.g, Fs: 0, Fk: 0, N: 0 };
    case 1: {
      const N = q.m1 * q.g;
      return { M, D: q.m2 * q.g, Fs: q.muS * N, Fk: q.muK * N, N };
    }
    case 2: {
      const N = q.m1 * q.g * Math.cos(q.theta);
      return { M, D: q.m2 * q.g - q.m1 * q.g * Math.sin(q.theta), Fs: q.muS * N, Fk: q.muK * N, N };
    }
  }
}

/** String tension from m2's equation: m2 g − T = m2 a. */
export const tension = (q: PulleyInput, a: number) => q.m2 * (q.g - a);

export class PulleyEngine implements SimulationEngine<Params> {
  readonly id = 'phys.pulley';
  readonly stateSize = 6;
  dt = 1 / 240;
  private t = 0;
  private s = 0;
  private v = 0;
  private a = 0;
  private friction = 0;
  private ended = false;
  private q: PulleyInput = pulleyInput({});
  private drag: number | null = null;
  private rest = 0;

  reset(p: Params): void {
    this.q = pulleyInput(p);
    this.t = 0;
    this.s = 0;
    this.v = 0;
    this.ended = false;
    this.drag = null;
    this.rest = 0;
    const r = accel1D(reduce(this.q), 0);
    this.a = r.a;
    this.friction = r.friction;
  }

  step(): void {
    const h = this.dt;
    this.t += h;
    if (this.ended) return;
    if (this.drag !== null) {
      const acc = dragAccel(this.drag, this.s, this.v);
      this.v += acc * h;
      this.s = Math.min(this.q.travel, Math.max(-this.q.travel, this.s + this.v * h));
      this.a = acc;
      return;
    }
    const r = advance1D(reduce(this.q), this.s, this.v, h, -this.q.travel, this.q.travel);
    this.s = r.s;
    this.v = r.v;
    this.a = r.a;
    this.friction = r.friction;
    this.rest = r.rest > 0 ? this.rest + r.rest : 0;
    if (r.hitLimit) this.ended = true;
  }

  time(): number {
    return this.t;
  }

  readState(out: Float64Array): void {
    out[PU.s] = this.s;
    out[PU.v] = this.v;
    out[PU.a] = this.ended ? 0 : this.a;
    out[PU.T] = this.drag !== null ? Number.NaN : tension(this.q, this.ended ? 0 : this.a);
    out[PU.friction] = this.friction;
    out[PU.ended] = this.ended ? 1 : 0;
    // Tension is undefined while the hand holds the block; report 0 instead of NaN.
    if (Number.isNaN(out[PU.T])) out[PU.T] = 0;
  }

  writeState(st: Float64Array, t: number): void {
    this.s = st[PU.s] ?? 0;
    this.v = st[PU.v] ?? 0;
    this.a = st[PU.a] ?? 0;
    this.friction = st[PU.friction] ?? 0;
    this.ended = (st[PU.ended] ?? 0) > 0.5;
    this.t = t;
  }

  input(msg: EngineInput): boolean {
    switch (msg.kind) {
      case 'dragStart':
        this.ended = false;
        this.drag = this.s;
        this.dragOrigin = { body: msg.body, x: msg.x, y: msg.y, s: this.s };
        return true;
      case 'dragMove': {
        const o = this.dragOrigin;
        if (this.drag === null || !o) return false;
        // m2 (body 1) follows the vertical pointer motion; m1 follows it along its path.
        const d =
          o.body === 1
            ? o.y - msg.y
            : this.q.config === 0
              ? msg.y - o.y
              : this.q.config === 1
                ? msg.x - o.x
                : (msg.x - o.x) * Math.cos(this.q.theta) + (msg.y - o.y) * Math.sin(this.q.theta);
        // Every mapping above is oriented so that +d means "m2 moves down".
        this.drag = o.s + d;
        return true;
      }
      case 'dragEnd':
        this.drag = null;
        this.dragOrigin = null;
        return true;
      case 'setParam':
        return false;
    }
  }

  private dragOrigin: { body: number; x: number; y: number; s: number } | null = null;

  finished(): boolean {
    return this.drag === null && (this.ended || this.rest > 1);
  }
}
