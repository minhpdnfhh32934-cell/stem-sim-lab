import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { hasWebGL2 } from '@/perf/benchmark';
import { createPostFx } from './postfx';

// Needs a real WebGL 2 context (a browser test runner); jsdom skips it. The chain's wiring is
// tested without a GPU in postfx.test.ts.
describe.skipIf(!hasWebGL2())('post-processing chain on a real GPU', () => {
  it('draws a frame and frees its render targets', () => {
    const renderer = new THREE.WebGLRenderer();
    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 10);
    camera.position.z = 3;
    const before = renderer.info.memory.textures;
    const fx = createPostFx(renderer, scene, camera, {
      width: 64,
      height: 64,
      pixelRatio: 1,
      theme: 'light',
      samples: 4,
    });
    fx.setHighlight(true);
    fx.render();
    fx.dispose();
    expect(renderer.info.memory.textures).toBeLessThanOrEqual(before + 1);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  });
});
