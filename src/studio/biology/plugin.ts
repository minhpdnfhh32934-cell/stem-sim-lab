import type { Source } from '@/core/data/dataset';
import { card3d } from '@/biology/division/mitosis3d/components';
import type { SubjectPlugin } from '../flow/types';
import type { StudioScenario } from '../scenario';
import { Facts, Observe, Predict } from './BiologySteps';
import { biologyOf } from './model';
import { ModelStep } from './ModelStep';

/** Sources of the 3D model's counts, stage notes and part texts. */
export function biologySources(scenario: StudioScenario): Source[] {
  const b = biologyOf(scenario);
  return b ? [...card3d(b.cellType).sources] : [];
}

export const biologyPlugin: SubjectPlugin = {
  Predict,
  Interact: ModelStep,
  Observe,
  Facts,
  modelSources: (scenario) => Promise.resolve(biologySources(scenario)),
  leads: {
    interact: 'studio.bio.leads.interact',
    observe: 'studio.bio.leads.observe',
    explain: 'studio.bio.leads.explain',
  },
  blockers: {
    observation: 'studio.bio.blockers.observation',
    activity: 'studio.bio.blockers.activity',
  },
};
