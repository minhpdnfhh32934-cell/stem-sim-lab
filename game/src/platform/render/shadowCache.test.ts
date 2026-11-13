import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShadowCache } from './shadowCache';

/** A spot 3 m up over the origin, its cone ~2.7 m wide at the floor; a box under it, one far off. */
function room() {
  const scene = new THREE.Scene();
  const light = new THREE.SpotLight('#ffffff', 5, 6, Math.PI / 5);
  light.castShadow = true;
  light.position.set(0, 3, 0);
  light.target.position.set(0, 0, 0);
  scene.add(light, light.target);
  const box = () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshBasicMaterial(),
    );
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const near = box();
  const far = box();
  far.position.set(20, 0, 0);
  const cache = new ShadowCache([light]);
  /** One frame as three draws it: matrices, the cache, then the shadow pass if asked. */
  const frame = (): boolean => {
    scene.updateMatrixWorld();
    cache.update(scene);
    const drawn = light.shadow.needsUpdate;
    if (drawn) {
      light.shadow.updateMatrices(light);
      light.shadow.needsUpdate = false;
    }
    return drawn;
  };
  return { scene, light, near, far, cache, frame };
}

describe('ShadowCache', () => {
  it('draws a map once, then only when something it shows changes', () => {
    const { near, far, frame, cache } = room();
    expect(frame()).toBe(true);
    expect(frame()).toBe(false);
    expect(frame()).toBe(false);
    far.position.x = 21; // outside the light's cone, before and after
    expect(frame()).toBe(false);
    near.position.x = 0.3;
    expect(frame()).toBe(true);
    expect(frame()).toBe(false);
    far.position.set(0.5, 0, 0); // into the cone
    expect(frame()).toBe(true);
    far.position.set(20, 0, 0); // and out again: where it was is drawn without it
    expect(frame()).toBe(true);
    expect(cache.mapsDrawn).toBe(4);
  });

  it('a caster hidden, removed, added, reshaped or re-materialed draws the map', () => {
    const { scene, near, frame } = room();
    frame();
    near.visible = false;
    expect(frame()).toBe(true);
    near.visible = true;
    expect(frame()).toBe(true);
    near.castShadow = false;
    expect(frame()).toBe(true);
    expect(frame()).toBe(false);
    near.castShadow = true;
    expect(frame()).toBe(true);
    const position = near.geometry.getAttribute('position') as THREE.BufferAttribute;
    position.setY(0, 0.5);
    position.needsUpdate = true;
    expect(frame()).toBe(true);
    near.material = new THREE.MeshBasicMaterial();
    expect(frame()).toBe(true);
    scene.remove(near);
    expect(frame()).toBe(true);
    expect(frame()).toBe(false);
  });

  it('a skinned mesh draws the map when its bones move, not when they stand still', () => {
    const { scene, frame } = room();
    const root = new THREE.Bone();
    const arm = new THREE.Bone();
    arm.position.y = 0.5;
    root.add(arm);
    const geometry = new THREE.BoxGeometry(0.2, 1, 0.2);
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute(
      'skinIndex',
      new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4),
    );
    geometry.setAttribute(
      'skinWeight',
      new THREE.Float32BufferAttribute(new Float32Array(count * 4).fill(0.25), 4),
    );
    const body = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
    body.castShadow = true;
    body.add(root);
    body.bind(new THREE.Skeleton([root, arm]));
    scene.add(body);
    expect(frame()).toBe(true);
    expect(frame()).toBe(false);
    arm.rotation.z = 0.4;
    expect(frame()).toBe(true);
    expect(frame()).toBe(false);
  });

  it('a light that moves, grows its map or goes dark and lit again draws its map', () => {
    const { light, near, frame } = room();
    frame();
    light.position.x = 0.5;
    expect(frame()).toBe(true);
    light.shadow.mapSize.set(2048, 2048);
    expect(frame()).toBe(true);
    light.intensity = 0;
    expect(frame()).toBe(true); // drawn once more as it goes dark (as RoomLightPool.assign asks)
    near.position.x = 0.2;
    expect(frame()).toBe(false); // dark: adds no light, its casters do not draw it
    light.intensity = 5;
    expect(frame()).toBe(true);
  });

  it('Medium: a moving caster draws its map at most 30 times a second, its last place never left out', () => {
    const { near, light, cache, scene } = room();
    cache.minInterval = 1 / 30;
    let drawn = 0;
    /** A frame at time `t` (s): the cache, then the shadow pass if asked. */
    const at = (t: number) => {
      scene.updateMatrixWorld();
      cache.update(scene, t);
      if (!light.shadow.needsUpdate) return false;
      light.shadow.needsUpdate = false;
      drawn++;
      return true;
    };
    expect(at(0)).toBe(true);
    // Moving every frame at 120 fps for half a second: 15 or 16 maps, not 60.
    for (let f = 1; f <= 60; f++) {
      near.position.x = f * 0.001;
      at(f / 120);
    }
    expect(drawn - 1).toBeGreaterThanOrEqual(15);
    expect(drawn - 1).toBeLessThanOrEqual(16);
    // It stops between two draws: the map still drawn once its time is up, where it stopped.
    near.position.x = 0.5;
    const t = 60 / 120;
    const first = at(t + 1 / 120);
    const later = [2, 3, 4, 5].map((k) => at(t + k / 120));
    expect([first, ...later].filter(Boolean)).toHaveLength(1);
    expect(at(t + 1)).toBe(false); // and nothing after
    // A warm-up's draw over the maps: drawn at once, whatever the interval.
    cache.invalidate();
    expect(at(t + 1 + 1 / 120)).toBe(true);
    // The light itself moved (its slot given another room's light) a frame later: at once too.
    light.position.x = 1;
    expect(at(t + 1 + 2 / 120)).toBe(true);
  });

  it('invalidate draws every lit map again (a warm-up draw wrote over them)', () => {
    const { frame, cache } = room();
    frame();
    cache.invalidate();
    expect(frame()).toBe(true);
    expect(frame()).toBe(false);
  });
});
