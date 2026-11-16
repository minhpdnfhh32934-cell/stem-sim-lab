import { GUIDED_TOPICS } from '@/studio/guided/topics';
import type { ModuleView } from './types';

/** Topic id → lazily loaded module (code and data load only when the topic opens). */
const MODULES: Record<string, () => Promise<ModuleView>> = {
  // Chemistry (Phase 4)
  periodicTable: () => import('@/chemistry/periodic/module').then((m) => m.default),
  atomComposition: () => import('@/chemistry/nuclide/modules').then((m) => m.atomComposition),
  isotopes: () => import('@/chemistry/nuclide/modules').then((m) => m.isotopes),
  periodTrends: () => import('@/chemistry/periodTrends/modules').then((m) => m.periodTrends),
  redox: () => import('@/chemistry/redox/modules').then((m) => m.redox),
  reactionEnthalpy: () => import('@/chemistry/thermo/modules').then((m) => m.reactionEnthalpy),
  halogens: () => import('@/chemistry/halogen/modules').then((m) => m.halogens),
  hydrogenHalides: () => import('@/chemistry/halogen/modules').then((m) => m.hydrogenHalides),
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
  // SH10 KNTT Bài 4, 5, 21, 24 (#255): their own chunk.
  cellElements: () => import('@/biology/sh10Modules').then((m) => m.cellElements),
  biomolecules: () => import('@/biology/sh10Modules').then((m) => m.biomolecules),
  microbeGrowth: () => import('@/biology/sh10Modules').then((m) => m.microbeGrowth),
  virusStructure: () => import('@/biology/sh10Modules').then((m) => m.virusStructure),
  crystalStructure: () => import('@/chemistry/crystal/modules').then((m) => m.crystalStructure),
  octetRule: () => import('@/chemistry/bonding/modules').then((m) => m.octetRule),
  ionicBond: () => import('@/chemistry/bonding/modules').then((m) => m.ionicBond),
  covalentBond: () => import('@/chemistry/bonding/modules').then((m) => m.covalentBond),
  intermolecularForces: () =>
    import('@/chemistry/bonding/modules').then((m) => m.intermolecularForces),
  // Physics lesson with its own view (no time stepping): harmonics and Fourier series.
  fourierSeries: () => import('@/physics/fourier/modules').then((m) => m.fourierSeries),
  // Descriptive textbook lessons (#255): each runs its guided Science Studio lesson.
  ...Object.fromEntries(
    GUIDED_TOPICS.map((id) => [
      id,
      () => import('@/studio/guided/modules').then((m) => m.guidedModule(id)),
    ]),
  ),
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
