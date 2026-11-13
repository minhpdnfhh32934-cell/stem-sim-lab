import { describe, expect, it } from 'vitest';
import { dissociated, kp, no2EquilibriumModel as model } from './no2Equilibrium';

// N₂O₄ ⇌ 2NO₂ against the standard tables and Le Chatelier's principle, worked by hand:
// Kp(298.15 K) = exp(−4730 / (8.314462618 × 298.15)) = 0.148 37…; the equilibrium x solves
// 4RT·x² = Kp·p°·V·(n₀ − x).

const INPUTS = {
  amount: 0.001,
  startVolume: 40,
  endVolume: 40,
  startTemperature: 25,
  endTemperature: 25,
  timeConstant: 2,
  runTime: 30,
};

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

const R = 8.314462618;

describe('NO₂ ⇌ N₂O₄ equilibrium', () => {
  it('takes Kp from ΔrG° and ΔrH° of the tables (van ’t Hoff)', () => {
    expect(kp(298.15)).toBeCloseTo(Math.exp(-4730 / (R * 298.15)), 12);
    expect(kp(298.15)).toBeCloseTo(0.14837, 4);
    // Endothermic dissociation: K grows with T by exp(−ΔH/R·(1/T − 1/T₀)).
    expect(kp(353.15) / kp(298.15)).toBeCloseTo(
      Math.exp((-57200 / R) * (1 / 353.15 - 1 / 298.15)),
      9,
    );
  });

  it('solves the quadratic: the root satisfies Kp exactly, Q/Kp = 1', () => {
    const n0 = 0.001;
    const V = 40e-6;
    const T = 298.15;
    const x = dissociated(n0, V, T);
    const p = (n: number) => (n * R * T) / V;
    expect(p(2 * x) ** 2 / (p(n0 - x) * 1e5) / kp(T)).toBeCloseTo(1, 10);
    const end = run(INPUTS, 0.05);
    expect(end.quotient).toBeCloseTo(1, 10);
  });

  it('warmed, shifts towards NO₂ (browner); cooled, towards N₂O₄ (paler) — Le Chatelier', () => {
    const at = (t: number) => model.predict!({ ...INPUTS, endTemperature: t });
    expect(at(80).dissociation ?? 0).toBeGreaterThan(at(25).dissociation ?? 0);
    expect(at(0).dissociation ?? 0).toBeLessThan(at(25).dissociation ?? 0);
    expect(at(80).no2Concentration ?? 0).toBeGreaterThan(at(25).no2Concentration ?? 0);
  });

  it('squeezed: darker at once, then the mixture shifts to N₂O₄ and pales somewhat', () => {
    const squeeze = { ...INPUTS, endVolume: 20 };
    const state = new Float64Array(model.variables.length);
    model.init(squeeze, state);
    const before = state[5] ?? NaN; // [NO₂] at 40 mL
    model.step(state, 1e-6, squeeze);
    const instant = state[5] ?? NaN;
    expect(instant / before).toBeCloseTo(2, 4); // the same NO₂ in half the volume
    const end = run(squeeze, 0.05);
    expect(end.no2Concentration).toBeLessThan(instant);
    expect(end.no2Concentration).toBeGreaterThan(before);
    expect(end.dissociation).toBeLessThan(model.predict!(INPUTS).dissociation ?? 0);
  });

  it.each([0.01, 0.13])('relaxes as x_eq + (x₀ − x_eq)·e^(−t/τ) (step %s s)', (dt) => {
    const hot = { ...INPUTS, endTemperature: 80, runTime: 4 };
    const x0 = dissociated(0.001, 40e-6, 298.15);
    const xe = dissociated(0.001, 40e-6, 353.15);
    const x = xe + (x0 - xe) * Math.exp(-2);
    expect(run(hot, dt).no2).toBeCloseTo(2 * x * 1000, 9);
  });

  it('keeps the nitrogen: n(NO₂) + 2·n(N₂O₄) = 2·n₀ at every state', () => {
    const end = run({ ...INPUTS, endTemperature: 60, endVolume: 80 }, 0.05);
    expect((end.no2 ?? 0) + 2 * (end.n2o4 ?? 0)).toBeCloseTo(2, 12);
  });
});
