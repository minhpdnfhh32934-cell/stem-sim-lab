import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { forced, stateAt, type Forced } from './model';

/** State: [x, v, a, extension (= x), spring force −k·x, driving force F₀ cos Ωt]. */
export const RE = { x: 0, v: 1, a: 2, ext: 3, F: 4, Fd: 5 } as const;

/**
 * Forced damped oscillator, exact: the state is computed straight from t = n·Δt (closed-form
 * steady part + exact free part), so nothing accumulates. Nothing can be dragged (the solution,
 * the challenge and the prediction read the parameters).
 */
export class ResonanceEngine implements SimulationEngine<Params> {
  readonly id = 'phys.resonance';
  readonly stateSize = 6;
  dt = 1 / 240;
  private n = 0;
  private o: Forced = forced({});
  /** No end of its own (#205 C1): it runs until paused. Only a caller (a test) sets one. */
  private tEnd: number | undefined;

  reset(p: Params): void {
    this.o = forced(p);
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
    out[RE.x] = s.x;
    out[RE.v] = s.v;
    out[RE.a] = s.a;
    out[RE.ext] = s.x;
    out[RE.F] = -this.o.k * s.x;
    out[RE.Fd] = s.Fd;
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
