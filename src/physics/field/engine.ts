import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { MODE, fieldAt, fieldSetup, plateField } from './model';

/** State: field at point M (or between the plates) [Eₓ, E_y, |E|]. */
export const FE = { ex: 0, ey: 1, e: 2 } as const;

/**
 * Electrostatics is static: the field is computed once per reset and only the clock advances, so
 * the graphs and the run controls work like every other scene. Nothing can be dragged (charges
 * and point M move only with their sliders, which the solution, POE and challenges read).
 */
export class FieldEngine implements SimulationEngine<Params> {
  readonly id = 'phys.field';
  readonly stateSize = 3;
  dt = 1 / 60;
  private n = 0;
  private e: [number, number] = [0, 0];

  reset(p: Params): void {
    const s = fieldSetup(p);
    this.e =
      s.mode === MODE.plates
        ? plateField(s.plates, 0, 0)
        : fieldAt(s.charges, s.k, s.probe.x, s.probe.y);
    this.n = 0;
  }

  step(): void {
    this.n++;
  }

  time(): number {
    return this.n * this.dt;
  }

  readState(out: Float64Array): void {
    out[FE.ex] = this.e[0];
    out[FE.ey] = this.e[1];
    out[FE.e] = Math.hypot(this.e[0], this.e[1]);
  }

  writeState(_s: Float64Array, t: number): void {
    this.n = Math.round(t / this.dt);
  }

  input(): boolean {
    return false;
  }

  finished(): boolean {
    return this.time() >= 10;
  }
}
