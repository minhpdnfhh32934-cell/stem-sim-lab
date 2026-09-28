import { describe, expect, it } from 'vitest';
import { pendulumPeriodExact } from '../math/special';
import { dopri5, integrateRk4, trbdf2, VelocityVerlet, type OdeFn } from './index';

// Harmonic oscillator x'' = -ω² x, state [x, v]. Exact: x = cos ωt, v = -ω sin ωt.
const omega = 2;
const sho: OdeFn = (_t, y, d) => {
  d[0] = y[1]!;
  d[1] = -omega * omega * y[0]!;
};

describe('RK4', () => {
  it('matches the analytic harmonic oscillator', () => {
    const y = integrateRk4(sho, [1, 0], 0, 5, 5000);
    expect(y[0]).toBeCloseTo(Math.cos(omega * 5), 9);
    expect(y[1]).toBeCloseTo(-omega * Math.sin(omega * 5), 9);
  });

  it('is fourth-order: halving h divides the error by ~16', () => {
    const err = (n: number) => Math.abs(integrateRk4(sho, [1, 0], 0, 5, n)[0]! - Math.cos(10));
    const ratio = err(200) / err(400);
    expect(ratio).toBeGreaterThan(14);
    expect(ratio).toBeLessThan(18);
  });
});

describe('Dormand–Prince 5(4)', () => {
  it('meets the requested tolerance on the oscillator over many periods', () => {
    const r = dopri5(sho, [1, 0], 0, 50, { rtol: 1e-10, atol: 1e-12 });
    expect(r.y[0]).toBeCloseTo(Math.cos(omega * 50), 7);
    expect(r.stats.steps).toBeGreaterThan(10);
  });

  it('solves exponential decay y′ = −y', () => {
    const r = dopri5((_t, y, d) => (d[0] = -y[0]!), [1], 0, 3, { rtol: 1e-11, atol: 1e-14 });
    expect(r.y[0]).toBeCloseTo(Math.exp(-3), 11);
  });

  it('locates a terminal event: projectile time of flight', () => {
    // Launch from height 20 m at 15 m/s, 30°, g = 9.81. State [x, y, vx, vy].
    const g = 9.81;
    const v0 = 15;
    const a = Math.PI / 6;
    const f: OdeFn = (_t, s, d) => {
      d[0] = s[2]!;
      d[1] = s[3]!;
      d[2] = 0;
      d[3] = -g;
    };
    const r = dopri5(f, [0, 20, v0 * Math.cos(a), v0 * Math.sin(a)], 0, 100, {
      events: [{ id: 'ground', g: (_t, s) => s[1]!, direction: -1, terminal: true }],
    });
    const vy0 = v0 * Math.sin(a);
    const tExact = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * 20)) / g;
    expect(r.stoppedBy).toBe('ground');
    expect(r.t).toBeCloseTo(tExact, 10);
    expect(r.y[0]).toBeCloseTo(v0 * Math.cos(a) * tExact, 9);
  });

  it('nonlinear pendulum half-period matches the elliptic-integral formula', () => {
    // θ'' = -(g/L) sin θ, released from rest at θ₀ = 60°; θ reaches -θ₀... we time θ = 0 crossings.
    const g = 9.81;
    const L = 1.2;
    const th0 = Math.PI / 3;
    const f: OdeFn = (_t, s, d) => {
      d[0] = s[1]!;
      d[1] = -(g / L) * Math.sin(s[0]!);
    };
    const r = dopri5(f, [th0, 0], 0, 10, {
      rtol: 1e-12,
      atol: 1e-14,
      events: [{ id: 'zero', g: (_t, s) => s[0]! }],
    });
    const zeros = r.events.map((e) => e.t);
    const T = pendulumPeriodExact(L, g, th0);
    expect(zeros[0]).toBeCloseTo(T / 4, 9);
    expect(zeros[1]! - zeros[0]!).toBeCloseTo(T / 2, 9);
  });

  it('keeps integrating correctly after a non-terminal event (FSAL safety)', () => {
    const r = dopri5(sho, [1, 0], 0, 20, {
      rtol: 1e-11,
      atol: 1e-13,
      events: [{ id: 'x0', g: (_t, s) => s[0]! }],
    });
    expect(r.events.length).toBe(13); // zeros of cos(2t) on (0, 20]: t = π/4 + kπ/2
    expect(r.y[0]).toBeCloseTo(Math.cos(40), 8);
  });
});

describe('velocity Verlet', () => {
  it('keeps the oscillator energy bounded (no secular drift) over 10 000 steps', () => {
    const x = Float64Array.from([1]);
    const v = Float64Array.from([0]);
    const verlet = new VelocityVerlet((_t, xx, _v, a) => (a[0] = -omega * omega * xx[0]!), 1);
    const E = () => 0.5 * v[0]! ** 2 + 0.5 * omega * omega * x[0]! ** 2;
    const E0 = E();
    let maxDev = 0;
    for (let i = 0; i < 10000; i++) {
      verlet.step(i * 0.01, x, v, 0.01);
      maxDev = Math.max(maxDev, Math.abs(E() / E0 - 1));
    }
    expect(maxDev).toBeLessThan(2e-4);
    // Late-time error equals early-time error bound → bounded, not drifting.
    expect(Math.abs(E() / E0 - 1)).toBeLessThan(2e-4);
  });

  it('is exact for constant acceleration (free fall)', () => {
    const x = Float64Array.from([0]);
    const v = Float64Array.from([0]);
    const verlet = new VelocityVerlet((_t, _x, _v, a) => (a[0] = -9.81), 1);
    for (let i = 0; i < 100; i++) verlet.step(i * 0.01, x, v, 0.01);
    expect(x[0]).toBeCloseTo(-0.5 * 9.81 * 1, 12);
    expect(v[0]).toBeCloseTo(-9.81, 12);
  });
});

describe('TR-BDF2 (stiff)', () => {
  it('solves y′ = −1000(y − cos t) − sin t, exact y = cos t', () => {
    const f: OdeFn = (t, y, d) => (d[0] = -1000 * (y[0]! - Math.cos(t)) - Math.sin(t));
    const r = trbdf2(f, [1], 0, 2, { rtol: 1e-7, atol: 1e-10 });
    expect(r.y[0]).toBeCloseTo(Math.cos(2), 6);
    // An explicit solver would need ~1000s of steps for stability; implicit takes far fewer.
    expect(r.stats.steps).toBeLessThan(400);
  });

  it('Robertson kinetics: conserves mass and matches reference values at t = 40', () => {
    // Hairer & Wanner, Solving ODEs II, §IV.10 (reference solution at t = 40).
    const f: OdeFn = (_t, y, d) => {
      const [a, b, c] = [y[0]!, y[1]!, y[2]!];
      d[0] = -0.04 * a + 1e4 * b * c;
      d[1] = 0.04 * a - 1e4 * b * c - 3e7 * b * b;
      d[2] = 3e7 * b * b;
    };
    const r = trbdf2(f, [1, 0, 0], 0, 40, { rtol: 1e-7, atol: 1e-12 });
    expect(r.y[0]! + r.y[1]! + r.y[2]!).toBeCloseTo(1, 9);
    expect(r.y[0]).toBeCloseTo(0.7158, 3);
    expect(r.y[1]! * 1e6).toBeCloseTo(9.185, 2);
    expect(r.y[2]).toBeCloseTo(0.2842, 3);
  });
});
