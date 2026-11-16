import { validateScenario, type StudioScenario, type StudioSubject } from '../../scenario';
import { sh10b03Levels } from './sh10b03Levels';
import { sh10b12Signalling } from './sh10b12Signalling';
import { sh10b13Metabolism } from './sh10b13Metabolism';
import { sh10b14BreakdownSynthesis } from './sh10b14BreakdownSynthesis';
import { sh10b19CellTechnology } from './sh10b19CellTechnology';
import { sh10b20MicrobeDiversity } from './sh10b20MicrobeDiversity';
import { sh10b22MicrobeUses } from './sh10b22MicrobeUses';
import { sh10b25VirusDiseases } from './sh10b25VirusDiseases';

/**
 * The descriptive textbook lessons (user decision 14/11/2026, #255). Kept out of
 * `builtInScenarios()` on purpose: they open from their own library topic and from their own group
 * in Science Studio. Each one is validated; an invalid lesson is left out, never shown half-built.
 */
export const GUIDED_LESSONS: readonly unknown[] = [
  sh10b03Levels,
  sh10b12Signalling,
  sh10b13Metabolism,
  sh10b14BreakdownSynthesis,
  sh10b19CellTechnology,
  sh10b20MicrobeDiversity,
  sh10b22MicrobeUses,
  sh10b25VirusDiseases,
];

let cache: StudioScenario[] | null = null;

export function guidedScenarios(): StudioScenario[] {
  if (!cache) {
    cache = [];
    for (const raw of GUIDED_LESSONS) {
      const r = validateScenario(raw);
      if (r.ok && r.scenario.binding.kind === 'guided') cache.push(r.scenario);
      else console.error('Invalid guided lesson', r.ok ? 'not a guided binding' : r.errors);
    }
  }
  return cache;
}

export function guidedFor(subject: StudioSubject): StudioScenario[] {
  return guidedScenarios().filter((s) => s.subject === subject);
}

export function guidedForTopic(topic: string): StudioScenario | null {
  return guidedScenarios().find((s) => s.topic === topic) ?? null;
}
