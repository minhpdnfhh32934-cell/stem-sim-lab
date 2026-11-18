import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { orbitalById, psi, radiusContaining } from './hydrogen';
import { sampleCloud } from './orbital3d';
import { buildOrbitalScene } from './orbitalScene3d';

const r = (c: ReturnType<typeof sampleCloud>, i: number) =>
  Math.hypot(c.points[3 * i] ?? 0, c.points[3 * i + 1] ?? 0, c.points[3 * i + 2] ?? 0);

describe('orbital 3D cloud', () => {
  it('follows |ψ|²: about 90 % of the points inside the radius holding 90 % (1s, 2p_z, 3d_z²)', () => {
    for (const [n, id] of [
      [1, 's'],
      [2, 'pz'],
      [3, 'dz2'],
    ] as const) {
      const o = orbitalById(id);
      const c = sampleCloud(n, o, 4000);
      expect(c.count).toBe(4000);
      const r90 = radiusContaining(n, o.l, 0.9);
      let inside = 0;
      for (let i = 0; i < c.count; i++) if (r(c, i) <= r90) inside++;
      // 4000 draws: the share's standard error is 0,005; the cube holds 99 % of the probability.
      expect(Math.abs(inside / c.count - 0.9 / 0.99)).toBeLessThan(0.025);
    }
  });

  it('2p_z: a nodal plane z = 0, ψ > 0 above it and < 0 below; each point keeps the sign of ψ', () => {
    const o = orbitalById('pz');
    const c = sampleCloud(2, o, 4000);
    let near = 0;
    for (let i = 0; i < c.count; i++) {
      const [x, y, z] = [c.points[3 * i] ?? 0, c.points[3 * i + 1] ?? 0, c.points[3 * i + 2] ?? 0];
      expect(c.signs[i]).toBe(psi(2, o, x, y, z) >= 0 ? 1 : -1);
      expect(c.signs[i]).toBe(z >= 0 ? 1 : -1);
      if (Math.abs(z) < 0.02 * c.extent) near++;
    }
    expect(near / c.count).toBeLessThan(0.01);
  });

  it('the same orbital always gives the same picture', () => {
    const o = orbitalById('dxy');
    expect(sampleCloud(3, o, 500).points).toEqual(sampleCloud(3, o, 500).points);
  });
});

describe('orbital 3D scene', () => {
  it('one draw call for the cloud; frees all', () => {
    const { kit, track, start } = testKit();
    const s = buildOrbitalScene(kit, {
      cloud: sampleCloud(2, orbitalById('pz'), 2000),
      mode: 'psi',
    }).state();
    expect(s.points).toBe(2000);
    expect(s.positive).toBeGreaterThan(900);
    expect(s.positive).toBeLessThan(1100);
    expect(kit.scene.getObjectByName('orbital-cloud')).toBeDefined();
    expectAllFreed(kit, track, start);
  });
});
