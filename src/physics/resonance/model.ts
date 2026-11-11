import { gammaOf, omega0, propagate, type Oscillator } from '../spring/model';
import type { Params } from '../types';

/**
 * Forced damped oscillator m x″ + b x′ + k x = F₀ cos(Ωt) (horizontal spring, x from
 * equilibrium). Exact: x = x_h + x_p, the steady part x_p = A cos(Ωt − φ) in closed form and the
 * free part x_h from the exact transition map of the damped spring (`spring/model.ts`), started
 * from x(0) − x_p(0), v(0) − v_p(0). Sources: SGK Vật lí 11 KNTT Bài 6; Halliday ch. 15.
 */
export interface Forced extends Oscillator {
  /** Amplitude of the driving force (N). */
  F0: number;
  /** Angular frequency of the driving force Ω (rad/s). */
  W: number;
  x0: number;
  v0: number;
}

export function forced(p: Params): Forced {
  return {
    m: p.m ?? 0.5,
    k: p.k ?? 50,
    b: p.b ?? 0.5,
    F0: p.F0 ?? 1,
    W: p.Omega ?? 8,
    x0: p.x0 ?? 0,
    v0: p.v0 ?? 0,
  };
}

/** Steady (forced) motion x_p = A cos(Ωt − φ): amplitude and phase lag φ ∈ [0, π]. */
export function steady(o: Forced): { A: number; phi: number } {
  const w0 = omega0(o);
  const g = gammaOf(o);
  const dw = w0 * w0 - o.W * o.W;
  return { A: o.F0 / o.m / Math.hypot(dw, 2 * g * o.W), phi: Math.atan2(2 * g * o.W, dw) };
}

/** Steady amplitude for another driving frequency (the A(Ω) curve). */
export const amplitudeAt = (o: Forced, W: number): number => steady({ ...o, W }).A;

/**
 * Driving frequency of the largest steady amplitude, Ω_r = √(ω₀² − 2γ²), and that amplitude
 * (F₀/m) / (2γ√(ω₀² − γ²)). None when 2γ² ≥ ω₀²: the amplitude then only falls as Ω grows.
 */
export function resonance(o: Forced): { W: number; A: number } | null {
  const w0 = omega0(o);
  const g = gammaOf(o);
  const r2 = w0 * w0 - 2 * g * g;
  if (!(r2 > 0) || !(g > 0)) return null;
  return { W: Math.sqrt(r2), A: o.F0 / o.m / (2 * g * Math.sqrt(w0 * w0 - g * g)) };
}

/** The free (transient) part x_h, v_h at time t: what the start adds to the steady motion. */
export function freePart(o: Forced, t: number): [number, number] {
  const { A, phi } = steady(o);
  return propagate(o, o.x0 - A * Math.cos(phi), o.v0 - A * o.W * Math.sin(phi), t);
}

/** Position, velocity, acceleration and driving force at time t. */
export function stateAt(o: Forced, t: number): { x: number; v: number; a: number; Fd: number } {
  const { A, phi } = steady(o);
  const [xh, vh] = freePart(o, t);
  const x = xh + A * Math.cos(o.W * t - phi);
  const v = vh - A * o.W * Math.sin(o.W * t - phi);
  const Fd = o.F0 * Math.cos(o.W * t);
  return { x, v, a: (Fd - o.k * x - o.b * v) / o.m, Fd };
}

/**
 * Time for the free part to shrink by e⁻²¹ (≈ 10⁻⁹): the motion is then the steady one. Its
 * slowest mode decays at γ, or at γ − √(γ² − ω₀²) when overdamped (written without cancellation).
 */
export function settleTime(o: Forced): number {
  const g = gammaOf(o);
  const w0 = omega0(o);
  return 21 / (g <= w0 ? g : (w0 * w0) / (g + Math.sqrt(g * g - w0 * w0)));
}
