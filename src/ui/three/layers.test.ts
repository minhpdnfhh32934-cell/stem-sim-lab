import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LAYER, assignLayers } from './layers';
import { contactShadow } from './lighting';
import { glass, solid } from './materials';

describe('render layers', () => {
  it('transparent shells on SHELL, haze on FX, the rest opaque; picking sees every layer', () => {
    const scene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(1, 8, 6);
    const shell = new THREE.Mesh(geo, glass('#16804a', { opacity: 0.2 }));
    const body = new THREE.Mesh(geo, solid('#0072b2', 'medium'));
    const shadow = contactShadow(-1, 1, 1);
    const multi = new THREE.Mesh(geo, [
      solid('#0072b2', 'medium'),
      glass('#fff', { opacity: 0.3 }),
    ]);
    scene.add(shell, body, shadow.mesh, multi);
    assignLayers(scene);
    expect(shell.layers.mask).toBe(1 << LAYER.SHELL);
    expect(body.layers.mask).toBe(1 << LAYER.OPAQUE);
    expect(shadow.mesh.layers.mask).toBe(1 << LAYER.FX);
    expect(multi.layers.mask).toBe(1 << LAYER.SHELL);

    // Every transparent material's mesh is off the opaque layer (the AO pass skips it).
    scene.traverse((o) => {
      const m = (o as Partial<THREE.Mesh>).material;
      if (m && !Array.isArray(m) && m.transparent) {
        expect(o.layers.isEnabled(LAYER.OPAQUE)).toBe(false);
      }
    });

    // A camera that sees all layers draws them; a ray that tests all layers hits the shell.
    const cam = new THREE.PerspectiveCamera();
    cam.layers.enableAll();
    expect(shell.layers.test(cam.layers)).toBe(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(shell).length).toBe(0);
    ray.layers.enableAll();
    expect(ray.intersectObject(shell).length).toBeGreaterThan(0);

    // A material that becomes see-through moves on the next pass.
    (body.material as THREE.Material).transparent = true;
    assignLayers(scene);
    expect(body.layers.mask).toBe(1 << LAYER.SHELL);
    geo.dispose();
    shadow.dispose();
  });
});
