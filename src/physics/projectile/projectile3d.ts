/**
 * What the 3D view of the throw lessons draws (pure, no three.js; tested against `analytic.ts`):
 * the predicted path from the closed form, the size of the scene (the 2D picture's), the ground
 * span and the arrow scales. The ball itself is where the lesson's engine puts it.
 */
import { niceStep } from '@/biology/fmt';
import { vectorScale } from '../render/draw';
import { projectile, projectileAt, type ProjectileInput, type ProjectileResult } from './analytic';

/** Points of the predicted path (the 2D picture's 80 segments). */
export const PATH_SEGMENTS = 80;

export interface Throw3D {
  r: ProjectileResult;
  /** The scene's size (the 2D picture's): max(|L|, H, 1 m). */
  s: number;
  /** Ground span along x and its half depth along z (m). */
  xMin: number;
  xMax: number;
  zHalf: number;
  /** Predicted positions (x, y), launch to landing. */
  path: [number, number][];
  /** Arrow lengths per m/s and per m/s² (the 2D picture's scales). */
  kv: number;
  ka: number;
  /** Ground marks: every `tick` metres from `ticks[0]`. */
  tick: number;
  ticks: number[];
}

export function throw3d(inp: ProjectileInput): Throw3D {
  const r = projectile(inp);
  const s = Math.max(Math.abs(r.range), r.maxHeight, 1);
  const xMin = Math.min(0, r.range) - 0.12 * s;
  const xMax = Math.max(0, r.range) + 0.12 * s;
  const path = Array.from({ length: PATH_SEGMENTS + 1 }, (_, i): [number, number] => {
    const p = projectileAt(inp, (r.flightTime * i) / PATH_SEGMENTS);
    return [p.x, p.y];
  });
  const kv = vectorScale(
    Math.max(inp.v0, Math.sqrt(2 * inp.g * Math.max(r.maxHeight, 0.1))),
    s,
    0.22,
  );
  const ka = vectorScale(inp.g, s, 0.1);
  const tick = niceStep(xMax - xMin, 5);
  const ticks: number[] = [];
  for (let k = Math.ceil(xMin / tick); k * tick <= xMax + 1e-9; k++) ticks.push(k * tick);
  return { r, s, xMin, xMax, zHalf: 0.1 * s, path, kv, ka, tick, ticks };
}
