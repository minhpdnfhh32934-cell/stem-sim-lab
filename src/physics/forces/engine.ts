import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { forceSet, resultant, runLength } from './model';

/** State: [x, y, vₓ, v_y] of the ring (m, m/s). */
export const FC = { x: 0, y: 1, vx: 2, vy: 3 } as const;

/** Constant forces: constant acceleration, evaluated exactly at t = steps·dt. */
export class ForcesEngine implements SimulationEngine<Params> {
  readonly id = 'phys.forces';
  readonly stateSize = 4;
  dt = 1 / 240;
  private steps = 0;
  private ax = 0;
  private ay = 0;
  private tEnd = 2;

  reset(p: Params): void {
    const s = forceSet(p);
    const R = resultant(s);
    this.ax = R.x / s.m;
    this.ay = R.y / s.m;
    this.steps = 0;
    this.tEnd = p.tEnd ?? runLength(s);
  }

  step(): void {
    this.steps++;
  }

  time(): number {
    return this.steps * this.dt;
  }

  readState(out: Float64Array): void {
    const t = this.time();
    out[FC.x] = 0.5 * this.ax * t * t;
    out[FC.y] = 0.5 * this.ay * t * t;
    out[FC.vx] = this.ax * t;
    out[FC.vy] = this.ay * t;
  }

  writeState(_s: Float64Array, t: number): void {
    this.steps = Math.round(t / this.dt);
  }

  finished(): boolean {
    return this.time() >= this.tEnd;
  }
}
