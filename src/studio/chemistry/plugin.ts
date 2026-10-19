import type { Source } from '@/core/data/dataset';
import { reactionById, REACTIONS_SOURCE } from '@/chemistry/data/reactions';
import type { SubjectPlugin } from '../flow/types';
import type { StudioScenario } from '../scenario';
import { engineEvidence, type StudioSession } from '../session';
import { Bench } from './BenchStep';
import { Facts, Observe, Predict } from './ChemistrySteps';
import { chemistryOf } from './evidence';
import { reactionIdOf } from './library';

/** Sources of every library record behind the session's mixes, plus the library itself. */
export function chemistrySources(scenario: StudioScenario, session: StudioSession): Source[] {
  const b = chemistryOf(scenario);
  const ids = new Set<string>(b ? [b.reaction] : []);
  for (const run of engineEvidence(session)) {
    const id = reactionIdOf(run.model);
    if (id) ids.add(id);
  }
  const out: Source[] = [];
  for (const id of ids) out.push(...(reactionById(id)?.sources ?? []));
  out.push(REACTIONS_SOURCE);
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

export const chemistryPlugin: SubjectPlugin = {
  Predict,
  Interact: Bench,
  Observe,
  Facts,
  modelSources: (scenario, session) => Promise.resolve(chemistrySources(scenario, session)),
  leads: {
    interact: 'studio.chem.leads.interact',
    observe: 'studio.chem.leads.observe',
    explain: 'studio.chem.leads.explain',
  },
  blockers: { observation: 'studio.chem.blockers.observation' },
};
