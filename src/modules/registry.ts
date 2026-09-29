import type { ModuleView } from './types';

/** Topic id → lazily loaded module (code and data load only when the topic opens). */
const MODULES: Record<string, () => Promise<ModuleView>> = {
  // Chemistry (Phase 4)
  periodicTable: () => import('@/chemistry/periodic/module').then((m) => m.default),
  electronConfiguration: () =>
    import('@/chemistry/atom/modules').then((m) => m.electronConfiguration),
  bohrModel: () => import('@/chemistry/atom/modules').then((m) => m.bohrModel),
  orbitals: () => import('@/chemistry/atom/modules').then((m) => m.orbitals),
  // Biology modules (Phase 5) are added here.
};

export function hasModule(id: string): boolean {
  return id in MODULES;
}

export async function loadModule(id: string): Promise<ModuleView> {
  const load = MODULES[id];
  if (!load) throw new Error(`No module for topic "${id}"`);
  return load();
}

export function moduleIds(): string[] {
  return Object.keys(MODULES);
}
