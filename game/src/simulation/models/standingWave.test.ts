import { describe, expect, it } from 'vitest';
import { standingWaveModel as model } from './standingWave';

// Standing waves: f_n = n·v/(2L), v = √(T/μ) worked out by hand, the sweep ending at f_n with the
// largest swing, the line against n, the refusals.

const INPUTS = {
  hangingMass: 0.1,
  loops: 2,
  stringLength: 1,
  linearDensity: 0.001,
  gravity: 9.81,
  driveAmplitude: 0.0004,
  dampingRatio: 0.02,
  sweepTime: 4,
  holdTime: 1,
};

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('standing wave on a string', () => {
  it('stands with two loops at 2·v/(2L): v = √(0.981 N / 1 g/m) = 31.32 m/s, f2 = 31.32 Hz', () => {
    const v = Math.sqrt((0.1 * 9.81) / 0.001);
    expect(v).toBeCloseTo(31.3209, 4);
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.waveSpeed).toBeCloseTo(v, 12);
    expect(p.resonantFrequency).toBeCloseTo(v, 12); // n = 2, L = 1 m
    expect(p.wavelength).toBe(1);
  });

  it('ends its sweep at f_n, the swing at its largest: a/(2ζ) = 1 cm', () => {
    const end = run(INPUTS, 0.01);
    expect(end.frequency).toBeCloseTo(end.resonantFrequency ?? NaN, 12);
    expect(end.amplitude).toBeCloseTo(0.0004 / 0.04, 12);
    expect(end.waveSpeed).toBeCloseTo(Math.sqrt(981), 9);
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    expect(state[2]).toBeLessThan(0.002); // at 60 % of f_n, small
  });

  it('puts f_n on a line through the origin against n: slope v/(2L)', () => {
    const f = (n: number) => model.predict?.({ ...INPUTS, loops: n }).resonantFrequency ?? NaN;
    expect(f(4) / f(1)).toBeCloseTo(4, 12);
    expect(f(3) - f(2)).toBeCloseTo(model.predict?.(INPUTS).frequencyPerLoop ?? NaN, 12);
    // Four times the mass doubles v, and every f_n with it.
    const heavy = model.predict?.({ ...INPUTS, hangingMass: 0.4 }).resonantFrequency ?? NaN;
    expect(heavy / f(2)).toBeCloseTo(2, 12);
  });

  it('refuses what it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, loops: 2.5 }, state)).toThrow(/loops/);
    expect(() => model.init({ ...INPUTS, hangingMass: 0 }, state)).toThrow(/hangingMass/);
  });
});
