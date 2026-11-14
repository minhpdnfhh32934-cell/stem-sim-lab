import { describe, expect, it } from 'vitest';
import { checkMisses, sliderEnds, sliderSweep } from '../testing';
import { TS, TensionEngine } from './engine';
import { hanging, tensions, tensionsByComponents, weight } from './model';
import { stringTension } from './scenes';

const D = Math.PI / 180;
const base = { ...stringTension.defaults, g: 9.81 };

describe('weight and string tension (VL10 Bài 17)', () => {
  it('one vertical string carries the whole weight', () => {
    const h = hanging({ ...base, strings: 1, m: 3 });
    expect(tensions(h).T1).toBeCloseTo(3 * 9.81, 12);
  });

  it('two strings at the same angle: T = P/(2 cos α), more than P beyond 60°', () => {
    for (const a of [10, 30, 60, 80]) {
      const h = hanging({ ...base, a1: a * D, a2: a * D });
      const T = weight(h) / (2 * Math.cos(a * D));
      expect(tensions(h).T1).toBeCloseTo(T, 10);
      expect(tensions(h).T2).toBeCloseTo(T, 10);
    }
    const steep = stringTension.solve({ ...base, a1: 80 * D, a2: 80 * D }, 'vi');
    expect(steep.notes?.length).toBe(1);
    // At exactly 60° each string pulls with the full weight.
    const h60 = hanging({ ...base, a1: 60 * D, a2: 60 * D });
    expect(tensions(h60).T1 / weight(h60)).toBeCloseTo(1, 12);
  });

  it('Lamy’s rule = the two component equations solved directly, over every slider', () => {
    const sets = [...sliderEnds(stringTension), ...sliderSweep(stringTension, 300, 17)].map(
      (p) => ({ ...p, g: p.g ?? 9.81 }),
    );
    expect(sets.map((p) => checkMisses(stringTension, p)).filter((m) => m.length > 0)).toEqual([]);
    for (const p of sets) {
      const h = hanging(p);
      const a = tensions(h);
      const b = tensionsByComponents(h);
      if (!b || !h.two) continue;
      // And the knot really balances: horizontal and vertical sums vanish.
      expect(a.T2 * Math.sin(h.a2) - a.T1 * Math.sin(h.a1)).toBeCloseTo(0, 9);
      expect(a.T1 * Math.cos(h.a1) + a.T2 * Math.cos(h.a2)).toBeCloseTo(weight(h), 9);
    }
  });

  it('two vertical strings: refused, and the solution explains why', () => {
    const p = { ...base, a1: 0, a2: 0 };
    expect(stringTension.validate?.(p)).toHaveLength(1);
    const s = stringTension.solve(p, 'vi');
    expect(s.answers.map((a) => a.id)).toEqual(['P']);
    expect(s.steps.at(-1)?.text.vi).toMatch(/không cho biết mỗi dây/);
  });

  it('the engine holds the tensions still (a static scene)', () => {
    const e = new TensionEngine();
    e.reset(base);
    const s = new Float64Array(e.stateSize);
    const { T1, T2 } = tensions(hanging(base));
    for (let i = 0; i < 100; i++) {
      e.step();
      e.readState(s);
      expect(s[TS.T1]).toBe(T1);
      expect(s[TS.T2]).toBe(T2);
    }
  });

  it('the "equal tensions" challenge: symmetric angles give a ratio of 1', () => {
    const r = stringTension
      .solve({ ...base, a1: 30 * D, a2: 30 * D }, 'vi')
      .answers.find((a) => a.id === 'ratio');
    expect(r?.value).toBeCloseTo(1, 12);
  });
});
