import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { circular, stateAt, type Circular } from './model';

/** State: [φ, x, y, vx, vy, ax, ay]. */
export const CE = { phi: 0, x: 1, y: 2, vx: 3, vy: 4, ax: 5, ay: 6 } as const;

/**
 * Uniform circular motion, exact: the phase is φ₀ + ω·t with t = n·Δt from the step count,
 * so nothing accumulates and radius and speed stay constant to rounding. Nothing can be
 * dragged (the body follows the parameters the solution and challenges read).
 */
export class CircularEngine implements SimulationEngine<Params> {
  readonly id = 'phys.circular';
  readonly stateSize = 7;
  dt = 1 / 240;
  private n = 0;
  private c: Circular = circular({});
  private tEnd = 60;

  reset(p: Params): void {
    this.c = circular(p);
    this.tEnd = p.tEnd ?? 60;
    this.n = 0;
  }

  step(): void {
    this.n++;
  }

  time(): number {
    return this.n * this.dt;
  }

  readState(out: Float64Array): void {
    const s = stateAt(this.c, this.time());
    out[CE.phi] = s.phi;
    out[CE.x] = s.x;
    out[CE.y] = s.y;
    out[CE.vx] = s.vx;
    out[CE.vy] = s.vy;
    out[CE.ax] = s.ax;
    out[CE.ay] = s.ay;
  }

  writeState(_s: Float64Array, t: number): void {
    this.n = Math.round(t / this.dt);
  }

  input(): boolean {
    return false;
  }

  finished(): boolean {
    return this.time() >= this.tEnd;
  }
}
