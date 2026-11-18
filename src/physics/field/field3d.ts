/**
 * What the 3D view of "Điện trường của điện tích điểm" draws (pure, no three.js; tested): the
 * charges where the lesson puts them (plane z = 0), the model's own field lines (`linesFor`, the
 * same as the 2D picture) and E at M (`fieldAtPoint` / `plateField`, what the engine computes).
 *
 * In space the field of charges on one straight line is symmetric about that line, so a field
 * line in the plane turned about it is still a field line: then the plane's lines are drawn again
 * turned by 60° and 120° (`COPIES`). Three charges off one line have no such symmetry: only the
 * plane's lines are drawn.
 */
import type { Params, WorldBounds } from '../types';
import { discRadii } from './fieldLines';
import { fieldView, lineFrame, linesFor } from './draw';
import { MODE, fieldAtPoint, fieldSetup, plateField, type Plates } from './model';

export type Vec3 = [number, number, number];

/** Turned copies of the plane's lines when the field is symmetric about the charges' line. */
export const COPIES = 3;

export interface Line3D {
  points: Vec3[];
  /** +1: E along the polyline; −1: against it. */
  dir: 1 | -1;
  /** Cut by the tracer's step budget (the 2D picture dashes it). */
  cut: boolean;
}

export interface Field3D {
  mode: 'points' | 'plates';
  charges: { q: number; at: Vec3; r: number }[];
  /** The charges' line (point, unit direction) when the field is symmetric about it. */
  axis: { at: Vec3; dir: Vec3 } | null;
  lines: Line3D[];
  /** Points where a line met E = 0 (and their turned copies). */
  nulls: Vec3[];
  probe: Vec3;
  /** E at M (V/m): x, y components and size. */
  E: [number, number];
  e: number;
  plates: Plates;
  view: WorldBounds;
}

/** Rotation of p about the line (a, u) by θ (Rodrigues; u a unit vector). */
export function turn(p: Vec3, a: Vec3, u: Vec3, theta: number): Vec3 {
  const v: Vec3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const x: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return [
    a[0] + v[0] * c + x[0] * s + u[0] * d * (1 - c),
    a[1] + v[1] * c + x[1] * s + u[1] * d * (1 - c),
    a[2] + v[2] * c + x[2] * s + u[2] * d * (1 - c),
  ];
}

/** The line the charges lie on, or null when three of them are not on one line. */
export function chargeAxis(charges: readonly { x: number; y: number }[]): Field3D['axis'] {
  const first = charges[0];
  if (!first) return null;
  const other = charges.find((c) => Math.hypot(c.x - first.x, c.y - first.y) > 0);
  // One charge (or all at one point): any line through it; the x-axis direction.
  if (!other) return { at: [first.x, first.y, 0], dir: [1, 0, 0] };
  const dx = other.x - first.x;
  const dy = other.y - first.y;
  const len = Math.hypot(dx, dy);
  const off = charges.some(
    (c) => Math.abs((c.x - first.x) * dy - (c.y - first.y) * dx) > 1e-9 * len * len,
  );
  return off ? null : { at: [first.x, first.y, 0], dir: [dx / len, dy / len, 0] };
}

export function field3d(p: Params): Field3D {
  const s = fieldSetup(p);
  const view = fieldView(p);
  if (s.mode === MODE.plates) {
    const E = plateField(s.plates, 0, 0);
    return {
      mode: 'plates',
      charges: [],
      axis: null,
      lines: [],
      nulls: [],
      probe: [0, 0, 0],
      E,
      e: Math.hypot(...E),
      plates: s.plates,
      view,
    };
  }
  const radii = discRadii(s.charges, lineFrame(p));
  const active = s.charges.filter((c) => c.q !== 0);
  const axis = chargeAxis(active);
  const traced = linesFor(p);
  const angles = axis ? Array.from({ length: COPIES }, (_, i) => (i * Math.PI) / COPIES) : [0];
  const lines: Line3D[] = [];
  const nulls: Vec3[] = [];
  for (const theta of angles) {
    const place = (x: number, y: number): Vec3 =>
      axis && theta !== 0 ? turn([x, y, 0], axis.at, axis.dir, theta) : [x, y, 0];
    for (const l of traced.lines) {
      const points: Vec3[] = [];
      for (let i = 0; i + 1 < l.points.length; i += 2)
        points.push(place(l.points[i] ?? 0, l.points[i + 1] ?? 0));
      lines.push({ points, dir: l.dir, cut: l.end === 'steps' });
    }
    // A point E = 0 on the axis stays where it is when turned: kept once.
    for (const [x, y] of traced.nullPoints) {
      const q = place(x, y);
      const size = view.xMax - view.xMin;
      if (!nulls.some((n) => Math.hypot(n[0] - q[0], n[1] - q[1], n[2] - q[2]) < 1e-6 * size))
        nulls.push(q);
    }
  }
  const E = fieldAtPoint(s.charges, s.k, s.probe.x, s.probe.y);
  return {
    mode: 'points',
    charges: s.charges.map((c, i) => ({ q: c.q, at: [c.x, c.y, 0], r: radii[i] ?? 0 })),
    axis,
    lines,
    nulls,
    probe: [s.probe.x, s.probe.y, 0],
    E,
    e: Math.hypot(...E),
    plates: s.plates,
    view,
  };
}
