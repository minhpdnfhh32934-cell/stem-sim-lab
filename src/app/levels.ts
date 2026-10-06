import { CATALOG, type ChapterEntry, type TopicEntry } from '@/app/catalog';
import type { Level } from '@/app/learner/profileStore';
import { SUBJECTS, type Subject } from '@/app/workspaceStore';

export interface LevelInfo {
  id: Level;
  /** 'planned': shown as "sắp có", no topics yet. */
  status: 'available' | 'planned';
}

/** Level → Subject → Topic (PROMPT_PHAN_2 A4.1). The MVP builds "Nền tảng" first. */
export const LEVELS: readonly LevelInfo[] = [
  { id: 'foundation', status: 'available' },
  { id: 'general', status: 'planned' },
];

/**
 * Curriculum mapping of the topics (grade / lesson in a specific programme or textbook).
 * Not filled in: it must come from a teacher, never be guessed (PROMPT_PHAN_2 A4.1,
 * MASTER_PROMPT §2.5). Listed in docs/DATA_REVIEW.md.
 */
export const CURRICULUM_MAPPING = {
  review_status: 'pending',
  /** topic id → reference (e.g. "Vật lý 10, Bài …"), filled in after a teacher's review. */
  entries: {} as Record<string, string>,
} as const;

/** Chapters of a subject at a level (every current topic is "Nền tảng"). */
export function chaptersFor(level: Level, subject: Subject): ChapterEntry[] {
  return level === 'foundation' ? CATALOG[subject] : [];
}

export interface Suggestion {
  subject: Subject;
  topic: TopicEntry;
}

/**
 * Topics suggested on the home screen: the first available topics of each subject (catalog
 * order = the order a course usually follows), subjects the learner chose first.
 */
export function suggestions(level: Level, interests: readonly Subject[], perSubject = 2) {
  const order = [...interests, ...SUBJECTS.filter((s) => !interests.includes(s))];
  const out: Suggestion[] = [];
  for (const subject of order) {
    const topics = chaptersFor(level, subject)
      .flatMap((c) => c.topics)
      .filter((t) => t.status === 'available')
      .slice(0, perSubject);
    for (const topic of topics) out.push({ subject, topic });
  }
  return out;
}

/** Number of topics that can be opened now, per subject and level. */
export function availableCount(level: Level, subject: Subject): number {
  return chaptersFor(level, subject)
    .flatMap((c) => c.topics)
    .filter((t) => t.status === 'available').length;
}
