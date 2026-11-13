import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAX_OUTLINES, Outlines, outlineNormals } from './outlines';

// The outline of what the held object can act on (Phase A contract A2, amended): a stencil mask, a
// wide amber shell and a narrow dark one per outlined mesh, following it as children, reused, never
// more than the cap; and a marker over each, larger over a task step's object.

const meshes = new Map<string, THREE.Mesh>();
const meshOf = (id: string) => {
  let mesh = meshes.get(id);
  if (!mesh) {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshStandardMaterial());
    meshes.set(id, mesh);
  }
  return mesh;
};
const eye = new THREE.Vector3(0, 0, 2);

describe('outlines', () => {
  it('adds a mask and two shells to each outlined mesh, sharing its geometry, and takes them back', () => {
    const outlines = new Outlines();
    outlines.sync(['a', 'b'], meshOf);
    const a = meshOf('a');
    expect(a.children.map((c) => c.name)).toEqual(['outline-mask', 'outline', 'outline-inner']);
    expect(a.children.every((c) => (c as THREE.Mesh).geometry === a.geometry)).toBe(true);
    outlines.sync(['b'], meshOf);
    expect(a.children).toEqual([]);
    expect(outlines.ids).toEqual(['b']);
    outlines.sync(['a', 'b'], meshOf); // a pooled pair comes back
    expect(a.children).toHaveLength(3);
    outlines.dispose();
    expect(meshOf('b').children).toEqual([]);
  });

  it('never outlines more than the cap, and skips what has no view', () => {
    const outlines = new Outlines();
    const ids = Array.from({ length: MAX_OUTLINES + 5 }, (_, i) => `m${i}`);
    outlines.sync(['ghost', ...ids], (id) => (id === 'ghost' ? null : meshOf(id)));
    expect(outlines.ids).toHaveLength(MAX_OUTLINES);
    expect(outlines.ids).not.toContain('ghost');
    outlines.dispose();
  });

  it('draws both shells only outside the mask, the dark over the amber, never as added light', () => {
    const outlines = new Outlines();
    expect(outlines.maskMaterial.colorWrite).toBe(false);
    expect(outlines.maskMaterial.stencilZPass).toBe(THREE.ReplaceStencilOp);
    for (const m of [outlines.amberMaterial, outlines.darkMaterial]) {
      expect(m.stencilFunc).toBe(THREE.NotEqualStencilFunc);
      expect(m.blending).toBe(THREE.NormalBlending); // added light washed out on a light ground
    }
    outlines.sync(['a'], meshOf);
    const [mask, amber, dark] = meshOf('a').children;
    expect(mask!.renderOrder).toBeLessThan(amber!.renderOrder);
    expect(amber!.renderOrder).toBeLessThan(dark!.renderOrder);
    expect(amber!.renderOrder).toBeGreaterThan(3); // glass 2, liquid 1, print 3
    outlines.dispose();
  });

  it('pulses the amber about once a second, never below 80 %, wider than the dark band', () => {
    const outlines = new Outlines();
    const shader = (m: THREE.MeshBasicMaterial) => {
      const s = {
        uniforms: {},
        vertexShader: 'void main() {\n#include <begin_vertex>\n}',
        fragmentShader: 'void main() {\n#include <opaque_fragment>\n}',
      } as unknown as THREE.WebGLProgramParametersWithUniforms;
      m.onBeforeCompile(s, {} as THREE.WebGLRenderer);
      return s;
    };
    const amber = shader(outlines.amberMaterial);
    const dark = shader(outlines.darkMaterial);
    expect(amber.vertexShader).toContain('outlineNormal * outlineWidth');
    const u = (s: THREE.WebGLProgramParametersWithUniforms, name: string) =>
      (s.uniforms as Record<string, { value: number }>)[name]!;
    const glow: number[] = [];
    for (let i = 0; i < 60; i++) {
      outlines.update(1 / 60, eye);
      glow.push(u(amber, 'outlineGlow').value);
      expect(u(amber, 'outlineWidth').value).toBeGreaterThan(u(dark, 'outlineWidth').value * 2);
    }
    expect(Math.min(...glow)).toBeGreaterThanOrEqual(0.8 - 1e-9);
    expect(Math.max(...glow)).toBeLessThanOrEqual(1 + 1e-9);
    expect(Math.max(...glow) - Math.min(...glow)).toBeGreaterThan(0.19); // a full cycle in 1 s
    outlines.dispose();
  });

  it('closes a box shell at its corners: the shared corners push along one averaged normal', () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const normals = outlineNormals(box);
    expect(outlineNormals(box)).toBe(normals); // made once, kept on the geometry
    const position = box.getAttribute('position');
    const corner = new THREE.Vector3(0.5, 0.5, 0.5);
    const seen = new THREE.Vector3();
    let at = 0;
    for (let k = 0; k < position.count; k++) {
      if (seen.fromBufferAttribute(position, k).distanceTo(corner) > 1e-9) continue;
      at++;
      seen.fromBufferAttribute(normals, k);
      expect(seen.length()).toBeCloseTo(1, 6); // float32
      expect(seen.x).toBeCloseTo(1 / Math.sqrt(3), 6);
      expect(seen.y).toBeCloseTo(1 / Math.sqrt(3), 6);
    }
    expect(at).toBe(3); // one vertex per face meeting there
    box.dispose();
  });

  it('puts a marker above each outlined object, larger over a step, the same size on screen', () => {
    const outlines = new Outlines();
    expect(outlines.markerCount).toBe(0);
    const near = meshOf('near');
    const far = meshOf('far');
    near.position.set(0, 0, 1);
    far.position.set(0, 0, -2);
    near.updateMatrixWorld();
    far.updateMatrixWorld();
    outlines.sync(['near', 'far'], meshOf, ['far']);
    outlines.update(1 / 60, eye);
    expect(outlines.markerCount).toBe(2);
    const marker = outlines.markers.getObjectByName('markers') as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const [p, q, s] = [new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3()];
    const sizes: number[] = [];
    for (let k = 0; k < 2; k++) {
      marker.getMatrixAt(k, m);
      m.decompose(p, q, s);
      expect(p.y).toBeGreaterThan(0.05); // above the 5 cm sphere's top
      sizes.push(s.y / p.distanceTo(eye)); // per metre away: about constant on screen
    }
    expect(sizes[1]! / sizes[0]!).toBeGreaterThan(1.4); // the step's (far) one is larger
    outlines.sync([], meshOf);
    expect(outlines.markerCount).toBe(0);
    outlines.dispose();
  });
});
