import type { ComponentId } from '@/biology/division/mitosis3d/components';
import type { ActionRecord } from '../session';
import { isComponentId } from './model';

/**
 * "Find the part from its function": each task shows the function text of one part
 * (`COMPONENTS[task].role`) and the learner answers by picking a part in the model. An answer
 * is right exactly when the picked part is the task's own part, so the key is the data itself.
 */
export type Answers = Partial<Record<ComponentId, ComponentId>>;

export interface TaskResult {
  task: ComponentId;
  chosen: ComponentId | null;
  correct: boolean;
}

export interface MatchScore {
  results: TaskResult[];
  correct: number;
  total: number;
  /** Every task has an answer (the check can run). */
  complete: boolean;
}

export function scoreMatch(tasks: readonly ComponentId[], answers: Answers): MatchScore {
  const results = tasks.map((task) => {
    const chosen = answers[task] ?? null;
    return { task, chosen, correct: chosen === task };
  });
  return {
    results,
    correct: results.filter((r) => r.correct).length,
    total: tasks.length,
    complete: results.every((r) => r.chosen !== null),
  };
}

/** Operation name of an answer in the session's action log (`arg` = "task=chosen"). */
export const ANSWER_OP = 'answer';

/** Answers rebuilt from the stored log; entries for unknown parts or tasks are ignored. */
export function answersFromActions(
  actions: readonly ActionRecord[],
  tasks: readonly ComponentId[],
): Answers {
  const out: Answers = {};
  for (const a of actions) {
    if (a.op !== ANSWER_OP || a.arg === null) continue;
    const [task = '', chosen = ''] = a.arg.split('=');
    if (!isComponentId(task) || !isComponentId(chosen) || !tasks.includes(task)) continue;
    out[task] = chosen;
  }
  return out;
}

/** The whole answer sheet as a log (one entry per answered task, in task order). */
export function answersToActions(
  answers: Answers,
  tasks: readonly ComponentId[],
  now: number,
): ActionRecord[] {
  const out: ActionRecord[] = [];
  for (const task of tasks) {
    const chosen = answers[task];
    if (chosen) out.push({ op: ANSWER_OP, arg: `${task}=${chosen}`, at: now });
  }
  return out;
}
