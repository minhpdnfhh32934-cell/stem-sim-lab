import { describe, expect, it } from 'vitest';
import { EngineRunner } from '@/core/sim/runner';
import { LATTICE_CHECK_TOL, latticeWavelength, particlePeriod } from './check';
import { lastBehind, shiftScale, verticalScale, viewLength } from './draw';
import { TW, TravelEngine } from './engine';
import {
  KIND,
  TRAVEL_DEFAULTS,
  arrival,
  displacement,
  front,
  period,
  phaseLag,
  travelInput,
  wavelength,
} from './model';
import { travellingWave } from './scenes';

const base = { ...TRAVEL_DEFAULTS };

function run(p: Record<string, number>, frames: number) {
  const e = new TravelEngine();
  e.reset(p);
  const r = new EngineRunner(e, 1000);
  const out = new Float64Array(e.stateSize);
  const samples: { t: number; s: Float64Array }[] = [];
  for (let i = 0; i < frames; i++) {
    const f = r.frame(1 / 60, 0.1);
    if ('code' in f) throw new Error(f.code);
    e.readState(out);
    samples.push({ t: e.time(), s: Float64Array.from(out) });
  }
  return samples;
}

describe('travelling wave (VL11 Bài 8–9)', () => {
  it('the state is the closed form at every step; M is still until the wave arrives', () => {
    const q = travelInput(base);
    const tM = arrival(q, q.xM);
    for (const { t, s } of run(base, 600)) {
      expect(s[TW.uO]).toBeCloseTo(0.12 * Math.sin(2 * Math.PI * 0.6 * t), 12);
      expect(s[TW.front]).toBeCloseTo(2 * t, 12);
      expect(s[TW.uM]).toBeCloseTo(displacement(q, q.xM, t), 12);
      if (t < tM) expect(s[TW.uM]).toBe(0);
    }
  });

  it('M repeats the motion of O exactly x/v later, never larger than A', () => {
    const q = travelInput(base);
    for (const t of [5.1, 6.3, 7.77, 12.4]) {
      expect(displacement(q, q.xM, t)).toBeCloseTo(displacement(q, 0, t - q.xM / q.v), 12);
      expect(Math.abs(displacement(q, q.xM, t))).toBeLessThanOrEqual(q.A);
    }
  });

  it('the textbook’s Hình 8.2: at T/4 the wave has gone λ/4, M at λ/4 lags by π/2; at T, λ', () => {
    const q = travelInput(base);
    const T = period(q);
    const lam = wavelength(q);
    expect(front(q, T / 4)).toBeCloseTo(lam / 4, 12);
    expect(phaseLag(q, lam / 4)).toBeCloseTo(Math.PI / 2, 12);
    expect(front(q, T)).toBeCloseTo(lam, 12);
    // O at its crest when the wave reaches λ/4; the part at λ/4 just starting to move.
    expect(displacement(q, 0, T / 4)).toBeCloseTo(q.A, 12);
    expect(displacement(q, lam / 4, T / 4)).toBeCloseTo(0, 12);
  });

  it('the textbook’s questions: the boat (tr. 35) and the shortest audible wave (tr. 39)', () => {
    // 24 oscillations in 40 s, crest 10 m away after 5 s.
    const boat = travelInput({ f: 24 / 40, v: 10 / 5 });
    expect(period(boat)).toBeCloseTo(40 / 24, 12);
    expect(wavelength(boat)).toBeCloseTo(10 / 3, 12);
    // A student hears up to 16 000 Hz; sound travels at 330 m/s.
    expect(wavelength(travelInput({ f: 16000, v: 330 }))).toBeCloseTo(0.020625, 12);
  });

  it('DOPRI5 checks: the period of M and the wavelength on a lattice', () => {
    for (const p of [base, { ...base, f: 3.7, v: 0.4 }, { ...base, f: 0.1, v: 20 }]) {
      const q = travelInput(p);
      expect(Math.abs(particlePeriod(q) / period(q) - 1)).toBeLessThan(1e-9);
      const gap = Math.abs(latticeWavelength(q) / wavelength(q) - 1);
      expect(gap).toBeLessThan(LATTICE_CHECK_TOL);
      // The lattice error is real but small: it would hide a wrong λ by a few per mille.
      expect(gap).toBeGreaterThan(0);
    }
  });

  it('every answer of the solution agrees with its check', () => {
    const answers = travellingWave.solve(base, 'vi').answers;
    expect(answers.map((a) => a.id)).toEqual(['T', 'lambda', 'tM', 'lag']);
    for (const a of answers)
      if (a.check !== undefined)
        expect(Math.abs(a.check / a.value - 1), a.id).toBeLessThan(a.checkTol ?? 1e-8);
    expect(answers.find((a) => a.id === 'tM')?.value).toBeCloseTo(5, 12);
  });

  it('drawing: crests stretched only when small, longitudinal layers never cross', () => {
    expect(verticalScale(travelInput(base))).toBeGreaterThanOrEqual(1);
    expect(verticalScale(travelInput({ ...base, A: 0.002 }))).toBeGreaterThan(1);
    for (const A of [0.001, 0.05, 0.12, 0.3, 0.5]) {
      const q = travelInput({ ...base, kind: KIND.longitudinal, A });
      const kA = (2 * Math.PI * A) / wavelength(q);
      if (kA < 0.6) expect(shiftScale(q) * kA).toBeLessThanOrEqual(0.6 + 1e-12);
      expect(shiftScale(q)).toBeGreaterThanOrEqual(1);
    }
    // The textbook's boat as a longitudinal wave: layer shifts drawn twice as large.
    expect(shiftScale(travelInput({ ...base, kind: KIND.longitudinal }))).toBe(2);
    // Crest marks stay on screen once the front has left it, a whole number of λ back.
    expect(lastBehind(2, 1, 0.25, 12)).toBeCloseTo(1.75, 12);
    const late = lastBehind(55.3, 2, 0.5, 12);
    expect(late).toBeLessThanOrEqual(12);
    expect(late).toBeGreaterThan(10);
    expect(((55.3 - 0.5 - late) / 2) % 1).toBeCloseTo(0, 9);
    // Long M distances keep at most 12 wavelengths on screen.
    const far = travelInput({ ...base, f: 20, v: 0.5, xM: 20 });
    expect(viewLength(far) / wavelength(far)).toBeLessThanOrEqual(12 + 1e-9);
  });

  it('validate: positive inputs; a longitudinal wave needs 2πA/λ < 1', () => {
    expect(travellingWave.validate?.(base)).toEqual([]);
    expect(travellingWave.validate?.({ ...base, v: 0 })).toHaveLength(1);
    expect(
      travellingWave.validate?.({ ...base, kind: KIND.longitudinal, A: 0.5, f: 2, v: 2 }),
    ).toHaveLength(1);
    expect(
      travellingWave.validate?.({ ...base, kind: KIND.transverse, A: 0.5, f: 2, v: 2 }),
    ).toEqual([]);
  });

  it('endless: no end of its own, a caller may still set one; Δt ≤ T/200', () => {
    const e = new TravelEngine();
    e.reset({ ...base, f: 20 });
    expect(e.dt).toBeLessThanOrEqual(1 / 20 / 200);
    for (let i = 0; i < 5000; i++) e.step();
    expect(e.finished()).toBe(false);
    e.reset({ ...base, tEnd: 1 });
    for (let i = 0; i < 300; i++) e.step();
    expect(e.finished()).toBe(true);
  });
});
