import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { TABLE_21_1 } from './data';
import { randomDecay, remaining } from './decayModel';
import { SAMPLE, STEPS, decayOrder, lawLeft, nucleus3d, randomRun } from './nuclear3d';
import { radius } from './nucleusModel';
import { buildDecayScene, buildNucleusScene } from './scene3d';

describe('nucleus 3D binding', () => {
  it('every nucleus of Bảng 21.1: A nucleons, exactly Z protons, the model’s radius', () => {
    for (const row of TABLE_21_1) {
      const n = nucleus3d(row.Z, row.A);
      expect(n.at).toHaveLength(row.A);
      expect(n.proton.filter(Boolean)).toHaveLength(row.Z);
      expect(n.R).toBe(radius(row.A));
      // Every nucleon inside the ball.
      for (const p of n.at) expect(Math.hypot(...p) + n.r).toBeLessThanOrEqual(n.R * (1 + 1e-12));
    }
    // R ∝ A^(1/3) with nucleons of one size: the same density for every nucleus.
    const r = TABLE_21_1.map((row) => nucleus3d(row.Z, row.A).r);
    for (const x of r) expect(x).toBeCloseTo(r[0] ?? NaN, 25);
  });
});

describe('decay 3D binding', () => {
  it('the law: round(200·2^(−t/T)) left; the random run is the 2D picture’s', () => {
    expect(lawLeft(0, 55)).toBe(SAMPLE);
    expect(lawLeft(110, 55)).toBe(50);
    expect(lawLeft(37, 55)).toBe(Math.round(SAMPLE * remaining(37, 55)));
    expect(randomRun(55, 23)).toEqual(randomDecay(200, 55, (5 * 55) / 50, 50, 23));
    expect(new Set(decayOrder(23)).size).toBe(SAMPLE);
  });
});

describe('nuclear 3D scenes', () => {
  it('the nucleus: Z protons and A − Z neutrons drawn; frees all', () => {
    const { kit, track, start } = testKit();
    const s = buildNucleusScene(kit, {
      nucleus: nucleus3d(79, 197),
      reference: { R: radius(238), text: 'U' },
      texts: ['Au'],
    }).state();
    expect(s).toMatchObject({ protons: 79, neutrons: 118 });
    expectAllFreed(kit, track, start);
  });

  it('the random run steps through the 2D picture’s counts; frees all', () => {
    const { kit, track, start } = testKit();
    const run = randomRun(55, 23);
    const scene = buildDecayScene(kit, { seed: 23, left: run, text: () => '' });
    expect(scene.state()).toEqual({ left: SAMPLE, step: 0 });
    for (let i = 0; i < 26; i++) scene.tick?.(0.1);
    // 2,6 s at 0,2 s a step: step 13.
    expect(scene.state()).toEqual({ left: run[13], step: 13 });
    const still = buildDecayScene(kit, { seed: 23, left: run, text: () => '', still: true });
    expect(still.state()).toEqual({ left: run[STEPS], step: STEPS });
    expectAllFreed(kit, track, start);
  });
});
