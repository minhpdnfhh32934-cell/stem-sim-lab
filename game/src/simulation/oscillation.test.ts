import { describe, expect, it } from 'vitest';
import { measureOscillation, MIN_CYCLES, PEAK_FLOOR } from './oscillation';

/** Samples every `dt` of a known motion, as a run records them. */
function sampled(f: (t: number) => number, seconds: number, dt = 0.01) {
  const n = Math.round(seconds / dt) + 1;
  const times = Float64Array.from({ length: n }, (_, i) => i * dt);
  const values = times.map(f);
  return { times, values, n };
}

/** A damped swing released at rest from y₀: the exact solution of y'' + 2σy' + ω₀²y = 0. */
const damped = (y0: number, sigma: number, omegaD: number) => (t: number) =>
  y0 * Math.exp(-sigma * t) * (Math.cos(omegaD * t) + (sigma / omegaD) * Math.sin(omegaD * t));

describe('measureOscillation: period and decay from samples with a known answer', () => {
  it('measures the period of a damped swing over many cycles, and its decay rate and ζ', () => {
    const T = 0.8;
    const omegaD = (2 * Math.PI) / T;
    const sigma = 0.5;
    const { times, values, n } = sampled(damped(0.1, sigma, omegaD), 10);
    const m = measureOscillation(times, values, n);
    expect(m.period?.cycles).toBeGreaterThanOrEqual(MIN_CYCLES);
    expect(m.period!.value).toBeCloseTo(T, 4);
    expect(m.peaks.length).toBeGreaterThanOrEqual(5);
    expect(m.decay!.rate).toBeCloseTo(sigma, 3);
    expect(m.decay!.r2).toBeCloseTo(1, 6);
    // ζ = σ/√(σ² + ω_d²), from the logarithmic decrement δ = σ·T_d alone.
    expect(m.decay!.zeta).toBeCloseTo(sigma / Math.hypot(sigma, omegaD), 4);
    expect(m.decay!.decrement).toBeCloseTo(sigma * T, 3);
  });

  it('measures about any rest value: the same swing 0.3 m down', () => {
    const f = damped(0.05, 0.3, 2 * Math.PI);
    const { times, values, n } = sampled((t) => 0.3 + f(t), 8);
    const m = measureOscillation(times, values, n, 0.3);
    expect(m.period!.value).toBeCloseTo(1, 4);
    expect(m.decay!.rate).toBeCloseTo(0.3, 3);
  });

  it('keeps an undamped swing’s amplitude: no decay to report', () => {
    const { times, values, n } = sampled((t) => 0.1 * Math.cos(2 * Math.PI * t), 6);
    const m = measureOscillation(times, values, n);
    expect(m.period!.value).toBeCloseTo(1, 5);
    for (const p of m.peaks) expect(p.amplitude).toBeCloseTo(0.1, 5);
    expect(m.decay === null || Math.abs(m.decay.rate) < 1e-6).toBe(true);
  });

  it('gives no period below 2 whole cycles, and no decay below 3 peaks', () => {
    const { times, values, n } = sampled((t) => 0.1 * Math.cos(2 * Math.PI * t), 1.6);
    const m = measureOscillation(times, values, n);
    expect(m.period).toBeNull();
    expect(m.decay).toBeNull();
  });

  it('finds nothing in a motion that does not swing (overdamped) or in no data', () => {
    const { times, values, n } = sampled((t) => 0.1 * Math.exp(-2 * t), 5);
    const m = measureOscillation(times, values, n);
    expect([m.crossings.length, m.peaks.length, m.period, m.decay]).toEqual([0, 0, null, null]);
    const empty = measureOscillation(new Float64Array(0), new Float64Array(0), 0);
    expect([empty.period, empty.decay, empty.floor]).toEqual([null, null, 0]);
  });

  it('leaves out swings below the floor at the end of a run', () => {
    const { times, values, n } = sampled(damped(0.1, 1.5, 2 * Math.PI), 12);
    const m = measureOscillation(times, values, n);
    expect(m.floor).toBeCloseTo(PEAK_FLOOR * 0.1, 6);
    for (const p of m.peaks) expect(p.amplitude).toBeGreaterThan(m.floor);
    expect(m.peaks.length).toBeLessThan(5); // later peaks are too small to read
  });

  it('stops at the first sample that is not finite, and never returns NaN', () => {
    const { times, values, n } = sampled((t) => 0.1 * Math.cos(2 * Math.PI * t), 6);
    values[450] = NaN; // t = 4.5 s
    const m = measureOscillation(times, values, n);
    expect(m.crossings.every((t) => t < 4.5)).toBe(true);
    expect(Number.isFinite(m.period!.value)).toBe(true);
    expect(m.period!.value).toBeCloseTo(1, 5);
  });
});
