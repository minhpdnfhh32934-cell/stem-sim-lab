import { describe, expect, it } from 'vitest';
import { C } from '@/core/constants';
import { dopri5 } from '@/core/ode';
import { traceFieldLines, type FieldLine, type Frame } from './fieldLines';
import { fieldAt, forceOn, plateField, potentialAt, type PointCharge } from './model';

const k = C.kC;
const frame: Frame = { xMin: -0.5, xMax: 0.5, yMin: -0.4, yMax: 0.4 };
const size = 1;

/** (x, y) pairs of a line. */
const pointsOf = (l: FieldLine): [number, number][] =>
  Array.from({ length: l.points.length / 2 }, (_, i) => [
    l.points[2 * i] ?? 0,
    l.points[2 * i + 1] ?? 0,
  ]);

describe('field of point charges (model)', () => {
  it('matches Coulomb for one charge and adds up for several', () => {
    const q = 2e-6;
    const [ex, ey] = fieldAt([{ q, x: 0, y: 0 }], k, 0.3, 0.4);
    // |E| = k|q|/r², pointing away from a + charge.
    expect(Math.hypot(ex, ey)).toBeCloseTo((k * q) / 0.25, 6);
    expect(ex / ey).toBeCloseTo(0.3 / 0.4, 12);
    const a: PointCharge = { q: 3e-8, x: -0.1, y: 0 };
    const b: PointCharge = { q: -5e-8, x: 0.2, y: 0.1 };
    const [sx, sy] = fieldAt([a, b], k, 0.05, -0.2);
    const [ax, ay] = fieldAt([a], k, 0.05, -0.2);
    const [bx, by] = fieldAt([b], k, 0.05, -0.2);
    expect(sx).toBeCloseTo(ax + bx, 6);
    expect(sy).toBeCloseTo(ay + by, 6);
  });

  it('equals −∇V (central differences of V = Σkqᵢ/rᵢ)', () => {
    const charges: PointCharge[] = [
      { q: 4e-9, x: -0.2, y: 0 },
      { q: -1e-9, x: 0.15, y: 0.05 },
      { q: 2e-9, x: 0, y: -0.25 },
    ];
    const step = 1e-6;
    for (const [x, y] of [
      [0.1, 0.2],
      [-0.3, -0.1],
      [0.05, -0.05],
    ] as const) {
      const [ex, ey] = fieldAt(charges, k, x, y);
      const gx =
        (potentialAt(charges, k, x + step, y) - potentialAt(charges, k, x - step, y)) / (2 * step);
      const gy =
        (potentialAt(charges, k, x, y + step) - potentialAt(charges, k, x, y - step)) / (2 * step);
      expect(Math.abs(-gx - ex)).toBeLessThan(1e-6 * Math.hypot(ex, ey));
      expect(Math.abs(-gy - ey)).toBeLessThan(1e-6 * Math.hypot(ex, ey));
    }
  });

  it("gives F = q₀E, and Coulomb's law between two charges", () => {
    const q1 = 2e-6;
    const q2 = -3e-6;
    const r = 0.3;
    const [fx, fy] = forceOn(q2, fieldAt([{ q: q1, x: 0, y: 0 }], k, r, 0));
    expect(fx).toBeCloseTo((-k * Math.abs(q1 * q2)) / (r * r), 9); // attraction, towards q1
    expect(Math.abs(fy)).toBe(0);
  });

  it("uses the problem's k: 9·10⁹ and 1/(4πε₀) differ by 0.14 %", () => {
    const [e1] = fieldAt([{ q: 1e-8, x: 0, y: 0 }], 9e9, 0.1, 0);
    const [e2] = fieldAt([{ q: 1e-8, x: 0, y: 0 }], C.kC, 0.1, 0);
    expect(e1).toBeCloseTo(9000, 9);
    expect((e1 - e2) / e2).toBeCloseTo(0.0014, 4);
  });

  it('has E = U/d between ideal plates and 0 outside', () => {
    const p = { U: 200, d: 0.02, w: 0.2 };
    expect(plateField(p, 0, 0)).toEqual([0, -10000]);
    expect(plateField(p, 0.09, 0.009)).toEqual([0, -10000]);
    expect(plateField(p, 0, 0.011)).toEqual([0, 0]);
    expect(plateField(p, 0.11, 0)).toEqual([0, 0]);
    // d ×2 with U kept → E halves.
    expect(plateField({ ...p, d: 0.04 }, 0, 0)[1]).toBe(-5000);
  });
});

