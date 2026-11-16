import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { displacement, front, isValid, partVelocity, travelInput, type Travel } from './model';

/** State: [u at O, u at M, velocity of the part at M, front position x = vt]. */
export const TW = { uO: 0, uM: 1, vM: 2, front: 3 } as const;

/** Fixed step Δt ≤ T/200, so slow playback still shows every swing smoothly. */
export const stepOf = (q: Travel) =>
  q.f > 0 && Number.isFinite(q.f) ? Math.min(1 / 240, 1 / (200 * q.f)) : 1 / 240;

/**
 * The wave evaluated in closed form at t = i·Δt (no accumulation, no truncation error). Endless:
 * the source keeps oscillating until the run is paused. Nothing is dragged in the engine.
 */
export class TravelEngine implements SimulationEngine<Params> {
  readonly id = 'phys.travellingWave';
  readonly stateSize = 4;
  dt = 1 / 240;
  private t0 = 0;
  private steps = 0;
  private q: Travel = travelInput({});
  private ok = true;
  /** No end of its own (#205 C1); only a caller (a test) sets one. */
  private tEnd: number | undefined;

  reset(p: Params): void {
    this.q = travelInput(p);
    this.ok = isValid(this.q);
    this.dt = stepOf(this.q);
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
    const q = this.q;
    out[TW.uO] = this.ok ? displacement(q, 0, t) : 0;
    out[TW.uM] = this.ok ? displacement(q, q.xM, t) : 0;
    out[TW.vM] = this.ok ? partVelocity(q, q.xM, t) : 0;
    out[TW.front] = this.ok ? front(q, t) : 0;
  }

  writeState(_s: Float64Array, t: number): void {
    this.t0 = t;
    this.steps = 0;
  }

  finished(): boolean {
    return this.tEnd !== undefined && this.time() >= this.tEnd;
  }
}
