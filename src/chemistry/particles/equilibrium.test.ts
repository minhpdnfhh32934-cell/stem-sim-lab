import { describe, expect, it } from 'vitest';
import {
  SYSTEMS,
  equilibriumConstant,
  integrate,
  quotient,
  shiftDirection,
  type Kinetics,
} from './equilibrium';

const sys = (id: string) => SYSTEMS.find((s) => s.id === id)!;
const kin: Kinetics = { kf0: 2, kr0: 0.5, eaf: 50e3, ear: 70e3, T0: 298.15 };

describe('chemical equilibrium (mass-action ODE)', () => {
  it('A ⇌ B follows the analytic solution', () => {
    const r = integrate(sys('a-b'), kin, 298.15, { A: 1, B: 0 }, 0, 3, 0.5);
    const kf = 2;
    const kr = 0.5;
    r.t.forEach((t, i) => {
      const aEq = kr / (kf + kr);
      const a = aEq + (1 - aEq) * Math.exp(-(kf + kr) * t);
      expect(r.c[i]!.A).toBeCloseTo(a, 8);
    });
  });

  it('A + B ⇌ C reaches Q = K and matches the quadratic solution', () => {
    const K = equilibriumConstant(kin, 298.15); // 4
    const r = integrate(sys('a+b-c'), kin, 298.15, { A: 1, B: 0.5, C: 0 }, 0, 60, 60);
    // x = [C]eq: x / ((1 − x)(0.5 − x)) = K
    const a = K;
    const b = -(K * 1.5 + 1);
    const c = K * 0.5;
    const x = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    expect(r.final.C).toBeCloseTo(x, 7);
    expect(quotient(sys('a+b-c'), r.final)).toBeCloseTo(K, 5);
  });

  it('Le Chatelier: adding reactant shifts forward; heating an exothermic reaction lowers K', () => {
    const s = sys('a+b-c');
    const eq = integrate(s, kin, 298.15, { A: 1, B: 0.5, C: 0 }, 0, 60, 60).final;
    const K = equilibriumConstant(kin, 298.15);
    const disturbed = { ...eq, A: (eq.A ?? 0) + 0.5 };
    expect(shiftDirection(quotient(s, disturbed), K)).toBe('forward');
    const after = integrate(s, kin, 298.15, disturbed, 0, 60, 60).final;
    expect(after.C!).toBeGreaterThan(eq.C!);
    // ΔH = Eaf − Ear = −20 kJ/mol (exothermic): K decreases with temperature.
    expect(equilibriumConstant(kin, 350)).toBeLessThan(K);
    // van 't Hoff: ln(K2/K1) = −ΔH/R (1/T2 − 1/T1)
    const dH = kin.eaf - kin.ear;
    const lhs = Math.log(equilibriumConstant(kin, 350) / K);
    const rhs = (-dH / 8.314462618) * (1 / 350 - 1 / 298.15);
    expect(lhs).toBeCloseTo(rhs, 6);
    expect(shiftDirection(quotient(s, eq), K)).toBe('none');
  });

  it('2A ⇌ B conserves mass (A + 2B constant)', () => {
    const r = integrate(sys('2a-b'), kin, 298.15, { A: 1, B: 0 }, 0, 10, 1);
    for (const c of r.c) expect((c.A ?? 0) + 2 * (c.B ?? 0)).toBeCloseTo(1, 9);
  });
});
