import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Finishes } from './finishes';
import { STEAM } from './looks';
import { QUALITY } from './quality';

describe('Max: fingerprints on the glassware (finishes.ts setWear)', () => {
  it('patches the shared sheen pass with world-space prints, and takes them off', () => {
    const finishes = new Finishes(QUALITY.ultra);
    const sheen = finishes.sheen;
    const plain = sheen.customProgramCacheKey();
    finishes.setWear(new THREE.Texture());
    expect(sheen.customProgramCacheKey()).toBe('max-glass-prints');
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    sheen.onBeforeCompile(shader as never, {} as never);
    expect(shader.vertexShader).toContain('vWearN = normalize( wearM * objectNormal );');
    expect(shader.fragmentShader).toContain('varying vec3 vWearN;');
    // The prints raise the sheen's roughness, after three's own roughness is read.
    const read = shader.fragmentShader.indexOf('#include <roughnessmap_fragment>');
    const prints = shader.fragmentShader.indexOf('roughnessFactor = clamp( roughnessFactor + 0.4');
    expect(read).toBeGreaterThan(0);
    expect(prints).toBeGreaterThan(read);
    expect(shader.uniforms.tWear).toBeDefined();
    finishes.setWear(null);
    expect(sheen.customProgramCacheKey()).toBe(plain);
    finishes.dispose();
  });
});

describe("Ultra: steam's mist (finishes.ts, looks.ts STEAM)", () => {
  it('draws a steam puff soft and torn on Ultra only, as built on the other levels', () => {
    const mist = new THREE.MeshBasicMaterial({ name: STEAM, transparent: true, opacity: 0.16 });
    const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mist, 4);
    const finishes = new Finishes(QUALITY.high);
    finishes.adopt(puffs);
    expect(mist.defines ?? {}).not.toHaveProperty('WISPS');
    finishes.set(QUALITY.ultra, null, 0);
    finishes.adopt(puffs);
    expect(mist.defines).toHaveProperty('WISPS');
    expect(mist.opacity).toBe(0.16); // its own opacity stays: only how it fades is shaped
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    };
    mist.onBeforeCompile(shader as never, {} as never);
    expect(shader.vertexShader).toContain('vWispAt = position * vec3( 2.6, 1.4, 2.6 ) + wispSeed;');
    expect(shader.fragmentShader).toContain('diffuseColor.a *= smoothstep( 0.1, 0.9, facing )');
    finishes.set(QUALITY.high, null, 0);
    finishes.adopt(puffs);
    expect(mist.defines).not.toHaveProperty('WISPS');
    finishes.dispose();
  });
});
