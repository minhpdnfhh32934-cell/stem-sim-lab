import { describe, expect, it } from 'vitest';
import { EngineRunner } from '@/core/sim/runner';
import { CP, CapacitorEngine } from './engine';
import {
  BANK_DEFAULTS,
  MODE,
  bankCharge,
  bankEnergy,
  bankInput,
  equivalent,
  integratedEnergy,
  overRated,
  parts,
  solvedCharge,
} from './model';
import { capacitor } from './scenes';

const uF = 1e-6;

describe('capacitors (VL11 Bài 21)', () => {
  it('the worked example of tr. 86–87: 2, 3, 4 µF → 12/13 µF in series, 9 µF in parallel', () => {
    const series = bankInput({ ...BANK_DEFAULTS });
    expect(equivalent(series) / uF).toBeCloseTo(12 / 13, 12);
    const parallel = bankInput({ ...BANK_DEFAULTS, mode: MODE.parallel });
    expect(equivalent(parallel) / uF).toBeCloseTo(9, 12);
  });

  it('question 1 of tr. 85: 2 µF at 36 V holds 72 µC; at its 200 V rating, 400 µC', () => {
    const one = bankInput({ mode: MODE.single, C1: 2 * uF, U: 36 });
    expect(bankCharge(one) / uF).toBeCloseTo(72, 9);
    expect(bankCharge(bankInput({ mode: MODE.single, C1: 2 * uF, U: 200 })) / uF).toBeCloseTo(
      400,
      9,
    );
  });

  it('the question of tr. 88: energy at the rating, 2 µF – 450 V and 2,5 µF – 350 V', () => {
    expect(bankEnergy(bankInput({ mode: MODE.single, C1: 2 * uF, U: 450 }))).toBeCloseTo(
      0.2025,
      12,
    );
    expect(bankEnergy(bankInput({ mode: MODE.single, C1: 2.5 * uF, U: 350 }))).toBeCloseTo(
      0.153125,
      12,
    );
  });

  it('series: same charge, voltages add up to U; parallel: same voltage, charges add up', () => {
    const s = bankInput({ ...BANK_DEFAULTS, U: 26 });
    const ps = parts(s);
    for (const part of ps) expect(part.Q).toBeCloseTo(bankCharge(s), 18);
    expect(ps.reduce((sum, part) => sum + part.U, 0)).toBeCloseTo(26, 10);
    const p = bankInput({ ...BANK_DEFAULTS, mode: MODE.parallel, U: 26 });
    const pp = parts(p);
    for (const part of pp) expect(part.U).toBe(26);
    expect(pp.reduce((sum, part) => sum + part.Q, 0)).toBeCloseTo(bankCharge(p), 18);
    // W = Σ Wᵢ in both.
    for (const b of [s, p])
      expect(parts(b).reduce((sum, x) => sum + x.W, 0)).toBeCloseTo(bankEnergy(b), 15);
  });

  it('independent checks: bisection charge and the DOPRI5 area under U(q)', () => {
    for (const mode of [MODE.single, MODE.series, MODE.parallel])
      for (const count of [2, 3]) {
        const b = bankInput({ ...BANK_DEFAULTS, mode, count, U: 123 });
        expect(Math.abs(solvedCharge(b) / bankCharge(b) - 1)).toBeLessThan(1e-12);
        expect(Math.abs(integratedEnergy(b) / bankEnergy(b) - 1)).toBeLessThan(1e-10);
      }
  });

  it('a capacitor above its rating is reported', () => {
    expect(
      overRated(
        bankInput({ mode: MODE.series, count: 2, C1: 1 * uF, C2: 10 * uF, U: 300, Umax: 200 }),
      ),
    ).toEqual([1]);
    expect(overRated(bankInput({ ...BANK_DEFAULTS }))).toEqual([]);
    const notes =
      capacitor.solve({ mode: MODE.single, C1: 2 * uF, U: 250, Umax: 200 }, 'vi').notes ?? [];
    expect(notes.some((n) => n.vi.includes('đánh thủng'))).toBe(true);
  });

  it('the engine charges steadily: U = q/C and W = q²/2C at every step', () => {
    const p = { ...BANK_DEFAULTS };
    const b = bankInput(p);
    const C = equivalent(b);
    const e = new CapacitorEngine();
    e.reset(p);
    const r = new EngineRunner(e, 1000);
    const out = new Float64Array(e.stateSize);
    for (let i = 0; i < 320; i++) {
      const f = r.frame(1 / 60, 1);
      if ('code' in f) throw new Error(f.code);
      e.readState(out);
      const q = out[CP.q] ?? 0;
      expect(out[CP.U]).toBeCloseTo(q / C, 9);
      expect(out[CP.W]).toBeCloseTo((q * q) / (2 * C), 15);
      expect((out[CP.U1] ?? 0) + (out[CP.U2] ?? 0) + (out[CP.U3] ?? 0)).toBeCloseTo(
        out[CP.U] ?? 0,
        9,
      );
    }
    expect(out[CP.q]).toBeCloseTo(bankCharge(b), 15);
    expect(e.finished()).toBe(true);
  });
});
