import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { averageEmf, emfAt, flux, fluxAt } from './model';
import { buildInductionScene } from './scene3d';
import { induction3d } from './induction3d';
import { generatorOf, useInductionStore, type InductionState } from './store';

const base = (): InductionState => ({ ...useInductionStore.getState() });
const texts = { B: 'B', north: 'N', south: 'S', now: { n: 'n', phi: 'Φ' } };

describe('induction 3D binding', () => {
  it('flux tab: the normals’ x share times BS is the model’s flux; the mean e.m.f. is −NΔΦ/Δt', () => {
    for (const [a1, a2] of [
      [0, 90],
      [30, 150],
      [90, 270],
      [45, 360],
    ] as const) {
      const s = { ...base(), tab: 'flux' as const, alpha1: a1, alpha2: a2, B1: 0.1, B2: 0.2 };
      const m = induction3d(s);
      expect(m.before?.phi).toBe(flux(0.1, s.S, a1));
      expect(m.now.phi).toBe(flux(0.2, s.S, a2));
      expect((m.before?.normal[0] ?? NaN) * 0.1 * s.S).toBeCloseTo(flux(0.1, s.S, a1), 15);
      expect(m.now.normal[0] * 0.2 * s.S).toBeCloseTo(flux(0.2, s.S, a2), 15);
      expect(m.emf).toBe(averageEmf(s.N, m.before?.phi ?? NaN, m.now.phi, s.dt));
      expect(Math.hypot(...m.now.normal)).toBeCloseTo(1, 15);
    }
  });

  it('generator tab: the coil turns at ω, Φ(t) and e(t) are the model’s', () => {
    const s0 = { ...base(), tab: 'generator' as const, alpha0: 30 };
    const g = generatorOf(s0);
    for (const t of [0, 0.0025, 0.005, 0.0137, 0.04]) {
      const m = induction3d({ ...s0, t });
      expect(m.now.phi).toBe(fluxAt(g, t));
      expect(m.emf).toBe(emfAt(g, t));
      expect(m.now.normal[0] * g.B * g.S).toBeCloseTo(fluxAt(g, t), 14);
      expect(m.before).toBeNull();
    }
  });
});

describe('induction 3D scene', () => {
  it('turns the drawn coil to the model’s normal and frees all', () => {
    const { kit, track, start } = testKit();
    const s = { ...base(), tab: 'generator' as const, alpha0: 0, t: 0.0025 };
    const model = induction3d(s);
    const scene = buildInductionScene(kit, { model, texts });
    const drawn = scene.state().coilNormal;
    model.now.normal.forEach((v, i) => {
      expect(drawn[i]).toBeCloseTo(v, 12);
    });
    expect(kit.scene.getObjectByName('ind-coil-before')).toBeUndefined();
    expectAllFreed(kit, track, start);
  });

  it('flux tab: a ghost coil before the change', () => {
    const { kit, track, start } = testKit();
    const model = induction3d({ ...base(), tab: 'flux' });
    buildInductionScene(kit, {
      model,
      texts: { ...texts, before: { n: 'n₁', phi: 'Φ₁' } },
    });
    expect(kit.scene.getObjectByName('ind-coil-before')).toBeDefined();
    expectAllFreed(kit, track, start);
  });
});
