import type { EngineInput, SimulationEngine } from '@/core/sim/engine';
import { dragAccel } from '../common/drag';
import type { Params } from '../types';

/** State layout: body k at offset 3k: [x, v, a]. */
export const LS = { xA: 0, vA: 1, aA: 2, xB: 3, vB: 4, aB: 5 } as const;

interface Body {
  x: number;
  v: number;
  a: number;
  a0: number;
  stopAtRest: boolean;
  stopped: boolean;
}

/**
 * Two bodies moving along a straight line with constant accelerations (exact update).
 * A braking body stops exactly when v reaches 0 (the stop instant is located inside the
 * step). The user can drag a body along the line with the spring constraint.
 */
export class LinearEngine implements SimulationEngine<Params> {
  readonly id = 'phys.linear';
  readonly stateSize = 6;
  dt = 1 / 240;
  private t = 0;
  private tEnd = 10;
  private bodies: Body[] = [];
  private drag: { body: number; x: number } | null = null;

  reset(p: Params): void {
    const stop = (p.stopAtRest ?? 1) > 0.5;
    const mk = (x: number, v: number, a: number): Body => ({
      x,
      v,
      a,
      a0: a,
      stopAtRest: stop,
      stopped: false,
    });
    this.bodies = [mk(p.xA ?? 0, p.vA ?? 0, p.aA ?? 0)];
    if ((p.twoBodies ?? 0) > 0.5) this.bodies.push(mk(p.xB ?? 0, p.vB ?? 0, p.aB ?? 0));
    this.tEnd = p.tEnd ?? 10;
    this.t = 0;
    this.drag = null;
  }

  step(): void {
    const h = this.dt;
    this.bodies.forEach((b, i) => {
      if (this.drag?.body === i) {
        // Semi-implicit Euler with the damped spring (velocity-dependent force).
        const acc = dragAccel(this.drag.x, b.x, b.v);
        b.v += acc * h;
        b.x += b.v * h;
        b.a = acc;
        return;
      }
      if (b.stopped) {
        b.a = 0;
        return;
      }
      const vNew = b.v + b.a0 * h;
      if (b.stopAtRest && b.v !== 0 && Math.sign(vNew) !== Math.sign(b.v)) {
        // Stops inside this step at s = −v/a.
        const s = -b.v / b.a0;
        b.x += b.v * s + 0.5 * b.a0 * s * s;
        b.v = 0;
        b.a = 0;
        b.stopped = true;
        return;
      }
      b.x += b.v * h + 0.5 * b.a0 * h * h;
      b.v = vNew;
      b.a = b.a0;
    });
    this.t += h;
  }

  time(): number {
    return this.t;
  }

  readState(out: Float64Array): void {
    out.fill(0);
    this.bodies.forEach((b, i) => {
      out[3 * i] = b.x;
      out[3 * i + 1] = b.v;
      out[3 * i + 2] = b.a;
    });
  }

  writeState(s: Float64Array, t: number): void {
    this.bodies.forEach((b, i) => {
      b.x = s[3 * i] ?? 0;
      b.v = s[3 * i + 1] ?? 0;
      b.a = s[3 * i + 2] ?? 0;
      b.stopped = b.stopAtRest && b.v === 0 && b.a === 0 && t > 0;
    });
    this.t = t;
  }

  input(msg: EngineInput): boolean {
    switch (msg.kind) {
      case 'dragStart':
        if (msg.body >= this.bodies.length) return false;
        this.drag = { body: msg.body, x: msg.x };
        return true;
      case 'dragMove':
        if (this.drag) this.drag = { ...this.drag, x: msg.x };
        return this.drag !== null;
      case 'dragEnd': {
        const d = this.drag;
        this.drag = null;
        if (d) {
          const b = this.bodies[d.body];
          // After a throw the body continues uniformly (no stored acceleration).
          if (b) {
            b.a0 = 0;
            b.a = 0;
            b.stopped = false;
          }
        }
        return true;
      }
      case 'setParam':
        return false;
    }
  }

  finished(): boolean {
    return this.t >= this.tEnd - 1e-9 && !this.drag;
  }
}
