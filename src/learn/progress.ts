import { CATALOG } from '@/app/catalog';
import type { MessageKey } from '@/app/i18n';
import { SUBJECTS } from '@/app/workspaceStore';
import { challengesFor } from './challenges';
import { poeFor } from './poe';
import type { ProgressState } from './progressStore';

type Progress = Pick<ProgressState, 'visited' | 'challenges' | 'predictions'>;

export interface TopicProgress {
  /** Learning steps of the topic (opened, predicted, challenges), done / total. */
  done: number;
  total: number;
  complete: boolean;
}

/** Progress of one topic. Topics without activities count "opened" only. */
export function topicProgress(topic: string, p: Progress): TopicProgress {
  const challenges = challengesFor(topic);
  const poe = poeFor(topic);
  const total = 1 + (poe ? 1 : 0) + challenges.length;
  let done = p.visited[topic] ? 1 : 0;
  if (poe && p.predictions[poe.id] !== undefined) done++;
  done += challenges.filter((c) => p.challenges[c.id] !== undefined).length;
  return { done, total, complete: done === total };
}

/** Topics of a chapter that are complete, out of the available ones. */
export function chapterProgress(topics: readonly { id: string; status: string }[], p: Progress) {
  const available = topics.filter((t) => t.status === 'available');
  return {
    done: available.filter((t) => topicProgress(t.id, p).complete).length,
    total: available.length,
  };
}

export interface Badge {
  id: string;
  title: MessageKey;
  /** Specific description of what was achieved. */
  desc: MessageKey;
  params?: Record<string, string | number>;
}

/** Badges earned so far. They reward trying and finishing, never speed or rank. */
export function earnedBadges(p: Progress): Badge[] {
  const out: Badge[] = [];
  const visited = Object.keys(p.visited);
  if (visited.length >= 1)
    out.push({
      id: 'firstSteps',
      title: 'learn.badges.firstSteps',
      desc: 'learn.badges.firstStepsDesc',
    });
  if (visited.length >= 10)
    out.push({
      id: 'explorer',
      title: 'learn.badges.explorer',
      desc: 'learn.badges.explorerDesc',
      params: { count: 10 },
    });
  const inSubject = (s: (typeof SUBJECTS)[number]) =>
    CATALOG[s].some((c) => c.topics.some((t) => p.visited[t.id]));
  if (SUBJECTS.every(inSubject))
    out.push({
      id: 'allSubjects',
      title: 'learn.badges.allSubjects',
      desc: 'learn.badges.allSubjectsDesc',
    });
  if (Object.keys(p.predictions).length >= 5)
    out.push({
      id: 'predictor',
      title: 'learn.badges.predictor',
      desc: 'learn.badges.predictorDesc',
      params: { count: 5 },
    });
  if (Object.keys(p.challenges).length >= 1)
    out.push({
      id: 'challenger',
      title: 'learn.badges.challenger',
      desc: 'learn.badges.challengerDesc',
    });
  for (const chapter of CATALOG.physics) {
    const ids = chapter.topics.flatMap((t) => challengesFor(t.id).map((c) => c.id));
    if (ids.length > 0 && ids.every((id) => p.challenges[id] !== undefined))
      out.push({
        id: `chapter.${chapter.id}`,
        title: 'learn.badges.chapter',
        desc: 'learn.badges.chapterDesc',
        params: { chapter: chapter.titleKey },
      });
  }
  return out;
}
