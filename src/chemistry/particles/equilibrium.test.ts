import { describe, expect, it } from 'vitest';
import {
  SYSTEMS,
  equilibriumConstant,
  integrate,
  quotient,
  shiftDirection,
  speciesOf,
  type EquilibriumSystem,
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

describe('equilibrium integration stays fast and exact at high temperature', () => {
  const DEFAULT: Kinetics = { kf0: 1, kr0: 0.25, eaf: 50e3, ear: 70e3, T0: 298.15 };
  const ms = (fn: () => void) => {
    const t0 = performance.now();
    fn();
    return performance.now() - t0;
  };

  it('closed form matches DOPRI5 for every built-in system (non-stiff)', () => {
    for (const s of SYSTEMS) {
      const c0 = Object.fromEntries(
        speciesOf(s).map((sp, i) => [
          sp,
          s.reactants.some((r) => r.species === sp) ? 1 + i * 0.2 : 0.1,
        ]),
      );
      const exact = integrate(s, kin, 320, c0, 0, 4, 0.5);
      const num = integrate(s, kin, 320, c0, 0, 4, 0.5, { numeric: true });
      expect(exact.method).toBe('exact');
      expect(num.method).toBe('numeric');
      exact.c.forEach((c, i) => {
        for (const sp of speciesOf(s)) expect(c[sp]).toBeCloseTo(num.c[i]![sp]!, 8);
      });
    }
  });

  it('closed form is right when the reaction runs backward and with a double root', () => {
    const s = sys('a+b-c');
    // Start with only product: runs backward.
    const back = integrate(s, kin, 298.15, { A: 0, B: 0, C: 1 }, 0, 3, 0.5);
    const backNum = integrate(s, kin, 298.15, { A: 0, B: 0, C: 1 }, 0, 3, 0.5, { numeric: true });
    back.c.forEach((c, i) => {
      expect(c.C).toBeCloseTo(backNum.c[i]!.C!, 8);
    });
    // k_r → 0 with [A] = [B]: second-order decay A = A0/(1 + k_f A0 t).
    const irr: Kinetics = { kf0: 2, kr0: 0, eaf: 0, ear: 0, T0: 298.15 };
    const r = integrate(s, irr, 298.15, { A: 1, B: 1, C: 0 }, 0, 5, 1);
    r.t.forEach((t, i) => {
      expect(r.c[i]!.A).toBeCloseTo(1 / (1 + 2 * t), 10);
    });
  });

  it('a 0.14 s step at 800 K with the default kinetics takes milliseconds (was ~500 ms)', () => {
    const s = sys('a+b-c');
    let c: Record<string, number> = { A: 1, B: 1, C: 0 };
    const t = ms(() => {
      for (let i = 0; i < 20; i++) c = integrate(s, DEFAULT, 800, c, 0, 0.14, 0.14).final;
    });
    expect(t / 20).toBeLessThan(5);
    // Q = K at the (very fast) equilibrium.
    expect(quotient(s, c) / equilibriumConstant(DEFAULT, 800)).toBeCloseTo(1, 6);
  });

  it('huge rate constants never throw and still reach Q = K', () => {
    const fast: Kinetics = { kf0: 1e6, kr0: 1e6, eaf: 300e3, ear: 250e3, T0: 298.15 };
    for (const s of SYSTEMS) {
      const c0 = Object.fromEntries(
        speciesOf(s).map((sp) => [sp, s.reactants.some((r) => r.species === sp) ? 1 : 0.2]),
      );
      const r = integrate(s, fast, 800, c0, 0, 0.14, 0.14);
      for (const sp of speciesOf(s)) expect(Number.isFinite(r.final[sp])).toBe(true);
      expect(quotient(s, r.final) / equilibriumConstant(fast, 800)).toBeCloseTo(1, 3);
    }
  });

  it('a stiff system without a closed form switches to TR-BDF2 and honours the time budget', () => {
    // 2A + B ⇌ C has order 3: no closed form, numerical path.
    const s: EquilibriumSystem = {
      id: '2a+b-c',
      reactants: [
        { species: 'A', nu: 2 },
        { species: 'B', nu: 1 },
      ],
      products: [{ species: 'C', nu: 1 }],
    };
    const fast: Kinetics = { kf0: 1e5, kr0: 1e4, eaf: 0, ear: 0, T0: 298.15 };
    let r = integrate(s, fast, 298.15, { A: 1, B: 1, C: 0 }, 0, 1, 1);
    expect(r.method).toBe('numeric');
    expect(r.t.at(-1)).toBe(1);
    expect(quotient(s, r.final) / equilibriumConstant(fast, 298.15)).toBeCloseTo(1, 4);
    // An expired budget stops early instead of freezing.
    r = integrate(s, fast, 298.15, { A: 1, B: 1, C: 0 }, 0, 1, 1, {
      deadline: performance.now() - 1,
    });
    expect(r.t.at(-1)!).toBeLessThan(1);
  });
});
