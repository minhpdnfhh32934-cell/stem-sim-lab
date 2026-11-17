import { dopri5 } from '@/core/ode';
import { THREE_PHASE_SHIFT } from '../magnetic/model';

/**
 * Vật lí 12 KNTT Bài 16 "Từ thông. Hiện tượng cảm ứng điện từ" and Bài 17 "Máy phát điện xoay
 * chiều": Φ = BS cosα (16.1), eₓ = −N ΔΦ/Δt (Faraday and Lenz, tr. 70), a coil turning at ω in a
 * uniform field gives e = E₀cos(ωt + φ₀) with E₀ = NBSω (17.1), T = 2π/ω, f = ω/2π, the effective
 * value E₀/√2 (17.4, 17.5), and the three coils of a three-phase generator 2π/3 apart (tr. 77).
 * The book prints no numbers for these lessons: the lesson's defaults are illustrations.
 */

const rad = (deg: number) => (deg * Math.PI) / 180;
/** cos of an angle in degrees, exactly 0 at odd multiples of 90°. */
const cosDeg = (deg: number) => ((deg - 90) % 180 === 0 ? 0 : Math.cos(rad(deg)));

/** Φ = BS cosα (Wb): α is the angle between B⃗ and the coil's normal n⃗. */
export const flux = (B: number, S: number, alphaDeg: number) => B * S * cosDeg(alphaDeg);

/** The mean induced e.m.f. while the flux through one turn goes from Φ₁ to Φ₂ in Δt: −N ΔΦ/Δt. */
export const averageEmf = (N: number, phi1: number, phi2: number, dt: number) =>
  (-N * (phi2 - phi1)) / dt;

/* ───────── The generator (Bài 17) ───────── */

export interface Generator {
  /** Turns, field (T), area of one turn (m²), frequency (Hz), angle of n⃗ to B⃗ at t = 0 (degrees). */
  N: number;
  B: number;
  S: number;
  f: number;
  alpha0: number;
}

export const omega = (g: Generator) => 2 * Math.PI * g.f;
/** E₀ = NBSω (17.1). */
export const peakEmf = (g: Generator) => g.N * g.B * g.S * omega(g);
/** The effective value E = E₀/√2 (17.5 for a voltage). */
export const effectiveEmf = (g: Generator) => peakEmf(g) / Math.SQRT2;
export const period = (g: Generator) => 1 / g.f;

/** Flux through one turn at time t: Φ = BS cos(ωt + α₀). */
export const fluxAt = (g: Generator, t: number) =>
  g.B * g.S * Math.cos(omega(g) * t + rad(g.alpha0));

/** e = −N dΦ/dt = NBSω sin(ωt + α₀) = E₀ cos(ωt + φ₀), with φ₀ = α₀ − π/2. */
export const emfAt = (g: Generator, t: number) =>
  peakEmf(g) * Math.sin(omega(g) * t + rad(g.alpha0));

/** φ₀ of (17.1) in (−π, π]. */
export function phase0(g: Generator) {
  let p = rad(g.alpha0) - Math.PI / 2;
  while (p <= -Math.PI) p += 2 * Math.PI;
  while (p > Math.PI) p -= 2 * Math.PI;
  return p;
}

/** The three coils of a three-phase generator: e₁, e₂ = …(+2π/3), e₃ = …(−2π/3) as on tr. 77. */
export function threePhaseAt(g: Generator, t: number): [number, number, number] {
  const x = omega(g) * t + phase0(g);
  const E0 = peakEmf(g);
  return [
    E0 * Math.cos(x),
    E0 * Math.cos(x + THREE_PHASE_SHIFT),
    E0 * Math.cos(x - THREE_PHASE_SHIFT),
  ];
}

/**
 * Independent check of Faraday's law: integrate the e.m.f. with DOPRI5 from 0 to t. The result must
 * equal −N(Φ(t) − Φ(0)).
 */
export function integratedEmf(g: Generator, t: number): number {
  if (t <= 0) return 0;
  const r = dopri5(
    (s, _y, dy) => {
      dy[0] = emfAt(g, s);
    },
    [0],
    0,
    t,
    { rtol: 1e-11, atol: 1e-13 },
  );
  return r.y[0] ?? NaN;
}
