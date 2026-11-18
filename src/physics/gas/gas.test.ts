import { describe, expect, it } from 'vitest';
import { sgkVl12 } from '../common/sources';
import { gasCard } from './card';
import {
  BOYLE_ROWS,
  CHARLES_ROWS,
  K_B,
  K_PRINTED,
  N_A,
  R,
  STANDARD,
  charlesFromIncrease,
  gas,
  integratedTwoSteps,
  kineticPressure,
  meanKineticEnergy,
  moleculeMass,
  moles,
  numberDensity,
  processPath,
  rmsSpeed,
  solveState,
  spread,
  withinBookRange,
} from './model';
import { loadExample, setGas, statesOf, useGasStore } from './store';

describe('ideal gas (VL12 Bài 8–12)', () => {
  it('the book’s data as printed: Bảng 9.1, 10.1, R from one mole, k = R/N_A', () => {
    expect(BOYLE_ROWS.map((r) => [r.V * 1e6, r.p / 1e5])).toEqual([
      [3, 1],
      [2.5, 1.2],
      [2, 1.5],
      [1.5, 1.9],
    ]);
    // Bảng 10.1 prints T = t + 273.
    for (const r of CHARLES_ROWS) expect(r.T).toBeCloseTo(r.t + 273, 9);
    expect(R).toBe(8.31);
    expect(N_A).toBe(6.02e23);
    // tr. 46: 1,013·10⁵ · 22,4·10⁻³ / 273 ≈ 8,31; tr. 49: k = 8,31 / 6,02·10²³ ≈ 1,38·10⁻²³.
    expect((STANDARD.p * STANDARD.V) / STANDARD.T).toBeCloseTo(R, 2);
    expect(K_B).toBeCloseTo(K_PRINTED, 25);
  });

  it('Bài 9 worked example (tr. 39): 10 L at 10⁵ Pa, then 1,25·10⁵ Pa at constant T → 8 L', () => {
    const s1 = { p: 1e5, V: 10e-3, T: 300 };
    const s2 = solveState('isothermal', 'V', s1, { p: 1.25e5, V: 1, T: 1 });
    expect(s2?.V).toBeCloseTo(8e-3, 15);
    expect(s2?.T).toBe(300);
  });

  it('Bài 9 question 1 (tr. 40): 0,04 m³ at 120 kPa squeezed to 0,025 m³ → 192 kPa', () => {
    const s2 = solveState(
      'isothermal',
      'p',
      { p: 120e3, V: 0.04, T: 290 },
      { p: 1, V: 0.025, T: 1 },
    );
    expect(s2?.p).toBeCloseTo(192e3, 6);
  });

  it('Bài 10 worked example (tr. 43): 32 °C → 117 °C, +1,7 L → 6,1 L and 7,8 L', () => {
    const r = charlesFromIncrease(32, 117, 1.7e-3);
    expect(r).toMatchObject({ T1: 305, T2: 390 });
    expect(r.V1).toBeCloseTo(6.1e-3, 12);
    expect(r.V2).toBeCloseTo(7.8e-3, 12);
  });

  it('Bài 10 question 1 (tr. 44): +10 % up to 47 °C at constant p → it started at about 17,9 °C', () => {
    // State "1" here is the end state (47 °C); asking for T of the other state.
    const s = solveState('isobaric', 'T', { p: 1e5, V: 1.1, T: 320 }, { p: 1, V: 1, T: 1 });
    expect((s?.T ?? 0) - 273).toBeCloseTo(17.909, 3);
  });

  it('Bài 11 worked example (tr. 45–46): the pump ends at 5,2·10⁵ Pa; DOPRI5 over Hình 11.1 agrees', () => {
    const s1 = { p: 1e5, V: 100e-6, T: 300 };
    const s2 = solveState('general', 'p', s1, { p: 1, V: 20e-6, T: 312 });
    expect(s2?.p).toBeCloseTo(5.2e5, 6);
    if (!s2) throw new Error('no state');
    const end = integratedTwoSteps(s1, s2);
    expect(end.p).toBeCloseTo(s2.p, 3);
    expect(end.T).toBeCloseTo(s2.T, 8);
    // The path of Hình 11.1: isothermal to p₂, then isobaric; it ends on state 2.
    const path = processPath('general', s1, s2);
    expect(path.mid).toMatchObject({ p: s2.p, T: 300 });
    expect(path.points.at(-1)).toEqual([s2.V, s2.p]);
    // 5,2·10⁵ Pa is above the 10⁵ Pa where the book says the laws were checked.
    expect(withinBookRange(s1)).toBe(true);
    expect(withinBookRange(s2)).toBe(false);
  });

  it('Bài 11 question 1 (tr. 47): the weather balloon is pumped to a radius of about 0,76 m', () => {
    const high = { p: 0.3e5, V: (4 / 3) * Math.PI, T: 200 };
    const ground = solveState('general', 'V', high, { p: 1.02e5, V: 1, T: 300 });
    expect(Math.cbrt(((ground?.V ?? 0) * 3) / (4 * Math.PI))).toBeCloseTo(0.7613, 4);
  });

  it('one mole at standard conditions is one mole; isochoric p/T stays constant', () => {
    expect(moles({ p: STANDARD.p, V: STANDARD.V, T: STANDARD.T })).toBeCloseTo(1, 2);
    const s = solveState('isochoric', 'p', { p: 2e5, V: 1e-3, T: 300 }, { p: 1, V: 9, T: 450 });
    expect(s).toMatchObject({ V: 1e-3 });
    expect(s?.p).toBeCloseTo(3e5, 6);
    expect(solveState('isothermal', 'T', { p: 1, V: 1, T: 1 }, { p: 1, V: 1, T: 1 })).toBeNull();
    expect(solveState('isobaric', 'V', { p: 1e5, V: 1, T: 300 }, { p: 1, V: 1, T: -5 })).toBeNull();
  });

  it('the book’s measurements: pV and V/T stay within 4 % of their mean', () => {
    const boyle = spread(BOYLE_ROWS.map((r) => r.pV));
    expect(boyle.mean).toBeCloseTo(0.29625, 9);
    expect(boyle.worst).toBeLessThan(0.04);
    expect(spread(CHARLES_ROWS.map((r) => r.VT)).worst).toBeLessThan(0.04);
  });

  it('Bài 12: Ēđ = 3/2 kT, ⅓μm·v̄² gives back p, oxygen at 273 K moves at √(v̄²) ≈ 461 m/s', () => {
    const o2 = gas('oxygen');
    expect(meanKineticEnergy(300)).toBeCloseTo(1.5 * (8.31 / 6.02e23) * 300, 30);
    const v = rmsSpeed(o2, 273);
    expect(v).toBeCloseTo(461.2, 0);
    // The book's "about 400 m/s" (tr. 35) is the mean speed, a little below √(v̄²).
    expect(v).toBeGreaterThan(400);
    for (const [p, T] of [
      [1e5, 273],
      [3e5, 500],
    ] as const) {
      const mu = numberDensity(p, T);
      expect(kineticPressure(mu, moleculeMass(o2), rmsSpeed(o2, T) ** 2)).toBeCloseTo(p, 6);
    }
    // Same temperature, same mean kinetic energy; lighter molecules move faster (question 2, tr. 50).
    expect(rmsSpeed(gas('nitrogen'), 300)).toBeGreaterThan(rmsSpeed(o2, 300));
    expect(rmsSpeed(gas('carbonDioxide'), 300)).toBeLessThan(rmsSpeed(o2, 300));
  });

  it('the store opens on the pump, loads the book’s questions and keeps the unknown allowed', () => {
    expect(statesOf(useGasStore.getState()).s2?.p).toBeCloseTo(5.2e5, 6);
    loadExample('boyle');
    expect(statesOf(useGasStore.getState()).s2?.V).toBeCloseTo(8e-3, 15);
    loadExample('ball');
    expect(statesOf(useGasStore.getState()).s2?.p).toBeCloseTo(192e3, 6);
    setGas({ process: 'isobaric' });
    expect(useGasStore.getState().unknown).toBe('V');
    setGas({ t1: -400, gasId: 'helium' });
    expect(useGasStore.getState()).toMatchObject({ t1: -272, gasId: 'oxygen' });
    setGas({ offset: 'exact' });
    expect(statesOf(useGasStore.getState()).s1.T).toBeCloseTo(1.15, 9);
    loadExample('pump');
    expect(useGasStore.getState().offset).toBe('book');
    expect(gasCard().sources.map((s) => s.id)).toEqual(
      expect.arrayContaining([8, 9, 10, 11, 12].map((n) => sgkVl12(n).id)),
    );
  });
});
