import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { rigLight } from '@/ui/three/lighting';
import { SceneKit } from '../kit';
import { habitat } from './habitat';
import { instancedTokens } from './instancedTokens';

const TOKENS: Record<string, string> = {
  '--bio3d-grass': '#b5ccb0',
  '--bio3d-grass-2': '#c1ceb6',
  '--bio3d-soil': '#816f62',
  '--bio3d-rock': '#c8cdd3',
  '--bio3d-sky-top': '#dbe7f3',
  '--bio3d-sky-horizon': '#f3f6f9',
  '--chart-2': '#e69f00',
  '--chart-6': '#56b4e9',
  '--bg-stage': '#fbfcfe',
};
const kitWith = (o: { shadows?: boolean } = {}) =>
  new SceneKit({
    tier: 'high',
    segments: 24,
    maxParticles: 10000,
    token: (n) => TOKENS[n] ?? '',
    look: 'outdoor',
    shadows: o.shadows ?? false,
  });

describe('habitat primitive', () => {
  it('terrain + outdoor rig + fog towards the horizon; shadows only when the tier allows', () => {
    const kit = kitWith();
    expect(kit.rig.userData.preset).toBe('outdoor');
    const h = habitat(kit, { radius: 10, seed: 4 });
    expect(h.ground.receiveShadow).toBe(false);
    expect(kit.scene.fog).toBeInstanceOf(THREE.Fog);
    expect(`#${(kit.scene.fog as THREE.Fog).color.getHexString()}`).toBe('#f3f6f9');
    expect(rigLight(kit.rig, 'key')?.castShadow).toBe(false);
    expect(Number.isFinite(h.heightAt(1, 2))).toBe(true);
    kit.dispose();

    const lit = kitWith({ shadows: true });
    const h2 = habitat(lit, { radius: 10 });
    expect(h2.ground.receiveShadow).toBe(true);
    const sun = rigLight(lit.rig, 'key') as THREE.DirectionalLight;
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.camera.right).toBeCloseTo(10 * 1.05 * 1.1, 6);
    lit.dispose();
  });
});

describe('instanced tokens', () => {
  it('one draw call, the role colour, the model count shown', () => {
    const kit = kitWith();
    const t = instancedTokens(kit, 'substrate', 50, 0.2);
    expect(`#${(t.mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe(
      '#e69f00',
    );
    t.set(0, [1, 2, 3]);
    const m = new THREE.Matrix4();
    t.mesh.getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).toArray()).toEqual([1, 2, 3]);
    t.show(12);
    expect(t.mesh.count).toBe(12);
    t.show(500);
    expect(t.mesh.count).toBe(50);
    // Water is drawn smaller than a solute of the same radius.
    const w = instancedTokens(kit, 'water', 2, 0.2);
    w.set(0, [0, 0, 0]);
    w.mesh.getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixScale(m).x).toBeCloseTo(0.14, 6);
    kit.dispose();
  });
});
