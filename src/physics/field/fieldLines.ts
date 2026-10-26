import { Rk4 } from '@/core/ode';
import { fieldAt, type PointCharge } from './model';

/**
 * Field lines of point charges: dr/ds = ±E/|E| (arc length s), classical RK4 with step doubling —
 * each step is also taken as two half steps, their difference / 15 estimates the local error
 * (Richardson, RK4 is 4th order) and sets the next step. The reported error is global: a coarse
 * copy of the line takes one full step where the drawn line takes two halves, and |drawn − coarse|
 * (≈ 15× the drawn line's own error; ≈ 11× the distance to a DOPRI5 line in the tests) is an upper
 * estimate of it, including the growth of early errors as lines spread out. The tolerance depends
 * only on the frame, never on the device tier. Lines start from + charges (along E) and from −
 * charges (against E, arrows reversed) on a small circle, about ∝ |q| (rounded, at least one); a −
 * charge skips the directions where a line already arrived. A line stops at a charge, outside the frame, when too long, where E = 0
 * (the point is marked) or when its step budget runs out (`end: 'steps'`, drawn differently).
 * Computed once per parameter change, never per frame.
 */

export interface Frame {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export type LineEnd = 'charge' | 'frame' | 'null' | 'long' | 'steps';

export interface FieldLine {
  /** x₀, y₀, x₁, y₁, … (m) in the order traced. */
  points: number[];
  /** +1: E points along the polyline (traced from a + charge); −1: against it (from a − charge). */
  dir: 1 | -1;
  end: LineEnd;
  /** Index of the charge the line starts from, and of the one it ends at (`end: 'charge'`). */
  from: number;
  to?: number;
  /** Arc length traced (m). */
  length: number;
  /** Upper estimate of the distance from the exact line, max |drawn − coarse| (m). */
  error: number;
}

export interface FieldLines {
  lines: FieldLine[];
  /** Points where a line met E = 0. */
  nullPoints: [number, number][];
  /** Largest `error` of any line (m): the number the Science Card shows. */
  maxError: number;
}

export interface FieldLineOptions {
  /** Lines leaving the largest |q|; others get round(n·|q|/|q|max), at least 1. */
  linesForLargest?: number;
  /** Step attempts allowed per line. */
  maxSteps?: number;
}

/** Fractions of the frame size (the larger side), identical on every device tier. */
const TOL = 1e-6;
const SEED_RADIUS = 0.02;
const H_MAX = 0.02;
const H_MIN = 1e-9;

export function traceFieldLines(
  input: readonly PointCharge[],
  k: number,
  frame: Frame,
  options: FieldLineOptions = {},
): FieldLines {
  const charges = input.filter((c) => c.q !== 0);
  const indexOf = (c: PointCharge) => input.indexOf(c);
  const size = Math.max(frame.xMax - frame.xMin, frame.yMax - frame.yMin);
  const tol = TOL * size;
  const r0 = SEED_RADIUS * size;
  const maxLength = 3 * (frame.xMax - frame.xMin + frame.yMax - frame.yMin);
  const maxSteps = options.maxSteps ?? 4000;
  const nLargest = options.linesForLargest ?? 12;
  const qMax = Math.max(0, ...charges.map((c) => Math.abs(c.q)));
  const eNull = 1e-12 * ((k * qMax) / (size * size));

  let sign = 1;
  const f = (_t: number, y: Float64Array, dy: Float64Array) => {
    const [ex, ey] = fieldAt(charges, k, y[0] ?? 0, y[1] ?? 0);
    const n = Math.hypot(ex, ey);
    // Exactly at a null point the direction is undefined: stand still rather than give NaN.
    dy[0] = n > 0 ? (sign * ex) / n : 0;
    dy[1] = n > 0 ? (sign * ey) / n : 0;
  };
  const rk = new Rk4(f, 2);
  const full = new Float64Array(2);
  const half = new Float64Array(2);
  const coarse = new Float64Array(2);

  const outside = (x: number, y: number) =>
    x < frame.xMin || x > frame.xMax || y < frame.yMin || y > frame.yMax;
  /** A charge (other than the origin) within r0 of the segment a → b. */
  const hitCharge = (ax: number, ay: number, bx: number, by: number, origin: PointCharge) =>
    charges.find((c) => {
      if (c === origin) return false;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.min(1, Math.max(0, ((c.x - ax) * dx + (c.y - ay) * dy) / len2)) : 0;
      return Math.hypot(ax + t * dx - c.x, ay + t * dy - c.y) < r0;
    });
  const direction = (x: number, y: number): [number, number, number] => {
    const [ex, ey] = fieldAt(charges, k, x, y);
    const n = Math.hypot(ex, ey);
    return [(sign * ex) / n, (sign * ey) / n, n];
  };

  const nullPoints: [number, number][] = [];
  const markNull = (x: number, y: number) => {
    if (!nullPoints.some(([px, py]) => Math.hypot(px - x, py - y) < 1e-3 * size)) {
      nullPoints.push([x, y]);
    }
  };

  const trace = (origin: PointCharge, angle: number, dir: 1 | -1): FieldLine => {
    sign = dir;
    let x = origin.x + r0 * Math.cos(angle);
    let y = origin.y + r0 * Math.sin(angle);
    const line: FieldLine = {
      points: [x, y],
      dir,
      end: 'steps',
      from: indexOf(origin),
      length: 0,
      error: 0,
    };
    // Two charges closer than two disc radii: a seed may start inside the other one's disc.
    const start = hitCharge(x, y, x, y, origin);
    if (start) {
      line.end = 'charge';
      line.to = indexOf(start);
      return line;
    }
    coarse[0] = x;
    coarse[1] = y;
    let h = r0 / 4;
    for (let attempt = 0; attempt < maxSteps; attempt++) {
      const [ux, uy, e0] = direction(x, y);
      if (!(e0 > eNull)) {
        markNull(x, y);
        line.end = 'null';
        return line;
      }
      full[0] = x;
      full[1] = y;
      rk.step(0, full, h);
      half[0] = x;
      half[1] = y;
      rk.step(0, half, h / 2);
      rk.step(0, half, h / 2);
      const err = Math.hypot(half[0] - full[0], half[1] - full[1]) / 15;
      if (err > tol && h > H_MIN * size) {
        h = Math.max(H_MIN * size, h * Math.max(0.2, 0.9 * (tol / err) ** 0.2));
        continue;
      }
      const nx = half[0];
      const ny = half[1];
      // A step across E = 0 turns the direction around or stalls (the chord of a smooth step is
      // about h; symmetric RK4 stages can cancel and fool the error estimate). Close in with
      // smaller steps; once a step is as small as the tolerance, the line ends there.
      const [vx, vy] = direction(nx, ny);
      if (vx * ux + vy * uy < 0 || Math.hypot(nx - x, ny - y) < h / 2) {
        if (h > tol) {
          h /= 4;
          continue;
        }
        markNull(nx, ny);
        line.points.push(nx, ny);
        line.length += h;
        line.end = 'null';
        return line;
      }
      line.length += h;
      rk.step(0, coarse, h);
      line.error = Math.max(line.error, Math.hypot(nx - coarse[0], ny - coarse[1]));
      line.points.push(nx, ny);
      const hit = hitCharge(x, y, nx, ny, origin);
      if (hit) {
        line.end = 'charge';
        line.to = indexOf(hit);
        return line;
      }
      if (outside(nx, ny)) {
        line.end = 'frame';
        return line;
      }
      if (line.length > maxLength) {
        line.end = 'long';
        return line;
      }
      x = nx;
      y = ny;
      h = Math.min(H_MAX * size, h * Math.min(2, 0.9 * (tol / Math.max(err, 1e-30 * size)) ** 0.2));
    }
    return line;
  };

  const count = (c: PointCharge) => Math.max(1, Math.round((nLargest * Math.abs(c.q)) / qMax));
  const lines: FieldLine[] = [];
  for (const c of charges.filter((q) => q.q > 0)) {
    const n = count(c);
    for (let i = 0; i < n; i++) lines.push(trace(c, (2 * Math.PI * i) / n, 1));
  }
  for (const c of charges.filter((q) => q.q < 0)) {
    const n = count(c);
    const arrived = lines
      .filter((l) => l.end === 'charge' && l.to === indexOf(c))
      .map((l) => {
        const px = l.points[l.points.length - 2] ?? c.x;
        const py = l.points[l.points.length - 1] ?? c.y;
        return Math.atan2(py - c.y, px - c.x);
      });
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;
      const taken = arrived.some((a) => {
        const d = Math.abs(((angle - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        return d < Math.PI / n;
      });
      if (!taken) lines.push(trace(c, angle, -1));
    }
  }
  return { lines, nullPoints, maxError: Math.max(0, ...lines.map((l) => l.error)) };
}
