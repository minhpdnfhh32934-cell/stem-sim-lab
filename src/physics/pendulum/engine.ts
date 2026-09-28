import type { EngineInput, SimulationEngine } from '@/core/sim/engine';
import { Rk4 } from '@/core/ode/rk4';
import { dragAccel } from '../common/drag';
import { propagate } from '../spring/model';
import type { Params } from '../types';

/** State: [θ, ω, angular acceleration, θ_small, tension, ω_small] (small = linearised model). */
export const PE = { th: 0, om: 1, al: 2, thS: 3, T: 4, omS: 5 } as const;

export interface PendulumInput {
  L: number;
  m: number;
  g: number;
  theta0: number;
  omega0: number;
  /** Linear damping on the angle (1/s), 0 = none. */
  c: number;
}

export function pendulumInput(p: Params): PendulumInput {
  return {
    L: p.L ?? 1,
    m: p.m ?? 1,
    g: p.g ?? 9.81,
    theta0: p.theta0 ?? 0.2,
    omega0: p.omega0 ?? 0,
    c: p.c ?? 0,
  };
}

const SUBSTEPS = 8;

/**
 * Simple pendulum θ″ = −(g/L) sin θ − c θ′ integrated with RK4 (8 substeps per Δt,
 * h = 1/1920 s: local error ~1e-15). The small-angle model θ″ = −(g/L) θ is advanced
 * with its exact solution alongside for comparison.
 */
export class PendulumEngine implements SimulationEngine<Params> {
  readonly id = 'phys.pendulum';
  readonly stateSize = 6;
  dt = 1 / 240;
  private t = 0;
  private y = new Float64Array(2);
  private small = { th: 0, om: 0 };
  private q: PendulumInput = pendulumInput({});
  private drag: number | null = null;
  private tEnd = 60;
  private readonly rk: Rk4;

  constructor() {
    this.rk = new Rk4((_t, y, d) => {
      const th = y[0] ?? 0;
      const om = y[1] ?? 0;
      d[0] = om;
      d[1] = this.alpha(th, om);
    }, 2);
  }

  private alpha(th: number, om: number): number {
    let a = -(this.q.g / this.q.L) * Math.sin(th) - this.q.c * om;
    if (this.drag !== null) a += dragAccel(this.drag, th, om);
    return a;
  }

  reset(p: Params): void {
    this.q = pendulumInput(p);
    this.tEnd = p.tEnd ?? 120;
    this.t = 0;
    this.y[0] = this.q.theta0;
    this.y[1] = this.q.omega0;
    this.small = { th: this.q.theta0, om: this.q.omega0 };
    this.drag = null;
  }

  step(): void {
    const h = this.dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) this.rk.step(this.t + i * h, this.y, h);
    // Exact solution of the linearised model θ″ + c θ′ + (g/L) θ = 0.
    const [th, om] = propagate(
      { m: 1, k: this.q.g / this.q.L, b: this.q.c },
      this.small.th,
      this.small.om,
      this.dt,
    );
    this.small = { th, om };
    this.t += this.dt;
  }

  time(): number {
    return this.t;
  }

  readState(out: Float64Array): void {
    const th = this.y[0] ?? 0;
    const om = this.y[1] ?? 0;
    out[PE.th] = th;
    out[PE.om] = om;
    out[PE.al] = this.alpha(th, om);
    out[PE.thS] = this.small.th;
    // Tension from the radial equation: T − m g cos θ = m L ω².
    out[PE.T] = this.q.m * (this.q.g * Math.cos(th) + this.q.L * om * om);
    out[PE.omS] = this.small.om;
  }

  writeState(s: Float64Array, t: number): void {
    this.y[0] = s[PE.th] ?? 0;
    this.y[1] = s[PE.om] ?? 0;
    this.small = { th: s[PE.thS] ?? 0, om: s[PE.omS] ?? 0 };
    this.t = t;
  }

  diagnostics() {
    const th = this.y[0] ?? 0;
    const om = this.y[1] ?? 0;
    // Specific energy per unit mass: ½ L² ω² + g L (1 − cos θ).
    return this.q.c === 0
      ? {
          invariants: {
            energy: 0.5 * this.q.L ** 2 * om * om + this.q.g * this.q.L * (1 - Math.cos(th)),
          },
        }
      : {};
  }

  input(msg: EngineInput): boolean {
    const angle = (x: number, y: number) => Math.atan2(x, -y);
    switch (msg.kind) {
      case 'dragStart':
        this.drag = angle(msg.x, msg.y);
        return true;
      case 'dragMove':
        if (this.drag !== null) this.drag = angle(msg.x, msg.y);
        return this.drag !== null;
      case 'dragEnd':
        this.drag = null;
        return true;
      case 'setParam':
        return false;
    }
  }

  finished(): boolean {
    return this.drag === null && this.t >= this.tEnd;
  }
}
