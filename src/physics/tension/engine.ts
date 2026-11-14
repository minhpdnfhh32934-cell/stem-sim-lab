import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { hanging, indeterminate, tensions, weight } from './model';

/** State: [T₁, T₂, P] (N). */
export const TS = { T1: 0, T2: 1, P: 2 } as const;

/**
 * A hanging lamp is at rest: the tensions are computed once per reset and only the clock
 * advances, so the graphs and the run controls work like every other scene (as the electric
 * field does).
 */
export class TensionEngine implements SimulationEngine<Params> {
  readonly id = 'phys.tension';
  readonly stateSize = 3;
  dt = 1 / 60;
  private n = 0;
  private t: [number, number, number] = [0, 0, 0];

  reset(p: Params): void {
    const h = hanging(p);
    // Two vertical strings: `validate` stops the scene; no NaN reaches the runner.
    const { T1, T2 } = indeterminate(h) ? { T1: 0, T2: 0 } : tensions(h);
    this.t = [T1, T2, weight(h)];
    this.n = 0;
  }

  step(): void {
    this.n++;
  }

  time(): number {
    return this.n * this.dt;
  }

  readState(out: Float64Array): void {
    out[TS.T1] = this.t[0];
    out[TS.T2] = this.t[1];
    out[TS.P] = this.t[2];
  }

  writeState(_s: Float64Array, t: number): void {
    this.n = Math.round(t / this.dt);
  }

  input(): boolean {
    return false;
  }

  finished(): boolean {
    return this.time() >= 5;
  }
}
