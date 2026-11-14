import { describe, expect, it } from 'vitest';
import { IS, InclineEngine } from '../incline/engine';
import { checkMisses, sliderEnds, sliderSweep } from '../testing';
import { climb, climbs, efficiency, pullInput, works } from './model';
import { workPower } from './scenes';

const D = Math.PI / 180;
const base = { ...workPower.defaults, g: 9.81 };

describe('work, power and efficiency (VL10 Bài 23, 24, 27)', () => {
  it('the work–energy theorem holds at every step of the engine', () => {
    const q = pullInput(base);
    const p = workPower.engineParams?.(base) ?? base;
    const e = new InclineEngine();
    e.reset(p);
    const s = new Float64Array(e.stateSize);
    let n = 0;
    while (!e.finished() && n < 1e5) {
      e.step();
      n++;
      e.readState(s);
      const w = works(q, s[IS.s] ?? 0);
      expect(w.total).toBeCloseTo(0.5 * q.m * (s[IS.v] ?? 0) ** 2, 8);
    }
    // The run ends at the top of the pull (s = length).
    expect(s[IS.s]).toBeCloseTo(q.length, 6);
    expect(e.time()).toBeCloseTo(climb(q).t, 2);
  });

  it('A = F s cos α: 80 N over 5 m along the slope is 400 J; gravity −mg·h', () => {
    const q = pullInput(base);
    const w = works(q, 5);
    expect(w.WF).toBeCloseTo(400, 12);
    expect(w.WP).toBeCloseTo(-10 * 9.81 * 5 * Math.sin(30 * D), 12);
    expect(w.WN).toBe(0);
  });

  it('efficiency = 1 − |A_ms|/A_F, and 100 % without friction', () => {
    const q = pullInput(base);
    const { v } = climb(q);
    const w = works(q, q.length);
    expect(efficiency(q, q.length, v)).toBeCloseTo(1 - Math.abs(w.Wms) / w.WF, 12);
    const smooth = pullInput({ ...base, mu: 0 });
    expect(efficiency(smooth, smooth.length, climb(smooth).v)).toBeCloseTo(1, 12);
  });

  it('the work of the weight depends only on the height, not on the pull', () => {
    const a = workPower.solve(base, 'vi').answers.find((x) => x.id === 'WP')?.value;
    const b = workPower.solve({ ...base, F: 160 }, 'vi').answers.find((x) => x.id === 'WP')?.value;
    expect(a).toBeDefined();
    expect(b).toBeCloseTo(a ?? NaN, 12);
  });

  it('a level floor: the weight does no work; a pull at β does work F s cos β', () => {
    const q = pullInput({ ...base, theta: 0, beta: 60 * D, F: 50 });
    const w = works(q, 4);
    expect(Object.is(w.WP, 0)).toBe(true);
    expect(Object.is(works(pullInput({ ...base, mu: 0 }), 3).Wms, 0)).toBe(true);
    expect(w.WF).toBeCloseTo(50 * 4 * 0.5, 12);
  });

  it('refuses a pull too small to move the crate up, or one that lifts it off', () => {
    expect(workPower.validate?.({ ...base, F: 30 })).toHaveLength(1);
    expect(climbs(pullInput({ ...base, F: 30 }))).toBe(false);
    expect(workPower.validate?.({ ...base, theta: 0, F: 500, beta: 80 * D, m: 0.5 })).toHaveLength(
      1,
    );
    expect(workPower.solve({ ...base, F: 30 }, 'vi').answers).toEqual([]);
  });

  it('every cross-check agrees over the sliders', () => {
    const sets = [...sliderEnds(workPower), ...sliderSweep(workPower, 300, 23)].map((p) => ({
      ...p,
      g: p.g ?? 9.81,
    }));
    expect(sets.map((p) => checkMisses(workPower, p)).filter((m) => m.length > 0)).toEqual([]);
    expect(sets.filter((p) => climbs(pullInput(p))).length).toBeGreaterThan(30);
  });
});
