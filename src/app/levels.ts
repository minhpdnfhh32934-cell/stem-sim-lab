import { CATALOG, type TopicEntry } from '@/app/catalog';
import { GRADES, gradeView } from '@/app/curriculum';
import type { MessageKey } from '@/app/i18n';
import type { GradeChoice } from '@/app/learner/profileStore';
import { SUBJECTS, type Subject } from '@/app/workspaceStore';

/** The library's switch "Lớp 10 · Lớp 11 · Lớp 12 · Tất cả". */
export const GRADE_CHOICES: readonly GradeChoice[] = [...GRADES, 'all'];

export interface LibraryTopic extends TopicEntry {
  /** Textbook lessons in the chosen grade (pending a teacher); empty under "Tất cả". */
  lessons: readonly number[];
}

export interface LibraryChapter {
  id: string;
  /** A SimLab chapter (i18n key), or a textbook chapter's title verbatim (grade view). */
  title: { key: MessageKey } | { text: string };
  topics: LibraryTopic[];
}

/**
 * Chapters of a subject in the chosen view: a grade lists its topics under the textbook's
 * chapters in book order (`gradeView`); "Tất cả" is the whole catalog, unplaced topics included.
 */
export function chaptersFor(grade: GradeChoice, subject: Subject): LibraryChapter[] {
  if (grade === 'all')
    return CATALOG[subject].map((c) => ({
      id: c.id,
      title: { key: c.titleKey },
      topics: c.topics.map((topic) => ({ ...topic, lessons: [] })),
    }));
  const entries = new Map(CATALOG[subject].flatMap((c) => c.topics).map((e) => [e.id, e]));
  return gradeView(grade, subject).map((c) => ({
    id: c.label,
    title: { text: c.label },
    topics: c.topics.flatMap(({ topic, lessons }) => {
      const entry = entries.get(topic);
      return entry ? [{ ...entry, lessons }] : [];
    }),
  }));
}

export interface Suggestion {
  subject: Subject;
  topic: TopicEntry;
}

/**
 * Topics suggested on the home screen: the first available topics of each subject in the chosen
 * view (book order for a grade, catalog order otherwise), subjects the learner chose first.
 */
export function suggestions(grade: GradeChoice, interests: readonly Subject[], perSubject = 2) {
  const order = [...interests, ...SUBJECTS.filter((s) => !interests.includes(s))];
  const out: Suggestion[] = [];
  for (const subject of order) {
    const topics = chaptersFor(grade, subject)
      .flatMap((c) => c.topics)
      .filter((t) => t.status === 'available')
      .slice(0, perSubject);
    for (const topic of topics) out.push({ subject, topic });
  }
  return out;
}

/** Number of topics that can be opened now, per subject in the chosen view. */
export function availableCount(grade: GradeChoice, subject: Subject): number {
  return chaptersFor(grade, subject)
    .flatMap((c) => c.topics)
    .filter((t) => t.status === 'available').length;
}
