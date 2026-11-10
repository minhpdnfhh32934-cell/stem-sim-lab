import { describe, expect, it } from 'vitest';
import { pendulumPeriodExact } from '@/core/math/special';
import { PE, PendulumEngine, pendulumInput } from './engine';
import { maxAngle, numericPeriodPendulum, separatrix, simplePendulum, wrapAngle } from './scenes';

describe('simple pendulum', () => {
  it('RK4 engine: period from zero crossings matches the elliptic formula', () => {
    const p = { L: 1, theta0: Math.PI / 3, omega0: 0, m: 0.5, c: 0, g: 9.81, tEnd: 10 };
    const e = new PendulumEngine();
    e.reset(p);
    const s = new Float64Array(6);
    let prev = p.theta0;
    const crossings: number[] = [];
    for (let i = 0; i < 2400; i++) {
      e.step();
      e.readState(s);
      const th = s[PE.th]!;
      if (prev > 0 && th <= 0) {
        // Linear interpolation inside the step is enough at this step size.
        const frac = prev / (prev - th);
        crossings.push(e.time() - e.dt + frac * e.dt);
      }
      prev = th;
    }
    const T = pendulumPeriodExact(1, 9.81, Math.PI / 3);
    expect(crossings[1]! - crossings[0]!).toBeCloseTo(T, 5);
  });

  it('energy is conserved to ~1e-12 (RK4 with substeps)', () => {
    const e = new PendulumEngine();
    e.reset({ L: 2, theta0: 1.2, omega0: 0, m: 1, c: 0, g: 9.81 });
    const E0 = e.diagnostics().invariants!.energy;
    for (let i = 0; i < 2400; i++) e.step();
    expect(Math.abs(e.diagnostics().invariants!.energy / E0 - 1)).toBeLessThan(1e-10);
  });

  it('numeric period (Dormand–Prince) equals the exact formula', () => {
    const q = pendulumInput({ L: 1.5, theta0: 1, g: 9.81 });
    expect(numericPeriodPendulum(q)).toBeCloseTo(pendulumPeriodExact(1.5, 9.81, 1), 9);
  });

  it('detects looping over the top', () => {
    expect(maxAngle(pendulumInput({ L: 1, theta0: 0, omega0: 10, g: 9.81 }))).toBeNull();
    expect(maxAngle(pendulumInput({ L: 1, theta0: 0.3, omega0: 0, g: 9.81 }))).toBeCloseTo(0.3, 12);
  });

  it('scene solution: 60° amplitude is ~7.3 % slower than the small-angle period', () => {
    const sol = simplePendulum.solve(simplePendulum.defaults, 'vi');
    const T = sol.answers.find((a) => a.id === 'period')!;
    const T0 = sol.answers.find((a) => a.id === 'period_small')!;
    expect(T.value / T0.value - 1).toBeCloseTo(0.0732, 3);
    expect(T.check).toBeCloseTo(T.value, 8);
    expect(sol.notes?.length).toBe(1);
  });
});

describe('simple pendulum — the string must stay taut', () => {
  const base = { L: 1, theta0: Math.PI / 3, omega0: 0, m: 0.5, c: 0, showSmall: 1, g: 9.81 };
  const deg = (d: number) => (d * Math.PI) / 180;
  const errs = (p: Record<string, number>) => simplePendulum.validate?.(p) ?? [];

  it('rejects an amplitude above 90°, where the tension would turn negative', () => {
    const p = { ...base, theta0: deg(120) };
    // T at release = m (g cos α + l ω²) < 0: a real string would go slack at once.
    const e = new PendulumEngine();
    e.reset(p);
    const s = new Float64Array(8);
    e.readState(s);
    expect(s[PE.T]).toBeLessThan(0);
    expect(errs(p).length).toBeGreaterThan(0);
  });

  it('rejects a push that swings it beyond 90° without looping', () => {
    const p = { ...base, theta0: 0, omega0: 6 }; // amplitude ≈ 146.6°
    expect(maxAngle(pendulumInput(p))).toBeGreaterThan(Math.PI / 2);
    expect(errs(p).length).toBeGreaterThan(0);
  });

  it('rejects a loop that is too slow at the top (v² < g l there)', () => {
    // ω0 = 6.5 rad/s from the bottom: loops (v_top² = 42.25 − 39.24 > 0) but v_top² < g l.
    expect(errs({ ...base, theta0: 0, omega0: 6.5 }).length).toBeGreaterThan(0);
  });

  it('accepts a fast loop, amplitudes up to 90°, and the defaults', () => {
    expect(errs({ ...base, theta0: 0, omega0: 8 })).toEqual([]); // v_top² = 64 − 39.24 > g l
    expect(errs({ ...base, theta0: deg(90) })).toEqual([]);
    expect(errs({ ...base, theta0: deg(-89) })).toEqual([]);
    expect(errs(simplePendulum.defaults)).toEqual([]);
  });

  it('with damping, any start above the 90° level is rejected (it slows through the slack zone)', () => {
    expect(errs({ ...base, c: 0.1, theta0: 0, omega0: 8 }).length).toBeGreaterThan(0);
    expect(errs({ ...base, c: 0.1, theta0: deg(80) })).toEqual([]);
  });
});

describe('phase space: the separatrix E = 2mgL (#54 item 3)', () => {
  const q = pendulumInput({ L: 1, g: 9.81, m: 0.5, c: 0 });

  it('every point of the separatrix has exactly E = 2mgL', () => {
    for (const sign of [1, -1] as const) {
      for (const [a, w] of separatrix(q, sign)) {
        const E = 0.5 * q.m * (q.L * w) ** 2 + q.m * q.g * q.L * (1 - Math.cos(a));
        expect(E).toBeCloseTo(2 * q.m * q.g * q.L, 10);
      }
    }
  });

  it('just inside it the pendulum swings, just outside it goes round', () => {
    const top = 2 * Math.sqrt(q.g / q.L);
    expect(maxAngle({ ...q, theta0: 0, omega0: 0.99 * top })).not.toBeNull();
    expect(maxAngle({ ...q, theta0: 0, omega0: 1.01 * top })).toBeNull();
  });

  it('the phase graph wraps the angle into (−π, π]', () => {
    expect(wrapAngle(Math.PI)).toBe(Math.PI);
    expect(wrapAngle(-Math.PI)).toBe(Math.PI);
    expect(wrapAngle((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2, 12);
    expect(wrapAngle(0.3 + 4 * Math.PI)).toBeCloseTo(0.3, 12);
    const g = simplePendulum.graphs.find((d) => d.id === 'phase');
    expect(g?.x?.period).toBeCloseTo(2 * Math.PI, 12);
    expect(g?.guides?.(simplePendulum.defaults)).toHaveLength(2);
  });
});
