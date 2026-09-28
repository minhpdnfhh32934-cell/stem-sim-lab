import type { EngineInput, SimulationEngine } from '@/core/sim/engine';
import { dragAccel } from '../common/drag';
import type { Params } from '../types';

/** State layout: [x, y, vx, vy, ax, ay, landed]. */
export const PS = { x: 0, y: 1, vx: 2, vy: 3, ax: 4, ay: 5, landed: 6 } as const;

/**
 * Point-mass projectile under uniform gravity. Between interactions the acceleration is
 * constant, so the position update x += v·Δt + ½·a·Δt² is exact (no truncation error).
 * Landing (y = 0) is located exactly inside the step by solving the quadratic.
 * While the user drags the ball a damped spring pulls it toward the pointer (§6.1).
 */
export class ProjectileEngine implements SimulationEngine<Params> {
  readonly id = 'phys.projectile';
  readonly stateSize = 7;
  dt = 1 / 240;
  private t = 0;
  private x = 0;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private ax = 0;
  private ay = 0;
  private landed = false;
  private g = 9.81;
  private drag: { x: number; y: number } | null = null;

  reset(p: Params): void {
    this.g = p.g ?? 9.81;
    const v0 = p.v0 ?? 0;
    const angle = p.angle ?? 0;
    this.t = 0;
    this.x = 0;
    this.y = p.h0 ?? 0;
    this.vx = v0 * Math.cos(angle);
    this.vy = v0 * Math.sin(angle);
    this.ax = 0;
    this.ay = -this.g;
    this.landed = false;
    this.drag = null;
  }

  private accel(x: number, y: number, vx: number, vy: number): [number, number] {
    if (!this.drag) return [0, -this.g];
    // While held, gravity is balanced by the hand; the spring alone moves the ball.
    return [dragAccel(this.drag.x, x, vx), dragAccel(this.drag.y, y, vy)];
  }

  step(): void {
    const h = this.dt;
    if (this.landed && !this.drag) {
      this.t += h;
      return;
    }
    const [ax, ay] = this.accel(this.x, this.y, this.vx, this.vy);
    let nx = this.x + this.vx * h + 0.5 * ax * h * h;
    let ny = this.y + this.vy * h + 0.5 * ay * h * h;
    let nvx = this.vx + ax * h;
    let nvy = this.vy + ay * h;
    if (this.drag) {
      // Velocity-dependent spring: refine with one corrector (Heun) for stability.
      const [ax2, ay2] = this.accel(nx, ny, nvx, nvy);
      nvx = this.vx + 0.5 * (ax + ax2) * h;
      nvy = this.vy + 0.5 * (ay + ay2) * h;
      nx = this.x + 0.5 * (this.vx + nvx) * h;
      ny = Math.max(0, this.y + 0.5 * (this.vy + nvy) * h);
      this.landed = false;
    } else if (ny <= 0 && this.vy * h + 0.5 * ay * h * h < 0) {
      // Exact landing time s ∈ (0, h]: y + vy s + ½ ay s² = 0.
      const a = 0.5 * ay;
      const b = this.vy;
      const c = this.y;
      const disc = Math.max(0, b * b - 4 * a * c);
      const s = a !== 0 ? (-b - Math.sqrt(disc)) / (2 * a) : -c / b;
      const sc = Math.min(h, Math.max(0, s));
      nx = this.x + this.vx * sc;
      ny = 0;
      nvx = this.vx;
      nvy = this.vy + ay * sc;
      this.landed = true;
      this.t += sc;
      this.x = nx;
      this.y = ny;
      this.vx = nvx;
      this.vy = nvy;
      this.ax = ax;
      this.ay = ay;
      return;
    }
    this.t += h;
    this.x = nx;
    this.y = ny;
    this.vx = nvx;
    this.vy = nvy;
    this.ax = ax;
    this.ay = ay;
  }

  time(): number {
    return this.t;
  }

  readState(out: Float64Array): void {
    out[PS.x] = this.x;
    out[PS.y] = this.y;
    out[PS.vx] = this.vx;
    out[PS.vy] = this.vy;
    out[PS.ax] = this.ax;
    out[PS.ay] = this.ay;
    out[PS.landed] = this.landed ? 1 : 0;
  }

  writeState(s: Float64Array, t: number): void {
    this.x = s[PS.x] ?? 0;
    this.y = s[PS.y] ?? 0;
    this.vx = s[PS.vx] ?? 0;
    this.vy = s[PS.vy] ?? 0;
    this.ax = s[PS.ax] ?? 0;
    this.ay = s[PS.ay] ?? -this.g;
    this.landed = (s[PS.landed] ?? 0) > 0.5;
    this.t = t;
  }

  diagnostics() {
    // Specific mechanical energy (per unit mass): ½v² + g·y.
    return {
      invariants: { energy: 0.5 * (this.vx ** 2 + this.vy ** 2) + this.g * this.y },
    };
  }

  input(msg: EngineInput): boolean {
    switch (msg.kind) {
      case 'dragStart':
        this.drag = { x: msg.x, y: Math.max(0, msg.y) };
        this.landed = false;
        return true;
      case 'dragMove':
        if (this.drag) this.drag = { x: msg.x, y: Math.max(0, msg.y) };
        return this.drag !== null;
      case 'dragEnd':
        this.drag = null;
        return true;
      case 'setParam':
        if (msg.name === 'g') {
          this.g = msg.value;
          return true;
        }
        return false;
    }
  }

  finished(): boolean {
    return this.landed && !this.drag;
  }
}
