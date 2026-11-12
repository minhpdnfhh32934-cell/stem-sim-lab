import { describe, expect, it } from 'vitest';
import { lotkaVolterra, lvDrift, lvInvariantLog, type LvParams } from '../ecology';
import { advanceLvRun, curvePoints, lvModel3d, momentAt, type LvEndless } from './binding';

/** The lesson's defaults (store.ts) and the 2D data's 800 steps (data.ts). */
const P = { alpha: 1, beta: 0.1, delta: 0.075, gamma: 1.5 };
const N = 800;

function start(p: LvParams, x0: number, y0: number, span: number) {
  const first = lotkaVolterra(p, x0, y0, span, N);
  return { p, first, firstDrift: lvDrift(p, first) };
}

describe('predator–prey 3D: the endless run (#205 C5)', () => {
  it('span k is the run computed in one go over k + 1 spans, sample for sample', () => {
    const s = start(P, 10, 5, 30);
    let run: LvEndless | null = null;
    for (let page = 0; page <= 3; page++) run = advanceLvRun(run, { key: 'a', page, ...s });
    if (!run) throw new Error('no run');
    const whole = lotkaVolterra(P, 10, 5, 4 * 30, 4 * N);
    expect(run.page).toBe(3);
    expect(run.traj.t).toHaveLength(N + 1);
    run.traj.t.forEach((t, i) => {
      expect(Math.abs(t - whole.t[3 * N + i]!)).toBeLessThan(1e-9);
      expect(run.traj.u[i]).toBe(whole.u[3 * N + i]);
      expect(run.traj.v[i]).toBe(whole.v[3 * N + i]);
    });
    // Asked for page 3 at once: the same spans, one after the other.
    const jumped = advanceLvRun(null, { key: 'a', page: 3, ...s });
    expect(jumped.traj.u).toEqual(run.traj.u);
  });

  it('V is checked against t = 0 over every span played, and kept small', () => {
    const s = start(P, 10, 5, 30);
    const run = advanceLvRun(null, { key: 'a', page: 9, ...s });
    const whole = lotkaVolterra(P, 10, 5, 10 * 30, 10 * N);
    expect(run.seen.V0).toBe(lvInvariantLog(P, whole.u[0]!, whole.v[0]!));
    expect(run.drift).toBeCloseTo(lvDrift(P, whole), 15);
    expect(run.drift).toBeLessThan(1e-8);
  });

  it('other inputs, or an earlier page (replay), start again from span 0', () => {
    const s = start(P, 10, 5, 30);
    const at2 = advanceLvRun(null, { key: 'a', page: 2, ...s });
    expect(advanceLvRun(at2, { key: 'b', page: 0, ...s }).traj).toBe(s.first);
    expect(advanceLvRun(at2, { key: 'a', page: 0, ...s }).traj).toBe(s.first);
    expect(advanceLvRun(at2, { key: 'a', page: 2, ...s })).toBe(at2);
  });

  it('a span shorter than a cycle: the scales grow to what later spans reach, never shrink', () => {
    // Slow cycles (2π/√(αγ) ≈ 28) shown 5 at a time: span 0 does not reach the peaks.
    const p = { alpha: 0.5, beta: 0.02, delta: 0.01, gamma: 0.1 };
    const s = start(p, 30, 5, 5);
    let run = advanceLvRun(null, { key: 'a', page: 0, ...s });
    const first = lvModel3d({ p, traj: run.traj, tEnd: 5, drift: run.drift, seen: run.seen }, 200);
    let grew = false;
    for (let page = 1; page <= 12; page++) {
      const before = run.seen;
      run = advanceLvRun(run, { key: 'a', page, ...s });
      expect(run.seen.peak.prey).toBeGreaterThanOrEqual(before.peak.prey);
      expect(run.seen.peak.predators).toBeGreaterThanOrEqual(before.peak.predators);
      expect(run.seen.rateRef).toBeGreaterThanOrEqual(before.rateRef);
      grew ||= run.seen.peak.prey > before.peak.prey || run.seen.rateRef > before.rateRef;
      const model = lvModel3d(
        { p, traj: run.traj, tEnd: 5, drift: run.drift, seen: run.seen },
        200,
      );
      expect(model.top).toBeGreaterThanOrEqual(first.top);
      // Every computed sample of the span fits its scales; the curve under the slider is 0…1.
      for (const t of run.traj.t) {
        const m = momentAt(model, t);
        expect(m.fill.prey).toBeLessThanOrEqual(1);
        expect(m.fill.predators).toBeLessThanOrEqual(1);
        expect(Math.abs(m.arrow.prey)).toBeLessThanOrEqual(1);
        expect(Math.abs(m.arrow.predators)).toBeLessThanOrEqual(1);
        expect(m.shown.prey).toBeLessThanOrEqual(model.slots.prey);
      }
      const c = curvePoints(model);
      for (const [u] of [...c.prey, ...c.predators]) {
        expect(u).toBeGreaterThanOrEqual(-1e-9);
        expect(u).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
    expect(grew).toBe(true);
  });
});
