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

/** A reply of at most this many words, with no topic of its own, continues the last question. */
const FOLLOW_UP_WORDS = 4;

/** Vietnamese tone marks (grave, acute, tilde, hook, dot below); other marks stay on the letter. */
const TONE_MARKS = /[\u0300\u0301\u0303\u0309\u0323]/gu;

interface Word {
  /** Letters with their vowel marks, tone apart: "hoá" and "hóa" are both "hoa|" + acute. */
  exact: string;
  /** No marks at all, "đ" → "d": for words typed without accents. */
  folded: string;
  /** The word was typed with accents (or "đ"). */
  accented: boolean;
}

function wordsOf(text: string): Word[] {
  return (
    text
      .normalize('NFD')
      .toLowerCase()
      .match(/[\p{L}\p{M}\d]+/gu) ?? []
  ).map((w) => {
    const tones = (w.match(TONE_MARKS) ?? []).sort().join('');
    const base = w.replace(TONE_MARKS, '').normalize('NFC');
    return {
      exact: `${base}|${tones}`,
      folded: normalizeForSearch(w),
      accented: /[\u0300-\u036f]|đ/u.test(w),
    };
  });
}

/**
 * The learner's word means the title's word: compared with accents when the learner typed them
 * ("giảm phần" is not "giảm phân"; "hoá" is "hóa", wherever the tone mark sits), folded when the
 * word was typed without any ("giam phan").
 */
function sameWord(said: Word, title: Word): boolean {
  return said.accented ? said.exact === title.exact : said.folded === title.folded;
}

/** Whole-word phrase match (so "phân" alone never matches "nguyên phân"). */
function containsPhrase(haystack: readonly Word[], phrase: readonly Word[]): boolean {
  if (phrase.length === 0) return false;
  for (let i = 0; i + phrase.length <= haystack.length; i++) {
    if (phrase.every((w, j) => sameWord(haystack[i + j] as Word, w))) return true;
  }
  return false;
}

/** The best available topic named in `text`: the longest title found wins. */
export function topicForText(text: string, locale: Locale): TopicLink | null {
  const haystack = wordsOf(text);
  let best: TopicLink | null = null;
  let bestLength = 0;
  for (const subject of SUBJECTS) {
    for (const chapter of CATALOG[subject]) {
      for (const topic of chapter.topics) {
        if (topic.status !== 'available') continue;
        const title = translate(locale, topic.titleKey);
        // "Con lắc đơn", "Định luật Hardy–Weinberg": the title without brackets and dashes.
        const phrase = wordsOf(title.replace(/\(.*?\)/g, ' '));
        const length = phrase.reduce((n, w) => n + w.folded.length, 0);
        if (length >= 4 && length > bestLength && containsPhrase(haystack, phrase)) {
          best = { id: topic.id, title };
          bestLength = length;
        }
      }
    }
  }
  return best;
}

interface ChatLine {
  role: string;
  content: string;
  /** Set on a quick button ("Chậm hơn"): it reworks the previous answer. */
  prompt?: string;
}

/** The teacher's message asks the learner something (a check question at its end). */
function asksBack(message: ChatLine | undefined): boolean {
  return message?.role === 'assistant' && /\?[\s*_)"'”»]*$/u.test(message.content);
}

/**
 * A reply that only continues the previous question: a quick button, or a few words that are not
 * a new question ("Ở kì giữa ạ.") — a short question counts when it answers the teacher's own.
 */
function isFollowUp(message: ChatLine, before: ChatLine | undefined): boolean {
  if (message.prompt) return true;
  const words = message.content.match(/[\p{L}\p{M}\d]+/gu) ?? [];
  if (words.length > FOLLOW_UP_WORDS) return false;
  return !message.content.trim().endsWith('?') || asksBack(before);
}

/**
 * The topic of the learner's latest question (null when it names none). A short follow-up with
 * no topic of its own keeps the topic of the question it follows; anything else drops the link,
 * so an old topic never shows under an unrelated answer.
 */
export function latestTopic(messages: readonly ChatLine[], locale: Locale): TopicLink | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'user') continue;
    const found = topicForText(m.content, locale);
    if (found) return found;
    if (!isFollowUp(m, messages[i - 1])) return null;
  }
  return null;
}
