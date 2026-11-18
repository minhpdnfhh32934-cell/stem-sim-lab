/**
 * What the 3D view of "Thế năng điện. Điện thế" draws (pure, no three.js; tested against the
 * model): the plates (− at y = 0, V = 0; + at y = d, V = U), the equipotential planes through M
 * and N with V = E·y (`potential`), the chosen path (`pathPoints`) and the direction of the force
 * qE on the charge. The charge itself is where the engine puts it (`PT.x`, `PT.y`).
 */
import type { Params } from '../types';
import { PT } from './engine';
import {
  field,
  isValid,
  pathPoints,
  platesInput,
  potential,
  rightEdge,
  type Plates,
} from './model';

export type Vec3 = [number, number, number];

export interface Potential3D {
  q: Plates;
  ok: boolean;
  /** The plates' extent along x (as in 2D) and their half depth along z (illustration). */
  x0: number;
  x1: number;
  depth: number;
  E: number;
  planes: { name: 'M' | 'N'; y: number; V: number }[];
  path: Vec3[];
  /** Unit direction of F = qE (null when U = 0). */
  force: Vec3 | null;
}

export function potential3d(p: Params): Potential3D {
  const q = platesInput(p);
  const x0 = -0.45 * q.d;
  const x1 = rightEdge(q);
  const s = q.q >= 0 ? -1 : 1;
  return {
    q,
    ok: isValid(q),
    x0,
    x1,
    depth: 0.35 * (x1 - x0),
    E: field(q),
    planes: [
      { name: 'M', y: q.M.y, V: potential(q, q.M.y) },
      { name: 'N', y: q.N.y, V: potential(q, q.N.y) },
    ],
    path: pathPoints(q).map((pt) => [pt.x, pt.y, 0]),
    force: q.U === 0 ? null : [0, s * Math.sign(q.U), 0],
  };
}

/** Where the engine has the charge now (M before it starts). */
export function chargeAt(state: Float64Array | null, m: Potential3D): Vec3 {
  return [state?.[PT.x] ?? m.q.M.x, state?.[PT.y] ?? m.q.M.y, 0];
}
