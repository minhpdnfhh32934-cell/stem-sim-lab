import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { rng } from '../genetics/stats';
import { expectAllFreed, testKit } from '../view3d/testing';
import { initialParticles, leftCount, poreIntervals, stepParticles3d } from './particles3d';
import { buildDiffusionScene, buildOsmosisScene } from './scene3d';
import { osmosisEquilibrium, osmosisTrajectory } from './transport';

describe('3D diffusion particles (illustration)', () => {
  it('stay in the box and cross the membrane only through a slot', () => {
    const rand = rng(3);
    const pores = poreIntervals(3);
    const p = initialParticles(200, rand);
    for (let step = 0; step < 400; step++) {
      const before = Float32Array.from(p);
      stepParticles3d(p, pores, rand);
      for (let i = 0; i < p.length; i += 3) {
        const [x, y, z] = [p[i] ?? 0, p[i + 1] ?? 0, p[i + 2] ?? 0];
        expect(x >= 0 && x <= 2 && y >= 0 && y <= 1 && z >= 0 && z <= 1).toBe(true);
        const x0 = before[i] ?? 0;
        if ((x0 - 1) * (x - 1) < 0) {
          const y0 = before[i + 1] ?? 0;
          const yc = y0 + ((1 - x0) / (x - x0)) * (y - y0);
          expect(pores.some(([a, b]) => yc >= a && yc <= b)).toBe(true);
        }
      }
    }
    // Some particles did cross (pores are open) …
    expect(leftCount(p)).toBeLessThan(200);
    // … and with no pore none can.
    const closed = initialParticles(100, rng(4));
    const r = rng(5);
    for (let step = 0; step < 300; step++) stepParticles3d(closed, [], r);
    const left0 = leftCount(initialParticles(100, rng(4)));
    expect(leftCount(closed)).toBe(left0);
  });

  it('the scenes build, count each side on the page and free everything', () => {
    const { kit, track, start } = testKit();
    const s = buildDiffusionScene(kit, {
      particles: 60,
      pores: 4,
      run: 0,
      sideText: (side, n) => `${String(side)}:${String(n)}`,
    });
    for (let k = 0; k < 30; k++) s.tick?.(1 / 60);
    const labels: string[] = [];
    kit.scene.traverse((o) => {
      const el = (o as { element?: HTMLElement }).element;
      if (el) labels.push(el.textContent);
    });
    const counts = labels.map((t) => Number(t.split(':')[1]));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(60);
    expectAllFreed(kit, track, start);
  });

  it('osmosis: the liquid columns are the model’s heights at each moment', () => {
    const { kit, track, start } = testKit();
    const p = { c0: 1, i: 1, T: 298.15, h0: 0.2, rho: 1000, g: 9.80665, lp: 5e-6 };
    const eq = osmosisEquilibrium(p);
    const traj = osmosisTrajectory(p, 40, 240);
    const s = buildOsmosisScene(kit, {
      h0: p.h0,
      hEq: eq.hL,
      traj,
      tEnd: 40,
      texts: { solution: 'S', water: 'W', membrane: 'M', dh: (cm) => `Δh=${cm.toFixed(3)}` },
    });
    s.setTime?.(40);
    let dh = '';
    kit.scene.traverse((o) => {
      const el = (o as { element?: HTMLElement }).element;
      if (el?.textContent.startsWith('Δh')) dh = el.textContent;
    });
    const hL = traj.hL[traj.hL.length - 1] ?? 0;
    expect(dh).toBe(`Δh=${((hL - (2 * p.h0 - hL)) * 100).toFixed(3)}`);
    expect(kit.scene.children.some((o) => o instanceof THREE.Mesh)).toBe(true);
    expectAllFreed(kit, track, start);
  });
});
