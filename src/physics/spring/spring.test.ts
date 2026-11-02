import { describe, expect, it } from 'vitest';
import { dopri5 } from '@/core/ode/dopri5';
import { EngineRunner } from '@/core/sim/runner';
import { SP, SpringEngine, springInput, staticExtension } from './engine';
import { amplitudePhase, period, propagate, regime, type Oscillator } from './model';
import { checkMisses, sliderSweep } from '../testing';
import { hookeSpring, numericPeriod, springPendulum } from './scenes';

function reference(o: Oscillator, x0: number, v0: number, t: number): number {
  const r = dopri5(
    (_t, y, d) => {
      d[0] = y[1] ?? 0;
      d[1] = (-o.k * (y[0] ?? 0) - o.b * (y[1] ?? 0)) / o.m;
    },
    [x0, v0],
    0,
    t,
    { rtol: 1e-12, atol: 1e-14 },
  );
  return r.y[0] ?? 0;
}

describe('spring cross-checks (#112)', () => {
  // Near critical damping the second zero crossing is ~e⁻³⁵ smaller than the first: below the
  // check's old absolute tolerance, so DOPRI5 reported 1,841 s / 2,892 s for 2,227 s / 4,514 s.
  it.each([
    ['springPendulum: near critical damping', springPendulum, { b: 9.9 }],
    ['hookeSpring: near critical damping', hookeSpring, { vertical: 0, x0: -0.26, b: 6.3 }],
    ['springPendulum: b 9,9986', springPendulum, { b: 9.9986 }],
    // Starts at equilibrium: the start is not a crossing; the crossings are T/2 and T.
    ['springPendulum: starts at equilibrium', springPendulum, { x0: 0, v0: 1, b: 9.9 }],
  ] as const)('%s', (_name, scene, p) => {
    const params = { ...scene.defaults, ...p };
    expect(scene.solve(params, 'vi').answers.some((a) => a.check !== undefined)).toBe(true);
    expect(checkMisses(scene, params)).toEqual([]);
  });

  it.each([
    ['springPendulum', springPendulum],
    ['hookeSpring', hookeSpring],
  ] as const)('%s: every check agrees over a slider sweep', (_name, scene) => {
    const sets = sliderSweep(scene, 400, 112);
    const misses = sets
      .map((p) => ({ p, miss: checkMisses(scene, p) }))
      .filter((r) => r.miss.length > 0);
    expect(misses).toEqual([]);
    // The sweep really checks: most sets carry a check (a check that went missing would pass).
    const checked = sets.filter((p) =>
      scene.solve(p, 'vi').answers.some((a) => a.check !== undefined),
    ).length;
    expect(checked).toBeGreaterThan(sets.length / 4);
  });

  it.each([
    // γ = 9,7039 s⁻¹, ω₀ = 9,7044 rad/s: T_d ≈ 64,8 s, x shrinks by ~1e-273 over one period.
    ['k 97, m 1,03, b 19,99', { k: 97, m: 1.03, b: 19.99 }],
    // γ = 1,732 s⁻¹, ω₀ = 1,73205 rad/s: T_d ≈ 474 s, x shrinks by ~1e-356 (below double precision).
    ['k 15, m 5, b 17,32', { k: 15, m: 5, b: 17.32 }],
  ] as const)(
    'a hair from critical damping on the slider grid (%s): checked, and it agrees',
    (_n, p) => {
      const params = { ...springPendulum.defaults, ...p };
      const period = springPendulum.solve(params, 'vi').answers.find((a) => a.id === 'period');
      expect(period?.check).toBeDefined();
      expect(checkMisses(springPendulum, params)).toEqual([]);
    },
  );

  it('the check stays quick on the UI thread near critical damping (under 50 ms)', () => {
    for (const b of [9.99, 9.999, 9.9999]) {
      const t0 = performance.now();
      springPendulum.solve({ ...springPendulum.defaults, b }, 'vi');
      expect(performance.now() - t0, `b ${String(b)}`).toBeLessThan(50);
    }
  });
});

