import { describe, expect, it } from 'vitest';
import { pendulumPeriodExact } from '@/core/math/special';
import { PE, PendulumEngine, pendulumInput } from './engine';
import { maxAngle, numericPeriodPendulum, simplePendulum } from './scenes';

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
