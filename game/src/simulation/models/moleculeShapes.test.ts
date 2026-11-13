import { describe, expect, it } from 'vitest';
import { idealAngle, MOLECULES, moleculeShapesModel as model } from './moleculeShapes';

// VSEPR as the textbook gives it: 2, 3, 4, 6 domains at 180°, 120°, 109.47°, 90°; lone pairs
// squeeze the bonds below the ideal; a symmetric molecule has no dipole, one with lone pairs does.

const at = (formula: string) => MOLECULES.findIndex((m) => m.formula === formula);

describe('molecule shapes', () => {
  it('spreads the domains as far apart as they go', () => {
    expect(idealAngle(2)).toBe(180);
    expect(idealAngle(3)).toBe(120);
    expect(idealAngle(4)).toBeCloseTo(109.4712, 4);
    expect(idealAngle(6)).toBe(90);
  });

  it('counts domains and lone pairs: water 4 and 2, ammonia 4 and 1, methane 4 and 0', () => {
    const p = (f: string) => model.predict!({ molecule: at(f), settleTime: 3 });
    expect([p('H₂O').domains, p('H₂O').lonePairs]).toEqual([4, 2]);
    expect([p('NH₃').domains, p('NH₃').lonePairs]).toEqual([4, 1]);
    expect([p('CH₄').domains, p('CH₄').lonePairs]).toEqual([4, 0]);
    expect([p('CO₂').domains, p('SO₂').domains]).toEqual([2, 3]);
  });

  it('lone pairs squeeze the bonds: CH₄ > NH₃ > H₂O', () => {
    const angle = (f: string) => MOLECULES[at(f)]?.angle ?? NaN;
    expect(angle('CH₄')).toBeGreaterThan(angle('NH₃'));
    expect(angle('NH₃')).toBeGreaterThan(angle('H₂O'));
    expect(angle('SO₂')).toBeLessThan(120);
  });

  it('is polar only when the bond dipoles do not cancel', () => {
    for (const m of MOLECULES) expect(m.dipole > 0, m.formula).toBe(m.lonePairs > 0);
  });

  it('settles from the ideal to the measured angle over the run', () => {
    const inputs = { molecule: at('H₂O'), settleTime: 3 };
    const state = new Float64Array(model.variables.length);
    model.init(inputs, state);
    expect(state[1]).toBeCloseTo(109.4712, 4);
    for (let i = 0; i < 1000 && !model.isComplete?.(state, inputs); i++)
      model.step(state, 0.07, inputs);
    expect(state[1]).toBeCloseTo(104.48, 12);
  });
});
