import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { column, liquidPart, sinkTime, totalPressure, type Column } from './model';

/** State: [probe depth (m), pressure from the liquid ρgd (Pa), total pressure pₐ + ρgd (Pa)]. */
export const PR = { d: 0, pl: 1, p: 2 } as const;

/** Run length: the sink, then one second at the point. */
export const runLength = (q: Column) => sinkTime(q) + 1;

/**
 * A pressure probe sinks at a constant speed from the surface to the depth h, then stays there.
 * The pressure is the exact p = pₐ + ρgd at the probe's depth d (t = n·Δt): nothing accumulates.
 */
export class PressureEngine implements SimulationEngine<Params> {
  readonly id = 'phys.liquidPressure';
  readonly stateSize = 3;
  dt = 1 / 60;
  private n = 0;
  private q: Column = column({});

  reset(p: Params): void {
    this.q = column(p);
    this.n = 0;
  }

  step(): void {
    this.n++;
  }

  time(): number {
    return this.n * this.dt;
  }

  depth(): number {
    const q = this.q;
    return q.h * Math.min(1, this.time() / sinkTime(q));
  }

  readState(out: Float64Array): void {
    const at = { ...this.q, h: this.depth() };
    out[PR.d] = at.h;
    out[PR.pl] = liquidPart(at);
    out[PR.p] = totalPressure(at);
  }

  writeState(_s: Float64Array, t: number): void {
    this.n = Math.round(t / this.dt);
  }

  input(): boolean {
    return false;
  }

  finished(): boolean {
    return this.time() >= runLength(this.q);
  }
}
