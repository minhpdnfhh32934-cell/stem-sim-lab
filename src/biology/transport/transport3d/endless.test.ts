import { describe, expect, it } from 'vitest';
import { osmosisData } from '../osmosisData';
import { osmosisTrajectory } from '../transport';
import { diffusionFrameAt, diffusionModel3d } from './diffusion';
import { WALK_KNOTS, knotOf } from './diffusionLayout';
import { advanceOsmosis, osmosisFrameAt, sampleIndex } from './osmosis';

const DIFF = { particles: 160, pores: 4, c1: 10, c2: 0, v1: 1, v2: 1, pa: 0.2, run: 0 };
/** The lesson's osmosis defaults (store.ts) and an arm that runs dry. */
const OSM = { c0: 1, i: 1, tC: 25, h0: 0.2 };
const DRY = { c0: 5, i: 1, tC: 25, h0: 0.2 };

describe('osmosis 3D: the endless run (#205 C5)', () => {
  it.each([OSM, DRY])('span k is the run computed in one go, sample for sample (%j)', (inputs) => {
    const d = osmosisData(inputs);
    const n = d.traj.t.length - 1;
    const run = advanceOsmosis(null, { key: 'a', page: 3, d });
    const whole = osmosisTrajectory(d.p, 4 * d.tEnd, 4 * n);
    expect(run.page).toBe(3);
    run.traj.hL.forEach((h, i) => {
      expect(Math.abs(run.traj.t[i]! - whole.t[3 * n + i]!) / d.tEnd).toBeLessThan(1e-9);
      expect(h).toBe(whole.hL[3 * n + i]);
      expect(h).toBeLessThanOrEqual(2 * d.p.h0);
    });
    // Each sample of the span is shown at its own time (the one at or before t).
    const m = { ...d, traj: run.traj };
    for (const i of [0, 7, n]) {
      expect(sampleIndex(m, run.traj.t[i]!)).toBe(i);
      expect(osmosisFrameAt(m, run.traj.t[i]!).hL).toBe(run.traj.hL[i]);
    }
  });

  it('other inputs, or an earlier page (Đặt lại), start again from span 0', () => {
    const d = osmosisData(OSM);
    const at2 = advanceOsmosis(null, { key: 'a', page: 2, d });
    expect(advanceOsmosis(at2, { key: 'b', page: 0, d }).traj).toBe(d.traj);
    expect(advanceOsmosis(at2, { key: 'a', page: 0, d }).traj).toBe(d.traj);
    expect(advanceOsmosis(at2, { key: 'a', page: 2, d })).toBe(at2);
  });
});

describe('diffusion 3D: the endless run (#205 C5)', () => {
  it('counts after tEnd follow the formula and settle at the equilibrium split', () => {
    const m = diffusionModel3d(DIFF);
    for (const k of [1, 2, 5, 20]) {
      const f = diffusionFrameAt(m, k * m.tEnd);
      expect(f.n1 + f.n2).toBe(m.total);
      expect(f.crossed).toBeLessThanOrEqual(m.crossers.length);
    }
    const late = diffusionFrameAt(m, 20 * m.tEnd);
    expect(late.n1).toBe(m.n1End);
    expect(late.crossed).toBe(m.crossers.length);
  });

  it('the illustrative walk goes back and forth past tEnd, never jumping', () => {
    const m = diffusionModel3d(DIFF);
    // Unchanged up to tEnd.
    for (const u of [0, 0.25, 0.5, 1]) expect(knotOf(m, u * m.tEnd)).toBeCloseTo(u * WALK_KNOTS, 9);
    let prev = knotOf(m, 0);
    const step = m.tEnd / 500;
    for (let t = step; t <= 5 * m.tEnd; t += step) {
      const k = knotOf(m, t);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(WALK_KNOTS);
      // One step of time moves at most one step along the knots.
      expect(Math.abs(k - prev)).toBeLessThanOrEqual((WALK_KNOTS / 500) * (1 + 1e-6));
      prev = k;
    }
  });
});
