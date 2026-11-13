import { describe, expect, it } from 'vitest';
import { resonanceModel as model } from './resonance';

// Forced oscillation: the closed form checked against its own differential equation numerically,
// the steady amplitude worked out by hand, the measured amplitude at the run's end, the peak.

const K = 0.25 * (2 * Math.PI * 2) ** 2; // f0 = 2 Hz for 0.25 kg
const INPUTS = {
  mass: 0.25,
  stiffness: K,
  dampingRatio: 0.05,
  driveFrequency: 2,
  driveAmplitude: 0.01,
  duration: 20,
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

describe('resonance', () => {
  it('solves x″ + 2ζω0x′ + ω0²x = ω0²·a·cos ωt from rest (checked by finite differences)', () => {
    const state = new Float64Array(model.variables.length);
    const inputs = { ...INPUTS, driveFrequency: 1.6 };
    const x = (t: number) => {
      model.init(inputs, state);
      if (t > 0) model.step(state, t, inputs);
      return state[1] ?? NaN;
    };
    const w0 = 2 * Math.PI * 2;
    const w = 2 * Math.PI * 1.6;
    const h = 1e-4;
    for (const t of [0.3, 1.1, 2.7]) {
      const x0 = x(t);
      const v = (x(t + h) - x(t - h)) / (2 * h);
      const acc = (x(t + h) - 2 * x0 + x(t - h)) / (h * h);
      const residual = acc + 2 * 0.05 * w0 * v + w0 * w0 * x0 - w0 * w0 * 0.01 * Math.cos(w * t);
      expect(Math.abs(residual)).toBeLessThan(1e-3); // vs terms of order ω0²·a ≈ 1.6 m/s²
    }
    expect(x(0)).toBeCloseTo(0, 12);
  });

  it('at resonance A = a/(2ζ): 1 cm drive, ζ = 0.05, gives 10 cm', () => {
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.steadyAmplitude).toBeCloseTo(0.1, 12);
    expect(p.naturalFrequency).toBeCloseTo(2, 12);
    expect(p.phaseLag).toBeCloseTo(90, 9);
    // Measured from the motion over the last period, once the free oscillation has died away.
    const end = run(INPUTS, 0.01);
    expect(end.amplitude).toBeCloseTo(0.1, 5);
    expect(end.amplitudeRatio).toBeCloseTo(10, 3);
  });

  it.each([
    [1, 0.01 / (1 - 0.25 + 0)], // below: A = a/√((1 − r²)² + (2ζr)²), r = 0.5
    [3, 0.01 / Math.hypot(1 - 2.25, 2 * 0.05 * 1.5)],
  ])('away from it, at %s Hz, the amplitude falls as the formula says', (f, expected) => {
    const r = f / 2;
    const exact = 0.01 / Math.hypot(1 - r * r, 2 * 0.05 * r);
    expect(model.predict?.({ ...INPUTS, driveFrequency: f }).steadyAmplitude).toBeCloseTo(
      exact,
      12,
    );
    expect(expected).toBeCloseTo(exact, f === 1 ? 3 : 12);
    expect(run({ ...INPUTS, driveFrequency: f }, 0.02).amplitude).toBeCloseTo(exact, 5);
  });

  it('peaks higher and sharper with lighter damping, at f0·√(1 − 2ζ²)', () => {
    const peak = (zeta: number) => model.predict?.({ ...INPUTS, dampingRatio: zeta }) ?? {};
    expect(peak(0.05).steadyAmplitude).toBeGreaterThan(peak(0.2).steadyAmplitude ?? Infinity);
    expect(peak(0.2).peakFrequency).toBeCloseTo(2 * Math.sqrt(1 - 0.08), 12);
  });

  it('refuses what it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, dampingRatio: 1 }, state)).toThrow(/dampingRatio/);
    expect(() => model.init({ ...INPUTS, driveFrequency: 0 }, state)).toThrow(/driveFrequency/);
  });
});