describe('field lines (RK4 with step doubling)', () => {
  it('runs straight out of a lone + charge, along E', () => {
    const { lines } = traceFieldLines([{ q: 1e-9, x: 0.1, y: -0.05 }], k, frame);
    expect(lines).toHaveLength(12);
    for (const l of lines) {
      expect(l.dir).toBe(1);
      expect(l.end).toBe('frame');
      const pts = pointsOf(l);
      const [x0, y0] = pts[0] ?? [0, 0];
      const a = Math.atan2(y0 + 0.05, x0 - 0.1);
      for (const [x, y] of pts) {
        // On the ray from the charge: no sideways drift.
        expect(Math.abs(Math.sin(Math.atan2(y + 0.05, x - 0.1) - a))).toBeLessThan(1e-9);
      }
    }
  });

  it('points into a lone − charge (traced outwards, arrows reversed)', () => {
    const { lines } = traceFieldLines([{ q: -1e-9, x: 0, y: 0 }], k, frame);
    for (const l of lines) {
      expect(l.dir).toBe(-1);
      const [x, y] = pointsOf(l).at(-1) ?? [0, 0];
      const [ex, ey] = fieldAt([{ q: -1e-9, x: 0, y: 0 }], k, x, y);
      expect(ex * x + ey * y).toBeLessThan(0); // E points towards the charge
    }
  });

  it('keeps Σqᵢcosθᵢ constant along every line of two charges on one axis', () => {
    const charges: PointCharge[] = [
      { q: 2e-9, x: -0.15, y: 0 },
      { q: -1e-9, x: 0.15, y: 0 },
    ];
    const flux = (x: number, y: number) =>
      charges.reduce((s, c) => s + (c.q * (x - c.x)) / Math.hypot(x - c.x, y - c.y), 0);
    const { lines } = traceFieldLines(charges, k, frame);
    expect(lines.some((l) => l.end === 'charge' && l.to === 1)).toBe(true);
    for (const l of lines) {
      const pts = pointsOf(l);
      // Skip the last point: it may lie inside the other charge's disc.
      const values = pts.slice(0, -1).map(([x, y]) => flux(x, y));
      const spread = Math.max(...values) - Math.min(...values);
      // |∇Φ| ≤ Σ|qᵢ|/r₀ (r₀ = 0,02 m seed circle) times the error the line reports.
      expect(spread, `line from ${l.from} ending ${l.end}`).toBeLessThan((3e-9 / 0.02) * l.error);
    }
  });

  it('stops the axis line of two equal + charges at the midpoint, without NaN', () => {
    const charges: PointCharge[] = [
      { q: 1e-9, x: -0.2, y: 0 },
      { q: 1e-9, x: 0.2, y: 0 },
    ];
    const { lines, nullPoints } = traceFieldLines(charges, k, frame);
    for (const l of lines) expect(l.points.every(Number.isFinite)).toBe(true);
    const axis = lines.filter((l) => Math.abs(l.points[1] ?? 1) < 1e-12 && l.end === 'null');
    expect(axis).toHaveLength(2);
    for (const l of axis) expect(Math.abs(l.points.at(-2) ?? 1)).toBeLessThan(1e-5 * size);
    expect(nullPoints).toHaveLength(1);
    expect(Math.hypot(...(nullPoints[0] ?? [1, 1]))).toBeLessThan(1e-5 * size);
  });

  it('agrees with DOPRI5 from the same seed, within the error it reports', () => {
    const charges: PointCharge[] = [
      { q: 3e-9, x: -0.2, y: 0.05 },
      { q: -2e-9, x: 0.1, y: -0.1 },
      { q: 1e-9, x: 0.25, y: 0.2 },
    ];
    const { lines, maxError } = traceFieldLines(charges, k, frame);
    expect(maxError).toBeGreaterThan(0);
    expect(maxError).toBeLessThan(1e-4 * size); // 0,1 mm on a 1 m frame
    for (const l of lines) {
      const pts = pointsOf(l);
      const [sx, sy] = pts[0] ?? [0, 0];
      const f = (_t: number, y: Float64Array, dy: Float64Array) => {
        const [ex, ey] = fieldAt(charges, k, y[0] ?? 0, y[1] ?? 0);
        const n = Math.hypot(ex, ey);
        dy[0] = (l.dir * ex) / n;
        dy[1] = (l.dir * ey) / n;
      };
      // Up to the last point before a stop (the stop point may sit inside a charge's disc).
      const along = l.end === 'frame' || l.end === 'long' ? l.length : undefined;
      if (along === undefined) continue;
      const ref = dopri5(f, [sx, sy], 0, along, { rtol: 1e-12, atol: 1e-14 });
      const [ex, ey] = pts.at(-1) ?? [0, 0];
      const gap = Math.hypot((ref.y[0] ?? 0) - ex, (ref.y[1] ?? 0) - ey);
      // Straight lines report ~0: allow round-off.
      expect(gap, `line from ${l.from}`).toBeLessThanOrEqual(l.error + 1e-12 * size);
    }
  });

  it('cuts a line by its step budget, not by time', () => {
    const { lines } = traceFieldLines([{ q: 1e-9, x: 0, y: 0 }], k, frame, { maxSteps: 3 });
    expect(lines.every((l) => l.end === 'steps' && l.points.length <= 2 * 4)).toBe(true);
  });

  it('draws as many lines as ∝ |q| and skips lines already arriving at a − charge', () => {
    const charges: PointCharge[] = [
      { q: 2e-9, x: -0.15, y: 0 },
      { q: -2e-9, x: 0.15, y: 0 },
    ];
    const { lines } = traceFieldLines(charges, k, frame, { linesForLargest: 8 });
    const fromPlus = lines.filter((l) => l.dir === 1);
    expect(fromPlus).toHaveLength(8);
    const arriving = fromPlus.filter((l) => l.end === 'charge' && l.to === 1).length;
    expect(lines.filter((l) => l.dir === -1)).toHaveLength(8 - arriving);
    const half = traceFieldLines(
      [charges[0] as PointCharge, { ...charges[1], q: -1e-9 } as PointCharge],
      k,
      frame,
      {
        linesForLargest: 8,
      },
    );
    expect(half.lines.filter((l) => l.dir === 1)).toHaveLength(8);
  });
});
