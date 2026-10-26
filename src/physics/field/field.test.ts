import { describe, expect, it } from 'vitest';
import { C } from '@/core/constants';
import { dopri5 } from '@/core/ode';
import { traceFieldLines, type FieldLine, type Frame } from './fieldLines';
import { fmtQty } from '../common/tex';
import { linesFor } from './draw';
import { FE, FieldEngine } from './engine';
import {
  MODE,
  fieldAt,
  fieldSetup,
  forceOn,
  plateField,
  potentialAt,
  type PointCharge,
} from './model';
import { electricField } from './scenes';

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
    const { lines, nullPoints } = traceFieldLines([{ q: -1e-9, x: 0, y: 0 }], k, frame);
    expect(lines).toHaveLength(12);
    expect(nullPoints).toEqual([]);
    for (const l of lines) {
      expect(l.dir).toBe(-1);
      expect(l.end).toBe('frame');
      // Traced away from the charge: the distance grows at every point.
      const r = pointsOf(l).map(([x, y]) => Math.hypot(x, y));
      for (let i = 1; i < r.length; i++) expect(r[i] ?? 0).toBeGreaterThan(r[i - 1] ?? 0);
      const [x, y] = pointsOf(l).at(-1) ?? [0, 0];
      const [ex, ey] = fieldAt([{ q: -1e-9, x: 0, y: 0 }], k, x, y);
      expect(ex * x + ey * y).toBeLessThan(0); // E points towards the charge
    }
  });

  it('never ends a line on a charge of the sign it started from (review of #89)', () => {
    const square: Frame = { xMin: -0.5, xMax: 0.5, yMin: -0.5, yMax: 0.5 };
    // Two equal + charges closer than the old disc radius (2 % of the frame = 2 cm).
    const close: PointCharge[] = [
      { q: 4e-8, x: 0, y: 0 },
      { q: 4e-8, x: 0.012, y: 0 },
    ];
    const a = traceFieldLines(close, k, square);
    expect(a.lines.filter((l) => l.end === 'charge')).toEqual([]);
    expect(a.nullPoints.some(([x, y]) => Math.hypot(x - 0.006, y) < 1e-4)).toBe(true);
    // A strong and a weak + charge 20 cm apart: the weak one's disc is no end either.
    const unequal: PointCharge[] = [
      { q: 1e-5, x: 0, y: 0 },
      { q: 1e-8, x: 0.2, y: 0 },
    ];
    expect(traceFieldLines(unequal, k, square).lines.filter((l) => l.end === 'charge')).toEqual([]);
    // Lines do end on a charge of the other sign.
    const dipole: PointCharge[] = [
      { q: 4e-8, x: 0, y: 0 },
      { q: -4e-8, x: 0.012, y: 0 },
    ];
    const ends = traceFieldLines(dipole, k, square).lines.filter((l) => l.end === 'charge');
    expect(ends.length).toBeGreaterThan(0);
    for (const l of ends) expect(l.to).toBe(l.from === 0 ? 1 : 0);
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

  it('never marks E = 0 on a charge when a seed lands exactly on another charge', () => {
    const square: Frame = { xMin: -0.5, xMax: 0.5, yMin: -0.5, yMax: 0.5 };
    const { nullPoints, lines } = traceFieldLines(
      [
        { q: 1e-5, x: 0, y: 0 },
        { q: -1e-5, x: 0.02, y: 0 },
      ],
      k,
      square,
    );
    expect(nullPoints).toEqual([]);
    expect(lines.every((l) => l.points.every(Number.isFinite))).toBe(true);
  });

  it('traces charges a millimetre apart without running out of steps', () => {
    const square: Frame = { xMin: -0.5, xMax: 0.5, yMin: -0.5, yMax: 0.5 };
    for (const gap of [1e-3, 1e-4]) {
      const { lines } = traceFieldLines(
        [
          { q: 4e-8, x: 0, y: 0 },
          { q: 4e-8, x: gap, y: 0 },
        ],
        k,
        square,
      );
      expect(
        lines.filter((l) => l.end === 'steps'),
        `gap ${gap}`,
      ).toEqual([]);
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

describe('electricField scene', () => {
  const sceneParams = (over: Record<string, number> = {}) => ({
    ...electricField.defaults,
    ...over,
  });
  const answer = (p: Record<string, number>, id: string) =>
    electricField.solve(p, 'vi').answers.find((a) => a.id === id);

  it('engine state equals the field of the model at M, and U/d between the plates', () => {
    const engine = new FieldEngine();
    const out = new Float64Array(engine.stateSize);
    const p = sceneParams({ yP: 0.05 });
    engine.reset(p);
    engine.step();
    engine.readState(out);
    const s = fieldSetup(p);
    const [ex, ey] = fieldAt(s.charges, s.k, s.probe.x, s.probe.y);
    expect(out[FE.ex]).toBe(ex);
    expect(out[FE.ey]).toBe(ey);
    expect(out[FE.e]).toBe(Math.hypot(ex, ey));
    engine.reset(sceneParams({ mode: MODE.plates }));
    engine.readState(out);
    expect(out[FE.e]).toBe(100 / 0.02);
    expect(engine.finished()).toBe(false);
  });

  it('solves the default dipole: E at the midpoint, force on q₀, Coulomb force, −∇V check', () => {
    const p = sceneParams();
    const e = (2 * C.kC * 4e-8) / 0.1 ** 2;
    expect(answer(p, 'E')?.value).toBeCloseTo(e, 6);
    expect(answer(p, 'Ex')?.value).toBeCloseTo(e, 6); // towards the − charge at B
    expect(answer(p, 'Ey')?.value).toBe(0);
    expect(answer(p, 'F')?.value).toBeCloseTo(1e-8 * e, 15);
    expect(answer(p, 'F12')?.value).toBeCloseTo((C.kC * 4e-8 * 4e-8) / 0.2 ** 2, 15);
    const E = answer(p, 'E');
    expect(Math.abs((E?.check ?? 0) - e) / e).toBeLessThan(1e-6);
    expect(answer({ ...p, n: 1 }, 'F12')).toBeUndefined();
    expect(answer({ ...p, mode: MODE.plates }, 'E')?.value).toBe(5000);
  });

  it('refuses M on a charge, charges too close, and plates without a gap', () => {
    expect(electricField.validate?.(sceneParams())).toEqual([]);
    expect(electricField.validate?.(sceneParams({ xP: 0.2 }))).toHaveLength(1);
    expect(electricField.validate?.(sceneParams({ x2: 0, xP: 0.05 }))).toHaveLength(1);
    expect(electricField.validate?.(sceneParams({ mode: MODE.plates, d: 0 }))).toHaveLength(1);
  });

  it('takes the mode and the number of charges from the problem, never from a slider', () => {
    const auto = electricField.autoDefaults;
    expect(auto?.(sceneParams(), { q1: 'problem', xP: 'problem' })).toEqual({
      n: 1,
      mode: MODE.points,
    });
    expect(auto?.(sceneParams(), { q1: 'problem', q3: 'problem' })).toEqual({
      n: 3,
      mode: MODE.points,
    });
    expect(auto?.(sceneParams(), { U: 'problem', d: 'problem' })).toEqual({ mode: MODE.plates });
    // A learner moving q₁ by hand keeps the two charges on screen.
    expect(auto?.(sceneParams(), { q1: 'user' })).toEqual({});
  });

  it('reports E = 0 where the fields cancel, without a meaningless relative check', () => {
    // q₂ = 4·q₁ at 30 cm: E = 0 at 10 cm from q₁ (k·q/0,1² = k·4q/0,2²).
    const p = sceneParams({ q1: 1e-6, q2: 4e-6, x2: 0.3, xP: 0.1 });
    const E = answer(p, 'E');
    expect(E?.value).toBe(0);
    expect(E?.check).toBeUndefined();
    expect(answer(p, 'Ex')?.value).toBe(0);
    const engine = new FieldEngine();
    const out = new Float64Array(engine.stateSize);
    engine.reset(p);
    engine.readState(out);
    expect(out[FE.e]).toBe(0);
  });

  it('says a zero charge makes no field and a zero test charge feels no force', () => {
    const texts = electricField
      .solve(sceneParams({ q1: 0, q0: 0 }), 'vi')
      .steps.map((st) => st.text.vi)
      .join(' ');
    expect(texts).toContain('q₁ = 0: không gây ra điện trường');
    expect(texts).toContain('q₀ = 0: không chịu lực điện');
    expect(texts).toContain('có một điện tích bằng 0');
  });

  it('accepts charges close together wherever M is; refuses only charges at one place', () => {
    // Review of #89: q₂ at 3 cm was refused once M moved to 50 cm (a drawing radius, not physics).
    expect(electricField.validate?.(sceneParams({ x2: 0.03, xP: 0.5 }))).toEqual([]);
    expect(electricField.validate?.(sceneParams({ x2: 0.01 }))).toEqual([]);
    expect(electricField.validate?.(sceneParams({ x2: 0.001, xP: 0.5 }))).toEqual([]);
    expect(electricField.validate?.(sceneParams({ x2: 0 }))).toHaveLength(1);
  });

  it('shows q₁, q₂, their distance and M first in Basic mode; U, d with the plates', () => {
    const visible = (p: Record<string, number>) =>
      electricField.params.filter((d) => d.when?.(p) ?? true).map((d) => d.key);
    expect(visible(sceneParams()).slice(0, 5)).toEqual(['mode', 'q1', 'q2', 'x2', 'xP']);
    // One charge: M on the x-axis, y_M hidden.
    expect(visible(sceneParams({ n: 1 })).slice(0, 5)).toEqual(['mode', 'q1', 'xP', 'n', 'x1']);
    expect(visible(sceneParams({ mode: MODE.plates }))).toEqual(['mode', 'U', 'd', 'q0']);
    expect(electricField.scienceCard(sceneParams({ mode: MODE.plates })).title.vi).toBe(
      'Điện trường đều giữa hai bản phẳng',
    );
  });

  it('puts the field-line error the code computed on an exact Science Card', () => {
    const c = electricField.scienceCard(sceneParams());
    expect(c.confidence).toBe('exact');
    const err = fmtQty('vi', linesFor(sceneParams()).maxError, 'mm', 2);
    expect(c.confidenceNote?.vi).toContain(err);
    expect(c.sources.length).toBeGreaterThan(0);
  });
});
