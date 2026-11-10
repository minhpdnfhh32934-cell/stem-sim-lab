import type { TFunction } from '@/app/i18n';
import type { LibraryChapter } from '@/app/levels';
import { normalizeForSearch } from '@/app/catalog';

export const chapterTitle = (c: LibraryChapter, t: TFunction) =>
  'key' in c.title ? t(c.title.key) : c.title.text;

/** Chapters whose title or topics match the query (accent- and case-insensitive). */
export function searchChapters(
  all: LibraryChapter[],
  query: string,
  t: TFunction,
): LibraryChapter[] {
  const q = normalizeForSearch(query);
  if (!q) return all;
  return all
    .map((c) => ({
      ...c,
      topics: c.topics.filter(
        (topic) =>
          normalizeForSearch(t(topic.titleKey)).includes(q) ||
          normalizeForSearch(chapterTitle(c, t)).includes(q),
      ),
    }))
    .filter((c) => c.topics.length > 0);
}
