import type { ExperimentDefinition, TopicDefinition } from '../simulation/experiment';
import type { Content } from './content';
import type { ProgressionState } from './GameState';

/** The subjects, in the order the board shows them. */
export const SUBJECTS = ['physics', 'chemistry', 'biology'] as const;
export type Subject = (typeof SUBJECTS)[number];

/** Marks the board's chart shows at most (the latest). */
export const MARKS_SHOWN = 10;

/**
 * What the hub's progress board shows (Phú, 2026-11-10), worked out from the save alone — never
 * invented: experiments run to the end (a run that ended by itself, `completedExperiments`) by
 * subject, topics whose every experiment is done, the marks of the teacher's papers, the guided
 * tasks finished, and the next experiment to do (the first not done, in the topics' order).
 * Without the lab pack (its experiments and topics not loaded yet) the experiment parts are empty.
 */
export interface ProgressSummary {
  readonly subjects: readonly { subject: Subject; done: number; total: number }[];
  readonly experiments: { done: number; total: number };
  /** Topics with every experiment done, and how many are started (some done) or exist. */
  readonly topicsDone: readonly TopicDefinition[];
  readonly topicsStarted: number;
  readonly topicsTotal: number;
  /** The latest marks (out of 10), oldest first; how many papers were marked, their mean, the best. */
  readonly marks: readonly number[];
  readonly papers: number;
  readonly average: number | null;
  readonly best: number | null;
  readonly tasks: { done: number; total: number };
  /** The next experiment to do, with its topic, or null (none left, or nothing loaded). */
  readonly next: { experiment: ExperimentDefinition; topic: TopicDefinition } | null;
}

type ContentPart = Pick<Content, 'experiments' | 'topics' | 'tasks'>;

export function progressSummary(content: ContentPart, progress: ProgressionState): ProgressSummary {
  const done = new Set(progress.completedExperiments);
  const experiments = content.experiments.all();
  const subjects = SUBJECTS.map((subject) => {
    const of = experiments.filter((e) => e.category === subject);
    return { subject, done: of.filter((e) => done.has(e.id)).length, total: of.length };
  });
  const topics = content.topics.all();
  const topicsDone = topics.filter((t) => t.experiments.every((id) => done.has(id)));
  const topicsStarted = topics.filter((t) => t.experiments.some((id) => done.has(id))).length;
  let next: ProgressSummary['next'] = null;
  for (const topic of topics) {
    const id = topic.experiments.find((e) => !done.has(e));
    const experiment = id === undefined ? undefined : content.experiments.tryGet(id);
    if (experiment) {
      next = { experiment, topic };
      break;
    }
  }
  const scores = progress.scores.map((s) => s.score);
  const taskIds = new Set(content.tasks.all().map((t) => t.id));
  return {
    subjects,
    experiments: {
      done: experiments.filter((e) => done.has(e.id)).length,
      total: experiments.length,
    },
    topicsDone,
    topicsStarted,
    topicsTotal: topics.length,
    marks: scores.slice(-MARKS_SHOWN),
    papers: scores.length,
    average: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    best: scores.length > 0 ? Math.max(...scores) : null,
    tasks: {
      done: progress.tasks.done.filter((id) => taskIds.has(id)).length,
      total: taskIds.size,
    },
    next,
  };
}
