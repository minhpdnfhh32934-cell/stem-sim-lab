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
  acidBaseTitration: () => import('@/chemistry/titration/modules').then((m) => m.acidBaseTitration),
  maxwellBoltzmann: () => import('@/chemistry/particles/modules').then((m) => m.maxwellBoltzmann),
  collisionTheory: () => import('@/chemistry/particles/modules').then((m) => m.collisionTheory),
  chemicalEquilibrium: () =>
    import('@/chemistry/particles/modules').then((m) => m.chemicalEquilibrium),
  // Biology (Phase 5)
  mitosis: () => import('@/biology/modules').then((m) => m.mitosis),
  meiosis: () => import('@/biology/modules').then((m) => m.meiosis),
  centralDogma: () => import('@/biology/modules').then((m) => m.centralDogma),
  pointMutation: () => import('@/biology/modules').then((m) => m.pointMutation),
  mendel: () => import('@/biology/modules').then((m) => m.mendel),
  hardyWeinberg: () => import('@/biology/modules').then((m) => m.hardyWeinberg),
  geneticDrift: () => import('@/biology/modules').then((m) => m.geneticDrift),
  logisticGrowth: () => import('@/biology/modules').then((m) => m.logisticGrowth),
  lotkaVolterra: () => import('@/biology/modules').then((m) => m.lotkaVolterra),
  michaelisMenten: () => import('@/biology/modules').then((m) => m.michaelisMenten),
  diffusionOsmosis: () => import('@/biology/modules').then((m) => m.diffusionOsmosis),
  cellStructure: () => import('@/biology/modules').then((m) => m.cellStructure),
  cellToDna: () => import('@/biology/modules').then((m) => m.cellToDna),
  crystalStructure: () => import('@/chemistry/crystal/modules').then((m) => m.crystalStructure),
  // Physics lesson with its own view (no time stepping): harmonics and Fourier series.
  fourierSeries: () => import('@/physics/fourier/modules').then((m) => m.fourierSeries),
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
