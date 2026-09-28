import type { PhysicsScene } from './types';

/**
 * Topic id → lazily loaded scene definition. Only scenes listed here are "available"
 * in the Library; everything else shows "Sắp có".
 */
const SCENES: Record<string, () => Promise<PhysicsScene>> = {
  freeFall: () => import('./projectile/scenes').then((m) => m.freeFall),
  horizontalProjectile: () => import('./projectile/scenes').then((m) => m.horizontalProjectile),
  obliqueProjectile: () => import('./projectile/scenes').then((m) => m.obliqueProjectile),
};

export function hasScene(topicId: string): boolean {
  return topicId in SCENES;
}

export async function loadScene(topicId: string): Promise<PhysicsScene> {
  const load = SCENES[topicId];
  if (!load) throw new Error(`No scene for topic "${topicId}"`);
  return load();
}

export function sceneIds(): string[] {
  return Object.keys(SCENES);
}
