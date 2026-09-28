import { VelocityVerlet } from '../ode/verlet';
import type { SimulationEngine } from './engine';

export interface OscillatorParams {
  mass: number; // kg
  k: number; // N/m
  x0: number; // m
  v0: number; // m/s
}

/**
 * Reference engine: undamped spring–mass oscillator integrated with velocity Verlet.
 * Used by the runtime tests and the startup benchmark. State: [x, v].
 */
export class OscillatorEngine implements SimulationEngine<OscillatorParams> {
  readonly id = 'demo.oscillator';
  readonly stateSize = 2;
  dt = 1 / 240;
  private t = 0;
  private readonly x = new Float64Array(1);
  private readonly v = new Float64Array(1);
  private p: OscillatorParams = { mass: 1, k: 1, x0: 1, v0: 0 };
  private readonly verlet = new VelocityVerlet((_t, x, _v, a) => {
    a[0] = (-this.p.k / this.p.mass) * (x[0] ?? 0);
  }, 1);

  constructor(params?: OscillatorParams) {
    if (params) this.reset(params);
  }

  reset(params: OscillatorParams): void {
    this.p = params;
    this.t = 0;
    this.x[0] = params.x0;
    this.v[0] = params.v0;
    this.verlet.invalidate();
  }

  step(): void {
    this.verlet.step(this.t, this.x, this.v, this.dt);
    this.t += this.dt;
  }

  time(): number {
    return this.t;
  }

  readState(out: Float64Array): void {
    out[0] = this.x[0] ?? 0;
    out[1] = this.v[0] ?? 0;
  }

  writeState(state: Float64Array, t: number): void {
    this.x[0] = state[0] ?? 0;
    this.v[0] = state[1] ?? 0;
    this.t = t;
    this.verlet.invalidate();
  }

  diagnostics() {
    const x = this.x[0] ?? 0;
    const v = this.v[0] ?? 0;
    return { invariants: { energy: 0.5 * this.p.mass * v * v + 0.5 * this.p.k * x * x } };
  }
}
