/**
 * What the 3D view of "Các định luật của khí lí tưởng" draws (pure, no three.js; tested against
 * the model): the same amount of gas in two cylinders, state 1 and state 2 of `statesOf`. The
 * gas column is as tall as V (to scale between the two), the arrow pressing on each piston as long
 * as p, and the particles move as fast as the rms speed allows, ∝ √T (Bài 12: ½mv² ∝ T). Both
 * cylinders hold the same number of particles: n = pV/RT is the same in both states.
 */
import type { GasState } from './model';

/** Particles drawn per cylinder (illustration of the same amount of gas). */
export const PARTICLES = 90;

export interface Cylinder3D {
  state: GasState;
  /** Gas column height, piston arrow length and particle speed, as shares of the larger state's. */
  height: number;
  push: number;
  speed: number;
}

export function gas3d(s1: GasState, s2: GasState | null): Cylinder3D[] {
  const all = s2 ? [s1, s2] : [s1];
  const vMax = Math.max(...all.map((s) => s.V));
  const pMax = Math.max(...all.map((s) => s.p));
  const tMax = Math.max(...all.map((s) => s.T));
  return all.map((state) => ({
    state,
    height: state.V / vMax,
    push: state.p / pMax,
    speed: Math.sqrt(state.T / tMax),
  }));
}
