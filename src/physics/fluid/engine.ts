import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import {
  direction,
  dragB,
  fallInput,
  inertia,
  motionAt,
  netWeight,
  travelTime,
  vacuumAt,
  type FallInput,
} from './model';

/**
 * State (world, y up): [centre height y, velocity v_y, acceleration a_y, drag force (signed),
 * distance travelled, vacuum ball height, vacuum ball velocity].
 */
export const FL = { y: 0, v: 1, a: 2, Fd: 3, s: 4, yVac: 5, vVac: 6 } as const;

/** A floating sphere does not move: the run still shows it for two seconds. */
export const runLength = (q: FallInput) => (direction(q) === 0 ? 2 : travelTime(q));

/** Fall or rise through a fluid with quadratic drag: the closed form at t = steps·dt (exact). */
export class FluidFallEngine implements SimulationEngine<Params> {
  readonly id = 'phys.fluidFall';
  readonly stateSize = 7;
  dt = 1 / 240;
  private steps = 0;
  private q: FallInput = fallInput({});
  private tEnd = 1;

  reset(p: Params): void {
    this.q = fallInput(p);
    this.steps = 0;
    this.tEnd = p.tEnd ?? runLength(this.q);
  }

  step(): void {
    this.steps++;
  }

  time(): number {
    // The last step lands exactly on the bottom (or the surface), not past it.
    return Math.min(this.steps * this.dt, this.tEnd);
  }

  readState(out: Float64Array): void {
    const q = this.q;
    const dir = direction(q);
    const { s, v } = motionAt(q, this.time());
    // Speed along the motion → world velocity (y up): sinking moves down (−), rising up (+).
    const vy = -dir * v;
    const Fd = dir === 0 ? 0 : dir * dragB(q) * v * v;
    out[FL.y] = dir < 0 ? s : q.H - s;
    out[FL.v] = vy;
    // a_y = (−weight + upthrust + drag)/(m + ½ρ_f V), all along y.
    out[FL.a] = (-netWeight(q) + Fd) / inertia(q);
    out[FL.Fd] = Fd;
    out[FL.s] = s;
    const vac = vacuumAt(q, this.time());
    out[FL.yVac] = q.H - vac.s;
    out[FL.vVac] = -vac.v;
  }

  writeState(_s: Float64Array, t: number): void {
    this.steps = Math.round(t / this.dt);
  }

  finished(): boolean {
    return this.time() >= this.tEnd;
  }
}
