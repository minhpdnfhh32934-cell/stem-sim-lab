import { describe, expect, it } from 'vitest';
import { resonanceTubeModel as model } from './resonanceTube';

// The resonance tube: v(t) and the two resonances worked out by hand, λ = 2(L2 − L1) free of the
// end correction, the loudness peaking at them, the refusals.

const INPUTS = {
  frequency: 512,
  temperature: 20,
  tubeRadius: 0.015,
  tubeLength: 0.8,
  startColumn: 0.05,
  lowerSpeed: 0.1,
};

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) {
    model.step(state, dt, inputs);
    expect([...state].every(Number.isFinite)).toBe(true);
  }
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('resonance tube', () => {
  it('at 20 °C sound goes 343.2 m/s: 331.3·√(1 + 20/273.15)', () => {
    const v = 331.3 * Math.sqrt(1 + 20 / 273.15);
    expect(v).toBeCloseTo(343.21, 2);
    expect(model.predict?.(INPUTS).speedOfSound).toBeCloseTo(v, 12);
  });

  it('resonates at λ/4 − e and 3λ/4 − e; λ = 2(L2 − L1) whatever e is', () => {
    const lambda = (331.3 * Math.sqrt(1 + 20 / 273.15)) / 512; // 0.670 m
    const end = run(INPUTS, 0.01);
    expect(end.firstResonance).toBeCloseTo(lambda / 4 - 0.009, 12);
    expect(end.secondResonance).toBeCloseTo((3 * lambda) / 4 - 0.009, 12);
    expect(end.wavelength).toBeCloseTo(lambda, 12);
    expect(end.speedOfSound).toBeCloseTo(512 * lambda, 9);
    const wide = run({ ...INPUTS, tubeRadius: 0.025 }, 0.01);
    expect(wide.wavelength).toBeCloseTo(lambda, 12);
  });

  it('is loudest at the resonances and quiet between them', () => {
    const state = new Float64Array(model.variables.length);
    const p = model.predict?.(INPUTS) ?? {};
    const at = (l: number) => {
      model.init(INPUTS, state);
      model.step(state, (l - 0.05) / 0.1, INPUTS);
      return state[2] ?? NaN;
    };
    expect(at(p.firstResonance ?? NaN)).toBeCloseTo(1, 9);
    expect(at(((p.firstResonance ?? 0) + (p.secondResonance ?? 0)) / 2)).toBeLessThan(0.06);
  });

  it('refuses a tube too short for the second resonance', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, frequency: 256 }, state)).toThrow(/higher frequency/);
    expect(() => model.init({ ...INPUTS, temperature: 80 }, state)).toThrow(/temperature/);
  });
});
