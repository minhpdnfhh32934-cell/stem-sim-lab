/**
 * What the 3D view of "Orbital nguyên tử hydro" draws (pure, no three.js; tested against the
 * model): a cloud of points sampled from |ψ|² of the lesson's own exact hydrogen orbital
 * (`psi`), by rejection inside the cube that holds 99 % of the probability
 * (`radiusContaining`). Denser points = higher probability of finding the electron there; each
 * point keeps the sign of ψ (the 2D picture's colours). Not a path of the electron. The sample is
 * seeded, so the same orbital always gives the same picture.
 */
import { rng } from '../particles/gas';
import { psi, radiusContaining, type RealOrbital } from './hydrogen';

export interface Cloud {
  /** x, y, z of each point (a₀) and the sign of ψ there (+1 / −1). */
  points: Float32Array;
  signs: Int8Array;
  count: number;
  /** Half the side of the sampling cube (a₀). */
  extent: number;
}

/** Points per tier (medium, high); Low shows the 2D slice. */
export const CLOUD_POINTS = { low: 2000, medium: 4000, high: 8000 } as const;

export function sampleCloud(n: number, orbital: RealOrbital, count: number, seed = 7): Cloud {
  const extent = radiusContaining(n, orbital.l, 0.99);
  const rnd = rng(seed);
  const u = () => (2 * rnd() - 1) * extent;
  // The largest |ψ|² in the cube, from a grid and some random probes, with a safety margin
  // (a point is accepted with probability |ψ|²/max).
  let max = 0;
  const g = 32;
  for (let i = 0; i <= g; i++)
    for (let j = 0; j <= g; j++)
      for (let k = 0; k <= g; k++) {
        const p = psi(
          n,
          orbital,
          ((2 * i) / g - 1) * extent,
          ((2 * j) / g - 1) * extent,
          ((2 * k) / g - 1) * extent,
        );
        max = Math.max(max, p * p);
      }
  for (let i = 0; i < 20000; i++) {
    const p = psi(n, orbital, u(), u(), u());
    max = Math.max(max, p * p);
  }
  max *= 1.25;
  const points = new Float32Array(count * 3);
  const signs = new Int8Array(count);
  let k = 0;
  for (let tries = 0; k < count && tries < 400 * count; tries++) {
    const x = u();
    const y = u();
    const z = u();
    const p = psi(n, orbital, x, y, z);
    if (rnd() * max < p * p) {
      points[3 * k] = x;
      points[3 * k + 1] = y;
      points[3 * k + 2] = z;
      signs[k] = p >= 0 ? 1 : -1;
      k++;
    }
  }
  return { points, signs, count: k, extent };
}
