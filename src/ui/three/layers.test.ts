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

  it('refracting glass on GLASS (never the AO layer); lights on every layer', () => {
    const scene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(1, 8, 6);
    const lens = new THREE.MeshPhysicalMaterial({ transmission: 0.9 });
    const glassMesh = new THREE.Mesh(geo, lens);
    // An explicit SHELL (the kit's shells) does not keep refracting glass off its layer.
    glassMesh.userData.layer = LAYER.SHELL;
    const light = new THREE.DirectionalLight();
    scene.add(glassMesh, light);
    assignLayers(scene);
    expect(glassMesh.layers.mask).toBe(1 << LAYER.GLASS);
    expect(glassMesh.layers.isEnabled(LAYER.OPAQUE)).toBe(false);
    for (const l of Object.values(LAYER)) expect(light.layers.isEnabled(l), String(l)).toBe(true);
    // Glass that stops refracting (the slow-frame guard) becomes a blended shell.
    lens.transmission = 0;
    lens.transparent = true;
    assignLayers(scene);
    expect(glassMesh.layers.mask).toBe(1 << LAYER.SHELL);
    geo.dispose();
    lens.dispose();
  });
});
