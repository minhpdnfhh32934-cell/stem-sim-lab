import type { EngineInput, SimulationEngine } from '@/core/sim/engine';
import { dragAccel } from '../common/drag';
import type { Params } from '../types';
import { accelFor, forces, type InclineInput } from './model';

/** Smallest τ in (0, max] with s + vτ + ½aτ² = target, or Infinity. */
function firstHit(s: number, v: number, a: number, target: number, max: number): number {
  const A = 0.5 * a;
  const C = s - target;
  let roots: number[];
  if (Math.abs(A) < 1e-300) roots = v !== 0 ? [-C / v] : [];
  else {
    const disc = v * v - 4 * A * C;
    if (disc < 0) return Infinity;
    const r = Math.sqrt(disc);
    roots = [(-v - r) / (2 * A), (-v + r) / (2 * A)];
  }
  const ok = roots.filter((t) => t > 1e-12 && t <= max);
  return ok.length ? Math.min(...ok) : Infinity;
}

/** State: [s, v, a, friction, N, off (1 = left the surface)]. */
export const IS = { s: 0, v: 1, a: 2, friction: 3, N: 4, off: 5 } as const;

export function inclineInput(p: Params): InclineInput {
  return {
    m: p.m ?? 1,
    g: p.g ?? 9.81,
    theta: p.theta ?? 0,
    F: p.F ?? 0,
    beta: p.beta ?? 0,
    muS: p.muS ?? p.mu ?? 0,
    muK: p.muK ?? p.mu ?? 0,
    s0: p.s0 ?? 0,
    v0: p.v0 ?? 0,
    length: p.length ?? 10,
  };
}

/**
 * Block on an incline. Between velocity sign changes the acceleration is constant, so
 * the update is exact; the instant v reaches 0 is located inside the step and the
 * static-friction condition is re-evaluated there (exact stick–slip).
 */
export class InclineEngine implements SimulationEngine<Params> {
  readonly id = 'phys.incline';
  readonly stateSize = 6;
  dt = 1 / 240;
  private t = 0;
  private s = 0;
  private v = 0;
  private a = 0;
  private friction = 0;
  private off = false;
  private p: InclineInput = inclineInput({});
  private tEnd = 30;
  private drag: number | null = null;
  private restTime = 0;

  reset(params: Params): void {
    this.p = inclineInput(params);
    this.tEnd = params.tEnd ?? 30;
    this.t = 0;
    this.s = this.p.s0;
    this.v = this.p.v0;
    this.off = false;
    this.drag = null;
    this.restTime = 0;
    const r = accelFor(this.p, this.v);
    this.a = r.a;
    this.friction = r.friction;
  }

  step(): void {
    let h = this.dt;
    this.t += h;
    if (this.off) return;
    if (this.drag !== null) {
      const acc = dragAccel(this.drag, this.s, this.v);
      this.v += acc * h;
      this.s = Math.min(this.p.length, Math.max(0, this.s + this.v * h));
      this.a = acc;
      return;
    }
    // Up to two sub-intervals: motion until v = 0, then the regime after stopping.
    for (let k = 0; k < 3 && h > 0; k++) {
      const r = accelFor(this.p, this.v);
      this.a = r.a;
      this.friction = r.friction;
      if (r.regime === 'static') {
        this.v = 0;
        this.restTime += h;
        break;
      }
      this.restTime = 0;
      let tau = h;
      const startV = this.v;
      if (startV !== 0 && Math.sign(r.a) !== Math.sign(startV) && r.a !== 0) {
        const ts = -startV / r.a;
        if (ts < tau) tau = ts;
      }
      // Leaving the surface (s = 0 or s = L) inside this sub-interval: stop exactly there.
      const tb = Math.min(
        firstHit(this.s, this.v, r.a, 0, tau),
        firstHit(this.s, this.v, r.a, this.p.length, tau),
      );
      if (tb <= tau) {
        this.s = this.s + this.v * tb + 0.5 * r.a * tb * tb;
        this.s = Math.min(this.p.length, Math.max(0, this.s));
        this.v = this.v + r.a * tb;
        this.off = true;
        return;
      }
      this.s += this.v * tau + 0.5 * r.a * tau * tau;
      this.v = tau < h ? 0 : this.v + r.a * tau;
      h -= tau;
    }
  }

  time(): number {
    return this.t;
  }

  readState(out: Float64Array): void {
    out[IS.s] = this.s;
    out[IS.v] = this.v;
    out[IS.a] = this.off ? 0 : this.a;
    out[IS.friction] = this.friction;
    out[IS.N] = forces(this.p).N;
    out[IS.off] = this.off ? 1 : 0;
  }

  writeState(st: Float64Array, t: number): void {
    this.s = st[IS.s] ?? 0;
    this.v = st[IS.v] ?? 0;
    this.a = st[IS.a] ?? 0;
    this.friction = st[IS.friction] ?? 0;
    this.off = (st[IS.off] ?? 0) > 0.5;
    this.t = t;
  }

  input(msg: EngineInput): boolean {
    switch (msg.kind) {
      case 'dragStart': {
        this.off = false;
        this.drag = this.project(msg.x, msg.y);
        return true;
      }
      case 'dragMove':
        if (this.drag !== null) this.drag = this.project(msg.x, msg.y);
        return this.drag !== null;
      case 'dragEnd':
        this.drag = null;
        return true;
      case 'setParam':
        return false;
    }
  }

  /** Projects a world point onto the incline coordinate (bottom at the origin). */
  private project(x: number, y: number): number {
    const c = Math.cos(this.p.theta);
    const s = Math.sin(this.p.theta);
    return Math.min(this.p.length, Math.max(0, x * c + y * s));
  }

  finished(): boolean {
    if (this.drag !== null) return false;
    return this.off || this.t >= this.tEnd || this.restTime > 1;
  }
}
