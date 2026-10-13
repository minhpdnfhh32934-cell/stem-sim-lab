/**
 * Links an AI Teacher answer to the simulation that shows it (audit EDU-03): when the learner's
 * question names an available topic ("nguyên phân", "rơi tự do", "cân bằng phương trình"), the
 * chat offers "Xem mô phỏng: Nguyên phân". Found by plain text matching on the catalog, never
 * chosen by the AI; every number in the simulation still comes from its engine.
 */
import { CATALOG, normalizeForSearch } from '@/app/catalog';
import { translate, type Locale } from '@/app/i18n';
import { SUBJECTS } from '@/app/workspaceStore';

export interface TopicLink {
  id: string;
  title: string;
}

/** Whole-phrase match on folded text (so "phân" alone never matches "nguyên phân"). */
function containsPhrase(haystack: string, phrase: string): boolean {
  const words = phrase.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const pattern = new RegExp(
    `(^|[^\\p{L}\\d])${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')}(?![\\p{L}\\d])`,
    'u',
  );
  return pattern.test(haystack);
}

/** The best available topic named in `text`: the longest title found wins. */
export function topicForText(text: string, locale: Locale): TopicLink | null {
  const haystack = normalizeForSearch(text);
  let best: TopicLink | null = null;
  let bestLength = 0;
  for (const subject of SUBJECTS) {
    for (const chapter of CATALOG[subject]) {
      for (const topic of chapter.topics) {
        if (topic.status !== 'available') continue;
        const title = translate(locale, topic.titleKey);
        // "Con lắc đơn", "Định luật Hardy–Weinberg": the title without brackets and dashes.
        const phrase = normalizeForSearch(title.replace(/\(.*?\)/g, ' ').replace(/[–—-]/g, ' '));
        if (phrase.length >= 4 && containsPhrase(haystack, phrase) && phrase.length > bestLength) {
          best = { id: topic.id, title };
          bestLength = phrase.length;
        }
      }
    }
  }
  return best;
}
