import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { withEdgeShade, withRelief, type ReliefUniforms } from './relief';
import { withRim } from './materials';

/** The parts of three.js's standard shaders the relief hooks into. */
function fakeShader() {
  return {
    uniforms: {} as Record<string, unknown>,
    vertexShader: 'void main() {\n#include <begin_vertex>\n}',
    fragmentShader: 'void main() {\n#include <normal_fragment_maps>\n#include <opaque_fragment>\n}',
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
}

const renderer = {} as THREE.WebGLRenderer;

describe('procedural relief', () => {
  it('bumps the normal from noise at the position, with its own uniforms', () => {
    const m = withRelief(new THREE.MeshStandardMaterial(), { frequency: 12, height: 0.01 });
    const s = fakeShader();
    m.onBeforeCompile(s, renderer);
    const u = m.userData.relief as ReliefUniforms;
    expect(u.uReliefFrequency.value).toBe(12);
    expect(u.uReliefHeight.value).toBe(0.01);
    expect(s.uniforms.uReliefFrequency).toBe(u.uReliefFrequency);
    expect(s.vertexShader).toContain('vSimlabRelief = position;');
    // The position is three.js's own attribute: never declared twice.
    expect(s.vertexShader).not.toContain('attribute vec3 position');
    // After the normal maps, before lighting.
    const f = s.fragmentShader;
    expect(f.indexOf('reliefGrad')).toBeGreaterThan(f.indexOf('#include <normal_fragment_maps>'));
    expect(f.indexOf('reliefGrad')).toBeLessThan(f.indexOf('#include <opaque_fragment>'));
    expect(m.customProgramCacheKey()).toContain('simlab-relief-position');
  });

  it('samples a stable surface attribute when the geometry has one', () => {
    const m = withRelief(new THREE.MeshPhysicalMaterial(), {
      frequency: 5,
      height: 0.02,
      attribute: 'surf',
    });
    const s = fakeShader();
    m.onBeforeCompile(s, renderer);
    expect(s.vertexShader).toContain('attribute vec3 surf;');
    expect(s.vertexShader).toContain('vSimlabRelief = surf;');
    expect(m.customProgramCacheKey()).toContain('simlab-relief-surf');
  });

  it('chains with a rim added before it', () => {
    const m = withRelief(withRim(new THREE.MeshStandardMaterial(), { color: '#ffffff' }), {
      frequency: 1,
      height: 0.05,
    });
    const s = fakeShader();
    m.onBeforeCompile(s, renderer);
    expect(s.fragmentShader).toContain('uRimColor');
    expect(s.fragmentShader).toContain('reliefGrad');
    expect(m.customProgramCacheKey()).toBe('simlab-rim|simlab-relief-position');
  });

  it('edge shade darkens towards the silhouette, after the relief and the rim, clamped 0…1', () => {
    const m = withEdgeShade(
      withRelief(withRim(new THREE.MeshStandardMaterial(), { color: '#ffffff' }), {
        frequency: 1,
        height: 0.05,
      }),
      { strength: 1.4 },
    );
    const s = fakeShader();
    m.onBeforeCompile(s, renderer);
    const u = m.userData.edgeShade as { uEdgeShade: { value: number } };
    expect(u.uEdgeShade.value).toBe(1);
    const f = s.fragmentShader;
    // The edge uses the bumped normal, and darkens what the rim added.
    expect(f.indexOf('outgoingLight *= 1.0 - uEdgeShade')).toBeGreaterThan(f.indexOf('reliefGrad'));
    expect(f.indexOf('outgoingLight *= 1.0 - uEdgeShade')).toBeGreaterThan(
      f.indexOf('outgoingLight += uRimColor'),
    );
    expect(f.split('#include <opaque_fragment>')).toHaveLength(2);
    expect(m.customProgramCacheKey()).toBe('simlab-rim|simlab-relief-position|simlab-edge');
  });
});
