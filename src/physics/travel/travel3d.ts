/**
 * What the 3D view of "Sóng cơ: sóng ngang, sóng dọc" draws (pure, no three.js; tested against the
 * model): the medium as a block of parts, one every λ/16 along Ox (as the 2D picture's layers),
 * ROWS deep. A part whose rest place is x sits where the 2D picture draws it — `drawnAt` with
 * u = `displacement(q, x, t)` (up and down for a transverse wave, along Ox for a longitudinal
 * one, with the 2D picture's stretch) — so every part only oscillates about its place.
 */
import { drawnAt, viewLength } from './draw';
import { KIND, displacement, wavelength, type Travel } from './model';

/** Rows of parts across the block (z), and layers (y) for a longitudinal wave. */
export const ROWS = 7;
export const LAYERS = 5;

export interface Medium {
  /** Rest places along Ox (m). */
  xs: number[];
  /** Offsets across (z) and, for a longitudinal wave, up (y), as shares of the band's half. */
  rows: number[];
  layers: number[];
  /** Half the block's depth and height (m). */
  half: number;
}

export function medium(q: Travel): Medium {
  const Lv = viewLength(q);
  const lam = wavelength(q);
  const n = Math.floor(Lv / (lam / 16)) + 1;
  const spread = (k: number) => Array.from({ length: k }, (_, i) => (2 * i) / (k - 1) - 1);
  return {
    xs: Array.from({ length: n }, (_, j) => (j * lam) / 16),
    rows: spread(ROWS),
    layers: q.kind === KIND.longitudinal ? spread(LAYERS) : [0],
    half: 0.05 * Lv,
  };
}

/** Where the part at rest place x is drawn at time t (x and y of the 2D picture). */
export function partAt(q: Travel, x: number, t: number): { x: number; y: number } {
  return drawnAt(q, x, displacement(q, x, t));
}
