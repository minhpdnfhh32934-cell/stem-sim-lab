import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { PARTICLES, gas3d } from './gas3d';
import { moles } from './model';
import { COLUMN, RADIUS, buildGasScene } from './scene3d';
import { statesOf, useGasStore } from './store';

const { s1, s2 } = statesOf(useGasStore.getState());

describe('ideal gas 3D binding', () => {
  it('the worked example of Bài 11: columns ∝ V, pushes ∝ p, speeds ∝ √T; the same gas', () => {
    if (!s2) throw new Error('no state 2');
    // 100 cm³, 27 °C, 10⁵ Pa → 20 cm³, 39 °C: p₂ = 5,2·10⁵ Pa (tr. 45–46).
    expect(s2.p).toBeCloseTo(5.2e5, 6);
    const [a, b] = gas3d(s1, s2);
    if (!a || !b) throw new Error('two cylinders');
    expect(b.height / a.height).toBeCloseTo(s2.V / s1.V, 12);
    expect(b.push / a.push).toBeCloseTo(s2.p / s1.p, 12);
    expect(b.speed / a.speed).toBeCloseTo(Math.sqrt(s2.T / s1.T), 12);
    expect(moles(s2)).toBeCloseTo(moles(s1), 15);
    expect(gas3d(s1, null)).toHaveLength(1);
  });
});

describe('ideal gas 3D scene', () => {
  it('the same particles in both, kept inside the column while they move; frees all', () => {
    if (!s2) throw new Error('no state 2');
    const { kit, track, start } = testKit();
    const cylinders = gas3d(s1, s2);
    const scene = buildGasScene(kit, { cylinders, texts: [['1'], ['2']] });
    for (let i = 0; i < 400; i++) scene.tick?.(1 / 60);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    cylinders.forEach((c, i) => {
      const parts = kit.scene.getObjectByName(`gas-parts-${String(i + 1)}`) as THREE.InstancedMesh;
      expect(parts.count).toBe(PARTICLES);
      const cx = (i - 0.5) * 2.2;
      for (let k = 0; k < PARTICLES; k++) {
        parts.getMatrixAt(k, m);
        p.setFromMatrixPosition(m);
        expect(Math.hypot(p.x - cx, p.z)).toBeLessThanOrEqual(0.9 * RADIUS + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(0.03 - 1e-6);
        expect(p.y).toBeLessThanOrEqual(COLUMN * c.height - 0.03 + 1e-6);
      }
    });
    // Speeds keep their √T ratio (bounces change directions only).
    const s = scene.state().speeds;
    expect((s[1] ?? 0) / (s[0] ?? 1)).toBeCloseTo(Math.sqrt(s2.T / s1.T), 6);
    expectAllFreed(kit, track, start);
  });
});
