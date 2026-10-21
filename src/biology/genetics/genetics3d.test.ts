import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { SceneKit } from '../view3d/kit';
import { expectAllFreed, testKit } from '../view3d/testing';
import { driftAt, fateOf } from './genetics3d';
import { wrightFisher } from './population';
import { buildDriftScene } from './scenes3d';
import { rng } from './stats';

const instancedCounts = (kit: SceneKit) => {
  const out: number[] = [];
  kit.scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) out.push(o.visible ? o.count : 0);
  });
  return out;
};

describe('genetics 3D numbers', () => {
  it('fate and frequencies come straight from the runs', () => {
    expect(fateOf([0.5, 0.7, 1])).toBe('fixed');
    expect(fateOf([0.5, 0.2, 0])).toBe('lost');
    expect(fateOf([0.5, 0.4])).toBe('polymorphic');
    const runs = [
      [0.5, 0.6, 1, 1],
      [0.5, 0.3, 0, 0],
      [0.5, 0.5, 0.4, 0.45],
    ];
    expect(driftAt(runs, 2)).toEqual({ p: [1, 0, 0.4], fixed: 1, lost: 1 });
    expect(driftAt(runs, 99).p).toEqual([1, 0, 0.45]);
  });
});

describe('genetics 3D scenes', () => {
  it('drift: every tube holds 2N copies, the A beads are the run’s count at each generation', () => {
    const { kit, track, start } = testKit();
    const N = 20;
    const rand = rng(3);
    const runs = Array.from({ length: 6 }, () => wrightFisher(N, 0.5, 60, rand));
    const s = buildDriftScene(kit, { runs, copies: 2 * N, per: 1, texts: { tube: String } });
    for (const g of [0, 10, 37, 60]) {
      s.setTime?.(g);
      const [a = 0, b = 0] = instancedCounts(kit);
      const expectedA = runs.reduce((sum, r) => sum + Math.round((r[g] ?? 0) * 2 * N), 0);
      expect(a).toBe(expectedA);
      expect(a + b).toBe(runs.length * 2 * N);
    }
    expectAllFreed(kit, track, start);
  });
});
