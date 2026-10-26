import { describe, expect, it } from 'vitest';
import { MODE, circular, stateAt } from './model';

const TAU = 2 * Math.PI;

describe('uniform circular motion — model', () => {
  it('every way of giving the motion yields the same ω, v, T, f, a_ht, F_ht', () => {
    // r = 0.5 m, v = 3 m/s → ω = 6 rad/s, T = π/3 s, f = 3/π Hz, a_ht = 18 m/s², F = 3.6 N (m = 0.2 kg).
    const base = { r: 0.5, m: 0.2 };
    const given = [
      { mode: MODE.v, v: 3 },
      { mode: MODE.omega, omega: 6 },
      { mode: MODE.period, T: Math.PI / 3 },
      { mode: MODE.freq, f: 3 / Math.PI },
    ];
    for (const g of given) {
      const c = circular({ ...base, ...g });
      expect(c.omega, `mode ${g.mode}`).toBeCloseTo(6, 12);
      expect(c.v).toBeCloseTo(3, 12);
      expect(c.T).toBeCloseTo(Math.PI / 3, 12);
      expect(c.f).toBeCloseTo(3 / Math.PI, 12);
      expect(c.aC).toBeCloseTo(18, 11);
      expect(c.F).toBeCloseTo(3.6, 11);
      // The textbook identities hold together.
      expect(c.omega).toBeCloseTo(c.v / c.r, 12);
      expect(c.T).toBeCloseTo((TAU * c.r) / c.v, 12);
      expect(c.f).toBeCloseTo(1 / c.T, 12);
      expect(c.aC).toBeCloseTo(c.omega ** 2 * c.r, 11);
    }
  });

  it('120 rev/min = 2 Hz gives ω = 4π rad/s, not 2 rad/s', () => {
    const c = circular({ mode: MODE.freq, r: 1, f: 2 });
    expect(c.omega).toBeCloseTo(4 * Math.PI, 12);
    expect(c.T).toBeCloseTo(0.5, 12);
  });

  it('position, velocity and acceleration come straight from t', () => {
    const c = circular({ mode: MODE.omega, r: 2, omega: 3, phi0: 0.4, dir: -1, m: 1 });
    for (const t of [0, 0.1, 1.7, 123.456]) {
      const s = stateAt(c, t);
      const phi = 0.4 - 3 * t;
      expect(s.phi).toBe(phi);
      expect(s.x).toBeCloseTo(2 * Math.cos(phi), 12);
      expect(s.y).toBeCloseTo(2 * Math.sin(phi), 12);
      // Radius and speed stay constant; velocity ⟂ radius; acceleration points to the centre.
      expect(Math.hypot(s.x, s.y)).toBeCloseTo(2, 12);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(6, 12);
      expect(s.x * s.vx + s.y * s.vy).toBeCloseTo(0, 11);
      expect(s.ax).toBeCloseTo(-9 * s.x, 11);
      expect(s.ay).toBeCloseTo(-9 * s.y, 11);
    }
    // Clockwise: at φ₀ = 0 the body moves towards −y.
    expect(stateAt(circular({ mode: MODE.v, r: 1, v: 2, dir: -1 }), 0).vy).toBe(-2);
  });
});
