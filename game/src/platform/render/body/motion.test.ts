import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import { CharacterDefinitionSchema } from '../../../gameplay/character';
import { Actor } from './actor';

const character = () => {
  const raw = (bundledContent.characters as unknown[]).find(
    (c) => (c as { id?: string }).id === 'researcher-male',
  );
  return CharacterDefinitionSchema.parse(raw);
};

const view = (speed: number) =>
  ({
    id: 'p',
    x: 0,
    z: 0,
    heading: 0,
    speed,
    sit: false,
    gesture: 'idle',
    look: null,
  }) as unknown as Parameters<Actor['update']>[0];

describe('Max: hair and clothes follow the body (motion.ts)', () => {
  it('marks hair and cloth, gives its materials their own program, and is only made when on', () => {
    const actor = new Actor(character(), new THREE.MeshBasicMaterial(), 0);
    const hair = actor.model.meshes.find((m) => m.userData.surface === 'hair');
    actor.setMotion(false);
    expect(hair?.geometry.hasAttribute('aWind')).toBe(false); // never made below Max
    actor.setMotion(true);
    expect(hair?.geometry.hasAttribute('aWind')).toBe(true);
    const material = hair?.material as THREE.Material;
    expect(material.customProgramCacheKey()).toContain('max-motion');
    // The shader takes the wind and the amount.
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\n#include <skinning_vertex>',
      fragmentShader: '',
    };
    material.onBeforeCompile(shader as never, {} as never);
    expect(shader.vertexShader).toContain('uMotion * windOffset(position, objectNormal)');
    expect(Object.keys(shader.uniforms)).toEqual(
      expect.arrayContaining(['uWind', 'uMotion', 'uTime', 'uHead']),
    );
    // Walking: the air's push grows towards the pace; off, the amount eases to nothing.
    for (let i = 0; i < 120; i++) actor.update(view(1.4), 1 / 60, i / 60, null);
    const wind = shader.uniforms.uWind as { value: THREE.Vector3 };
    expect(wind.value.z).toBeGreaterThan(1.3);
    actor.setMotion(false);
    for (let i = 0; i < 180; i++) actor.update(view(0), 1 / 60, 2 + i / 60, null);
    expect((shader.uniforms.uMotion as { value: number }).value).toBeLessThan(0.01);
    actor.dispose();
  });
});
