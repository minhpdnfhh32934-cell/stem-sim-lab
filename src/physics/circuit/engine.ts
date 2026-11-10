import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { circuitInput, solveCircuit } from './model';

/** State: main current, terminal voltage, power of the external circuit, efficiency. */
export const CE = { I: 0, U: 1, P: 2, H: 3 } as const;

/**
 * A direct-current circuit at steady state: computed once per reset; only the clock advances, so
 * the graphs (constant lines) and the run controls work like every other scene.
 */
export class CircuitEngine implements SimulationEngine<Params> {
  readonly id = 'phys.circuit';
  readonly stateSize = 4;
  dt = 1 / 60;
  private n = 0;
  private s: [number, number, number, number] = [0, 0, 0, 0];

  reset(p: Params): void {
    const r = solveCircuit(circuitInput(p));
    this.s = [r.I, r.U, r.Pout, r.H];
    this.n = 0;
  }

  step(): void {
    this.n++;
  }

  time(): number {
    return this.n * this.dt;
  }

  readState(out: Float64Array): void {
    this.s.forEach((v, i) => (out[i] = v));
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
