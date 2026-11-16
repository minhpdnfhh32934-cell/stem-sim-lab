import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import {
  energy,
  isValid,
  pathLength,
  platesInput,
  pointAt,
  potential,
  work,
  type Plates,
} from './model';

/** State: [x, y (m), distance along the path s (m), V (V), W (J), work done so far A (J)]. */
export const PT = { x: 0, y: 1, s: 2, V: 3, W: 4, A: 5 } as const;

/** The charge is carried from M to N in this time (an illustration, not its own motion). */
export const MOVE_TIME = 4;
/** Run length: the move, then one second at N. */
export const RUN_TIME = MOVE_TIME + 1;

/**
 * The charge is carried slowly along the chosen path at a steady pace; at each step the state is
 * the exact V, W at its place and the exact work of the electric force from M (nothing builds up).
 */
export class PotentialEngine implements SimulationEngine<Params> {
  readonly id = 'phys.electricPotential';
  readonly stateSize = 6;
  dt = 1 / 60;
  private n = 0;
  private q: Plates = platesInput({});
  private ok = true;

  reset(p: Params): void {
    this.q = platesInput(p);
    this.ok = isValid(this.q);
    this.n = 0;
  }

  step(): void {
    this.n++;
  }

  time(): number {
    return this.n * this.dt;
  }

  readState(out: Float64Array): void {
    const q = this.q;
    const s = this.ok ? pathLength(q) * Math.min(1, this.time() / MOVE_TIME) : 0;
    const at = this.ok ? pointAt(q, s) : q.M;
    out[PT.x] = at.x;
    out[PT.y] = at.y;
    out[PT.s] = s;
    out[PT.V] = this.ok ? potential(q, at.y) : 0;
    out[PT.W] = this.ok ? energy(q, at.y) : 0;
    out[PT.A] = this.ok ? work(q, q.M, at) : 0;
  }

  writeState(_s: Float64Array, t: number): void {
    this.n = Math.round(t / this.dt);
  }

  input(): boolean {
    return false;
  }

  finished(): boolean {
    return this.time() >= RUN_TIME;
  }
}
