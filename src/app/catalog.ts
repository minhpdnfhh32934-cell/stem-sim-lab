import type { MessageKey } from '@/app/i18n';
import type { Subject } from '@/app/workspaceStore';
import { hasModule } from '@/modules/registry';
import { hasScene } from '@/physics/registry';

/**
 * Topic catalog shown in the Library (MASTER_PROMPT §6, MVP scope).
 * Contains only names and structure — no scientific data. `status` becomes
 * `available` as each topic is implemented and passes its reference tests.
 */
export type TopicStatus = 'planned' | 'available';

export interface TopicEntry {
  id: string;
  titleKey: MessageKey;
  status: TopicStatus;
}

export interface ChapterEntry {
  id: string;
  titleKey: MessageKey;
  topics: TopicEntry[];
}

const planned = (id: string): TopicEntry => ({
  id,
  titleKey: `topics.${id}` as MessageKey,
  status: hasScene(id) || hasModule(id) ? 'available' : 'planned',
});

const chapter = (id: string, topicIds: string[]): ChapterEntry => ({
  id,
  titleKey: `chapters.${id}` as MessageKey,
  topics: topicIds.map(planned),
});

export const CATALOG: Record<Subject, ChapterEntry[]> = {
  physics: [
    chapter('kinematics', [
      'uniformMotion',
      'uniformAcceleration',
      'freeFall',
      'horizontalProjectile',
      'obliqueProjectile',
    ]),
    chapter('dynamics', [
      'forceComposition',
      'newtonLaws',
      'newtonThirdLaw',
      'stringTension',
      'inclinedPlane',
      'pulley',
      'hookeSpring',
      'fluidFall',
      'torqueBalance',
    ]),
    chapter('fluids', ['liquidPressure']),
    chapter('energyMomentum', ['workPower', 'energyConservation', 'collisions']),
    chapter('oscillations', ['springPendulum', 'simplePendulum', 'forcedOscillation']),
    chapter('circularMotion', ['uniformCircularMotion']),
    chapter('waves', ['travellingWave', 'emWave', 'interference', 'standingWave', 'fourierSeries']),
    chapter('electricField', ['electricField', 'electricPotential', 'capacitor']),
    chapter('dcCircuit', ['electricCurrent', 'dcCircuit']),
    chapter('thermalPhysics', ['matterStructure', 'heatAndPhase']),
    chapter('idealGasChapter', ['gasKinetic', 'idealGas']),
    chapter('magnetismChapter', [
      'magneticField',
      'magneticForce',
      'induction',
      'inductionApplications',
      'electromagneticField',
    ]),
    chapter('nuclearChapter', ['nucleus', 'radioactivity', 'nuclearIndustry']),
    chapter('gravitation', ['keplerOrbit']),
  ],
  chemistry: [
    chapter('atoms', [
      'atomComposition',
      'isotopes',
      'periodicTable',
      'periodTrends',
      'electronConfiguration',
      'bohrModel',
      'orbitals',
    ]),
    chapter('bonds', ['octetRule', 'ionicBond', 'covalentBond', 'intermolecularForces']),
    chapter('molecules', ['molecule3d', 'vsepr', 'bondPolarity']),
    chapter('reactions', ['reactionLibrary', 'equationBalancing', 'redox', 'reactionEnthalpy']),
    chapter('particles', ['collisionTheory', 'maxwellBoltzmann', 'chemicalEquilibrium']),
    chapter('aqueousSolutions', ['aqueousEquilibrium', 'acidBaseTitration']),
    chapter('nitrogenSulfurGroup', ['nitrogenSulfur']),
    chapter('organicBasicsGroup', ['organicBasics', 'organicSeparation']),
    chapter('hydrocarbonGroup', ['hydrocarbons']),
    chapter('halideAlcoholPhenolGroup', ['halideAlcoholPhenol']),
    chapter('carbonylAcidGroup', ['carbonylAcid']),
    chapter('halogenGroup', ['halogens', 'hydrogenHalides']),
    chapter('crystals', ['crystalStructure']),
    chapter('esterLipidGroup', ['esterLipid', 'soapDetergent']),
    chapter('carbohydrateGroup', ['monosaccharides', 'disaccharides', 'polysaccharides']),
  ],
  biology: [
    chapter('livingWorld', ['levelsOfLife']),
    chapter('cellChemistry', ['cellElements', 'biomolecules']),
    chapter('cell', ['mitosis', 'meiosis', 'cellTechnology']),
    chapter('molecular', ['centralDogma', 'pointMutation']),
    chapter('genetics', ['mendel', 'hardyWeinberg', 'geneticDrift']),
    chapter('ecology', ['logisticGrowth', 'lotkaVolterra']),
    chapter('cellPhysiology', [
      'michaelisMenten',
      'diffusionOsmosis',
      'cellSignalling',
      'metabolismEnergy',
      'breakdownSynthesis',
    ]),
    chapter('cellStructure', ['cellStructure', 'cellToDna']),
    chapter('microbesViruses', [
      'microbeDiversity',
      'microbeGrowth',
      'microbeApplications',
      'virusStructure',
      'virusDiseases',
    ]),
    chapter('organismMetabolismGroup', [
      'organismMetabolism',
      'plantWaterMinerals',
      'plantPhotosynthesis',
      'plantRespiration',
      'animalNutrition',
      'animalRespiration',
      'animalCirculation',
      'immunity',
      'excretionHomeostasis',
    ]),
    chapter('responseGroup', [
      'responseOverview',
      'plantResponse',
      'animalResponse',
      'animalBehaviour',
    ]),
    chapter('growthGroup', ['growthOverview', 'plantGrowth', 'animalGrowth']),
    chapter('reproductionGroup', [
      'reproductionOverview',
      'plantReproduction',
      'animalReproduction',
    ]),
    chapter('integrationGroup', ['bodyIntegration']),
  ],
};

/** Vietnamese-aware normalisation for search: "Dao động" matches "dao dong". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
