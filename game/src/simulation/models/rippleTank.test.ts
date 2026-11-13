import { describe, expect, it } from 'vitest';
import { rippleTankModel as model, rippleWavenumber } from './rippleTank';

// The ripple tank: the dispersion against its three textbook limits and the minimum wave speed,
// the maxima along S1S2 counted by hand, the probe's scan, the refusals.

const G = 9.81;
const SIGMA = 0.0728;
const RHO = 998;
const INPUTS = { frequency: 20, sourceSeparation: 0.06, depth: 0.005, scanTime: 6 };

describe('ripple tank dispersion', () => {
  it('meets the textbook limits: shallow √(gh), deep gravity ω²/g, deep capillary', () => {
    // Long waves on shallow water travel at √(g·h).
    expect(0.01 / rippleWavenumber(0.01, 0.01)).toBeCloseTo(Math.sqrt(G * 0.01), 5);
    // Deep water, long enough for gravity alone: k = ω²/g.
    expect(rippleWavenumber(3, 10) / (9 / G)).toBeCloseTo(1, 4);
    // Deep water, short enough for surface tension alone: k = (ρω²/σ)^(1/3).
    const omega = 2 * Math.PI * 2000;
    expect(rippleWavenumber(omega, 1) / ((RHO * omega ** 2) / SIGMA) ** (1 / 3)).toBeCloseTo(1, 2);
  });

  it('is slowest, (4gσ/ρ)^¼ ≈ 0.231 m/s, at λ = 2π·√(σ/(ρg)) ≈ 17.1 mm on deep water', () => {
    const kMin = Math.sqrt((RHO * G) / SIGMA);
    const cMin = ((4 * G * SIGMA) / RHO) ** 0.25;
    expect(cMin).toBeCloseTo(0.2313, 4);
    expect((2 * Math.PI) / kMin).toBeCloseTo(0.01713, 5);
    expect(rippleWavenumber(cMin * kMin, 1) / kMin).toBeCloseTo(1, 9);
  });
});

describe('ripple tank', () => {
  const lambda = (2 * Math.PI) / rippleWavenumber(2 * Math.PI * 20, 0.005);

  it('has 11 maxima between sources 6 cm apart at 20 Hz: m = 5 either side, λ/2 apart', () => {
    expect(lambda).toBeCloseTo(0.01189, 5); // 6 cm / λ = 5.05
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.maxima).toBe(11);
    expect(p.maximaSpan).toBeCloseTo(5 * lambda, 14);
    expect(p.maximaSpacing).toBeCloseTo(lambda / 2, 14);
    expect(p.wavelengthFromMaxima).toBeCloseTo(lambda, 14);
    expect(p.waveSpeed).toBeCloseTo(20 * lambda, 13);
  });

  it('crosses S1S2 with its probe: strongest at the middle, still a quarter wavelength on', () => {
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    expect(state[1]).toBeCloseTo(-0.03, 12);
    model.step(state, 3, INPUTS);
    expect(state[1]).toBeCloseTo(0, 12);
    expect(state[2]).toBeCloseTo(2, 12);
    const quarter = { ...INPUTS, scanTime: 0.06 / (0.03 + lambda / 4) };
    model.init(quarter, state);
    model.step(state, 1, quarter);
    expect(state[1]).toBeCloseTo(lambda / 4, 12);
    expect(state[2]).toBeLessThan(1e-9);
    model.step(state, 100, quarter);
    expect(model.isComplete?.(state, quarter)).toBe(true);
  });

  it('makes slower waves at lower frequencies, as real ripples do above ~13 Hz', () => {
    const v = (f: number) => model.predict?.({ ...INPUTS, frequency: f }).waveSpeed ?? NaN;
    expect(v(15)).toBeLessThan(v(20));
    expect(v(20)).toBeLessThan(v(25));
  });

  it('refuses what it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, frequency: 100 }, state)).toThrow(/frequency/);
    expect(() => model.init({ ...INPUTS, frequency: 10, sourceSeparation: 0.015 }, state)).toThrow(
      /wavelength apart/,
    );
  });
});
