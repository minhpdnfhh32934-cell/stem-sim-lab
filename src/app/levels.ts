import { CATALOG, type TopicEntry } from '@/app/catalog';
import { GRADES, gradeView } from '@/app/curriculum';
import type { MessageKey } from '@/app/i18n';
import type { GradeChoice } from '@/app/learner/profileStore';
import type { Subject } from '@/app/workspaceStore';

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
