/**
 * What the 3D view of "Cảm ứng điện từ" draws (pure, no three.js; tested against the model): a
 * coil turning about the vertical axis in a uniform field B⃗ along ±x. Its normal n⃗ makes the
 * angle θ with +x (n⃗ = (cosθ, 0, −sinθ): +x turned by θ about y), so n⃗ · B⃗ · S is the model's
 * flux. Flux tab: the coil before (α₁, ghost) and after (α₂); generator tab: the coil at time t,
 * θ = ωt + α₀ — the angle the 2D picture draws.
 */
import { averageEmf, flux, fluxAt, emfAt, omega } from './model';
import { generatorOf, type InductionState } from './store';

export type Vec3 = [number, number, number];

export interface Coil3D {
  /** Angle of n⃗ to +x (degrees). */
  angle: number;
  normal: Vec3;
  /** Flux through one turn (Wb), from the model. */
  phi: number;
}

export interface Induction3D {
  /** +1: B⃗ along +x; −1: along −x (a negative B). */
  fieldSign: 1 | -1;
  now: Coil3D;
  /** Flux tab: the coil before the change. */
  before: Coil3D | null;
  /** The e.m.f. (V): mean −NΔΦ/Δt (flux tab) or e(t) (generator tab), from the model. */
  emf: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export function coilNormal(angleDeg: number): Vec3 {
  const a = rad(angleDeg);
  // Exact at multiples of 90° (the coil face-on or edge-on to B⃗).
  const c = (angleDeg - 90) % 180 === 0 ? 0 : Math.cos(a);
  const s = angleDeg % 180 === 0 ? 0 : Math.sin(a);
  return [c, 0, -s];
}

export function induction3d(s: InductionState): Induction3D {
  if (s.tab === 'flux') {
    const phi1 = flux(s.B1, s.S, s.alpha1);
    const phi2 = flux(s.B2, s.S, s.alpha2);
    return {
      fieldSign: s.B2 < 0 ? -1 : 1,
      before: { angle: s.alpha1, normal: coilNormal(s.alpha1), phi: phi1 },
      now: { angle: s.alpha2, normal: coilNormal(s.alpha2), phi: phi2 },
      emf: averageEmf(s.N, phi1, phi2, s.dt),
    };
  }
  const g = generatorOf(s);
  const angle = ((omega(g) * s.t) / Math.PI) * 180 + g.alpha0;
  return {
    fieldSign: 1,
    before: null,
    now: { angle, normal: coilNormal(angle), phi: fluxAt(g, s.t) },
    emf: emfAt(g, s.t),
  };
}
