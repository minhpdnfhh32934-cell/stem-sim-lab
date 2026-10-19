import type { ComponentId } from '@/biology/division/mitosis3d/components';
import { timelineFor } from '@/biology/division/mitosis3d/store';
import type { Stage3D } from '@/biology/division/mitosis3d/timeline';
import type { BiologyBinding } from '../scenario';
import { ACTIVITY_KEY, withActions, withEngine, type StudioSession } from '../session';
import { matchEvidence, stageEvidence } from './evidence';
import { answersFromActions, answersToActions, scoreMatch, type Answers } from './match';
import { answerStage, bioVerdict } from './model';

/**
 * Records one observed stage of the lesson's own cell (2n and cell type from the binding, so a
 * record never describes another cell than the question). Only the stage the model singles out
 * for the question sets the verdict; any other stage is kept as evidence and leaves the current
 * verdict as it is.
 */
export function withStageObservation(
  s: StudioSession,
  b: BiologyBinding,
  stage: Stage3D,
  now: number,
  labelOf: (stage: Stage3D) => string,
): StudioSession {
  const tl = timelineFor(b.pairs, b.cellType);
  const answer = answerStage(tl, b.stageQuestion);
  const verdict =
    answer !== null && stage === answer ? bioVerdict(answer, s.prediction, labelOf) : s.verdict;
  return withEngine(s, stageEvidence(tl, stage, b.cellType, now), verdict);
}

/**
 * Stores the answer sheet. A changed sheet makes the last check stale, so its record is
 * dropped and the activity has to be checked again.
 */
export function withAnswer(
  s: StudioSession,
  tasks: readonly ComponentId[],
  task: ComponentId,
  chosen: ComponentId,
  now: number,
): StudioSession {
  if (!tasks.includes(task)) return s;
  const answers: Answers = { ...answersFromActions(s.actions, tasks), [task]: chosen };
  const next = withActions(s, answersToActions(answers, tasks, now), now);
  const checked = next.evidence.some((e) => e.kind === 'engine' && e.key === ACTIVITY_KEY);
  if (!checked) return next;
  return {
    ...next,
    evidence: next.evidence.filter((e) => !(e.kind === 'engine' && e.key === ACTIVITY_KEY)),
    completedAt: null,
  };
}

/** Checks a complete answer sheet against the data (an incomplete one is not checked). */
export function withMatchCheck(
  s: StudioSession,
  tasks: readonly ComponentId[],
  now: number,
): StudioSession {
  const answers = answersFromActions(s.actions, tasks);
  if (!scoreMatch(tasks, answers).complete) return s;
  return withEngine(s, matchEvidence(tasks, answers, now), s.verdict);
}
