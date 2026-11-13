import { describe, expect, it } from 'vitest';
import { balance, balancingModel as model, imbalance, REACTIONS } from './balancing';

// The library's equations as any textbook balances them, and conservation of mass.
const KNOWN = [
  [1, 2, 1, 2], // CH₄ + 2O₂ → CO₂ + 2H₂O
  [2, 1, 2], // 2H₂ + O₂ → 2H₂O
  [1, 3, 2], // N₂ + 3H₂ → 2NH₃
  [1, 5, 3, 4], // C₃H₈ + 5O₂ → 3CO₂ + 4H₂O
  [2, 3, 2], // 2Al + 3Cl₂ → 2AlCl₃
  [1, 3, 2, 3], // Fe₂O₃ + 3CO → 2Fe + 3CO₂
  [2, 2, 3], // 2KClO₃ → 2KCl + 3O₂
  [1, 3, 2, 3], // C₂H₅OH + 3O₂ → 2CO₂ + 3H₂O
];

describe('balancing equations', () => {
  it('finds the smallest whole-number coefficients of every reaction in the library', () => {
    REACTIONS.forEach((r, i) => {
      expect(balance(r), `reaction ${i}`).toEqual(KNOWN[i]);
      expect(imbalance(r, KNOWN[i] ?? [])).toBe(0);
    });
  });

  it('conserves mass: 16 g of methane burn with 64 g of oxygen to 44 g CO₂ + 36 g water', () => {
    const p = model.predict!({ reaction: 0, mass: 16.043, stepTime: 0.5 });
    expect(p.reactantMass).toBeCloseTo(p.productMass ?? NaN, 9);
    expect(p.reactantMass).toBeCloseTo(16.043 + 2 * 31.998, 6);
  });

  it('balances by inspection over the run until no atom is left over', () => {
    const inputs = { reaction: 3, mass: 44.097, stepTime: 0.5 };
    const state = new Float64Array(model.variables.length);
    model.init(inputs, state);
    const start = state[2] ?? 0;
    expect(start).toBeGreaterThan(0);
    for (let i = 0; i < 10000 && !model.isComplete?.(state, inputs); i++)
      model.step(state, 0.05, inputs);
    expect(state[2]).toBe(0);
    expect([state[3], state[4], state[5], state[6]]).toEqual([1, 5, 3, 4]);
    expect(state[7]).toBeCloseTo(state[8] ?? NaN, 9);
  });
});
