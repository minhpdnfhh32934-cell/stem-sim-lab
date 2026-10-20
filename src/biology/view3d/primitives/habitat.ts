/**
 * An outdoor habitat for the population lessons (style guide §1–§3, part B): a round patch of
 * terrain from the habitat tokens (grass, soil on slopes, rock on high ground), the outdoor light
 * (the kit must be built with `look: 'outdoor'`), fog towards the horizon colour, and the sun's
 * shadow camera fitted to the habitat (shadow maps only on High with a discrete GPU). The ground
 * is illustration; organisms stand on it at `heightAt(x, z)`, their number comes from the model.
 */
import * as THREE from 'three';
import { fitShadow } from '@/ui/three/lighting';
import type { SceneKit } from '../kit';
import { terrain } from '../recipes';

export interface HabitatOptions {
  radius: number;
  seed?: number;
  /** Height of the hills (world units; default 3 % of the radius). */
  relief?: number;
}

export interface Habitat {
  ground: THREE.Mesh;
  /** Ground height under a point (world units), for standing organisms on it. */
  heightAt(x: number, z: number): number;
}

/** Fog from 1.5 radii (no haze on the subject) to 6 radii away. */
export const FOG_NEAR = 1.5;
export const FOG_FAR = 6;

export function habitat(kit: SceneKit, o: HabitatOptions): Habitat {
  const t = terrain(kit, {
    radius: o.radius,
    seed: o.seed ?? 1,
    ...(o.relief !== undefined ? { relief: o.relief } : {}),
  });
  const ground = kit.mesh(t.geometry, t.material);
  ground.name = 'habitat-ground';
  ground.receiveShadow = kit.shadows;
  const horizon = kit.color('--bio3d-sky-horizon');
  if (/^#[0-9a-f]{3,6}$/i.test(horizon)) {
    kit.scene.fog = new THREE.Fog(horizon, o.radius * FOG_NEAR, o.radius * FOG_FAR);
  }
  if (kit.shadows) fitShadow(kit.rig, [0, 0, 0], o.radius * 1.05);
  return { ground, heightAt: t.heightAt };
}
