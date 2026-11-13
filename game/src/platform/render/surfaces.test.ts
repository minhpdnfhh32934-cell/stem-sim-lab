import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { QUALITY } from './quality';
import { FINISHES } from './palette';
import { FINISH_SURFACES, SURFACE_SETS, Surfaces, surfaceOf, type SurfaceId } from './surfaces';

// Ultra's real surfaces: every set's files shipped, what takes which surface (and what never
// does), the shader patch and its removal. The textures themselves are the GPU's (e2e and bench).

const ROOT = resolve(__dirname, '../../../public/ultra/textures');

describe('Ultra surface sets', () => {
  it('ships every set it names, with its maps and its source in the README', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
    for (const [id, set] of Object.entries(SURFACE_SETS)) {
      for (const map of ['color', 'normal', 'roughness', ...(set.ao ? ['ao'] : [])]) {
        expect(existsSync(resolve(ROOT, set.folder, `${map}.jpg`)), `${id} ${map}`).toBe(true);
      }
      expect(readme, id).toContain(set.folder);
    }
  });

  it('maps only finishes that exist, and never glass or a light', () => {
    for (const finish of Object.keys(FINISH_SURFACES)) expect(FINISHES).toHaveProperty(finish);
    for (const [finish, spec] of Object.entries(FINISHES)) {
      if (spec.look === 'glass' || spec.look === 'light') {
        expect(FINISH_SURFACES[finish as keyof typeof FINISHES], finish).toBeUndefined();
      }
    }
  });

  it('is Ultra only', () => {
    expect(QUALITY.ultra.surfaces).toBe(true);
    for (const q of ['low', 'medium', 'high'] as const) expect(QUALITY[q].surfaces).toBe(false);
  });
});

describe('which material takes which surface', () => {
  const tagged = (data: object, params: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial(params);
    Object.assign(m.userData, data);
    return m;
  };

  it('follows the tag its maker gave: a surface, a finish, a look', () => {
    expect(surfaceOf(tagged({ surface: 'plaster' }))).toBe('plaster');
    expect(surfaceOf(tagged({ finish: 'worktop-epoxy' }))).toBe('plastic-glossy');
    expect(surfaceOf(tagged({ look: 'metal' }))).toBe('steel');
    expect(surfaceOf(tagged({}))).toBeNull();
    expect(surfaceOf(tagged({ finish: 'glow-cool' }))).toBeNull();
  });

  it('leaves see-through and glowing materials alone, whatever their tag', () => {
    expect(surfaceOf(tagged({ look: 'metal' }, { transparent: true }))).toBeNull();
    expect(surfaceOf(tagged({ look: 'painted' }, { emissive: '#ffd9a0' }))).toBeNull();
  });
});

describe('the patch', () => {
  /** A Surfaces whose sets are "loaded" with blank textures (no fetch in a unit test). */
  function loadedSurfaces() {
    const surfaces = new Surfaces('/', () => 1);
    const blank = () => new THREE.Texture();
    const sets = new Map<SurfaceId, object>();
    for (const id of Object.keys(SURFACE_SETS) as SurfaceId[]) {
      sets.set(id, {
        color: blank(),
        normal: blank(),
        roughness: blank(),
        ao: SURFACE_SETS[id].ao ? blank() : null,
        colorMean: 0.5,
        roughMean: 0.5,
      });
    }
    (surfaces as unknown as { loaded: Map<SurfaceId, object> }).loaded = sets;
    return surfaces;
  }

  /** Runs a material's patch over three's own shader text. */
  function compiled(material: THREE.MeshStandardMaterial) {
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      defines: {} as Record<string, string>,
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer);
    return shader;
  }

  it('patches what has a surface, keyed per surface, and leaves the rest', () => {
    const surfaces = loadedSurfaces();
    const floor = new THREE.MeshStandardMaterial();
    floor.userData.surface = 'floor-concrete';
    const plain = new THREE.MeshStandardMaterial();
    const root = new THREE.Group();
    root.add(
      new THREE.Mesh(new THREE.BoxGeometry(), floor),
      new THREE.Mesh(new THREE.BoxGeometry(), plain),
    );
    surfaces.adopt(root);
    expect(Object.hasOwn(floor, 'onBeforeCompile')).toBe(true);
    expect(floor.customProgramCacheKey()).toBe('ultra-surface:floor-concrete');
    expect(Object.hasOwn(plain, 'onBeforeCompile')).toBe(false);

    const shader = compiled(floor);
    expect(shader.vertexShader).toContain('vTriPos = ( modelMatrix * triPos ).xyz;');
    for (const piece of ['triSample( tTriColor', 'roughnessFactor = clamp', 'triWorld', 'tTriAo']) {
      expect(shader.fragmentShader, piece).toContain(piece);
    }
    expect(shader.defines.TRI_AO).toBe(''); // concrete has an AO map
    expect(shader.uniforms.uTriScale?.value).toBe(SURFACE_SETS['floor-concrete'].scale);
  });

  it('takes every patch off when Ultra is left', () => {
    const surfaces = loadedSurfaces();
    const wall = new THREE.MeshStandardMaterial();
    wall.userData.surface = 'plaster';
    surfaces.adopt(new THREE.Mesh(new THREE.BoxGeometry(), wall));
    surfaces.drop();
    expect(Object.hasOwn(wall, 'onBeforeCompile')).toBe(false);
    expect(wall.customProgramCacheKey()).toBe(
      new THREE.MeshStandardMaterial().customProgramCacheKey(),
    );
    expect(surfaces.ready).toBe(false);
  });

  it('leaves a material someone else already customised', () => {
    const surfaces = loadedSurfaces();
    const custom = new THREE.MeshStandardMaterial();
    custom.userData.surface = 'plaster';
    const own = () => undefined;
    custom.onBeforeCompile = own;
    surfaces.adopt(new THREE.Mesh(new THREE.BoxGeometry(), custom));
    expect(Object.getOwnPropertyDescriptor(custom, 'onBeforeCompile')?.value).toBe(own);
  });
});
