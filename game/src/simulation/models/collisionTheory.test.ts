import { describe, expect, it } from 'vitest';
import { collisionTheoryModel as model, energeticShare } from './collisionTheory';

// Collision theory worked by hand: at 300 K, e^(−50 000/(8.314462618 × 300)) = 1.9697e−9 of
// collisions carry 50 kJ/mol; with A = 5.1e8 L/(mol·s), k = 1.0045 L/(mol·s).

const INPUTS = {
  temperature: 300,
  activationEnergy: 50,
  concentration: 0.1,
  preExponential: 5.1e8,
  runTime: 60,
};
const R = 8.314462618;

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('collision theory', () => {
  it('gives the energetic share e^(−Ea/RT) and k = A·e^(−Ea/RT)', () => {
    expect(energeticShare(50, 300)).toBeCloseTo(Math.exp(-50000 / (R * 300)), 20);
    expect(energeticShare(50, 300)).toBeCloseTo(1.9697e-9, 12);
    expect(model.predict!(INPUTS).rateConstant).toBeCloseTo(
      5.1e8 * Math.exp(-50000 / (R * 300)),
      9,
    );
  });

  it.each([0.01, 0.7])(
    'falls as [A] = c₀/(1 + k·c₀·t), a second-order reaction (step %s s)',
    (dt) => {
      const k = 5.1e8 * Math.exp(-50000 / (R * 300));
      const end = run(INPUTS, dt);
      expect(end.reactant).toBeCloseTo(0.1 / (1 + k * 0.1 * 60), 12);
      expect((end.reactant ?? 0) + (end.product ?? 0)).toBeCloseTo(0.1, 14);
      expect(end.rate).toBeCloseTo(k * (end.reactant ?? 0) ** 2, 14);
    },
  );

  it('a 10 K rise speeds it by e^(Ea/R·(1/T₁ − 1/T₂)), about 1.9 times for 50 kJ/mol', () => {
    const rate = (t: number) => model.predict!({ ...INPUTS, temperature: t }).initialRate ?? NaN;
    const ratio = rate(310) / rate(300);
    expect(ratio).toBeCloseTo(Math.exp((50000 / R) * (1 / 300 - 1 / 310)), 12);
    expect(ratio).toBeCloseTo(1.91, 2);
  });

  it('doubling the concentration quadruples the initial rate and halves the half-life', () => {
    const p1 = model.predict!(INPUTS);
    const p2 = model.predict!({ ...INPUTS, concentration: 0.2 });
    expect((p2.initialRate ?? 0) / (p1.initialRate ?? 1)).toBeCloseTo(4, 12);
    expect((p2.halfLife ?? 0) / (p1.halfLife ?? 1)).toBeCloseTo(0.5, 12);
  });
});
