import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EffectsPass } from './effectsPass';
import { Finishes } from './finishes';
import { GLASSWARE_LOOK } from './looks';
import { Particles } from './particles';
import { QUALITY } from './quality';

const still = { opacity: 1, grow: 0, lift: 0, drag: 0 };
const materialOf = (pool: Particles) => pool.points.material as THREE.ShaderMaterial;

describe("Max's see-through pass (effectsPass.ts)", () => {
  it('makes every pool soft and premultiplied while it lives, and gives them back', () => {
    const smoke = new Particles(4, '#888888', false, still);
    const flame = new Particles(4, '#ffaa00', true, still);
    const finishes = new Finishes(QUALITY.ultra);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial(GLASSWARE_LOOK),
    );
    finishes.adopt(glass);
    expect([...finishes.glassMeshes()]).toEqual([glass]);
    const depth = new THREE.DepthTexture(64, 32);
    const pass = new EffectsPass(
      new THREE.PerspectiveCamera(60, 2, 0.05, 200),
      depth,
      { glass: finishes.glassMeshes, showGlass: finishes.showGlass, stirred: () => [] },
      64,
      32,
    );
    for (const pool of [smoke, flame]) {
      const m = materialOf(pool);
      expect(m.defines).toHaveProperty('SOFT');
      expect(m.uniforms.tSceneDepth?.value).toBe(depth);
      expect(m.uniforms.uPointScale?.value).toBe(0.5); // drawn at half the resolution
      expect(m.blending).toBe(THREE.CustomBlending);
      expect(m.blendSrc).toBe(THREE.OneFactor);
    }
    // Smoke laid over (premultiplied), flames added; only flames are ADD.
    expect(materialOf(smoke).blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(materialOf(flame).blendDst).toBe(THREE.OneFactor);
    expect(materialOf(flame).defines).toHaveProperty('ADD');
    expect(materialOf(smoke).defines).not.toHaveProperty('ADD');
    // A pool made while the pass lives starts soft.
    const late = new Particles(4, '#ffffff', false, still);
    expect(materialOf(late).defines).toHaveProperty('SOFT');

    pass.hide(); // the world pass draws neither
    expect((glass.material as THREE.Material).visible).toBe(false);
    for (const pool of [smoke, flame, late]) expect(materialOf(pool).visible).toBe(false);

    pass.dispose(); // Ultra again: each drawn as before
    expect((glass.material as THREE.Material).visible).toBe(true);
    for (const pool of [smoke, flame, late]) {
      const m = materialOf(pool);
      expect(m.visible).toBe(true);
      expect(m.defines).not.toHaveProperty('SOFT');
      expect(m.uniforms.uPointScale?.value).toBe(1);
    }
    expect(materialOf(smoke).blending).toBe(THREE.NormalBlending);
    expect(materialOf(flame).blending).toBe(THREE.AdditiveBlending);
    for (const pool of [smoke, flame, late]) pool.dispose();
    finishes.dispose();
  });
});
