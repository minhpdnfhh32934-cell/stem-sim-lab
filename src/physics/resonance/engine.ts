import type { SimulationEngine } from '@/core/sim/engine';
import { gammaOf } from '../spring/model';
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
  private tEnd = 60;

  reset(p: Params): void {
    this.o = forced(p);
    // Long enough for the free part to die out (5/γ: below 1 % of its start) and some periods more.
    const g = gammaOf(this.o);
    this.tEnd = p.tEnd ?? Math.max(60, Math.min(600, 5 / g + (20 * Math.PI) / this.o.W));
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
    return this.time() >= this.tEnd;
  }
}
