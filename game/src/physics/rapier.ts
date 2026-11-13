import type RAPIER from '@dimforge/rapier3d-compat';

export type Rapier = typeof RAPIER;

/**
 * Loads Rapier on demand. The dynamic import puts Rapier — including its 3 MB WebAssembly, which
 * the compat build inlines as base64 — in a separate chunk that is only downloaded when the first
 * world scene needs physics, not with the menu. The module import is cached by the module system
 * and Rapier's own `init()` returns early once instantiated, so nothing is cached here.
 */
export async function loadRapier(): Promise<Rapier> {
  const { default: rapier } = await import('@dimforge/rapier3d-compat');
  await rapier.init();
  return rapier;
}
