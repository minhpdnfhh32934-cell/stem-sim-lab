import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { interferenceView } from './draw';
import { IF, InterferenceEngine, interferenceInput, sourcesOf } from './engine';
import { MIN_PER_LAMBDA, heightAt, surfaceGrid } from './interference3d';
import { amplitudeAt } from './model';
import { interference } from './scenes';
import { buildInterferenceScene } from './scene3d';

const p = { ...interference.defaults };
const q = interferenceInput(p);
const [s1, s2] = sourcesOf(q);

describe('interference 3D binding', () => {
  it('the height at M is the engine’s displacement u(M)/(2a) at every moment', () => {
    const engine = new InterferenceEngine();
    engine.reset(p);
    const state = new Float64Array(engine.stateSize);
    const m = q.m;
    if (!m) throw new Error('no M');
    for (let i = 0; i < 200; i++) {
      engine.step();
      engine.readState(state);
      const t = state[IF.t] ?? NaN;
      expect(heightAt(s1, s2, m.x, m.y, t)).toBeCloseTo((state[IF.u] ?? NaN) / (2 * q.a), 12);
    }
  });

  it('on S₁S₂ maxima stand still at the amplitude 2a|cos(πΔr/λ)| of the model', () => {
    for (const x of [-0.03, -0.015, 0, 0.0075, 0.02]) {
      const dr = Math.abs(x - s2.x) - Math.abs(x - s1.x);
      const amp = amplitudeAt(q.a, dr, q.lambda1) / (2 * q.a);
      let peak = 0;
      for (let k = 0; k < 400; k++)
        peak = Math.max(peak, Math.abs(heightAt(s1, s2, x, 0, (k / 400) * (1 / q.f1))));
      expect(peak).toBeCloseTo(amp, 3);
    }
  });

  it('never fewer than 4 grid points per wavelength; too fine a wave draws no surface', () => {
    const v = interferenceView(p);
    const g = surfaceGrid(v, q.lambda1, 200);
    if (!g) throw new Error('no grid');
    expect(q.lambda1 / g.step).toBeGreaterThanOrEqual(MIN_PER_LAMBDA);
    expect(g.nx * g.step).toBeGreaterThanOrEqual(v.xMax - v.xMin);
    expect(surfaceGrid(v, q.lambda1 / 100, 200)).toBeNull();
  });
});

describe('interference 3D scene', () => {
  it('moves the surface to the engine’s time without rebuilding; frees all', () => {
    const { kit, track, start } = testKit();
    let state: Float64Array | null = null;
    const scene = buildInterferenceScene(kit, {
      sources: [s1, s2],
      view: interferenceView(p),
      lambdaMin: q.lambda1,
      m: q.m,
      texts: { S1: 'S₁', S2: 'S₂', M: 'M' },
      read: () => state,
    });
    expect(scene.state().grid).not.toBeNull();
    state = new Float64Array(5);
    state[IF.t] = 0.0371;
    scene.tick?.(1 / 60);
    const m = q.m;
    if (!m) throw new Error('no M');
    expect(scene.state().t).toBe(0.0371);
    expect(scene.state().hM).toBeCloseTo(heightAt(s1, s2, m.x, m.y, 0.0371), 15);
    expectAllFreed(kit, track, start);
  });
});
