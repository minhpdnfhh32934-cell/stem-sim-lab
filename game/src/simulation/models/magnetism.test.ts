import { describe, expect, it } from 'vitest';
import type { SimulationModel } from '../SimulationModel';
import { MU0, currentBalanceModel, inductionModel } from './magnetism';

// Magnetism: F = B·I·L·sin α on the balance; the induced emf against −N·dΦ/dt by finite
// differences, its peaks at z = ±a/2, Lenz's signs, the refusals.

function run(model: SimulationModel, inputs: Record<string, number>, dt = 0.01) {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  const seen: Record<string, number>[] = [];
  for (let i = 0; i < 200000 && !model.isComplete?.(state, inputs); i++) {
    model.step(state, dt, inputs);
    seen.push(Object.fromEntries(model.variables.map((v, k) => [v, state[k] ?? NaN])));
  }
  return seen;
}

const BALANCE = {
  current: 2,
  wireLength: 0.04,
  angle: 90,
  fieldStrength: 0.06,
  gravity: 9.81,
  switchTime: 0.5,
  duration: 2,
};

describe('current balance', () => {
  it('2 A on 4 cm across 0.06 T: F = 4.8 mN, the reading up by 0.489 g', () => {
    const last = run(currentBalanceModel, BALANCE).at(-1)!;
    expect(last.force).toBeCloseTo(0.0048, 12);
    expect(last.balanceReading).toBeCloseTo(0.0048 / 9.81, 12);
    expect(last.clock).toBe(2);
  });

  it('reads nothing before the switch, and F follows sin α', () => {
    const seen = run(currentBalanceModel, BALANCE);
    expect(seen.find((s) => s.clock! < 0.5)?.balanceReading).toBe(0);
    const at30 = run(currentBalanceModel, { ...BALANCE, angle: 30 }).at(-1)!;
    expect(at30.force).toBeCloseTo(0.0024, 12);
    const p = currentBalanceModel.predict?.(BALANCE) ?? {};
    expect(p.forcePerAmpere).toBeCloseTo(0.06 * 0.04, 12);
    expect(p.field).toBe(0.06);
  });
});

const COIL = {
  speed: 0.5,
  turns: 400,
  polarity: 1,
  coilRadius: 0.02,
  magnetMoment: 1,
  startDistance: 0.25,
  circuitResistance: 50,
  timeLapse: 0.2,
};

describe('a magnet through a coil', () => {
  it('gives e = −N·dΦ/dt: the emf against a finite difference of the flux linkage', () => {
    const seen = run(inductionModel, COIL, 0.001);
    for (let i = 1; i < seen.length - 1; i += 37) {
      const [a, b, c] = [seen[i - 1]!, seen[i]!, seen[i + 1]!];
      const dPhi = (c.fluxLinkage! - a.fluxLinkage!) / (c.labTime! - a.labTime!);
      expect(b.emf).toBeCloseTo(-dPhi, 4);
    }
  });

  it('peaks at |z| = a/2 with 3·μ0·m·N·v/(4·a²·1.25^2.5): first −, then + for north pole first', () => {
    const peak = (3 * MU0 * 1 * 400 * 0.5) / (4 * 0.02 ** 2 * 1.25 ** 2.5);
    const last = run(inductionModel, COIL).at(-1)!;
    expect(last.firstPeak).toBeCloseTo(-peak, 12);
    expect(last.secondPeak).toBeCloseTo(peak, 12);
    expect(last.peakEmf).toBeCloseTo(peak, 12);
    expect(peak).toBeCloseTo(0.2698, 3);
    const south = run(inductionModel, { ...COIL, polarity: -1 }).at(-1)!;
    expect(south.firstPeak).toBeCloseTo(peak, 12);
    expect(inductionModel.predict?.(COIL).firstPeak).toBeCloseTo(-peak, 12);
  });

  it('the peak is proportional to N and to v; at the centre N·Φ = μ0·m·N/(2a)', () => {
    const p = inductionModel.predict?.(COIL) ?? {};
    expect(inductionModel.predict?.({ ...COIL, speed: 1 }).peakEmf).toBeCloseTo(2 * p.peakEmf!, 12);
    expect(inductionModel.predict?.({ ...COIL, turns: 800 }).peakEmf).toBeCloseTo(
      2 * p.peakEmf!,
      12,
    );
    expect(p.fluxLinkage).toBeCloseTo((MU0 * 400) / (2 * 0.02), 12);
  });

  it('runs 2·z0/v of lab time, slowed', () => {
    const last = run(inductionModel, COIL).at(-1)!;
    expect(last.labTime).toBeCloseTo(1, 12);
    expect(last.magnetPosition).toBeCloseTo(0.25, 12);
    const state = new Float64Array(inductionModel.variables.length);
    inductionModel.init(COIL, state);
    expect(() => inductionModel.init({ ...COIL, polarity: 0 }, state)).toThrow(/polarity/);
  });
});
