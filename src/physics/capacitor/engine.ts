import type { SimulationEngine } from '@/core/sim/engine';
import type { Params } from '../types';
import { MODE, bankCharge, bankInput, equivalent, isValid, type Bank } from './model';

/**
 * State: [charge of the bank q (C), its voltage q/C (V), its energy q²/2C (J), then the voltage on
 * capacitor 1, 2, 3 (V; 0 when absent)].
 */
export const CP = { q: 0, U: 1, W: 2, U1: 3, U2: 4, U3: 5 } as const;

/** The bank is charged from 0 to Q in this time (an illustration: no resistor is modelled). */
export const CHARGE_TIME = 4;
export const RUN_TIME = CHARGE_TIME + 1;

/**
 * Charging, step by step (Hình 21.9): the charge grows steadily from 0 to Q = CU and every value is
 * the exact one for the charge reached; nothing is integrated.
 */
export class CapacitorEngine implements SimulationEngine<Params> {
  readonly id = 'phys.capacitor';
  readonly stateSize = 6;
  dt = 1 / 60;
  private n = 0;
  private b: Bank = bankInput({});
  private ok = true;

  reset(p: Params): void {
    this.b = bankInput(p);
    this.ok = isValid(this.b);
    this.n = 0;
  }

  step(): void {
    this.n++;
  }

  time(): number {
    return this.n * this.dt;
  }

  readState(out: Float64Array): void {
    out.fill(0);
    if (!this.ok) return;
    const b = this.b;
    const C = equivalent(b);
    const q = bankCharge(b) * Math.min(1, this.time() / CHARGE_TIME);
    out[CP.q] = q;
    out[CP.U] = q / C;
    out[CP.W] = (q * q) / (2 * C);
    b.caps.forEach((c, i) => {
      out[CP.U1 + i] = b.mode === MODE.parallel ? q / C : q / c;
    });
  }

  writeState(_s: Float64Array, t: number): void {
    this.n = Math.round(t / this.dt);
  }

  input(): boolean {
    return false;
  }

  finished(): boolean {
    return this.time() >= RUN_TIME;
  }
}