describe('oscillator exact propagator', () => {
  it.each([
    ['undamped', { m: 0.25, k: 100, b: 0 }],
    ['underdamped', { m: 0.25, k: 100, b: 1 }],
    ['critical', { m: 0.25, k: 100, b: 2 * Math.sqrt(100 * 0.25) }],
    ['overdamped', { m: 0.25, k: 100, b: 30 }],
  ] as const)('%s case matches high-accuracy integration', (_name, o) => {
    let x = 0.05;
    let v = 0.3;
    for (let i = 0; i < 480; i++) [x, v] = propagate(o, x, v, 1 / 240);
    expect(x).toBeCloseTo(reference(o, 0.05, 0.3, 2), 9);
  });

  it('classifies damping regimes', () => {
    expect(regime({ m: 1, k: 4, b: 0 })).toBe('none');
    expect(regime({ m: 1, k: 4, b: 4 })).toBe('critical');
    expect(regime({ m: 1, k: 4, b: 1 })).toBe('under');
    expect(regime({ m: 1, k: 4, b: 10 })).toBe('over');
  });

  it('T = 2π√(m/k) and A = √(x0² + (v0/ω)²)', () => {
    const o = { m: 0.4, k: 40, b: 0 };
    expect(period(o)).toBeCloseTo(2 * Math.PI * 0.1, 12);
    expect(amplitudePhase(o, 0.03, 0.4).A).toBeCloseTo(0.05, 12);
  });
});

describe('spring engine and scenes', () => {
  it('vertical spring: static extension mg/k and energy conservation', () => {
    const q = springInput({ vertical: 1, m: 0.2, k: 50, g: 9.81 });
    expect(staticExtension(q)).toBeCloseTo((0.2 * 9.81) / 50, 12);
    const e = new SpringEngine();
    e.reset({ vertical: 1, m: 0.2, k: 50, g: 9.81, x0: 0.02, v0: 0, b: 0, tEnd: 5 });
    const run = new EngineRunner(e, 1000);
    let f;
    for (let i = 0; i < 300; i++) f = run.frame(1 / 60, 1);
    if (!f || 'code' in f) throw new Error('frame');
    expect(f.stats.maxRelDrift).toBeLessThan(1e-12);
    const st = new Float64Array(5);
    e.readState(st);
    expect(st[SP.x]).toBeCloseTo(0.02 * Math.cos(Math.sqrt(50 / 0.2) * e.time()), 10);
  });

  it('numeric period agrees with 2π√(m/k)', () => {
    const q = springInput({ m: 0.25, k: 100, x0: 0.05, v0: 0, b: 0 });
    expect(numericPeriod(q)).toBeCloseTo(period(q), 9);
  });

  it('scene solutions agree with their checks', () => {
    for (const sc of [hookeSpring, springPendulum]) {
      const sol = sc.solve(sc.defaults, 'vi');
      expect(sol.answers.length).toBeGreaterThan(2);
      for (const a of sol.answers)
        if (a.check !== undefined) expect(a.check).toBeCloseTo(a.value, 8);
    }
  });
});

describe('damped spring: period only where there is an oscillation', () => {
  const base = { vertical: 0, m: 0.25, k: 100, x0: 0.05, v0: 0, l0: 0.3, g: 9.81 };
  const answer = (b: number, id: string) =>
    springPendulum.solve({ ...base, b }, 'en').answers.find((a) => a.id === id);

  it('underdamped (b = 8): reports the pseudo-period 2π/ω_d, cross-checked numerically', () => {
    // ω0 = 20, γ = 16 → ω_d = 12 rad/s, T_d = 2π/12 ≈ 0.5236 s (not 2π/20 ≈ 0.3142 s).
    const T = answer(8, 'period');
    expect(T?.value).toBeCloseTo((2 * Math.PI) / 12, 12);
    expect(T?.check).toBeDefined();
    expect(T?.check ?? 0).toBeCloseTo((2 * Math.PI) / 12, 8);
    expect(answer(8, 'frequency')?.value).toBeCloseTo(12 / (2 * Math.PI), 12);
    expect(numericPeriod(springInput({ ...base, b: 8 }))).toBeCloseTo((2 * Math.PI) / 12, 8);
  });

  it('overdamped (b = 15) and critical: no period or frequency, ω0 stays as the natural value', () => {
    for (const b of [15, 10]) {
      expect(answer(b, 'period')).toBeUndefined();
      expect(answer(b, 'frequency')).toBeUndefined();
      expect(answer(b, 'omega')?.value).toBeCloseTo(20, 12);
    }
  });

  it('undamped: period 2π/ω0 as before', () => {
    expect(answer(0, 'period')?.value).toBeCloseTo((2 * Math.PI) / 20, 12);
  });

  it('the Hooke default (light damping) reports the damped period', () => {
    const q = springInput(hookeSpring.defaults);
    const w0 = Math.sqrt(q.k / q.m);
    const gamma = q.b / (2 * q.m);
    const T = hookeSpring.solve(hookeSpring.defaults, 'en').answers.find((a) => a.id === 'period');
    expect(T?.value).toBeCloseTo((2 * Math.PI) / Math.sqrt(w0 * w0 - gamma * gamma), 12);
  });
});
