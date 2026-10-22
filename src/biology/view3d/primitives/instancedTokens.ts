/**
 * Instanced tokens of a palette role (substrate, product, inhibitor, solute, water…): one draw
 * call for all of them, the role's shape cue as geometry and its recipe material (data token as
 * albedo; water muted and smaller). How many are shown and where they sit is the caller's — from
 * the lesson's model; this only draws them.
 */
import * as THREE from 'three';
import type { SceneKit, Vec3 } from '../kit';
import { ROLES } from '../palette';
import { PARTICLE_SCALE, particleMaterial, type ParticleRole } from '../recipes';
import { shapeGeometry } from './classShape';

export interface Tokens {
  mesh: THREE.InstancedMesh;
  /** Places token i at `at` (world units); scale is the role's size × `size`. No allocation. */
  set(i: number, at: Vec3, size?: number): void;
  /** Shows the first `n` tokens (the model's count), hides the rest. */
  show(n: number): void;
}

/** `capacity` tokens of `role`, `radius` world units each (before the role's own scale). */
export function instancedTokens(
  kit: SceneKit,
  role: ParticleRole,
  capacity: number,
  radius: number,
  parent: THREE.Object3D = kit.scene,
): Tokens {
  const mesh = kit.instanced(
    shapeGeometry(kit, ROLES[role].shape),
    particleMaterial(kit, role),
    capacity,
    parent,
  );
  mesh.name = `tokens-${role}`;
  const base = radius * PARTICLE_SCALE[role];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    mesh,
    set(i, at, size = 1) {
      p.set(at[0], at[1], at[2]);
      s.setScalar(base * size);
      mesh.setMatrixAt(i, m.compose(p, q, s));
      mesh.instanceMatrix.needsUpdate = true;
    },
    show(n) {
      mesh.count = Math.max(0, Math.min(capacity, Math.floor(n)));
    },
  };
}
