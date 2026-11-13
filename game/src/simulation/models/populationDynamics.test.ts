import { describe, expect, it } from 'vitest';
import {
  conserved,
  halfCapacityDay,
  logistic,
  logisticGrowthModel,
  predatorPreyModel,
} from './populationDynamics';

function run(model: typeof logisticGrowthModel, inputs: Record<string, number>, dt = 0.02) {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  const seen: number[][] = [[...state]];
  for (let i = 0; i < 200000 && !model.isComplete?.(state, inputs); i++) {
    model.step(state, dt, inputs);
    seen.push([...state]);
  }
  return { state, seen };
}

describe('logistic growth', () => {
  it('solves dN/dt = rN(1 − N/K): the formula agrees with a fine numerical integration', () => {
    const r = 0.8;
    const k = 300;
    let n = 5;
    const h = 1e-4;
    for (let t = 0; t < 10 - 1e-9; t += h) {
      const f = (m: number) => r * m * (1 - m / k);
      const k1 = f(n);
      const k2 = f(n + (h / 2) * k1);
      const k3 = f(n + (h / 2) * k2);
      const k4 = f(n + h * k3);
      n += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    expect(logistic(r, k, 5, 10)).toBeCloseTo(n, 8);
  });

  it('reaches K/2 on day ln((K − N₀)/N₀)/r, growing fastest there at rK/4', () => {
    const inputs = { rate: 0.8, capacity: 300, start: 5, days: 20, daysPerSecond: 2 };
    expect(logistic(0.8, 300, 5, halfCapacityDay(0.8, 300, 5))).toBeCloseTo(150, 9);
    const { state, seen } = run(logisticGrowthModel, inputs);
    const p = logisticGrowthModel.predict!(inputs);
    expect(state[4]).toBeCloseTo(p.halfDay ?? NaN, 12);
    expect(Math.max(...seen.map((s) => s[3] ?? 0))).toBeCloseTo(p.peakGrowth ?? NaN, 1);
    expect(state[2]).toBeCloseTo(p.population ?? NaN, 9);
  });

  it('stopped before K/2, it grew fastest on its last day, not its first', () => {
    // r 0.2, K 500, N₀ 5: K/2 comes on day ln(99)/0.2 ≈ 23, after the 20 days run.
    const inputs = { rate: 0.2, capacity: 500, start: 5, days: 20, daysPerSecond: 2 };
    const { seen } = run(logisticGrowthModel, inputs);
    const p = logisticGrowthModel.predict!(inputs);
    expect(p.halfDay).toBe(0);
    const n = logistic(0.2, 500, 5, 20);
    expect(p.peakGrowth).toBeCloseTo(0.2 * n * (1 - n / 500), 9);
    expect(Math.max(...seen.map((s) => s[3] ?? 0))).toBeCloseTo(p.peakGrowth ?? NaN, 1);
  });
});

describe('predator and prey', () => {
  const inputs = {
    prey: 60,
    predators: 30,
    preyBirth: 1,
    predatorDeath: 1,
    predation: 0.02,
    conversion: 0.01,
    days: 30,
    daysPerSecond: 2,
  };

  it('keeps Lotka–Volterra’s conserved quantity along the cycles', () => {
    const { seen } = run(predatorPreyModel, inputs);
    const v0 = conserved(60, 30, inputs);
    for (const s of seen) expect(conserved(s[2] ?? NaN, s[3] ?? NaN, inputs)).toBeCloseTo(v0, 6);
  });

  it('rests at the equilibrium x* = γ/δ, y* = α/β', () => {
    const p = predatorPreyModel.predict!(inputs);
    expect([p.preyEquilibrium, p.predatorEquilibrium]).toEqual([100, 50]);
    const { state } = run(predatorPreyModel, { ...inputs, prey: 100, predators: 50 });
    expect(state[2]).toBeCloseTo(100, 9);
    expect(state[3]).toBeCloseTo(50, 9);
  });

  it('cycles with the predators’ peak after the prey’s', () => {
    const { seen } = run(predatorPreyModel, inputs);
    const firstPeak = (k: number) =>
      seen.findIndex(
        (s, i) =>
          i > 0 &&
          (s[k] ?? 0) >= (seen[i - 1]?.[k] ?? 0) &&
          (s[k] ?? 0) > (seen[i + 1]?.[k] ?? Infinity),
      );
    expect(firstPeak(3)).toBeGreaterThan(firstPeak(2));
  });
});
