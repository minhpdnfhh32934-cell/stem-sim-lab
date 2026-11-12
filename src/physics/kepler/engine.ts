import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { orbit, stateAt, type Orbit } from './model';

/** State: [x, y, vx, vy, r, v, areal velocity (x·vy − y·vx)/2]. */
export const KE = { x: 0, y: 1, vx: 2, vy: 3, r: 4, v: 5, areal: 6 } as const;

/**
 * Kepler orbit, exact: the state comes straight from t = n·Δt through Kepler's equation (Newton's
 * method to rounding), so nothing accumulates. Nothing can be dragged.
 */
export class KeplerEngine implements SimulationEngine<Params> {
  readonly id = 'phys.kepler';
  readonly stateSize = 7;
  dt = 1 / 240;
  private n = 0;
  private o: Orbit = orbit({});
  /** No end of its own (#205 C1): it runs until paused. Only a caller (a test) sets one. */
  private tEnd: number | undefined;

  reset(p: Params): void {
    this.o = orbit(p);
    this.tEnd = p.tEnd;
    this.n = 0;
  }

  step(): void {
    this.n++;
  }

  time(): number {
    return this.n * this.dt;
  }

  readState(out: Float64Array): void {
    const s = stateAt(this.o, this.time());
    out[KE.x] = s.x;
    out[KE.y] = s.y;
    out[KE.vx] = s.vx;
    out[KE.vy] = s.vy;
    out[KE.r] = Math.hypot(s.x, s.y);
    out[KE.v] = Math.hypot(s.vx, s.vy);
    out[KE.areal] = (s.x * s.vy - s.y * s.vx) / 2;
  }

  writeState(_s: Float64Array, t: number): void {
    this.n = Math.round(t / this.dt);
  }

  input(): boolean {
    return false;
  }

  finished(): boolean {
    return this.tEnd !== undefined && this.time() >= this.tEnd;
  }
}
