import { describe, expect, it } from 'vitest';
import { dopri5 } from '@/core/ode/dopri5';
import { checkMisses, sliderEnds, sliderSweep } from '../testing';
import { FC, ForcesEngine } from './engine';
import { forceSet, resultant, resultantByAngles, runLength } from './model';
import { forceComposition } from './scenes';

const D = Math.PI / 180;
const base = forceComposition.defaults;

describe('adding and resolving forces (VL10 Bài 13)', () => {
  it('3 N along Ox and 4 N along Oy add to 5 N at 53,13°', () => {
    const R = resultant(forceSet({ ...base, count: 2, F1: 3, a1: 0, F2: 4, a2: 90 * D }));
    expect(R.size).toBeCloseTo(5, 12);
    expect(R.angle / D).toBeCloseTo(Math.atan2(4, 3) / D, 10);
  });

  it('the parallelogram rule: R² = F₁² + F₂² + 2F₁F₂cos α, from 0° to 180°', () => {
    for (const alpha of [0, 30, 60, 90, 120, 150, 180]) {
      const q = forceSet({ ...base, count: 2, F1: 3, a1: 20 * D, F2: 4, a2: (20 + alpha) * D });
      const expected = Math.sqrt(9 + 16 + 24 * Math.cos(alpha * D));
      expect(resultant(q).size).toBeCloseTo(expected, 12);
      expect(resultantByAngles(q)).toBeCloseTo(expected, 12);
    }
  });

  it('components and the angles-only formula agree over a slider sweep (two and three forces)', () => {
    const sets = [...sliderEnds(forceComposition), ...sliderSweep(forceComposition, 300, 13)];
    for (const p of sets) {
      const q = forceSet(p);
      expect(Math.abs(resultant(q).size - resultantByAngles(q))).toBeLessThan(1e-9);
    }
    expect(sets.map((p) => checkMisses(forceComposition, p)).filter((m) => m.length > 0)).toEqual(
      [],
    );
  });

  it('balanced forces: the ring never moves, and the solution says so', () => {
    // 3 N at 0°, 4 N at 90° and 5 N exactly opposite their resultant.
    const back = Math.atan2(4, 3) + Math.PI;
    const p = { ...base, count: 3, F1: 3, a1: 0, F2: 4, a2: 90 * D, F3: 5, a3: back };
    expect(resultant(forceSet(p)).size).toBeLessThan(1e-12);
    const e = new ForcesEngine();
    e.reset(p);
    const s = new Float64Array(e.stateSize);
    while (!e.finished()) {
      e.step();
      e.readState(s);
      expect(Math.hypot(s[FC.x] ?? 0, s[FC.y] ?? 0)).toBeLessThan(1e-12);
    }
    const last = forceComposition.solve(p, 'vi').steps.at(-1)?.text.vi ?? '';
    expect(last).toMatch(/^Hợp lực bằng 0/);
  });

  it('unbalanced forces: the engine follows ½·(R/m)·t², as DOPRI5 does', () => {
    const p = { ...base, m: 2.5 };
    const q = forceSet(p);
    const R = resultant(q);
    const e = new ForcesEngine();
    e.reset(p);
    const s = new Float64Array(e.stateSize);
    while (!e.finished()) e.step();
    e.readState(s);
    const T = e.time();
    expect(T).toBeCloseTo(runLength(q), 2);
    const ref = dopri5(
      (_t, y, dy) => {
        dy[0] = y[2] ?? 0;
        dy[1] = y[3] ?? 0;
        dy[2] = R.x / q.m;
        dy[3] = R.y / q.m;
      },
      [0, 0, 0, 0],
      0,
      T,
      { rtol: 1e-12, atol: 1e-14 },
    );
    expect(s[FC.x]).toBeCloseTo(ref.y[0] ?? 0, 10);
    expect(s[FC.y]).toBeCloseTo(ref.y[1] ?? 0, 10);
    expect(s[FC.vx]).toBeCloseTo(ref.y[2] ?? 0, 10);
    // It moves along the resultant.
    expect(Math.atan2(s[FC.y] ?? 0, s[FC.x] ?? 0)).toBeCloseTo(R.angle, 10);
  });

  it('the balance challenge is solvable at its preset direction (−127°)', () => {
    const p = { ...base, count: 3, a3: -127 * D, F3: 5 };
    expect(resultant(forceSet(p)).size).toBeLessThan(0.025);
  });

  it('no Vietnamese abbreviation in the formulas (an English page shows them too)', () => {
    for (const loc of ['vi', 'en'] as const) {
      const tex = forceComposition
        .solve(base, loc)
        .steps.map((s) => s.tex ?? '')
        .join(' ');
      expect(tex).not.toMatch(/cb\}/);
    }
  });
});
