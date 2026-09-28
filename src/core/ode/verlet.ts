/**
 * Velocity Verlet for second-order systems x'' = a(t, x, v).
 *
 * For velocity-independent accelerations (gravity, springs, pendulum) this is symplectic
 * and time-reversible: energy errors stay bounded instead of drifting, which makes it the
 * right choice for real-time conservative mechanics. For velocity-dependent forces
 * (damping) the new acceleration uses a predicted velocity — second order but no longer
 * symplectic; the Science Card must then say "gần đúng".
 */
export type AccelFn = (t: number, x: Float64Array, v: Float64Array, a: Float64Array) => void;

export class VelocityVerlet {
  private readonly a0: Float64Array;
  private readonly a1: Float64Array;
  private readonly vPred: Float64Array;
  private primed = false;

  constructor(
    private readonly accel: AccelFn,
    readonly size: number,
    /** Whether `accel` reads `v` (enables the velocity predictor). */
    private readonly velocityDependent = false,
  ) {
    this.a0 = new Float64Array(size);
    this.a1 = new Float64Array(size);
    this.vPred = new Float64Array(size);
  }

  /** Call after changing x or v from outside (reset, user drag). */
  invalidate(): void {
    this.primed = false;
  }

  step(t: number, x: Float64Array, v: Float64Array, h: number): void {
    const { accel, size, a0, a1, vPred } = this;
    if (!this.primed) {
      accel(t, x, v, a0);
      this.primed = true;
    }
    for (let i = 0; i < size; i++) {
      x[i] = (x[i] ?? 0) + h * (v[i] ?? 0) + 0.5 * h * h * (a0[i] ?? 0);
    }
    if (this.velocityDependent) {
      for (let i = 0; i < size; i++) vPred[i] = (v[i] ?? 0) + h * (a0[i] ?? 0);
      accel(t + h, x, vPred, a1);
    } else {
      accel(t + h, x, v, a1);
    }
    for (let i = 0; i < size; i++) {
      v[i] = (v[i] ?? 0) + 0.5 * h * ((a0[i] ?? 0) + (a1[i] ?? 0));
      a0[i] = a1[i] ?? 0;
    }
  }
}
