import { describe, expect, it } from 'vitest';
import { doubleSlitModel as model, doubleSlitPattern } from './doubleSlit';

// Young's fringes: i = λD/a worked out by hand, the pattern's maxima and minima where the fringes
// say, the sensor's scan, the line against D, the refusals.

const INPUTS = {
  wavelength: 650e-9,
  slitSeparation: 0.3e-3,
  slitWidth: 0.05e-3,
  screenDistance: 1,
  scanSpan: 0.02,
  scanTime: 4,
};

describe('double slit', () => {
  it('spaces red fringes 2.167 mm apart: 650 nm × 1 m / 0.3 mm', () => {
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.fringeSpacing).toBeCloseTo(2.16667e-3, 8);
    expect(p.tenFringes).toBeCloseTo(21.6667e-3, 7);
    expect(p.wavelengthFromFringes).toBeCloseTo(650e-9, 15);
  });

  it('is bright at every fringe, dark half way between, dimmer under the envelope', () => {
    const I = doubleSlitPattern(INPUTS);
    const i = 2.16667e-3;
    expect(I(0)).toBe(1);
    expect(I(i / 2)).toBeLessThan(1e-9);
    expect(I(i)).toBeCloseTo((0.5 / (Math.PI / 6)) ** 2, 4); // the first fringe under the envelope: sinc²(π/6) ≈ 0.912
    expect(I(2 * i)).toBeLessThan(I(i));
    // The envelope's first zero, λD/b = 13 mm: every sixth fringe is missing (a/b = 6).
    expect(I(6 * i)).toBeLessThan(1e-9);
  });

  it('crosses the screen with its sensor, reading the pattern', () => {
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    expect(state[1]).toBeCloseTo(-0.01, 12);
    model.step(state, 2, INPUTS);
    expect(state[1]).toBeCloseTo(0, 12);
    expect(state[2]).toBeCloseTo(1, 12);
    model.step(state, 5, INPUTS);
    expect(state[0]).toBe(4);
  });

  it('spaces the fringes in proportion to D: slope λ/a', () => {
    const at = (D: number) =>
      model.predict?.({ ...INPUTS, screenDistance: D }).fringeSpacing ?? NaN;
    expect((at(1.5) - at(0.5)) / 1).toBeCloseTo(650e-9 / 0.3e-3, 12);
  });

  it('refuses what it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, wavelength: 1e-6 }, state)).toThrow(/wavelength/);
    expect(() => model.init({ ...INPUTS, slitWidth: 0.0004 }, state)).toThrow(/narrower/);
  });
});
