import { describe, expect, it } from 'vitest';
import { dopri5 } from '@/core/ode/dopri5';
import { numericAmplitude, forcedLaw } from './check';
import { ResonanceEngine, RE } from './engine';
import { amplitudeAt, forced, resonance, stateAt, steady } from './model';
import { amplitudeCurve, forcedOscillation } from './scenes';

const base = forced({}); // m 0.5 kg, k 50 N/m (ω₀ = 10 rad/s), b 0.5 kg/s (γ = 0.5 1/s), F₀ 1 N, Ω 8

describe('forced damped oscillator (#54 item 9)', () => {
  it('steady amplitude and phase follow the closed form', () => {
    const { A, phi } = steady(base);
    expect(A).toBeCloseTo(2 / Math.hypot(100 - 64, 2 * 0.5 * 8), 12);
    expect(phi).toBeCloseTo(Math.atan2(8, 36), 12);
    // At Ω = ω₀ the lag is a quarter period.
    expect(steady({ ...base, W: 10 }).phi).toBeCloseTo(Math.PI / 2, 12);
  });

  it('starts from x₀, v₀ and agrees with DOPRI5 on the equation of motion', () => {
    for (const o of [base, { ...base, x0: 0.05, v0: -0.3 }, { ...base, b: 30, W: 3 }]) {
      const s0 = stateAt(o, 0);
      expect(s0.x).toBeCloseTo(o.x0, 12);
      expect(s0.v).toBeCloseTo(o.v0, 12);
      for (const t of [0.7, 3.1, 12.4]) {
        const r = dopri5(forcedLaw(o), [o.x0, o.v0], 0, t, { rtol: 1e-12, atol: 1e-14 });
        const s = stateAt(o, t);
        expect(Math.abs(s.x - (r.y[0] ?? 0))).toBeLessThan(1e-9);
        expect(Math.abs(s.v - (r.y[1] ?? 0))).toBeLessThan(1e-8);
        // a from Newton's law, the same as the state's.
        expect(s.a).toBeCloseTo((s.Fd - o.k * s.x - o.b * s.v) / o.m, 10);
      }
    }
  });

  it('the integrated motion settles on the steady amplitude', () => {
    const chk = numericAmplitude({ ...base, x0: 0.05 });
    expect(chk).not.toBeNull();
    expect(Math.abs((chk ?? 0) / steady(base).A - 1)).toBeLessThan(1e-6);
  });

  it('the check waits for an overdamped slow mode and for a large free part (#119)', () => {
    for (const o of [
      // γ ≈ 30 > ω₀ ≈ 9,9: the free part decays at ≈ 1,6 1/s, not at γ.
      { m: 0.15, k: 14.7, b: 9.05, F0: 0.84, W: 27.3, x0: -0.13, v0: 0 },
      // Ω ≪ ω₀ ≈ 19 and x₀ ≈ 50·A: the free part weighs ω₀/Ω more in x² + (v/Ω)².
      { m: 0.42, k: 155, b: 1.96, F0: 0.62, W: 1.6, x0: -0.19, v0: 0 },
    ])
      expect(Math.abs((numericAmplitude(o) ?? 0) / steady(o).A - 1)).toBeLessThan(1e-9);
  });

  it('resonance: the peak of A(Ω) is at √(ω₀² − 2γ²), none under strong damping', () => {
    const r = resonance(base);
    expect(r?.W).toBeCloseTo(Math.sqrt(100 - 0.5), 12);
    expect(r?.A).toBeCloseTo(amplitudeAt(base, r?.W ?? 0), 12);
    for (const d of [-0.05, 0.05])
      expect(amplitudeAt(base, (r?.W ?? 0) + d)).toBeLessThan(r?.A ?? 0);
    const strong = { ...base, b: 10 }; // γ = 10 > ω₀/√2
    expect(resonance(strong)).toBeNull();
    const curve = amplitudeCurve({ b: 10 });
    expect(curve.every(([, A], i) => i === 0 || A < (curve[i - 1]?.[1] ?? Infinity))).toBe(true);
  });

  it('the engine reads the closed form at t = n·Δt', () => {
    const e = new ResonanceEngine();
    e.reset({ x0: 0.05 });
    for (let i = 0; i < 480; i++) e.step();
    const out = new Float64Array(e.stateSize);
    e.readState(out);
    const s = stateAt({ ...base, x0: 0.05 }, e.time());
    expect(out[RE.x]).toBe(s.x);
    expect(out[RE.Fd]).toBe(s.Fd);
    expect(out[RE.F]).toBeCloseTo(-50 * s.x, 12);
  });

  it('the scene: needs damping; the solution carries the DOPRI5 check of A', () => {
    expect(forcedOscillation.validate?.({ ...forcedOscillation.defaults, b: 0 })).toHaveLength(1);
    const sol = forcedOscillation.solve(forcedOscillation.defaults, 'vi');
    const A = sol.answers.find((a) => a.id === 'A');
    expect(A?.value).toBeCloseTo(steady(base).A, 12);
    expect(Math.abs((A?.check ?? 0) / (A?.value ?? 1) - 1)).toBeLessThan(1e-6);
    expect(sol.answers.map((a) => a.id)).toContain('omegaR');
  });
});
