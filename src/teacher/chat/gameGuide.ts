import type { Locale } from '@/app/i18n/types';
import type { KnowledgeDocument } from './chatStore';
import { rankDocuments } from './knowledge';

/*
 * What AI Teacher knows about the SimLab 3D game (docs/GAME.md): a guide generated from the
 * game's own content (`npm run game-guide` → data/game_guide.json). It is searched only for a
 * question about the game, and on its own, so the science library's term weights and every other
 * prompt stay exactly as they were.
 */

interface GuideSection {
  id: string;
  source: string;
  vi: { title: string; text: string };
  en: { title: string; text: string };
}

interface Guide {
  reviewStatus: 'pending' | 'verified';
  sections: GuideSection[];
}

/** Lower case, marks and "đ" folded: "Trò chơi" and "tro choi" read alike. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/giu, 'd').toLowerCase();
}

/** Folded words separated by single spaces ("Thầy Quang," → "thay quang"). */
function words(text: string): string {
  return fold(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Words that only a question about the game uses: its name, "game" (not "game of…", "game
 * theory": an English exercise may play a game of billiards), its teacher and the rooms whose
 * names no textbook uses. A follow-up is caught too, because the query carries the previous
 * question. Checked on every evaluation and held-out question (none is a game question).
 */
const GAME_WORDS =
  /\bsimlab\s*3d\b|\bgame\b(?!\s+(?:of|theory)\b)|\btro choi (?:simlab|3d|nay)\b|\bmr\.? quang\b|\bsanh simlab\b|\bsimlab hub\b|\bkhu (?:nem xien|con lac)\b|\bphong chuan bi\b|\bpreparation room\b|\bhanh lang phong sach\b/u;

/** "Thầy Quang" by its tone: folded, "Em thấy quang phổ…" would read as the teacher. */
const TEACHER = /(?<![\p{L}\p{N}])thầy quang(?![\p{L}\p{N}])/u;
const UNACCENTED_TEACHER = /\bthay quang\b/u;

export function isGameQuestion(query: string): boolean {
  const folded = fold(query);
  const accented = folded !== query.normalize('NFD').toLowerCase();
  return (
    GAME_WORDS.test(folded) ||
    (accented
      ? TEACHER.test(query.normalize('NFC').toLowerCase())
      : UNACCENTED_TEACHER.test(folded))
  );
}

/** "Còn con lắc thì sao?", "What about the pendulum?": goes on with the question before it. */
const GOES_ON = /^\s*(?:còn|thế còn|vậy còn|vậy|thế|and|what about|how about)(?![\p{L}\p{N}])/iu;

/** A short follow-up ("Còn phòng Hóa thì sao?") to the learner's own game question before it. */
export function continuesGame(question: string, before: string): boolean {
  return GOES_ON.test(question) && isGameQuestion(before);
}

/** Words that say "the game", never which part of it: left out when the guide is searched. */
const NAMES_THE_GAME =
  /(?<![\p{L}\p{N}])(?:simlab\s*3d|simlab|games?|trò chơi|tro choi)(?![\p{L}\p{N}])/giu;

const NAME: Record<Locale, string> = { vi: 'Hướng dẫn SimLab 3D', en: 'SimLab 3D guide' };
const SOURCE: Record<Locale, string> = { vi: 'Nguồn', en: 'Source' };
const PENDING: Record<Locale, string> = {
  vi: 'Trạng thái: nội dung khoa học của game chưa được giáo viên duyệt.',
  en: 'Status: the game’s science is not yet reviewed by a teacher.',
};

let guide: Promise<Guide> | null = null;

/** The guide's sections as library documents (loaded on the first game question). */
export async function gameKnowledge(locale: Locale): Promise<KnowledgeDocument[]> {
  guide ??= import('@data/game_guide.json').then((m) => m.default as Guide);
  const { sections, reviewStatus } = await guide;
  return sections.map((s) => ({
    id: `builtin:game:${s.id}`,
    name: `${NAME[locale]} · ${s[locale].title}`,
    text: [
      s[locale].text,
      `${SOURCE[locale]}: SimLab 3D, ${s.source}`,
      ...(reviewStatus === 'pending' ? [PENDING[locale]] : []),
    ].join('\n'),
    addedAt: 0,
  }));
}

/**
 * Guide sections for a game question: a cloud prompt gets the overview and the best matches
 * (`limit` in all), an on-device prompt its one best match, or the overview when nothing matches.
 */
export async function searchGameGuide(
  query: string,
  locale: Locale,
  limit: number,
): Promise<KnowledgeDocument[]> {
  const all = await gameKnowledge(locale);
  const overview = all[0] as KnowledgeDocument;
  // A section the question names ("Thầy Quang", "Rơi tự do", "Phòng chuẩn bị") comes first,
  // the longest name first: the word ranking drops "thầy" and cannot tell a topic listing
  // "Rơi tự do" from the experiment itself. One-word names ("Điện") are too loose for this.
  const asked = ` ${words(query)} `;
  const named = all
    .map((d) => ({ d, title: words(d.name.split(' · ').pop() ?? '') }))
    .filter(({ title }) => title.includes(' ') && asked.includes(` ${title} `))
    .sort((a, b) => b.title.length - a.title.length)
    .map(({ d }) => d);
  const ranked = [
    ...named,
    ...rankDocuments(query.replace(NAMES_THE_GAME, ' '), all, locale).map((r) => r.document),
  ].filter((d, i, list) => list.indexOf(d) === i);
  if (limit <= 1) return [ranked[0] ?? overview];
  return [overview, ...ranked.filter((d) => d !== overview)].slice(0, limit);
}
