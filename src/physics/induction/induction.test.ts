import { describe, expect, it } from 'vitest';
import { sgkVl12 } from '../common/sources';
import { inductionCard } from './card';
import {
  averageEmf,
  effectiveEmf,
  emfAt,
  flux,
  fluxAt,
  integratedEmf,
  peakEmf,
  period,
  phase0,
  threePhaseAt,
  type Generator,
} from './model';
import { generatorOf, setInduction, useInductionStore } from './store';

const g: Generator = { N: 200, B: 0.1, S: 0.01, f: 50, alpha0: 0 };

describe('electromagnetic induction (VL12 Bài 16–17)', () => {
  it('Φ = BS cosα: largest when B⃗ is along n⃗, zero at 90°, negative past it (question tr. 66)', () => {
    expect(flux(0.1, 0.01, 0)).toBeCloseTo(1e-3, 15);
    expect(flux(0.1, 0.01, 90)).toBe(0);
    expect(flux(0.1, 0.01, 270)).toBe(0);
    expect(flux(0.1, 0.01, 180)).toBeCloseTo(-1e-3, 15);
    // 1 Wb = 1 T · 1 m² (tr. 66).
    expect(flux(1, 1, 0)).toBe(1);
  });

  it('e = −N ΔΦ/Δt: a growing flux gives a negative e.m.f. (Lenz)', () => {
    expect(averageEmf(200, 1e-3, 0, 0.1)).toBeCloseTo(2, 12);
    expect(averageEmf(200, 0, 1e-3, 0.1)).toBeCloseTo(-2, 12);
  });

  it('the generator: E₀ = NBSω, E = E₀/√2, T = 1/f, e = E₀cos(ωt + φ₀) with φ₀ = α₀ − π/2', () => {
    expect(peakEmf(g)).toBeCloseTo(200 * 0.1 * 0.01 * 100 * Math.PI, 12);
    expect(effectiveEmf(g) * Math.SQRT2).toBeCloseTo(peakEmf(g), 12);
    expect(period(g)).toBeCloseTo(0.02, 15);
    expect(phase0(g)).toBeCloseTo(-Math.PI / 2, 15);
    for (const t of [0, 0.003, 0.0117, 0.019]) {
      const w = 2 * Math.PI * g.f;
      expect(emfAt(g, t)).toBeCloseTo(peakEmf(g) * Math.cos(w * t + phase0(g)), 10);
    }
    // The coil is perpendicular to B⃗ (n⃗ along B⃗) when e = 0 and largest when Φ = 0 (question tr. 72).
    expect(emfAt(g, 0)).toBeCloseTo(0, 12);
    expect(fluxAt(g, 0)).toBeCloseTo(g.B * g.S, 15);
    expect(emfAt(g, 0.005)).toBeCloseTo(peakEmf(g), 10);
    expect(fluxAt(g, 0.005)).toBeCloseTo(0, 15);
  });

  it('Faraday checked independently: ∫e dt by DOPRI5 equals −N(Φ(t) − Φ(0))', () => {
    for (const alpha0 of [0, 30, 135]) {
      const h = { ...g, alpha0 };
      for (const t of [0.004, 0.013, 0.031]) {
        expect(integratedEmf(h, t)).toBeCloseTo(-h.N * (fluxAt(h, t) - fluxAt(h, 0)), 9);
      }
    }
  });

  it('three-phase (tr. 77): e₂, e₃ are e₁ shifted by ±2π/3; the three add up to zero', () => {
    for (const t of [0, 0.0031, 0.0142]) {
      const [e1, e2, e3] = threePhaseAt(g, t);
      expect(e1).toBeCloseTo(emfAt(g, t), 10);
      expect(e1 + e2 + e3).toBeCloseTo(0, 9);
      expect(e2).toBeCloseTo(emfAt(g, t + 1 / (3 * g.f)), 9);
    }
  });

  it('the store keeps the cursor inside two periods and whole turns', () => {
    setInduction({ t: 1, gN: 12.6, f: 100 });
    expect(useInductionStore.getState()).toMatchObject({ t: 0.02, gN: 13 });
    expect(generatorOf(useInductionStore.getState()).f).toBe(100);
    setInduction({ f: 50, gN: 200, t: 0 });
    expect(inductionCard().sources.map((s) => s.id)).toEqual(
      expect.arrayContaining([sgkVl12(16).id, sgkVl12(17).id]),
    );
  });
});
