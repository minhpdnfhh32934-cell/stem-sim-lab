import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FloorPath } from './floorPath';

// The guided task's way on the floor (Phase A contract A5): chevrons on the path, pointing along
// it, gliding forward; hidden without a path.

describe('the floor path', () => {
  it('lays chevrons on the path, on the floor, each pointing along its leg', () => {
    const path = new FloorPath();
    path.set([0, 0, 2, 0, 2, 3], 0); // 2 m along +x, then 3 m along +z
    expect(path.mesh.visible).toBe(true);
    path.update(0);
    expect(path.mesh.count).toBe(15); // 5 m / 0.35 m, the first at the start
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const tip = new THREE.Vector3();
    for (let k = 0; k < path.mesh.count; k++) {
      path.mesh.getMatrixAt(k, m);
      m.decompose(p, q, s);
      expect(p.y).toBeCloseTo(0.012, 9);
      const onFirst = Math.abs(p.z) < 1e-9 && p.x >= -1e-9 && p.x <= 2 + 1e-9;
      const onSecond = Math.abs(p.x - 2) < 1e-9 && p.z >= -1e-9 && p.z <= 3 + 1e-9;
      expect(onFirst || onSecond).toBe(true);
      tip.set(0, 0, 1).applyQuaternion(q);
      if (p.x < 1.99)
        expect(tip.x).toBeCloseTo(1, 9); // along +x
      else if (p.z > 0.01) expect(tip.z).toBeCloseTo(1, 9); // along +z
    }
    path.dispose();
  });

  it('glides forward and hides with no path', () => {
    const path = new FloorPath();
    path.set([0, 0, 3, 0], 0);
    path.update(0);
    const first = new THREE.Matrix4();
    path.mesh.getMatrixAt(0, first);
    path.update(0.2);
    const later = new THREE.Matrix4();
    path.mesh.getMatrixAt(0, later);
    const x = (m: THREE.Matrix4) => new THREE.Vector3().setFromMatrixPosition(m).x;
    expect(x(later)).toBeGreaterThan(x(first));
    path.set([], 0);
    expect([path.mesh.visible, path.mesh.count]).toEqual([false, 0]);
    path.dispose();
  });
});
