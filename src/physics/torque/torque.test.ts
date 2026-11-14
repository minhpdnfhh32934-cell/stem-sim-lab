import { describe, expect, it } from 'vitest';
import { dopri5 } from '@/core/ode/dopri5';
import { convert } from '@/core/units';
import { checkMisses, sliderEnds, sliderSweep } from '../testing';
import { TQ, TorqueEngine } from './engine';
import {
  THETA_MAX,
  balanceDistance,
  balanced,
  inertia,
  lever,
  netMoment,
  tipTime,
  type Lever,
} from './model';
import { numericTip, torqueBalance } from './scenes';

const base = { ...torqueBalance.defaults, g: 9.81 };

/** θ(t) from DOPRI5 on the equation of motion, for comparison with the RK4 engine. */
function reference(q: Lever, t: number): number {
  const r = dopri5(
    (_t, y, dy) => {
      dy[0] = y[1] ?? 0;
      dy[1] = (netMoment(q) * Math.cos(y[0] ?? 0)) / inertia(q);
    },
    [0, 0],
    0,
    t,
    { rtol: 1e-12, atol: 1e-14 },
  );
  return r.y[0] ?? 0;
}

describe('moments and the balance of a rigid body (VL10 Bài 21)', () => {
  it('the moment rule: m₁d₁ = m₂d₂ balances the beam', () => {
    const q = lever(base);
    expect(balanceDistance(q)).toBeCloseTo((1.5 * 0.4) / 1, 12);
    expect(balanced({ ...q, d2: balanceDistance(q) })).toBe(true);
    expect(balanced(q)).toBe(false);
    // Defaults: right side heavier (1 kg at 0.8 m against 1.5 kg at 0.4 m) → it tips right.
    expect(netMoment(q)).toBeLessThan(0);
  });

  it('quadrature time to the ground = DOPRI5 event, over every slider', () => {
    const sets = [...sliderEnds(torqueBalance), ...sliderSweep(torqueBalance, 250, 21)].map(
      (p) => ({ ...p, g: p.g ?? 9.81 }),
    );
    expect(sets.map((p) => checkMisses(torqueBalance, p)).filter((m) => m.length > 0)).toEqual([]);
    for (const p of sets.slice(0, 40)) {
      const q = lever(p);
      if (balanced(q)) continue;
      expect(tipTime(q)).toBeCloseTo(numericTip(q) ?? NaN, 9);
    }
  });

  it('the RK4 engine follows DOPRI5 until the end touches the ground, then rests there', () => {
    const q = lever(base);
    const e = new TorqueEngine();
    e.reset(base);
    const s = new Float64Array(e.stateSize);
    const T = tipTime(q);
    let checked = 0;
    while (!e.finished()) {
      e.step();
      e.readState(s);
      const t = e.time();
      if ((s[TQ.down] ?? 0) < 0.5 && t < T - 0.01 && Math.round(t * 240) % 24 === 0) {
        expect(s[TQ.theta]).toBeCloseTo(reference(q, t), 9);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(2);
    expect(s[TQ.down]).toBe(1);
    expect(Math.abs(s[TQ.theta] ?? 0)).toBeCloseTo(THETA_MAX, 12);
    expect(Math.sign(s[TQ.theta] ?? 0)).toBe(Math.sign(netMoment(q)));
  });

  it('energy stays constant while the beam turns', () => {
    const e = new TorqueEngine();
    e.reset({ ...base, m1: 4, d1: 0.9 });
    const E0 = e.diagnostics().invariants?.energy ?? NaN;
    expect(E0).toBeGreaterThan(0);
    const s = new Float64Array(e.stateSize);
    while (!e.finished()) {
      e.step();
      e.readState(s);
      if ((s[TQ.down] ?? 0) > 0.5) break;
      expect(e.diagnostics().invariants?.energy).toBeCloseTo(E0, 9);
    }
  });

  it('a balanced beam stays level the whole run', () => {
    const p = { ...base, d2: 0.6 };
    const e = new TorqueEngine();
    e.reset(p);
    const s = new Float64Array(e.stateSize);
    while (!e.finished()) {
      e.step();
      e.readState(s);
      expect(s[TQ.theta]).toBe(0);
    }
    expect(torqueBalance.solve(p, 'vi').answers.some((a) => a.id === 'N')).toBe(true);
  });

  it('a newton metre is a moment, never converted to joules', () => {
    expect(() => convert(1, 'N*m', 'J')).toThrow();
    expect(convert(2, 'N·m', 'N*m')).toBe(2);
  });
});
