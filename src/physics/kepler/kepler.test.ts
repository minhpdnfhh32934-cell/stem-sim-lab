import { describe, expect, it } from 'vitest';
import { integrate, numericSpeedRatio } from './check';
import { KE, KeplerEngine } from './engine';
import {
  arealVelocity,
  eccentricAnomaly,
  orbit,
  sectorArea,
  semiMinor,
  speedRatio,
  stateAt,
} from './model';
import { keplerOrbit } from './scenes';

describe('Kepler orbit (#54 item 12)', () => {
  it("Newton's method solves Kepler's equation to rounding, even at e = 0.9", () => {
    for (const e of [0, 0.3, 0.5, 0.9])
      for (const M of [0, 0.1, 1, 2.5, Math.PI, 4, 6.2]) {
        const E = eccentricAnomaly(M, e);
        expect(Math.abs(E - e * Math.sin(E) - M)).toBeLessThan(1e-13);
      }
  });

  it('the closed form agrees with DOPRI5 on Newton’s law of gravitation', () => {
    for (const e of [0.1, 0.5, 0.8]) {
      const o = orbit({ e, T: 10 });
      for (const t of [0.37 * o.T, 0.5 * o.T, 1.8 * o.T]) {
        const s = stateAt(o, t);
        const y = integrate(o, t);
        expect(Math.hypot(s.x - (y[0] ?? 0), s.y - (y[1] ?? 0))).toBeLessThan(1e-8);
        expect(Math.hypot(s.vx - (y[2] ?? 0), s.vy - (y[3] ?? 0))).toBeLessThan(1e-7);
      }
    }
  });

  it("Kepler's second law: equal areas in equal times, at the rate πab/T", () => {
    const o = orbit({ e: 0.6, T: 12, N: 6 });
    const slice = (Math.PI * semiMinor(o)) / o.N;
    for (let k = 0; k < o.N; k++)
      expect(
        Math.abs(sectorArea(o, (k * o.T) / o.N, ((k + 1) * o.T) / o.N) / slice - 1),
      ).toBeLessThan(1e-5);
    for (const t of [0, 1.3, 5.9, 11]) {
      const s = stateAt(o, t);
      expect((s.x * s.vy - s.y * s.vx) / 2).toBeCloseTo(arealVelocity(o), 12);
    }
  });

  it('perihelion speed over aphelion speed is (1 + e)/(1 − e), also from the integration', () => {
    const o = orbit({ e: 0.5 });
    expect(speedRatio(o)).toBeCloseTo(3, 12);
    expect(Math.abs(numericSpeedRatio(o) / 3 - 1)).toBeLessThan(1e-8);
  });

  it('the engine reads the closed form at t = n·Δt; the solution carries its checks', () => {
    const e = new KeplerEngine();
    e.reset({ e: 0.4, T: 8 });
    for (let i = 0; i < 700; i++) e.step();
    const out = new Float64Array(e.stateSize);
    e.readState(out);
    const s = stateAt(orbit({ e: 0.4, T: 8 }), e.time());
    expect(out[KE.x]).toBe(s.x);
    expect(out[KE.areal]).toBeCloseTo(arealVelocity(orbit({ e: 0.4, T: 8 })), 12);
    const sol = keplerOrbit.solve(keplerOrbit.defaults, 'vi');
    for (const a of sol.answers)
      if (a.check !== undefined) expect(Math.abs(a.check / a.value - 1), a.id).toBeLessThan(1e-5);
  });
});
