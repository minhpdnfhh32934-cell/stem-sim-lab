import { describe, expect, it } from 'vitest';
import { C } from '@/core/constants';
import { EngineRunner } from '@/core/sim/runner';
import { MOVE_TIME, PT, PotentialEngine } from './engine';
import {
  CHARGE,
  PATH,
  PLATE_DEFAULTS,
  energy,
  field,
  integratedPotential,
  integratedWork,
  pathLength,
  platesInput,
  pointAt,
  potential,
  work,
} from './model';
import { electricPotential } from './scenes';

const base = { ...PLATE_DEFAULTS };

describe('electric potential energy and potential (VL11 Bài 19–20)', () => {
  it('the worked example of tr. 81: U = 36 V, M in the middle of the gap → V_M = 18 V', () => {
    const q = platesInput(base);
    expect(field(q)).toBeCloseTo(900, 9);
    expect(potential(q, q.M.y)).toBeCloseTo(18, 12);
    expect(potential(q, 0)).toBe(0);
    expect(potential(q, q.d)).toBeCloseTo(36, 12);
  });

  it('the question of tr. 82: 5 m above the ground where the Earth’s field is 114 V/m → 570 V', () => {
    // A uniform field of 114 V/m over 10 m (U = 1140 V), the point 5 m up.
    const q = platesInput({ U: 1140, d: 10, hM: 5 });
    expect(potential(q, 5)).toBeCloseTo(570, 9);
  });

  it('A_MN = qU_MN = W_M − W_N, the same along the straight and the broken path (Hình 19.1)', () => {
    for (const kind of [CHARGE.test, CHARGE.electron, CHARGE.proton]) {
      const straight = platesInput({ ...base, kind, hM: 0.03, hN: 0.005, dx: 0.05 });
      const broken = platesInput({
        ...base,
        kind,
        hM: 0.03,
        hN: 0.005,
        dx: 0.05,
        path: PATH.broken,
      });
      const A = work(straight, straight.M, straight.N);
      expect(Math.abs((energy(straight, 0.03) - energy(straight, 0.005)) / A - 1)).toBeLessThan(
        1e-12,
      );
      expect(Math.abs(integratedWork(straight) / A - 1)).toBeLessThan(1e-10);
      expect(Math.abs(integratedWork(broken) / A - 1)).toBeLessThan(1e-10);
      expect(pathLength(broken)).toBeGreaterThan(pathLength(straight));
    }
  });

  it('the photocell question of tr. 80: an electron from the cathode to the anode at 45 V', () => {
    const q = platesInput({ U: 45, d: 0.01, kind: CHARGE.electron, hM: 0, hN: 0.01, dx: 0 });
    // A = qU_KA = (−e)(0 − 45 V) = 45 eV > 0: the field pulls the electron to the anode.
    expect(work(q, q.M, q.N) / (45 * C.e)).toBeCloseTo(1, 12);
  });

  it('DOPRI5 checks agree; the solution’s answers match them', () => {
    const q = platesInput(base);
    expect(Math.abs(integratedPotential(q, q.M.y) - 18)).toBeLessThan(1e-10);
    const answers = electricPotential.solve(base, 'vi').answers;
    expect(answers.map((a) => a.id)).toEqual(['E', 'VM', 'VN', 'UMN', 'WM', 'A']);
    for (const a of answers)
      if (a.check !== undefined)
        expect(Math.abs(a.check - a.value), a.id).toBeLessThanOrEqual(
          1e-8 * Math.abs(a.value) + 1e-12,
        );
  });

  it('the engine carries the charge from M to N; A and W are exact at every step', () => {
    const p = { ...base, path: PATH.broken, dx: 0.03 };
    const q = platesInput(p);
    const e = new PotentialEngine();
    e.reset(p);
    const r = new EngineRunner(e, 1000);
    const out = new Float64Array(e.stateSize);
    for (let i = 0; i < 400; i++) {
      const f = r.frame(1 / 60, 1);
      if ('code' in f) throw new Error(f.code);
      e.readState(out);
      const at = pointAt(q, out[PT.s] ?? 0);
      expect(out[PT.y]).toBeCloseTo(at.y, 12);
      expect(out[PT.A]).toBe(work(q, q.M, at));
      expect(out[PT.W]).toBe(energy(q, at.y));
    }
    expect(e.time()).toBeGreaterThan(MOVE_TIME);
    expect(out[PT.x]).toBeCloseTo(q.N.x, 12);
    expect(out[PT.A]).toBe(work(q, q.M, q.N));
    expect(e.finished()).toBe(true);
  });

  it('validate: points between the plates', () => {
    expect(electricPotential.validate?.(base)).toEqual([]);
    expect(electricPotential.validate?.({ ...base, hM: 0.05 })).toHaveLength(1);
    expect(electricPotential.validate?.({ ...base, d: 0 })).toHaveLength(1);
  });
});
