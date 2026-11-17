/**
 * What the 3D view of "Lực từ" draws (pure, no three.js; tested against the model): B⃗ along +x,
 * the wire in the page (x–y plane) at α to B⃗, the current along it, and F⃗ = I·L⃗ × B⃗ from the
 * model's `cross` — perpendicular to the page, as `forceDirection` says. The force arrow's length
 * is F / (BIL) = sinα of its largest; its value is the model's `force`.
 */
import { cross, force, forceDirection, type Out } from './model';

export type Vec3 = [number, number, number];

export interface MagneticInputs {
  B: number;
  I: number;
  L: number;
  alpha: number;
  reversed: boolean;
}

export interface Magnetic3D {
  field: Vec3;
  /** Unit vector of the current (the wire's direction, flipped when reversed). */
  current: Vec3;
  /** Unit vector of F⃗, or null when there is no force (F = 0). */
  force: Vec3 | null;
  /** F / (BIL): 0 … 1 (0 when BIL = 0). */
  share: number;
  F: number;
  dir: Out;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export function magnetic3d(s: MagneticInputs): Magnetic3D {
  const k = s.reversed ? -1 : 1;
  // Exact at the book's round angles (cos 90° = 0, sin 180° = 0).
  const c = s.alpha % 180 === 90 ? 0 : Math.cos(rad(s.alpha));
  const sn = s.alpha % 180 === 0 ? 0 : Math.sin(rad(s.alpha));
  const current: Vec3 = [k * c, k * sn, 0];
  const field: Vec3 = [1, 0, 0];
  const F = force(s.B, s.I, s.L, s.alpha);
  const dir = forceDirection(s.alpha, s.reversed);
  const f = cross(current, field);
  const len = Math.hypot(f[0], f[1], f[2]);
  const max = s.B * s.I * s.L;
  return {
    field,
    current,
    force: F > 0 && len > 0 ? [f[0] / len, f[1] / len, f[2] / len] : null,
    share: max > 0 ? F / max : 0,
    F,
    dir,
  };
}
