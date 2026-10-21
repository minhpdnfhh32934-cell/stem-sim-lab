import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneKit } from '../view3d/kit';
import { expectAllFreed, testKit } from '../view3d/testing';
import { lotkaVolterra } from './ecology';
import { figuresFor, lvMoment, lvPeaks, lvSampleAt } from './eco3d';
import { buildLvScene } from './scenes3d';

/** Figures drawn by the scene's instanced meshes. */
function drawnFigures(kit: SceneKit): number[] {
  const out: number[] = [];
  kit.scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && o.visible) out.push(o.count);
  });
  return out;
}

describe('Lotka–Volterra 3D numbers', () => {
  it('one figure per individual when the tier can draw them all; else a fixed share, rounded', () => {
    expect(figuresFor(1000, 4000)).toEqual({ per: 1, capacity: 1000 });
    const big = figuresFor(9000, 1500);
    expect(big.per).toBe(6);
    expect(big.capacity).toBe(1500);
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

describe('Lotka–Volterra 3D scene', () => {
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
