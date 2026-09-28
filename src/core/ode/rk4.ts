import type { OdeFn } from './types';

/**
 * Classical 4th-order Runge–Kutta, fixed step. Reusable workspace avoids allocations
 * inside the simulation loop.
 */
export class Rk4 {
  private readonly k1: Float64Array;
  private readonly k2: Float64Array;
  private readonly k3: Float64Array;
  private readonly k4: Float64Array;
  private readonly tmp: Float64Array;

  constructor(
    private readonly f: OdeFn,
    readonly size: number,
  ) {
    this.k1 = new Float64Array(size);
    this.k2 = new Float64Array(size);
    this.k3 = new Float64Array(size);
    this.k4 = new Float64Array(size);
    this.tmp = new Float64Array(size);
  }

  /** Advances y (in place) from t by h. */
  step(t: number, y: Float64Array, h: number): void {
    const { f, size, k1, k2, k3, k4, tmp } = this;
    f(t, y, k1);
    for (let i = 0; i < size; i++) tmp[i] = (y[i] ?? 0) + 0.5 * h * (k1[i] ?? 0);
    f(t + 0.5 * h, tmp, k2);
    for (let i = 0; i < size; i++) tmp[i] = (y[i] ?? 0) + 0.5 * h * (k2[i] ?? 0);
    f(t + 0.5 * h, tmp, k3);
    for (let i = 0; i < size; i++) tmp[i] = (y[i] ?? 0) + h * (k3[i] ?? 0);
    f(t + h, tmp, k4);
    for (let i = 0; i < size; i++) {
      y[i] =
        (y[i] ?? 0) + (h / 6) * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0));
    }
  }
}

/** Convenience: integrate from t0 to t1 with a fixed number of RK4 steps. */
export function integrateRk4(
  f: OdeFn,
  y0: ArrayLike<number>,
  t0: number,
  t1: number,
  steps: number,
): Float64Array {
  const y = Float64Array.from(y0);
  const solver = new Rk4(f, y.length);
  const h = (t1 - t0) / steps;
  for (let i = 0; i < steps; i++) solver.step(t0 + i * h, y, h);
  return y;
}
