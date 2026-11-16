import { describe, expect, it } from 'vitest';
import { C } from '@/core/constants';
import { toSI } from '@/core/units';
import { EngineRunner } from '@/core/sim/runner';
import { CurrentEngine, WR } from './engine';
import {
  WIRE_DEFAULTS,
  area,
  chargeIn,
  driftSpeed,
  electronsIn,
  integratedCharge,
  wireInput,
} from './model';
import { electricCurrent } from './scenes';

describe('electric current in a metal wire (VL11 Bài 22)', () => {
  it('the exercise of tr. 93: d = 2 mm, I = 5 A, n = 8,45·10²⁸/m³ → v ≈ 1,2·10⁻⁴ m/s', () => {
    const w = wireInput({ ...WIRE_DEFAULTS });
    expect(area(w)).toBeCloseTo(Math.PI * 1e-6, 18);
    expect(driftSpeed(w)).toBeCloseTo(1.2e-4, 5);
    expect(driftSpeed(w)).toBeCloseTo(5 / (8.45e28 * Math.PI * 1e-6 * C.e), 15);
  });

  it('Δq = IΔt; 1 C is 1 A for 1 s; the question of tr. 92: 10 000 mA·h is 36 000 C', () => {
    const w = wireInput({ I: 1 });
    expect(chargeIn(w, 1)).toBe(1);
    expect(electronsIn(w, 1)).toBeCloseTo(1 / C.e, -3);
    expect(toSI(10000, 'mAh')).toBeCloseTo(36000, 9);
  });

  it('the DOPRI5 check of Δq agrees; the solution lists S, v, Δq, N', () => {
    const w = wireInput({ ...WIRE_DEFAULTS, dt: 7.3 });
    expect(Math.abs(integratedCharge(w) / chargeIn(w, 7.3) - 1)).toBeLessThan(1e-12);
    const answers = electricCurrent.solve({ ...WIRE_DEFAULTS }, 'vi').answers;
    expect(answers.map((a) => a.id)).toEqual(['S', 'v', 'dq', 'N']);
    for (const a of answers)
      if (a.check !== undefined) expect(Math.abs(a.check / a.value - 1), a.id).toBeLessThan(1e-8);
  });

  it('the engine: electrons drift at v, the charge grows as I·t; endless', () => {
    const w = wireInput({ ...WIRE_DEFAULTS });
    const e = new CurrentEngine();
    e.reset({ ...WIRE_DEFAULTS });
    const r = new EngineRunner(e, 1000);
    const out = new Float64Array(e.stateSize);
    for (let i = 0; i < 300; i++) {
      const f = r.frame(1 / 60, 0.1);
      if ('code' in f) throw new Error(f.code);
      e.readState(out);
      const t = e.time();
      expect(out[WR.s]).toBeCloseTo(driftSpeed(w) * t, 15);
      expect(out[WR.q]).toBeCloseTo(5 * t, 12);
    }
    expect(e.finished()).toBe(false);
  });

  it('a thicker wire, same current: the drift is slower (S grows as d²)', () => {
    const thin = driftSpeed(wireInput({ ...WIRE_DEFAULTS }));
    const thick = driftSpeed(wireInput({ ...WIRE_DEFAULTS, d: 4e-3 }));
    expect(thick / thin).toBeCloseTo(0.25, 12);
  });
});
