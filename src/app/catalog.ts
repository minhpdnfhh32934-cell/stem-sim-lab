import type { MessageKey } from '@/app/i18n';
import type { Subject } from '@/app/workspaceStore';
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
  status: hasScene(id) ? 'available' : 'planned',
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
    chapter('dynamics', ['newtonLaws', 'inclinedPlane', 'pulley', 'hookeSpring']),
    chapter('energyMomentum', ['energyConservation', 'collisions']),
    chapter('oscillations', ['springPendulum', 'simplePendulum']),
  ],
  chemistry: [
    chapter('atoms', ['periodicTable', 'electronConfiguration', 'bohrModel', 'orbitals']),
    chapter('molecules', ['molecule3d', 'vsepr', 'bondPolarity']),
    chapter('reactions', ['reactionLibrary', 'equationBalancing']),
    chapter('particles', ['collisionTheory', 'maxwellBoltzmann', 'chemicalEquilibrium']),
  ],
  biology: [
    chapter('cell', ['mitosis', 'meiosis']),
    chapter('molecular', ['centralDogma', 'pointMutation']),
    chapter('genetics', ['mendel', 'hardyWeinberg', 'geneticDrift']),
    chapter('ecology', ['logisticGrowth', 'lotkaVolterra']),
    chapter('cellPhysiology', ['michaelisMenten', 'diffusionOsmosis']),
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
