import { describe, expect, it } from 'vitest';
import { C } from '@/core/constants';
import { RHO, osmosisData } from '../osmosisData';
import {
  SOLUTE_DRAWN,
  TUBE,
  WATER_DRAWN,
  levelY,
  osmosisFrameAt,
  osmosisModel3d,
  rulerTicks,
  sampleIndex,
  soluteAt,
  waterAt,
  type OsmosisData,
  type Vec3,
} from './osmosis';

type Inputs = { c0: number; i: number; tC: number; h0: number };
/** The lesson's data, as the 2D and 3D views get it (same tEnd and 240 samples). */
const data = (over: Partial<Inputs> = {}): OsmosisData =>
  osmosisData({ c0: 1, i: 1, tC: 25, h0: 0.2, ...over });

const CASES: Partial<Inputs>[] = [
  {},
  { c0: 5, i: 3, h0: 0.5 },
  { c0: 0.1, h0: 0.05, tC: 0 },
  // The water arm runs dry before Π is balanced.
  { c0: 5, i: 3, h0: 0.05 },
];

describe('osmosis in 3D', () => {
  it('heights are the trajectory’s samples (the one at or before t); h_L + h_R = 2h₀', () => {
    for (const over of CASES) {
      const d = data(over);
      const m = osmosisModel3d(d);
      d.traj.t.forEach((t, k) => {
        const f = osmosisFrameAt(m, t);
        expect(f.index).toBe(k);
        expect(f.hL).toBe(d.traj.hL[k]);
        expect(f.hR).toBeCloseTo(Math.max(0, 2 * d.p.h0 - (d.traj.hL[k] ?? 0)), 15);
        expect(f.dh).toBeCloseTo(f.hL - f.hR, 15);
        expect(f.pi).toBeCloseTo(d.p.i * ((d.p.c0 * d.p.h0) / f.hL) * C.R * d.p.T, 6);
        expect(f.rhoGdh).toBeCloseTo(RHO * C.gn * f.dh, 9);
      });
      // Between two samples the earlier one shows.
      const mid = ((d.traj.t[10] ?? 0) + (d.traj.t[11] ?? 0)) / 2;
      expect(sampleIndex(d, mid)).toBe(10);
      expect(osmosisFrameAt(m, d.tEnd * 2).index).toBe(240);
    }
  });

  it('the final Δh is the model’s equilibrium (or the dry tube’s 2h₀)', () => {
    for (const over of CASES) {
      const d = data(over);
      const f = osmosisFrameAt(osmosisModel3d(d), d.tEnd);
      if (d.eq.dry) expect(f.dh).toBeCloseTo(d.eq.dh, 12);
      // Six time constants of the linearised equation: within 1 % of the exact equilibrium.
      else expect(Math.abs(f.dh - d.eq.dh) / d.eq.dh).toBeLessThan(0.01);
    }
  });

  it('one vertical scale for both columns and the ruler; the tallest liquid fits the tube', () => {
    for (const over of CASES) {
      const d = data(over);
      const m = osmosisModel3d(d);
      expect(levelY(m, 0.1) / 0.1).toBeCloseTo(m.perMetre, 12);
      const tallest = Math.max(...d.traj.hL, d.eq.hL);
      expect(levelY(m, tallest)).toBeLessThanOrEqual(TUBE.height);
      const ticks = rulerTicks(m);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBeCloseTo(m.rulerCm, 9);
      expect(levelY(m, m.rulerCm / 100)).toBeLessThanOrEqual(TUBE.height + 1e-9);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(11);
    }
  });

  it('the solute stays in the solution column, its count constant, spreading as the column rises', () => {
    const d = data();
    const m = osmosisModel3d(d);
    const p: Vec3 = [0, 0, 0];
    const spread = (t: number) => {
      const f = osmosisFrameAt(m, t);
      let lo = Infinity;
      let hi = -Infinity;
      for (let j = 0; j < SOLUTE_DRAWN; j++) {
        soluteAt(m, f, j, 3.7, p);
        expect(Math.hypot(p[0] + TUBE.a, p[2])).toBeLessThanOrEqual(TUBE.r);
        expect(p[1]).toBeGreaterThanOrEqual(0);
        expect(p[1]).toBeLessThanOrEqual(levelY(m, f.hL));
        lo = Math.min(lo, p[1]);
        hi = Math.max(hi, p[1]);
      }
      return { span: hi - lo, f };
    };
    const start = spread(0);
    const end = spread(d.tEnd);
    expect(end.span).toBeGreaterThan(start.span);
    // c = c₀h₀/h_L: the same amount of solute in a taller column.
    expect(end.f.c * end.f.hL).toBeCloseTo(start.f.c * start.f.hL, 12);
  });

  it('water molecules stay in the bottom channel and move only while water crosses', () => {
    const d = data();
    const m = osmosisModel3d(d);
    const p: Vec3 = [0, 0, 0];
    const xs = (t: number) => {
      const f = osmosisFrameAt(m, t);
      return Array.from({ length: WATER_DRAWN }, (_, j) => {
        waterAt(m, f, j, 0, p);
        expect(Math.hypot(p[1] + TUBE.r, p[2])).toBeLessThanOrEqual(TUBE.r);
        expect(Math.abs(p[0])).toBeLessThanOrEqual(TUBE.a);
        return p[0];
      });
    };
    expect(xs(d.tEnd * 0.3)).not.toEqual(xs(0));
    // At the end the level has settled: the molecules stand still.
    const last = d.traj.t.at(-1) ?? d.tEnd;
    expect(xs(last)).toEqual(xs(last + d.tEnd));
  });
});
