import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { detailed } from './detail';
import { mergeStill } from './mergeStill';

/** Every vertex of what is drawn under `root`, in root's frame, sorted (to compare as sets). */
function vertices(root: THREE.Object3D): string[] {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const out: string[] = [];
  root.traverse((object) => {
    if (!(object as Partial<THREE.Mesh>).isMesh) return;
    const mesh = object as THREE.Mesh;
    const m = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    const p = mesh.geometry.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      out.push(`${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`);
    }
  });
  return out.sort();
}

const meshes = (root: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as Partial<THREE.Mesh>).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
};

describe('a frame’s fixed parts merged (mergeStill)', () => {
  it('draws the parts of one material once, each where it was, and leaves what is told apart', () => {
    const ink = new THREE.MeshStandardMaterial();
    const white = new THREE.MeshStandardMaterial();
    const printed = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const frame = new THREE.Group();
    frame.position.set(0.3, 1, -0.2);
    frame.rotation.y = 0.4;
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, parent = frame) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    // Ten ticks turned round a centre (as the force board's), a ring, in ink; a board in white.
    for (let a = 0; a < 10; a++) {
      add(new THREE.PlaneGeometry(0.03, 0.002), ink).rotation.z = (a * Math.PI) / 5;
    }
    add(new THREE.RingGeometry(0.2, 0.203, 32), ink);
    add(new THREE.BoxGeometry(0.6, 0.6, 0.02), white).position.y = 0.3;
    add(new THREE.BoxGeometry(0.03, 0.3, 0.03), white).position.set(0.2, 0.15, -0.02);
    // Under a plain group too.
    const inner = new THREE.Group();
    inner.position.x = 0.1;
    frame.add(inner);
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 16), white, inner);
    // Told apart: a named part, a printed one, one casting no shadow, one with children.
    add(new THREE.BoxGeometry(0.1, 0.1, 0.1), ink).name = 'reading';
    add(new THREE.BoxGeometry(0.1, 0.1, 0.1), printed);
    add(new THREE.BoxGeometry(0.1, 0.1, 0.1), ink).castShadow = false;
    add(new THREE.BoxGeometry(0.1, 0.1, 0.1), ink).add(new THREE.Object3D());
    const before = vertices(frame);

    const made = mergeStill(frame);

    expect(made).toHaveLength(2); // ink, white
    expect(vertices(frame)).toEqual(before);
    const drawn = meshes(frame);
    expect(drawn).toHaveLength(2 + 4); // the two merges and the four told apart
    expect(drawn.filter((m) => m.material === ink)).toHaveLength(1 + 3);
    expect(drawn.find((m) => m.name === 'reading')).toBeDefined();
    expect(drawn.filter((m) => m.material === white)).toHaveLength(1);
    for (const mesh of drawn.filter((m) => m.geometry.userData.pieces)) {
      expect(mesh.castShadow).toBe(true);
      expect(mesh.parent).toBe(frame);
    }
  });

  it('keeps Ultra’s detail: a box turned any way is still bevelled in the merge', () => {
    const steel = new THREE.MeshStandardMaterial();
    const frame = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), steel);
    strut.rotation.set(0.3, 0.7, 0.1); // no quarter turn
    strut.position.set(0.2, 0.15, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.2), steel);
    frame.add(strut, foot);
    const [merged] = mergeStill(frame);
    if (!merged) throw new Error('nothing merged');
    const ultra = detailed(merged);
    expect(ultra).not.toBeNull();
    // Bevelled (more vertices), the same size and place: its bounds within the bevel (6 mm for a
    // 3 cm strut; a turned box's rounded corners no longer reach the old bounds).
    expect(ultra!.getAttribute('position').count).toBeGreaterThan(
      merged.getAttribute('position').count,
    );
    merged.computeBoundingBox();
    ultra!.computeBoundingBox();
    const a = merged.boundingBox!;
    const b = ultra!.boundingBox!;
    for (const k of ['x', 'y', 'z'] as const) {
      expect(Math.abs(b.min[k] - a.min[k])).toBeLessThan(0.0061);
      expect(Math.abs(b.max[k] - a.max[k])).toBeLessThan(0.0061);
    }
  });
});
