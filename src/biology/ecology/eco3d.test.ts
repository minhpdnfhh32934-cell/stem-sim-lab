import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneKit } from '../view3d/kit';
import { expectAllFreed, testKit } from '../view3d/testing';
import { logistic, lotkaVolterra } from './ecology';
import { figuresFor, logisticMoment, logisticPeak, lvMoment, lvPeaks, lvSampleAt } from './eco3d';
import { buildLogisticScene, buildLvScene } from './scenes3d';
import type { LogisticState } from './store';

const LOGI: LogisticState = { N0: 10, r: 0.5, K: 1000, tEnd: 30 };

/** Figures drawn by the scene's instanced meshes. */
function drawnFigures(kit: SceneKit): number[] {
  const out: number[] = [];
  kit.scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && o.visible) out.push(o.count);
  });
  return out;
}

describe('ecology 3D numbers', () => {
  it('the logistic peak is an end point of the run (the curve is monotone)', () => {
    expect(logisticPeak(LOGI)).toBeCloseTo(logistic(10, 0.5, 1000, 30), 9);
    const falling = { ...LOGI, N0: 1500 };
    expect(logisticPeak(falling)).toBe(1500);
  });

  it('one figure per individual when the tier can draw them all; else a fixed share, rounded', () => {
    expect(figuresFor(1000, 4000)).toEqual({ per: 1, capacity: 1000 });
    const big = figuresFor(9000, 1500);
    expect(big.per).toBe(6);
    expect(big.capacity).toBe(1500);
    // Every moment of a run uses the same share.
    const per = figuresFor(logisticPeak(LOGI), 300).per;
    for (const t of [0, 5, 10, 30]) {
      const m = logisticMoment(LOGI, t, per);
      expect(m.value).toBeCloseTo(logistic(10, 0.5, 1000, t), 9);
      expect(m.shown).toBe(Math.round(m.value / per));
    }
  });

  it('Lotka–Volterra numbers are computed trajectory points, never interpolated', () => {
    const p = { alpha: 1, beta: 0.1, delta: 0.075, gamma: 1.5 };
    const traj = lotkaVolterra(p, 10, 5, 30, 800);
    for (const t of [0, 0.01, 7.3, 29.99, 30, 40]) {
      const k = lvSampleAt(traj, t);
      const m = lvMoment(traj, k, { prey: 1, predators: 1 });
      expect(traj.t).toContain(m.t);
      expect(m.prey.value).toBe(traj.x[k]);
      expect(m.predators.value).toBe(traj.y[k]);
      // The nearest computed time.
      const dt = 30 / 800;
      expect(Math.abs(m.t - Math.min(30, Math.max(0, t)))).toBeLessThanOrEqual(dt / 2 + 1e-12);
    }
    const peaks = lvPeaks(traj);
    expect(peaks.prey).toBe(Math.max(...traj.x));
    expect(peaks.predators).toBe(Math.max(...traj.y));
  });
});

describe('ecology 3D scenes', () => {
  it('logistic: the habitat shows round(N(t)) figures at every moment; dispose frees all', () => {
    const { kit, track, start } = testKit();
    const { per, capacity } = figuresFor(logisticPeak(LOGI), 4000);
    const s = buildLogisticScene(kit, {
      st: LOGI,
      per,
      capacity,
      texts: { k: 'K = 1.000', half: 'K/2', title: 'N(t)' },
    });
    for (const t of [0, 5, 9.19, 20, 30]) {
      s.setTime?.(t);
      expect(drawnFigures(kit)).toEqual([Math.round(logistic(10, 0.5, 1000, t))]);
    }
    expectAllFreed(kit, track, start);
  });

  it('Lotka–Volterra: prey and predator figures follow the trajectory', () => {
    const { kit, track, start } = testKit();
    const traj = lotkaVolterra({ alpha: 1, beta: 0.1, delta: 0.075, gamma: 1.5 }, 10, 5, 30, 800);
    const peak = lvPeaks(traj);
    const prey = figuresFor(peak.prey, 2400);
    const pred = figuresFor(peak.predators, 1600);
    const s = buildLvScene(kit, {
      traj,
      per: { prey: prey.per, predators: pred.per },
      capacity: { prey: prey.capacity, predators: pred.capacity },
      peak,
      texts: { prey: 'x', predators: 'y', peakPrey: 'max', peakPredators: 'max' },
    });
    for (const t of [0, 3, 12.5, 30]) {
      s.setTime?.(t);
      const k = lvSampleAt(traj, t);
      expect(drawnFigures(kit)).toEqual(
        [Math.round(traj.x[k] ?? 0), Math.round(traj.y[k] ?? 0)].filter((n) => n > 0),
      );
    }
    expectAllFreed(kit, track, start);
  });
});
