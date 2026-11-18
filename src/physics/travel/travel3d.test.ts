import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { drawnAt, shiftScale, verticalScale } from './draw';
import { TW, TravelEngine } from './engine';
import { KIND, displacement, travelInput, wavelength } from './model';
import { buildTravelScene } from './scene3d';
import { LAYERS, ROWS, medium, partAt } from './travel3d';

const base = travelInput({});

describe('travelling wave 3D binding', () => {
  it('parts every λ/16; each sits where the 2D picture draws it and only oscillates', () => {
    for (const kind of [KIND.transverse, KIND.longitudinal]) {
      const q = { ...base, kind };
      const m = medium(q);
      expect((m.xs[1] ?? 0) - (m.xs[0] ?? 0)).toBeCloseTo(wavelength(q) / 16, 12);
      expect(m.layers).toHaveLength(kind === KIND.longitudinal ? LAYERS : 1);
      expect(m.rows).toHaveLength(ROWS);
      for (const t of [0, 1.3, 4.7, 9.9])
        for (const x of m.xs.slice(0, 40)) {
          const p = partAt(q, x, t);
          expect(p).toEqual(drawnAt(q, x, displacement(q, x, t)));
          const away = kind === KIND.transverse ? Math.abs(p.y) : Math.abs(p.x - x);
          const stretch = kind === KIND.transverse ? verticalScale(q) : shiftScale(q);
          expect(away).toBeLessThanOrEqual(q.A * stretch * (1 + 1e-12));
        }
    }
  });
});

describe('travelling wave 3D scene', () => {
  it('moves to the engine’s instant t = front / v; M follows the model; frees all', () => {
    const { kit, track, start } = testKit();
    const engine = new TravelEngine();
    engine.reset({});
    const state = new Float64Array(engine.stateSize);
    const scene = buildTravelScene(kit, {
      q: base,
      texts: { O: 'O', M: 'M', v: 'v' },
      read: () => state,
    });
    for (let i = 0; i < 700; i++) engine.step();
    engine.readState(state);
    scene.tick?.(1 / 60);
    const s = scene.state();
    expect(s.t).toBeCloseTo((state[TW.front] ?? 0) / base.v, 12);
    const xM = Math.round(base.xM / (wavelength(base) / 16)) * (wavelength(base) / 16);
    expect(s.mY).toBeCloseTo(displacement(base, xM, s.t) * verticalScale(base), 12);
    expectAllFreed(kit, track, start);
  });
});
