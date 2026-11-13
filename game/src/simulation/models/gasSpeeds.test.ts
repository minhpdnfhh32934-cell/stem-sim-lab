import { describe, expect, it } from 'vitest';
import {
  erf,
  gasSpeedsModel as model,
  mostProbableSpeed,
  quantileSpeeds,
  speedDensity,
  speedShare,
} from './gasSpeeds';

// The Maxwell–Boltzmann distribution against its closed forms: nitrogen at 300 K has
// v_p = √(2RT/M) = 421.95 m/s, v̄ = √(8RT/πM) = 476.1 m/s, v_rms = √(3RT/M) = 516.8 m/s.

const INPUTS = { gas: 1, temperature: 300, particles: 400, scanTime: 20 };
const R = 8.314462618;
const M = 0.028014;

function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('Maxwell–Boltzmann speeds', () => {
  it('computes erf to double precision', () => {
    expect(erf(0)).toBe(0);
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 14);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 14);
    expect(erf(3)).toBeCloseTo(0.9999779095030014, 14);
    expect(erf(-1)).toBeCloseTo(-0.8427007929497149, 14);
  });

  it('is a distribution: f integrates to 1 and F is its integral', () => {
    let area = 0;
    const dv = 0.5;
    for (let v = dv / 2; v < 4000; v += dv) area += speedDensity(v, M, 300) * dv;
    expect(area).toBeCloseTo(1, 6);
    let half = 0;
    for (let v = dv / 2; v < 500; v += dv) half += speedDensity(v, M, 300) * dv;
    expect(half).toBeCloseTo(speedShare(500, M, 300), 6);
  });

  it('predicts v_p, v̄ and v_rms; the scan peaks at v_p, the set’s mean and rms come close', () => {
    const p = model.predict!(INPUTS);
    expect(p.mostProbable).toBeCloseTo(Math.sqrt((2 * R * 300) / M), 9);
    expect(p.mostProbable).toBeCloseTo(421.95, 1);
    expect(p.mean).toBeCloseTo(476.1, 0);
    expect(p.rms).toBeCloseTo(516.8, 0);
    const end = run(INPUTS, 0.01);
    expect(end.peakSpeed).toBeCloseTo(p.mostProbable ?? NaN, -1); // within the scan's step
    expect(Math.abs((end.meanSpeed ?? 0) / (p.mean ?? 1) - 1)).toBeLessThan(2e-3);
    expect(Math.abs((end.rmsSpeed ?? 0) / (p.rms ?? 1) - 1)).toBeLessThan(5e-3);
    expect(end.share).toBeCloseTo(100 * speedShare(3 * mostProbableSpeed(M, 300), M, 300), 9);
  });

  it('hotter or lighter, faster: v ∝ √(T/M)', () => {
    const v = (gas: number, t: number) =>
      model.predict!({ ...INPUTS, gas, temperature: t }).rms ?? NaN;
    expect(v(1, 1200) / v(1, 300)).toBeCloseTo(2, 12);
    expect(v(0, 300) / v(1, 300)).toBeCloseTo(Math.sqrt(0.028014 / 0.0040026), 9);
  });

  it('samples by quantiles: increasing speeds, each splitting the distribution evenly', () => {
    const speeds = new Float64Array(10);
    quantileSpeeds(10, M, 300, speeds);
    for (let i = 1; i < 10; i++) expect(speeds[i] ?? 0).toBeGreaterThan(speeds[i - 1] ?? 0);
    expect(speedShare(speeds[4] ?? 0, M, 300)).toBeCloseTo(0.45, 9);
  });
});
