import { describe, expect, it } from 'vitest';
import { galvanicCellModel as model } from './galvanicCell';

// The cell against the Nernst equation worked by hand: the Daniell cell at standard
// concentrations reads E° = 0.3419 − (−0.7618) = 1.1037 V; each tenfold change of a 2+ ion moves
// its electrode by (RT/2F)·ln 10 = 29.58 mV at 25 °C.

const INPUTS = {
  pair: 0,
  leftConcentration: 1,
  rightConcentration: 1,
  temperature: 25,
  timeConstant: 0.5,
  readTime: 5,
};

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

const SLOPE_2 = (8.314462618 * 298.15 * Math.LN10) / (2 * 96485.33212331); // V per decade, n = 2

describe('galvanic cell', () => {
  it('reads the Daniell cell’s standard emf, 1.1037 V, its needle settling through τ', () => {
    const end = run(INPUTS, 0.01);
    expect(end.emf).toBeCloseTo(1.1037, 12);
    expect(end.reading).toBeCloseTo(1.1037 * (1 - Math.exp(-10)), 10);
    expect(model.predict!(INPUTS).standardEmf).toBeCloseTo(1.1037, 12);
  });

  it('follows Nernst: diluting Cu²⁺ tenfold lowers the emf by 29.6 mV; diluting Zn²⁺ raises it', () => {
    const emf = (left: number, right: number) =>
      model.predict!({ ...INPUTS, leftConcentration: left, rightConcentration: right }).emf ?? NaN;
    expect(emf(1, 0.1)).toBeCloseTo(1.1037 - SLOPE_2, 12);
    expect(emf(0.1, 1)).toBeCloseTo(1.1037 + SLOPE_2, 12);
    expect(SLOPE_2).toBeCloseTo(0.02958, 5);
  });

  it('a 1+ ion (silver) moves twice as far per decade; ΔG = −zFE with z the electrons swapped', () => {
    const zincSilver = { ...INPUTS, pair: 3 };
    const p = model.predict!(zincSilver);
    expect(p.standardEmf).toBeCloseTo(0.7996 + 0.7618, 12);
    expect(p.electrons).toBe(2);
    expect(p.gibbsEnergy).toBeCloseTo((-2 * 96485.33212331 * (p.emf ?? NaN)) / 1000, 9);
    const diluted = model.predict!({ ...zincSilver, rightConcentration: 0.1 });
    expect((p.emf ?? 0) - (diluted.emf ?? 0)).toBeCloseTo(2 * SLOPE_2, 12);
  });

  it('ranks the metals: the further apart in the series, the larger the emf', () => {
    const e = (pair: number) => model.predict!({ ...INPUTS, pair }).standardEmf ?? NaN;
    expect(e(4)).toBeGreaterThan(e(0)); // Mg|Cu > Zn|Cu
    expect(e(0)).toBeGreaterThan(e(1)); // Zn|Cu > Fe|Cu
    expect(e(1)).toBeGreaterThan(e(2)); // Fe|Cu > Pb|Cu
    expect(e(5)).toBeCloseTo(0.7996 - 0.3419, 12); // Cu|Ag
  });

  it('refuses a pair it does not have', () => {
    expect(() => model.init({ ...INPUTS, pair: 9 }, new Float64Array(5))).toThrow(/pair/);
  });
});
