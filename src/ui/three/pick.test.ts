import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { drawStats } from './drawStats';
import { ndcFromEvent, pickFirst, visibleHits } from './pick';

/** A ray along −z through (x, y). */
function rayDown(x = 0, y = 0): THREE.Raycaster {
  return new THREE.Raycaster(new THREE.Vector3(x, y, 10), new THREE.Vector3(0, 0, -1));
}

function ball(r: number, z = 0, transparent = false): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 16, 12),
    new THREE.MeshBasicMaterial({ transparent, side: THREE.DoubleSide }),
  );
  m.position.z = z;
  m.updateMatrixWorld(true);
  return m;
}

describe('picking', () => {
  it('an inner part wins over the container around it', () => {
    const shell = ball(5, 0, true);
    const inner = ball(1);
    const isContainer = (o: THREE.Object3D) => o === shell;
    expect(pickFirst(rayDown(), [shell, inner], { isContainer })?.object).toBe(inner);
    // Through the shell only: the shell.
    expect(pickFirst(rayDown(3, 0), [shell, inner], { isContainer })?.object).toBe(shell);
    expect(pickFirst(rayDown(9, 0), [shell, inner], { isContainer })).toBeNull();
  });

  it('hidden parts (or parts in a hidden group) and faded parts are not picked', () => {
    const group = new THREE.Group();
    const a = ball(1);
    group.add(a);
    group.updateMatrixWorld(true);
    group.visible = false;
    expect(visibleHits(rayDown(), [a])).toEqual([]);
    const faded = ball(1, 0, true);
    (faded.material as THREE.Material).opacity = 0.01;
    expect(visibleHits(rayDown(), [faded])).toEqual([]);
    (faded.material as THREE.Material).opacity = 0.5;
    expect(visibleHits(rayDown(), [faded])).toHaveLength(2);
  });

  it('instanced meshes report the instance under the ray', () => {
    const m = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.4, 8, 6),
      new THREE.MeshBasicMaterial(),
      3,
    );
    for (let i = 0; i < 3; i++) m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 2, 0, 0));
    m.updateMatrixWorld(true);
    expect(pickFirst(rayDown(4, 0), [m])?.instanceId).toBe(2);
  });

  it('pointer position to device coordinates', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 100 }) as DOMRect;
    const v = ndcFromEvent({ clientX: 110, clientY: 20 }, el, new THREE.Vector2());
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.y).toBeCloseTo(1, 12);
  });
});

describe('drawStats', () => {
  it('counts instanced meshes and fat lines as one call each', () => {
    const scene = new THREE.Scene();
    const inst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial(),
      10,
    );
    inst.count = 4;
    scene.add(inst);
    const lines = new LineSegmentsGeometry().setPositions([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]);
    scene.add(new LineSegments2(lines, new LineMaterial({ linewidth: 0.1, worldUnits: true })));
    // 4 boxes × 12 triangles; 2 segments × (18 indices / 3) triangles.
    expect(drawStats(scene)).toEqual({ calls: 2, triangles: 4 * 12 + 2 * 6, lines: 0 });
  });
});
