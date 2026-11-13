import { describe, expect, it } from 'vitest';
import { chargeField, COULOMB_K, pointChargesModel as model } from './pointCharges';

// Point charges: k from ε0, Coulomb's field worked by hand, superposition on the axis and off it,
// the probe's scan, the refusals.

const INPUTS = {
  charge: 5e-9,
  secondCharge: 0,
  separation: 0.2,
  probeDistance: 0.1,
  testCharge: 1e-9,
  scanFrom: 0.03,
  scanTo: 0.25,
  scanTime: 6,
};

describe('point charges', () => {
  it('uses k = 1/(4πε0) ≈ 8.988 × 10⁹ N·m²/C²', () => {
    expect(COULOMB_K / 1e9).toBeCloseTo(8.98755, 5);
  });

  it('gives 5 nC a field of 4494 V/m at 10 cm, and 1 nC there a force of 4.494 µN', () => {
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.fieldOne).toBeCloseTo((8.98755e9 * 5e-9) / 0.01, 0);
    expect(p.fieldSum).toBeCloseTo(p.fieldOne ?? NaN, 12);
    expect(p.fieldTwo).toBe(0);
    expect(p.force).toBeCloseTo(4.49378e-6, 10);
  });

  it('quarters the field at twice the distance', () => {
    const at = (r: number) => model.predict?.({ ...INPUTS, probeDistance: r }).fieldOne ?? NaN;
    expect(at(0.2) / at(0.1)).toBeCloseTo(0.25, 14);
  });

  it('adds Q2’s field d further on: like charges strengthen it, unlike weaken it', () => {
    const like = model.predict?.({ ...INPUTS, secondCharge: 5e-9 }) ?? {};
    const unlike = model.predict?.({ ...INPUTS, secondCharge: -5e-9 }) ?? {};
    const e2 = (COULOMB_K * 5e-9) / 0.3 ** 2; // 0.1 + 0.2 m from Q2
    expect(like.fieldTwo).toBeCloseTo(e2, 9);
    expect(like.fieldSum).toBeCloseTo((like.fieldOne ?? NaN) + e2, 9);
    expect(unlike.fieldSum).toBeCloseTo((unlike.fieldOne ?? NaN) - e2, 9);
  });

  it('draws the same field off the axis: zero half way between equal like charges', () => {
    const E = chargeField({ ...INPUTS, secondCharge: 5e-9 });
    const out: [number, number] = [0, 0];
    E(-0.1, 0, out);
    expect(Math.hypot(out[0], out[1])).toBeLessThan(1e-9);
    E(0.1, 0, out); // on the axis, as the model's own
    expect(out[0]).toBeCloseTo(
      model.predict?.({ ...INPUTS, secondCharge: 5e-9 }).fieldSum ?? NaN,
      6,
    );
    E(0, 0.1, out); // above Q1: Q1 straight up, Q2 from 0.2 m to the left
    const r = Math.hypot(0.2, 0.1);
    expect(out[1]).toBeCloseTo((COULOMB_K * 5e-9) / 0.01 + ((COULOMB_K * 5e-9) / r ** 3) * 0.1, 6);
    expect(out[0]).toBeCloseTo(((COULOMB_K * 5e-9) / r ** 3) * 0.2, 6);
  });

  it('moves its probe outwards, reading k·Q/r²', () => {
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    expect(state[1]).toBeCloseTo(0.03, 12);
    model.step(state, 3, INPUTS);
    expect(state[1]).toBeCloseTo(0.14, 12);
    expect(state[2]).toBeCloseTo((COULOMB_K * 5e-9) / 0.14 ** 2, 8);
    model.step(state, 10, INPUTS);
    expect(model.isComplete?.(state, INPUTS)).toBe(true);
  });

  it('refuses what it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, charge: 0 }, state)).toThrow(/charge/);
    expect(() => model.init({ ...INPUTS, scanFrom: 0.3 }, state)).toThrow(/outwards/);
  });
});
