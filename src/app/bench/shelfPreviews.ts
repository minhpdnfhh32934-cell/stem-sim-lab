import type { ResolvedTheme } from '@/app/settings/settingsStore';
import { hasScene } from '@/physics/registry';

/**
 * Topics without a physics engine frame (chemistry, biology and Fourier) with a picture of their
 * stage at its default values (docs/BENCH_DESIGN.md §9.3): public/shelf/<topic>.<light|dark>.webp,
 * made by scripts/bench/shelf-previews.mjs from the app's own output. Physics scenes draw their
 * engine frame instead (SceneStill).
 */
export const SHELF_PREVIEWS: ReadonlySet<string> = new Set([
  'fourierSeries',
  'emWave',
  'heatAndPhase',
  'idealGas',
  'magneticForce',
  'induction',
  'nucleus',
  'radioactivity',
  'aqueousEquilibrium',
  'nitrogenSulfur',
  'organicBasics',
  'hydrocarbons',
  'halideAlcoholPhenol',
  'carbonylAcid',
  'atomComposition',
  'isotopes',
  'periodicTable',
  'periodTrends',
  'redox',
  'reactionEnthalpy',
  'halogens',
  'hydrogenHalides',
  'electronConfiguration',
  'bohrModel',
  'orbitals',
  'molecule3d',
  'vsepr',
  'bondPolarity',
  'reactionLibrary',
  'equationBalancing',
  'acidBaseTitration',
  'collisionTheory',
  'maxwellBoltzmann',
  'chemicalEquilibrium',
  'crystalStructure',
  'octetRule',
  'ionicBond',
  'covalentBond',
  'intermolecularForces',
  'mitosis',
  'meiosis',
  'centralDogma',
  'pointMutation',
  'mendel',
  'hardyWeinberg',
  'geneticDrift',
  'logisticGrowth',
  'lotkaVolterra',
  'michaelisMenten',
  'diffusionOsmosis',
  'cellStructure',
  'cellToDna',
  'cellElements',
  'biomolecules',
  'microbeGrowth',
  'virusStructure',
  'levelsOfLife',
  'cellSignalling',
  'metabolismEnergy',
  'breakdownSynthesis',
  'cellTechnology',
  'microbeDiversity',
  'microbeApplications',
  'virusDiseases',
  'organicSeparation',
  'organismMetabolism',
  'plantWaterMinerals',
  'plantPhotosynthesis',
  'plantRespiration',
  'animalNutrition',
  'animalRespiration',
  'animalCirculation',
  'immunity',
  'excretionHomeostasis',
  'responseOverview',
  'plantResponse',
  'animalResponse',
  'animalBehaviour',
  'growthOverview',
  'plantGrowth',
  'animalGrowth',
  'reproductionOverview',
  'plantReproduction',
  'animalReproduction',
  'bodyIntegration',
  'matterStructure',
  'gasKinetic',
  'magneticField',
  'inductionApplications',
  'electromagneticField',
  'nuclearIndustry',
]);

/** The picture of `topic` in `theme`, or null when it has none. */
export function shelfPreviewUrl(topic: string, theme: ResolvedTheme): string | null {
  return SHELF_PREVIEWS.has(topic)
    ? `${import.meta.env.BASE_URL}shelf/${topic}.${theme}.webp`
    : null;
}

/** Whether `topic` has a picture on the shelf: an engine frame or a stage picture. */
export function hasTopicPicture(topic: string): boolean {
  return hasScene(topic) || SHELF_PREVIEWS.has(topic);
}
