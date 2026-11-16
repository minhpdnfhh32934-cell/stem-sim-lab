import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { chargeIn, driftSpeed, electronsIn, isValid, wireInput, type Wire } from './model';

/** State: [distance an electron has drifted (m), charge through the section Δq (C), electrons N]. */
export const WR = { s: 0, q: 1, N: 2 } as const;

/**
 * The electrons drift at their real speed (a fraction of a millimetre per second); every value is
 * the closed form at t = n·Δt. Endless: the current flows until the run is paused.
 */
export class CurrentEngine implements SimulationEngine<Params> {
  readonly id = 'phys.electricCurrent';
  readonly stateSize = 3;
  dt = 1 / 60;
  private t0 = 0;
  private steps = 0;
  private w: Wire = wireInput({});
  private ok = true;
  /** No end of its own (#205 C1); only a caller (a test) sets one. */
  private tEnd: number | undefined;

  reset(p: Params): void {
    this.w = wireInput(p);
    this.ok = isValid(this.w);
    this.t0 = 0;
    this.steps = 0;
    this.tEnd = p.tEnd;
  }

  step(): void {
    this.steps++;
  }

  time(): number {
    return this.t0 + this.steps * this.dt;
  }

  readState(out: Float64Array): void {
    const t = this.time();
    out[WR.s] = this.ok ? driftSpeed(this.w) * t : 0;
    out[WR.q] = this.ok ? chargeIn(this.w, t) : 0;
    out[WR.N] = this.ok ? electronsIn(this.w, t) : 0;
  }

  writeState(_s: Float64Array, t: number): void {
    this.t0 = t;
    this.steps = 0;
  }

  finished(): boolean {
    return this.tEnd !== undefined && this.time() >= this.tEnd;
  }
}
