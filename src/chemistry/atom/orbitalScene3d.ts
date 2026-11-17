/**
 * The 3D scene of "Orbital nguyên tử hydro" (three.js, on the biology scene kit; 1 world unit =
 * 1 a₀): the cloud of `orbital3d` in one draw call (ψ > 0 --chart-1, ψ < 0 --chart-4, as in 2D;
 * |ψ|² mode one colour), the nucleus at the centre and the x, y, z axes. Static: drawn on change.
 * Model y is up on the page of the 2D slice; here the model's z is the world's up axis.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import type { Cloud } from './orbital3d';

export interface OrbitalScene extends Bio3DScene {
  state(): { points: number; positive: number; extent: number };
}

export function buildOrbitalScene(
  kit: SceneKit,
  o: { cloud: Cloud; mode: 'psi' | 'density' },
): OrbitalScene {
  const { cloud } = o;
  const L = cloud.extent;
  const pos = new Float32Array(cloud.count * 3);
  const col = new Float32Array(cloud.count * 3);
  const plus = new THREE.Color(kit.color('--chart-1'));
  const minus = new THREE.Color(kit.color('--chart-4'));
  let positive = 0;
  for (let i = 0; i < cloud.count; i++) {
    // Model (x, y, z) → world (x, z, −y): the model's z axis points up.
    pos[3 * i] = cloud.points[3 * i] ?? 0;
    pos[3 * i + 1] = cloud.points[3 * i + 2] ?? 0;
    pos[3 * i + 2] = -(cloud.points[3 * i + 1] ?? 0);
    const sign = cloud.signs[i] ?? 1;
    if (sign > 0) positive++;
    const c = o.mode === 'density' || sign > 0 ? plus : minus;
    col.set([c.r, c.g, c.b], 3 * i);
  }
  const geo = kit.geometry(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = kit.own(
    new THREE.PointsMaterial({
      size: L * 0.012,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  const cloudObj = new THREE.Points(geo, mat);
  cloudObj.name = 'orbital-cloud';
  kit.scene.add(cloudObj);

  // The nucleus and the axes (z up, as the book draws orbitals).
  const nucleus = kit.mesh(kit.sphere(), kit.solid(kit.color('--text')));
  nucleus.scale.setScalar(L * 0.02);
  const axisMat = kit.own(new THREE.LineBasicMaterial({ color: kit.color('--text-faint') }));
  const ends: [THREE.Vector3, string][] = [
    [new THREE.Vector3(L, 0, 0), 'x'],
    [new THREE.Vector3(0, 0, -L), 'y'],
    [new THREE.Vector3(0, L, 0), 'z'],
  ];
  for (const [end, name] of ends) {
    const g = kit.geometry(new THREE.BufferGeometry().setFromPoints([end.clone().negate(), end]));
    kit.scene.add(new THREE.LineSegments(g, axisMat));
    kit.label(
      name,
      [end.x * 1.06, end.y * 1.06 + (name === 'z' ? 0 : L * 0.04), end.z * 1.06],
      'muted',
    );
  }

  return {
    kit,
    bounds: { center: [0, 0, 0], radius: L },
    state: () => ({ points: cloud.count, positive, extent: L }),
  };
}
