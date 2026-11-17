import { describe, expect, it } from 'vitest';
import { BOOK_MASSES, ISOTOPES, PARTICLES, TABLE_21_1, isotope } from './data';
import {
  activity,
  doseAt,
  halfLifeFrom,
  halfLifeSeconds,
  lambdaOf,
  randomDecay,
  remaining,
  timeToLeft,
  toCurie,
} from './decayModel';
import {
  AMU_MEV,
  BOOK_REACTIONS,
  balanced,
  binding,
  fissionEnergy,
  massDefect,
  missing,
  radius,
  symbolOf,
} from './nucleusModel';

const mass = (s: string) => BOOK_MASSES.find((m) => m.symbol === s)?.amu ?? NaN;

describe('nucleus (VL12 Bài 21–22)', () => {
  it('the book’s particles: m_p, m_n in kg and in amu agree; 2m_p + 2m_n = 4,03188 amu', () => {
    expect(PARTICLES.proton_kg / PARTICLES.amu_kg).toBeCloseTo(PARTICLES.proton_amu, 4);
    expect(2 * PARTICLES.proton_amu + 2 * PARTICLES.neutron_amu).toBeCloseTo(4.03188, 12);
  });

  it('R = 1,2·10⁻¹⁵·A^(1/3) m runs 10–30 % above the radii of Bảng 21.1 (kept as printed)', () => {
    expect(radius(16)).toBeCloseTo(1.2e-15 * Math.cbrt(16), 25);
    for (const r of TABLE_21_1) {
      const ratio = radius(r.A) / r.nucleus_radius;
      expect(ratio, r.symbol).toBeGreaterThan(1.1);
      expect(ratio, r.symbol).toBeLessThan(1.35);
    }
  });

  it('He-4 (tr. 99): Δm = 0,02928 amu; O-16 (question, tr. 99): Δm = 0,1326 amu', () => {
    expect(massDefect(2, 4, mass('He'))).toBeCloseTo(0.02928, 12);
    expect(massDefect(8, 16, mass('O'))).toBeCloseTo(0.1326, 12);
    // 1 amu·c² with the book's amu and CODATA c, e.
    expect(AMU_MEV).toBeCloseTo(931.494, 2);
    const he = binding(2, 4, mass('He'));
    expect(he.E).toBeCloseTo(0.02928 * AMU_MEV, 9);
    expect(he.perNucleon).toBeCloseTo(he.E / 4, 12);
    expect(binding(8, 16, mass('O')).perNucleon).toBeGreaterThan(he.perNucleon);
  });

  it('every reaction the book writes conserves A and Z; the question of tr. 97 gives ²³⁶U and ¹³⁴Sn', () => {
    for (const r of BOOK_REACTIONS) expect(balanced(r), r.id).toBe(true);
    const X = missing(
      [
        { A: 1, Z: 0 },
        { A: 235, Z: 92 },
      ],
      [],
    );
    expect(X).toEqual({ A: 236, Z: 92 });
    const Y = missing(
      [X],
      [
        { A: 99, Z: 42 },
        { A: 1, Z: 0, count: 3 },
      ],
    );
    expect(Y).toEqual({ A: 134, Z: 50 });
    expect(symbolOf(Y)).toBe('Sn');
    expect(symbolOf({ A: 1, Z: 0 })).toBe('n');
  });

  it('1 kg of ²³⁵U at 200 MeV each fission (question, tr. 101): about 8,2·10¹³ J', () => {
    const e = fissionEnergy(1);
    expect(e.nuclei).toBeCloseTo((1000 / 235) * 6.02e23, -18);
    expect(e.joules).toBeGreaterThan(8.1e13);
    expect(e.joules).toBeLessThan(8.3e13);
  });
});

describe('radioactivity (VL12 Bài 23)', () => {
  it('Bảng 23.2 as printed; Rn-220 halves every 55 s', () => {
    expect(ISOTOPES.map((i) => [i.id, i.half_life, i.unit])).toEqual([
      ['C14', 5700, 'year'],
      ['I131', 8, 'day'],
      ['O15', 120, 'second'],
      ['Po210', 140, 'day'],
      ['Ra226', 1600, 'year'],
      ['Rn219', 4, 'second'],
      ['U235', 7e8, 'year'],
    ]);
    expect(remaining(110, 55)).toBeCloseTo(0.25, 15);
    expect(halfLifeSeconds(isotope('I131'))).toBe(8 * 86400);
  });

  it('question 2, tr. 108: 75 % of O-15 gone in 244 s → T = 122 s (Bảng 23.2: 1,2·10² s)', () => {
    expect(halfLifeFrom(0.25, 244)).toBeCloseTo(122, 9);
  });

  it('question 2, tr. 109: F-18 (T ≈ 110 min) falls to 10 % and 1 %; 10⁹ Bq in 1 mL', () => {
    const T = 110 * 60;
    expect(timeToLeft(0.1, T) / 60).toBeCloseTo(110 * Math.log2(10), 9);
    expect(timeToLeft(0.01, T) / 60).toBeCloseTo(2 * 110 * Math.log2(10), 9);
    const N0 = 1e9 / lambdaOf(T);
    expect(N0).toBeCloseTo(9.522e12, -9);
    const N1 = N0 * remaining(86400, T);
    expect(N1).toBeGreaterThan(1.08e9);
    expect(N1).toBeLessThan(1.1e9);
    expect(activity(N0, T)).toBeCloseTo(1e9, 0);
    expect(toCurie(3.7e10)).toBe(1);
  });

  it('the random picture is reproducible and follows the law on average', () => {
    expect(randomDecay(100, 10, 1, 20)).toEqual(randomDecay(100, 10, 1, 20));
    const left = randomDecay(10000, 5, 1, 5);
    expect(left[0]).toBe(10000);
    // After one half-life: 5 000 ± 3σ (σ = 50).
    expect(Math.abs((left[5] ?? 0) - 5000)).toBeLessThan(150);
  });

  it('safety (tr. 112): twice as far from a point source, a quarter of the dose', () => {
    expect(doseAt(1, 1, 2)).toBe(0.25);
  });
});
