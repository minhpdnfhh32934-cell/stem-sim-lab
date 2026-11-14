import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { contactTime, finalVelocities, stateAt, thirdLawInput, type ThirdLawInput } from './model';

/**
 * State: [x1, v1, x2, v2, force on cart 1 (from cart 2), force on cart 2 (from cart 1),
 * a1, a2]. Forces and accelerations are signed along +x.
 */
export const TL = { x1: 0, v1: 1, x2: 2, v2: 3, F21: 4, F12: 5, a1: 6, a2: 7 } as const;

/**
 * Coasting after the push: long enough for the faster cart to roll about 1.2 m, at least half a
 * second and at most three.
 */
export function runLength(q: ThirdLawInput): number {
  const { v1, v2 } = finalVelocities(q);
  const fastest = Math.max(Math.abs(v1), Math.abs(v2), 1e-9);
  return contactTime(q) + Math.min(3, Math.max(0.5, 1.2 / fastest));
}

/** Two carts pushed apart by a spring: every step is the closed form at t = steps·dt (exact). */
export class ThirdLawEngine implements SimulationEngine<Params> {
  readonly id = 'phys.thirdLaw';
  readonly stateSize = 8;
  dt = 1 / 240;
  private steps = 0;
  private q: ThirdLawInput = thirdLawInput({});
  private tEnd = 1;

  reset(p: Params): void {
    this.q = thirdLawInput(p);
    this.steps = 0;
    this.tEnd = p.tEnd ?? runLength(this.q);
  }

  step(): void {
    this.steps++;
  }

  time(): number {
    return this.steps * this.dt;
  }

  readState(out: Float64Array): void {
    const s = stateAt(this.q, this.time());
    out[TL.x1] = s.x1;
    out[TL.v1] = s.v1;
    out[TL.x2] = s.x2;
    out[TL.v2] = s.v2;
    // The spring pushes cart 1 to the left (−x) and cart 2 to the right (+x).
    out[TL.F21] = -s.F;
    out[TL.F12] = s.F;
    out[TL.a1] = -s.F / this.q.m1;
    out[TL.a2] = s.F / this.q.m2;
  }

  writeState(_s: Float64Array, t: number): void {
    // The state is a function of time only: restoring a time restores the state.
    this.steps = Math.round(t / this.dt);
  }

  diagnostics() {
    const s = stateAt(this.q, this.time());
    const stretch = Math.max(0, s.F / this.q.k);
    // Momentum stays 0: a relative drift of 0 is meaningless, so only the energy ½kd² is watched.
    return {
      invariants: {
        energy:
          0.5 * this.q.m1 * s.v1 ** 2 + 0.5 * this.q.m2 * s.v2 ** 2 + 0.5 * this.q.k * stretch ** 2,
      },
    };
  }

  finished(): boolean {
    return this.time() >= this.tEnd;
  }
}
