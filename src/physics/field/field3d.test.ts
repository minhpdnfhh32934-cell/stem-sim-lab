import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import type { Params } from '../types';
import { linesFor } from './draw';
import { FE, FieldEngine } from './engine';
import { COPIES, chargeAxis, field3d, turn, type Vec3 } from './field3d';
import { MODE, fieldSetup } from './model';
import { electricField } from './scenes';
import { buildFieldScene } from './scene3d';

const base: Params = { ...electricField.defaults };
const texts = { charges: ['q₁', 'q₂', 'q₃'], M: 'M', E: 'E', nul: 'E = 0' };

/** Coulomb's law in space (test only): E = Σ k qᵢ (r − rᵢ)/|r − rᵢ|³. */
function field3(p: Params, r: Vec3): Vec3 {
  const s = fieldSetup(p);
  const e: Vec3 = [0, 0, 0];
  for (const c of s.charges) {
    const d: Vec3 = [r[0] - c.x, r[1] - c.y, r[2]];
    const n = Math.hypot(...d);
    const f = (s.k * c.q) / (n * n * n);
    e[0] += f * d[0];
    e[1] += f * d[1];
    e[2] += f * d[2];
  }
  return e;
}

function engineE(p: Params): [number, number] {
  const eng = new FieldEngine();
  eng.reset(p);
  const out = new Float64Array(eng.stateSize);
  eng.readState(out);
  return [out[FE.ex] ?? NaN, out[FE.ey] ?? NaN];
}

describe('electric field 3D binding', () => {
  it('two charges: the plane’s lines are the 2D lines; turned copies; E at M is the engine’s', () => {
    const m = field3d(base);
    const traced = linesFor(base);
    expect(m.axis).not.toBeNull();
    expect(m.lines).toHaveLength(COPIES * traced.lines.length);
    traced.lines.forEach((l, i) => {
      const drawn = m.lines[i]?.points ?? [];
      expect(drawn).toHaveLength(l.points.length / 2);
      drawn.forEach((pt, k) => {
        expect(pt).toEqual([l.points[2 * k], l.points[2 * k + 1], 0]);
      });
    });
    const [ex, ey] = engineE(base);
    expect(m.E[0]).toBe(ex);
    expect(m.E[1]).toBe(ey);
  });

  it('the field is symmetric about the charges’ line, so a turned field line is one', () => {
    const m = field3d(base);
    const axis = m.axis;
    if (!axis) throw new Error('no axis');
    for (const p of [
      [0.05, 0.03, 0],
      [0.1, -0.07, 0],
      [0.31, 0.12, 0],
    ] as Vec3[])
      for (const k of [1, 2]) {
        const theta = (k * Math.PI) / COPIES;
        const e0 = field3(base, p);
        const e1 = field3(base, turn(p, axis.at, axis.dir, theta));
        // E at the turned point = E at the point, turned (a vector: about the origin).
        const rotated = turn(e0, [0, 0, 0], axis.dir, theta);
        const scale = Math.hypot(...e0);
        for (let j = 0; j < 3; j++)
          expect((e1[j] ?? 0) / scale).toBeCloseTo((rotated[j] ?? 0) / scale, 12);
      }
  });

  it('three charges off one line: only the plane’s lines', () => {
    const p: Params = { ...base, n: 3, x3: 0.1, y3: 0.1 };
    const m = field3d(p);
    expect(m.axis).toBeNull();
    expect(m.lines).toHaveLength(linesFor(p).lines.length);
    expect(m.lines.every((l) => l.points.every((q) => q[2] === 0))).toBe(true);
    expect(
      chargeAxis([
        { x: 0, y: 0 },
        { x: 0.2, y: 0 },
        { x: 0.4, y: 0 },
      ]),
    ).not.toBeNull();
  });

  it('capacitor: E = U/d from the + plate to the − plate', () => {
    const p: Params = { ...base, mode: MODE.plates, U: 100, d: 0.02 };
    const m = field3d(p);
    expect(m.mode).toBe('plates');
    expect(m.E).toEqual([0, -5000]);
    expect(engineE(p)).toEqual([0, -5000]);
  });
});

describe('electric field 3D scene', () => {
  it('one arrowhead per line, a ball per charge; frees all', () => {
    const { kit, track, start } = testKit();
    const model = field3d(base);
    const s = buildFieldScene(kit, { model, texts }).state();
    expect(s.lines).toBe(model.lines.length);
    expect(s.arrowheads).toBe(model.lines.length);
    expect(s.charges).toBe(2);
    expect(kit.scene.getObjectByName('field-E')).toBeDefined();
    expectAllFreed(kit, track, start);
  });

  it('capacitor scene frees all', () => {
    const { kit, track, start } = testKit();
    buildFieldScene(kit, { model: field3d({ ...base, mode: MODE.plates }), texts });
    expect(kit.scene.getObjectByName('field-uniform')?.children).toHaveLength(9);
    expectAllFreed(kit, track, start);
  });
});
