/**
 * What the 3D view of "Cường độ dòng điện" draws (pure, no three.js; tested): a piece of the
 * wire four diameters long (to scale, as in 2D), fixed positive ions, and free electrons that
 * drift against the current by the engine's distance s (`WR.s`, at the model's real drift speed)
 * — the same rule as the 2D picture, wrapped round the piece. Each dot stands for very many
 * electrons; where they sit across the section is illustration.
 */
import { jitter } from '../common/jitter';
import { lengthOf } from './model';

export const ELECTRONS = 60;
/** Ions: COLS slices along the wire, each a 3 × 3 grid across it. */
export const ION_COLS = 14;
export const ION_GRID = [-0.5, 0, 0.5] as const;

export const wireLength = (d: number) => lengthOf(d);

/** x of electron k after the electrons drifted s (m) against the current (in [0, Lw)). */
export function electronX(k: number, s: number, Lw: number): number {
  const x0 = jitter(k, 1) * Lw;
  return (((x0 - s) % Lw) + Lw) % Lw;
}

/** Where electron k sits across the wire (y, z), within 0,76 of the radius r. */
export function electronYZ(k: number, r: number): [number, number] {
  const rho = 0.76 * r * Math.sqrt(jitter(k, 2));
  const phi = 2 * Math.PI * jitter(k, 3);
  return [rho * Math.cos(phi), rho * Math.sin(phi)];
}
