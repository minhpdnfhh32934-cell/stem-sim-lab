import { useMemo } from 'react';
import { openStudio } from '@/app/topics';
import { useAuthoringStore } from './authoring/authoringStore';
import type { StudioScenario } from './scenario';
import { builtInScenarios } from './scenarios';
import { useStudioStore } from './studioStore';

/**
 * Science Studio lessons as the lab sees them (user decision 2026-10-20: the studio lives inside
 * the lab). The registered scenarios are the only source: a lesson belongs to the catalog topic
 * its `topic` names, and a physics lesson holds the lab POE its `binding.poe` names.
 */

/** Lessons of a catalog topic: the built-in ones first, then the teacher's own, in their order. */
export function lessonsForTopic(
  topicId: string | null,
  authored: readonly StudioScenario[],
): StudioScenario[] {
  if (!topicId) return [];
  return [...builtInScenarios(), ...authored].filter((s) => s.topic === topicId);
}

/** The lesson that runs a lab POE (the first one when several do), or null. */
export function lessonForPoe(
  poeId: string | undefined,
  lessons: readonly StudioScenario[],
): StudioScenario | null {
  if (!poeId) return null;
  return lessons.find((s) => s.binding.kind === 'physics' && s.binding.poe === poeId) ?? null;
}

export function useLessonsForTopic(topicId: string | null): StudioScenario[] {
  const authored = useAuthoringStore((s) => s.scenarios);
  return useMemo(() => lessonsForTopic(topicId, authored), [topicId, authored]);
}

/** Shows one lesson in Science Studio; the learner's saved session for it is kept as it is. */
export function openLesson(scenario: StudioScenario): void {
  useStudioStore.getState().openScenario(scenario.subject, scenario.id);
  openStudio();
}
