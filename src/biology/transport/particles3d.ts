/**
 * The illustrative Brownian particles of the diffusion picture, in 3D (pure, tested). Same rule
 * as the 2D picture, extruded in depth: a box [0, 2] × [0, 1] × [0, 1] split by a membrane at
 * x = 1 whose pores are slots across its whole depth at the 2D pores' heights; a particle crosses
 * only through a slot, walls reflect. The Fick model (the chart) never uses these particles.
 */
import { brownianStep } from './transport';

/** Pore slots along y (centres spread evenly, width 0.05), as in the 2D picture. */
export function poreIntervals(n: number): [number, number][] {
  const w = 0.05;
  return Array.from({ length: n }, (_, k) => {
    const c = (k + 0.5) / n;
    return [c - w / 2, c + w / 2];
  });
}

/** Diffusion coefficient and step of the illustration (the 2D picture's). */
const D = 0.02;
const DT = 1 / 60;

/** `count` particles spread over the whole box (seeded): x, y, z for each. */
export function initialParticles(count: number, rand: () => number): Float32Array {
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    p[3 * i] = 0.02 + 0.96 * rand();
    p[3 * i + 1] = rand();
    p[3 * i + 2] = rand();
  }
  return p;
}

const reflect = (v: number, max: number) => (v < 0 ? -v : v > max ? 2 * max - v : v);

/** One Brownian step of every particle (in place). */
export function stepParticles3d(
  p: Float32Array,
  pores: [number, number][],
  rand: () => number,
): void {
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i] ?? 0;
    const y = p[i + 1] ?? 0;
    const z = p[i + 2] ?? 0;
    const [dx, dy] = brownianStep(D, DT, rand);
    const [dz] = brownianStep(D, DT, rand);
    let nx = reflect(x + dx, 2);
    const ny = Math.min(1, Math.max(0, reflect(y + dy, 1)));
    const nz = Math.min(1, Math.max(0, reflect(z + dz, 1)));
    if ((x - 1) * (nx - 1) < 0) {
      // Crossing the membrane: allowed only through a slot (y at the crossing point).
      const f = (1 - x) / (nx - x);
      const yc = y + f * (ny - y);
      if (!pores.some(([a, b]) => yc >= a && yc <= b)) nx = 2 - nx;
    }
    p[i] = nx;
    p[i + 1] = ny;
    p[i + 2] = nz;
  }
}

/** Particles on the left of the membrane (x < 1). */
export function leftCount(p: Float32Array): number {
  let n = 0;
  for (let i = 0; i < p.length; i += 3) if ((p[i] ?? 0) < 1) n++;
  return n;
}
