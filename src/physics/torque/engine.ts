import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import {
  THETA_MAX,
  angularAccel,
  balanced,
  inertia,
  lever,
  netMoment,
  tipTime,
  type Lever,
} from './model';

/** State: [θ (rad), ω (rad/s), net moment now (N·m), resting on the ground (0/1)]. */
export const TQ = { theta: 0, omega: 1, moment: 2, down: 3 } as const;

/** Run length: until the beam has touched the ground plus one second; 2 s when balanced. */
export const runLength = (q: Lever) => (balanced(q) ? 2 : tipTime(q) + 1);

/**
 * The tipping beam: θ″ = (net moment)·cos θ / I, integrated with RK4 (10 substeps per frame
 * step). At the ground angle it stops (the end rests on the ground). Mechanical energy
 * ½Iω² − (net moment)·sin θ is watched while it turns.
 */
export class TorqueEngine implements SimulationEngine<Params> {
  readonly id = 'phys.torque';
  readonly stateSize = 4;
  dt = 1 / 240;
  private readonly sub = 10;
  private t = 0;
  private th = 0;
  private w = 0;
  private down = false;
  private level = false;
  private q: Lever = lever({});
  private tEnd = 2;

  reset(p: Params): void {
    this.q = lever(p);
    this.t = 0;
    this.th = 0;
    this.w = 0;
    this.down = false;
    this.level = balanced(this.q);
    this.tEnd = p.tEnd ?? runLength(this.q);
  }

  step(): void {
    const h = this.dt / this.sub;
    // Balanced (the moment is rounding only): the beam stays exactly level.
    for (let i = 0; i < this.sub && !this.down && !this.level; i++) {
      const f = (th: number) => angularAccel(this.q, th);
      const k1t = this.w;
      const k1w = f(this.th);
      const k2t = this.w + (h / 2) * k1w;
      const k2w = f(this.th + (h / 2) * k1t);
      const k3t = this.w + (h / 2) * k2w;
      const k3w = f(this.th + (h / 2) * k2t);
      const k4t = this.w + h * k3w;
      const k4w = f(this.th + h * k3t);
      this.th += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
      this.w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
      if (Math.abs(this.th) >= THETA_MAX) {
        // The low end reaches the ground: it rests there.
        this.th = Math.sign(this.th) * THETA_MAX;
        this.w = 0;
        this.down = true;
      }
    }
    this.t += this.dt;
  }

  time(): number {
    return this.t;
  }

  readState(out: Float64Array): void {
    out[TQ.theta] = this.th;
    out[TQ.omega] = this.w;
    out[TQ.moment] = this.down || this.level ? 0 : netMoment(this.q) * Math.cos(this.th);
    out[TQ.down] = this.down ? 1 : 0;
  }

  writeState(s: Float64Array, t: number): void {
    this.th = s[TQ.theta] ?? 0;
    this.w = s[TQ.omega] ?? 0;
    this.down = (s[TQ.down] ?? 0) > 0.5;
    this.t = t;
  }

  diagnostics() {
    // Energy while turning (the stop on the ground is a collision, not part of it). The potential
    // energy is measured from the resting position on the ground, so the reference is not 0.
    const M = netMoment(this.q);
    return this.down
      ? {}
      : {
          invariants: {
            energy:
              0.5 * inertia(this.q) * this.w ** 2 +
              Math.abs(M) * Math.sin(THETA_MAX) -
              M * Math.sin(this.th),
          },
        };
  }

  finished(): boolean {
    return this.t >= this.tEnd;
  }
}
