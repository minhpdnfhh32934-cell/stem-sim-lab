import { validateScenario, type StudioScenario, type StudioSubject } from '../scenario';
import { biologyMitosisMetaphase } from './biologyMitosisMetaphase';
import { chemistryChlorideTest } from './chemistryChlorideTest';
import { physicsFreeFall } from './physicsFreeFall';

/** Built-in scenarios. Each one is validated; an invalid entry is left out, never shown half-built. */
const BUILT_IN: readonly unknown[] = [
  physicsFreeFall,
  chemistryChlorideTest,
  biologyMitosisMetaphase,
];

let cache: StudioScenario[] | null = null;

export function builtInScenarios(): StudioScenario[] {
  if (!cache) {
    cache = [];
    for (const raw of BUILT_IN) {
      const r = validateScenario(raw);
      if (r.ok) cache.push(r.scenario);
      else console.error('Invalid studio scenario', r.errors);
    }
  }
  return cache;
}

export function scenariosFor(subject: StudioSubject): StudioScenario[] {
  return builtInScenarios().filter((s) => s.subject === subject);
}
