/**
 * The points of AI Teacher's orb (#234): an even Fibonacci spiral on a unit sphere with a small
 * seeded jitter, plus a few points inside it for depth. Pure, no three.js: the drawing (step 2)
 * copies these into one buffer once. The same seed always gives the same orb (stable tests).
 */
import type { QualityTier } from '@/perf/tiers';
import { rng } from '../board/rough';

/**
 * Points and line pairs per quality tier. Low draws the light SVG rings instead (no orb). First
 * values from the plan; step 2 measures frame time and memory and may lower them.
 */
export const ORB_BUDGET: Readonly<Record<Exclude<QualityTier, 'low'>, OrbBudget>> = {
  medium: { points: 300, pairs: 700 },
  high: { points: 600, pairs: 1500 },
};

export interface OrbBudget {
  points: number;
  pairs: number;
}

/** Share of the points placed inside the sphere; the rest lie on (about) its surface. */
export const INNER_SHARE = 0.12;
/** How far a surface point may leave the unit sphere (± share of the radius). */
export const SURFACE_JITTER = 0.02;
/** Inner points sit between these radii (never at the centre, never on the surface). */
export const INNER_RADII: readonly [number, number] = [0.35, 0.85];

/** `count` points as interleaved x, y, z (unit sphere, y up). */
export function orbPoints(count: number, seed = 1): Float32Array {
  const out = new Float32Array(count * 3);
  const random = rng(seed);
  const inner = Math.round(count * INNER_SHARE);
  const surface = count - inner;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < surface; i++) {
    const y = 1 - (2 * (i + 0.5)) / surface;
    const ring = Math.sqrt(1 - y * y);
    const angle = i * golden + (random() - 0.5) * 0.2;
    const r = 1 + (random() * 2 - 1) * SURFACE_JITTER;
    out[3 * i] = Math.cos(angle) * ring * r;
    out[3 * i + 1] = y * r;
    out[3 * i + 2] = Math.sin(angle) * ring * r;
  }
  const [r0, r1] = INNER_RADII;
  for (let i = surface; i < count; i++) {
    // A uniform direction (Archimedes: uniform height, uniform angle), then a radius.
    const y = random() * 2 - 1;
    const angle = random() * 2 * Math.PI;
    const ring = Math.sqrt(1 - y * y);
    const r = r0 + (r1 - r0) * random();
    out[3 * i] = Math.cos(angle) * ring * r;
    out[3 * i + 1] = y * r;
    out[3 * i + 2] = Math.sin(angle) * ring * r;
  }
  return out;
}
