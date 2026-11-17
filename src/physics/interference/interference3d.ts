/**
 * What the 3D view of "Giao thoa sóng hai nguồn" draws (pure, no three.js; tested against the
 * model and the engine): the water surface as a grid over the 2D view's region, its height at
 * every point u/(2a) = ½[cos(ω₁t − k₁r₁) + cos(ω₂t − k₂r₂)] from the model's `waveAt` (the 2D
 * picture's colour rule), drawn `RELIEF` times the view's width high — the real amplitude is far
 * too small to see. Like the 2D picture, the grid never has under 4 points per wavelength (fewer
 * would show false fringes): when that would take more points than the tier allows, no surface.
 */
import type { WorldBounds } from '../types';
import { waveAt, type Source } from './model';

/** Points per wavelength the grid aims for, and the fewest it accepts. */
export const PER_LAMBDA = 6;
export const MIN_PER_LAMBDA = 4;
/** Height of a crest of 2a, as a share of the view's width (illustration). */
export const RELIEF = 0.05;

export interface Grid {
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  step: number;
}

/** The surface grid over `view` for the shortest wavelength, at most `maxCells` per side. */
export function surfaceGrid(view: WorldBounds, lambdaMin: number, maxCells: number): Grid | null {
  const w = view.xMax - view.xMin;
  const h = view.yMax - view.yMin;
  if (!(lambdaMin > 0) || !(w > 0) || !(h > 0)) return null;
  const longest = Math.max(w, h);
  if (longest / (lambdaMin / MIN_PER_LAMBDA) > maxCells) return null;
  const step = Math.max(lambdaMin / PER_LAMBDA, longest / maxCells);
  return {
    nx: Math.ceil(w / step),
    ny: Math.ceil(h / step),
    x0: view.xMin,
    y0: view.yMin,
    step,
  };
}

/** u/(2a) at (x, y) and time t: the two waves of `waveAt` with amplitude ½ each. */
export function heightAt(s1: Source, s2: Source, x: number, y: number, t: number): number {
  const r1 = Math.hypot(x - s1.x, y - s1.y);
  const r2 = Math.hypot(x - s2.x, y - s2.y);
  return waveAt(s1, 0.5, r1, t) + waveAt(s2, 0.5, r2, t);
}
