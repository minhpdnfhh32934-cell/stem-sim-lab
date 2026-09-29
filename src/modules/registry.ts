import type { ModuleView } from './types';

/** Topic id → lazily loaded module (code and data load only when the topic opens). */
const MODULES: Record<string, () => Promise<ModuleView>> = {
  // Chemistry (Phase 4)
  periodicTable: () => import('@/chemistry/periodic/module').then((m) => m.default),
  electronConfiguration: () =>
    import('@/chemistry/atom/modules').then((m) => m.electronConfiguration),
  bohrModel: () => import('@/chemistry/atom/modules').then((m) => m.bohrModel),
  orbitals: () => import('@/chemistry/atom/modules').then((m) => m.orbitals),
  molecule3d: () => import('@/chemistry/molecule/modules').then((m) => m.molecule3d),
  vsepr: () => import('@/chemistry/molecule/modules').then((m) => m.vsepr),
  bondPolarity: () => import('@/chemistry/molecule/modules').then((m) => m.bondPolarity),
  reactionLibrary: () => import('@/chemistry/reaction/modules').then((m) => m.reactionLibrary),
  equationBalancing: () => import('@/chemistry/reaction/modules').then((m) => m.equationBalancing),
  maxwellBoltzmann: () => import('@/chemistry/particles/modules').then((m) => m.maxwellBoltzmann),
  collisionTheory: () => import('@/chemistry/particles/modules').then((m) => m.collisionTheory),
  chemicalEquilibrium: () =>
    import('@/chemistry/particles/modules').then((m) => m.chemicalEquilibrium),
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
