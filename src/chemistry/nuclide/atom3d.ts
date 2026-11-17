/**
 * What the 3D view of "Thành phần của nguyên tử" draws (pure, no three.js; tested): the same
 * illustration as the 2D picture, "not to scale" (HH10 Bài 1) — only the counts mean anything.
 * The nucleus packs exactly Z protons and N neutrons (`nucleus3d`, nucleons of radius ½); the
 * electrons are dots spread at random through a thick shell around it (seeded; no electron
 * shells: that is Bài 3).
 */
import { nucleus3d, type Vec3 } from '@/physics/nuclear/nuclear3d';
import { rng } from '../particles/gas';

export type { Vec3 };

export interface Atom3D {
  nucleons: Vec3[];
  proton: boolean[];
  electrons: Vec3[];
  /** Radius of the drawn nucleus and of the electrons' outer reach (world units). */
  R: number;
  reach: number;
}

export function atom3d(z: number, n: number, electrons: number, seed = 5): Atom3D {
  const nuc = nucleus3d(z, z + n);
  const k = 0.5 / nuc.r;
  const R = nuc.R * k;
  const inner = R + 1.2;
  const reach = R + 3.6;
  const rnd = rng(seed);
  const e = Array.from({ length: electrons }, (): Vec3 => {
    // Uniform direction, radius anywhere in the shell (no shells drawn).
    const y = 2 * rnd() - 1;
    const s = Math.sqrt(1 - y * y);
    const phi = 2 * Math.PI * rnd();
    const r = inner + (reach - inner) * rnd();
    return [r * s * Math.cos(phi), r * y, r * s * Math.sin(phi)];
  });
  return {
    nucleons: nuc.at.map((p) => [p[0] * k, p[1] * k, p[2] * k]),
    proton: nuc.proton,
    electrons: e,
    R,
    reach,
  };
}
