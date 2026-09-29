import { describe, expect, it } from 'vitest';
import { dopri5 } from '@/core/ode';
import { logistic, lotkaVolterra, lvEquilibrium, lvInvariant } from './ecology/ecology';
import {
  apparent,
  lambertW,
  rate,
  substrateAt,
  substrateNumeric,
  type EnzymeParams,
} from './enzyme/enzyme';
import { rng } from './genetics/stats';
import {
  brownianStep,
  osmosisEquilibrium,
  osmosisRate,
  osmosisTrajectory,
  twoCompartment,
  type OsmosisParams,
} from './transport/transport';

describe('ecology', () => {
  it('logistic: exact solution matches the ODE, approaches K, inflection at K/2', () => {
    const r = 0.8;
    const K = 1000;
    const N0 = 10;
    const num = dopri5(
      (_t, y, d) => {
        d[0] = r * (y[0] ?? 0) * (1 - (y[0] ?? 0) / K);
      },
      [N0],
      0,
      12,
      { rtol: 1e-11, atol: 1e-12 },
    ).y[0]!;
    expect(logistic(N0, r, K, 12)).toBeCloseTo(num, 6);
    expect(logistic(N0, r, K, 100)).toBeCloseTo(K, 6);
    const tInflection = Math.log(K / N0 - 1) / r;
    expect(logistic(N0, r, K, tInflection)).toBeCloseTo(K / 2, 9);
  });

  it('Lotka–Volterra: invariant conserved, equilibrium and small-oscillation period', () => {
    const p = { alpha: 1.1, beta: 0.4, delta: 0.1, gamma: 0.4 };
    const traj = lotkaVolterra(p, 10, 10, 60, 600);
    const v0 = lvInvariant(p, 10, 10);
    for (let i = 0; i < traj.t.length; i++) {
      expect(Math.abs(lvInvariant(p, traj.x[i]!, traj.y[i]!) - v0)).toBeLessThan(1e-7);
    }
    const eq = lvEquilibrium(p);
    const still = lotkaVolterra(p, eq.x, eq.y, 10, 10);
    expect(still.x.at(-1)).toBeCloseTo(eq.x, 8);
    // Small oscillation around the equilibrium: period ≈ 2π/√(αγ).
    const small = lotkaVolterra(p, eq.x * 1.01, eq.y, 3 * eq.period, 3000);
    const peaks: number[] = [];
    for (let i = 1; i < small.x.length - 1; i++) {
      if (small.x[i]! > small.x[i - 1]! && small.x[i]! >= small.x[i + 1]!) peaks.push(small.t[i]!);
    }
    expect(peaks.length).toBeGreaterThanOrEqual(2);
    expect(peaks[1]! - peaks[0]!).toBeCloseTo(eq.period, 1);
  });
});

describe('enzyme kinetics', () => {
  const base: EnzymeParams = { vmax: 10, km: 2, inhibitor: 0, ki: 1, kind: 'none' };
  it('v = Vmax/2 at [S] = Km', () => {
    expect(rate(base, 2)).toBeCloseTo(5, 12);
  });
  it('inhibitors change Km and Vmax as in the textbook', () => {
    const I = { ...base, inhibitor: 1 };
    expect(apparent({ ...I, kind: 'competitive' })).toEqual({ vmax: 10, km: 4 });
    expect(apparent({ ...I, kind: 'noncompetitive' })).toEqual({ vmax: 5, km: 2 });
    expect(apparent({ ...I, kind: 'uncompetitive' })).toEqual({ vmax: 5, km: 1 });
    // Competitive inhibition is overcome at high [S].
    expect(rate({ ...I, kind: 'competitive' }, 1e6)).toBeCloseTo(10, 3);
  });
  it('Lambert W and the exact [S](t) agree with DOPRI5', () => {
    expect(lambertW(Math.E)).toBeCloseTo(1, 14);
    expect(lambertW(1) * Math.exp(lambertW(1))).toBeCloseTo(1, 14);
    for (const t of [0, 0.5, 2, 5]) {
      expect(substrateAt(base, 20, t)).toBeCloseTo(substrateNumeric(base, 20, t), 7);
    }
    expect(substrateAt(base, 20, 0)).toBeCloseTo(20, 10);
  });
});

describe('diffusion and osmosis', () => {
  it('two compartments: exact solution conserves amount and reaches the mean', () => {
    const r = twoCompartment(10, 0, 1, 3, 0.5, 2);
    expect(r.c1 * 1 + r.c2 * 3).toBeCloseTo(10, 12);
    const far = twoCompartment(10, 0, 1, 3, 0.5, 200);
    expect(far.c1).toBeCloseTo(2.5, 10);
    expect(far.c2).toBeCloseTo(2.5, 10);
  });

  it('osmosis: the U-tube settles where ρgΔh = iCRT (van ’t Hoff)', () => {
    const p: OsmosisParams = { c0: 0.2, i: 1, T: 298.15, h0: 0.1, rho: 1000, g: 9.81, lp: 1e-5 };
    const eq = osmosisEquilibrium(p);
    expect(osmosisRate(p, eq.hL)).toBeCloseTo(0, 9);
    expect(p.rho * p.g * eq.dh).toBeCloseTo(eq.pi, 6);
    const traj = osmosisTrajectory(p, 4000, 40);
    expect(traj.hL.at(-1)).toBeCloseTo(eq.hL, 6);
    // Water always moves INTO the solution arm.
    expect(eq.hL).toBeGreaterThan(p.h0);
  });

  it('Brownian motion: mean squared displacement = 4Dt in 2D', () => {
    const rand = rng(3);
    const D = 0.5;
    const dt = 0.01;
    const steps = 200;
    let msd = 0;
    const walkers = 2000;
    for (let w = 0; w < walkers; w++) {
      let x = 0;
      let y = 0;
      for (let s = 0; s < steps; s++) {
        const [dx, dy] = brownianStep(D, dt, rand);
        x += dx;
        y += dy;
      }
      msd += x * x + y * y;
    }
    msd /= walkers;
    expect(Math.abs(msd - 4 * D * dt * steps) / (4 * D * dt * steps)).toBeLessThan(0.05);
  });
});
