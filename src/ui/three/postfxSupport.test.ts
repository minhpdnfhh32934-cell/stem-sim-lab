import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  PostFxGuard,
  SLOW_FRAMES,
  SLOW_FRAME_MS,
  disableTransmission,
  sceneWantsBloom,
} from './postfxSupport';

describe('post-processing support', () => {
  it('the guard asks for a step down after 30 consecutive animated frames over 20 ms', () => {
    const g = new PostFxGuard();
    let t = 0;
    const steps: number[] = [];
    for (let i = 1; i <= SLOW_FRAMES * 2 + 1; i++) {
      t += SLOW_FRAME_MS + 5;
      if (g.frame(t)) steps.push(i);
    }
    // The first frame has no predecessor; then 30 slow ones; the count starts again after a step.
    expect(steps).toEqual([SLOW_FRAMES + 1, 2 * SLOW_FRAMES + 1]);
  });

  it('fast frames, and single on-demand frames far apart, never count', () => {
    const g = new PostFxGuard();
    let t = 0;
    for (let i = 0; i < 100; i++) {
      t += 16;
      expect(g.frame(t)).toBe(false);
    }
    for (let i = 0; i < 100; i++) {
      t += 400;
      expect(g.frame(t)).toBe(false);
    }
    // Slow frames interrupted by a fast one start counting again.
    for (let i = 0; i < 29; i++) expect(g.frame((t += 30))).toBe(false);
    expect(g.frame((t += 10))).toBe(false);
    for (let i = 0; i < 29; i++) expect(g.frame((t += 30))).toBe(false);
  });

  it('bloom only for a visible mesh whose material is marked to glow', () => {
    const scene = new THREE.Scene();
    const geo = new THREE.BoxGeometry();
    const plain = new THREE.MeshStandardMaterial();
    const glow = new THREE.MeshStandardMaterial();
    glow.userData.bloom = true;
    const a = new THREE.Mesh(geo, plain);
    const b = new THREE.Mesh(geo, glow);
    scene.add(a);
    expect(sceneWantsBloom(scene)).toBe(false);
    const group = new THREE.Group();
    group.add(b);
    scene.add(group);
    expect(sceneWantsBloom(scene)).toBe(true);
    group.visible = false;
    expect(sceneWantsBloom(scene)).toBe(false);
    geo.dispose();
  });

  it('turning refraction off leaves the plain see-through look', () => {
    const scene = new THREE.Scene();
    const glassy = new THREE.MeshPhysicalMaterial({ transmission: 0.9, thickness: 0.2 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), glassy);
    scene.add(mesh);
    disableTransmission(scene);
    expect(glassy.transmission).toBe(0);
    expect(glassy.transparent).toBe(true);
    expect(glassy.opacity).toBeLessThanOrEqual(0.35);
    mesh.geometry.dispose();
  });
});
