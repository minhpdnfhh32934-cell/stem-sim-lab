/**
 * What the 3D view of "Định luật II Kepler" draws (pure, no three.js; tested against the model):
 * the orbit laid in a horizontal plane (model x → world x, model y → world −z), the N slices the
 * planet sweeps in equal times (the 2D picture's, each an arc of the model's own positions), and
 * which slice is being swept at time t.
 */
import { arc, type Orbit } from './model';

export type Vec3 = [number, number, number];

export const toWorld = (x: number, y: number): Vec3 => [x, 0, -y];

/** Arc points per slice (the 2D picture's 48). */
export const SLICE_STEPS = 48;

/** The equal-time slices: each the arc from k·T/N to (k+1)·T/N, in model coordinates. */
export const slices = (o: Orbit) =>
  Array.from({ length: o.N }, (_, k) =>
    arc(o, (k * o.T) / o.N, ((k + 1) * o.T) / o.N, SLICE_STEPS),
  );

/** The slice being swept at time t (any t, the motion repeats every T). */
export function sliceAt(o: Orbit, t: number): number {
  const slice = o.T / o.N;
  return Math.min(o.N - 1, Math.floor((((t % o.T) + o.T) % o.T) / slice));
}
