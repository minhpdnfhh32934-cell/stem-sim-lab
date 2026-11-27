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

/** Lower case, accents kept, words separated by single spaces ("Bảng tuần hoàn?" → "bảng tuần hoàn"). */
function plain(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The question has accents (or "đ"): its words are compared with their accents. */
function accented(text: string): boolean {
  return fold(text) !== text.normalize('NFD').toLowerCase();
}

/**
 * Whole phrases, written with their accents. A question with accents is compared with them as
 * written, so "bảng tuần hoàn" never reads as the character Tuấn, "chạy" (run) never as "cháy"
 * (fire), "thấy quang phổ" never as "thầy Quang"; a question typed without any accent is compared
 * with accents removed on both sides (the only case where such words can be confused).
 */
export function phrases(list: readonly string[]): (query: string) => boolean {
  const exact = list.map((p) => ` ${plain(p)} `);
  const loose = list.map((p) => ` ${words(p)} `);
  return (query) => {
    const withAccents = accented(query);
    const text = withAccents ? ` ${plain(query)} ` : ` ${words(query)} `;
    return (withAccents ? exact : loose).some((p) => text.includes(p));
  };
}

/** "game", but not "a game of billiards" or "game theory" (English exercises). */
const GAME = /(?<![\p{L}\p{N}])game(?!\s+(?:of|theory)\b)(?![\p{L}\p{N}])/iu;

/**
 * Words that only a question about the game uses: its name, "game", its teacher and the places,
 * people and things no textbook names. Left out on purpose: names a science question also uses
 * ("projectile range", "phòng thực hành hóa học", "trong trò chơi" of an exercise, "phong lan" the
 * orchid, "ra đề kiểm tra" asked of AI Teacher itself, "gọi 114" of a real fire). A follow-up is
 * caught by `continuesGame`. Checked on every evaluation and held-out question (none is a game
 * question).
 */
const GAME_PHRASES = phrases([
  'simlab 3d',
  'simlab3d',
  'trò chơi simlab',
  'trò chơi 3d',
  'trò chơi này',
  'mở trò chơi',
  'thầy quang',
  'mr quang',
  'sảnh simlab',
  'simlab hub',
  'khu ném xiên',
  'khu con lắc',
  'phòng chuẩn bị',
  'preparation room',
  'hành lang phòng sạch',
  'vào phòng sạch',
  'cleanroom entry',
  'phòng giáo viên',
  'teacher room',
  'teacher s room',
  'teacher bathroom',
  'chemistry annex',
  'biology annex',
  'phòng sóng và quang học',
  'pendulum bay',
  'tạo nhân vật',
  'chọn nhân vật',
  'nhân vật của bạn',
  'laptop ở sảnh',
  'thư viện kiến thức simlab',
  'bảng tiến độ học tập',
  'learning progress board',
  'chơi nhiều người',
  'máy chủ phòng',
  'màn mở đầu tên lửa',
  'rocket intro',
]);

export function isGameQuestion(query: string): boolean {
  return GAME.test(query) || GAME_PHRASES(query);
}

/** "Còn con lắc thì sao?", "What about the pendulum?": goes on with the question before it. */
const GOES_ON = /^\s*(?:còn|thế còn|vậy còn|vậy|thế|and|what about|how about)(?![\p{L}\p{N}])/iu;

/**
 * Things only the game has: a short question naming one goes on with a game question before it.
 * Not "thầy" (learners call AI Teacher "thầy" too) nor "bảng tuần hoàn" (a chemistry lesson too).
 */
const GAME_THINGS = phrases([
  'nhân vật',
  'laptop',
  'bàn làm việc',
  'bàn điều khiển',
  'đồ bảo hộ',
  'găng tay',
  'kính bảo hộ',
  'áo blouse',
  'phòng sạch',
  'cứu hỏa',
  'điện thoại',
  'túi đồ',
  'phím',
  'menu',
  'bản lưu',
  'workbench',
  'control desk',
  'hotbar',
]);

/** A short follow-up ("Còn phòng Hóa thì sao?", "Nhân vật nào cao nhất?") to the learner's own game question before it. */
export function continuesGame(question: string, before: string): boolean {
  if (!isGameQuestion(before)) return false;
  return GOES_ON.test(question) || (question.length <= 80 && GAME_THINGS(question));
}

/** Which section a question's words point to first (before the library's own ranking), in order. */
const SECTION_HINTS: [(query: string) => boolean, string][] = [
  [phrases(['nhân vật', 'character', 'characters']), 'characters'],
  [
    phrases([
      'đề kiểm tra',
      'bài kiểm tra',
      'chấm bài',
      'chấm điểm',
      'ngân hàng câu hỏi',
      'test paper',
      'question bank',
    ]),
    'test-papers',
  ],
  [phrases(['thầy quang', 'mr quang', 'giảng trên bảng', 'ví dụ trên bảng']), 'npc:teacher'],
  [
    phrases(['laptop', 'cuốn sách', 'sách kiến thức', 'thư viện kiến thức', 'knowledge books']),
    'laptop-books',
  ],
  [
    phrases([
      'bảng tuần hoàn',
      'bảng tiến độ',
      'tiến độ học tập',
      'sàn kính',
      'mô hình adn',
      'mô hình nguyên tử',
      'mô hình sóng',
      'giếng trời',
      'periodic table',
      'progress board',
    ]),
    'hub-boards',
  ],
  [
    phrases([
      'bàn làm việc',
      'bàn điều khiển',
      'sai số',
      'độ không đảm bảo',
      'bình phương tối thiểu',
      'khớp đường thẳng',
      'phân tích các lần chạy',
      'chạy thí nghiệm',
      'làm thí nghiệm',
      'workbench',
      'control desk',
      'uncertainty',
      'linear fit',
    ]),
    'how-experiments-work',
  ],
  [
    phrases([
      'phím',
      'điều khiển',
      'nhảy',
      'chạy',
      'đi bộ',
      'key',
      'keys',
      'controls',
      'hotbar',
      'túi đồ',
      'gamepad',
      'tay cầm',
    ]),
    'controls',
  ],
  [
    phrases([
      'phòng sạch',
      'đồ bảo hộ',
      'áo blouse',
      'kính bảo hộ',
      'găng tay',
      'rửa tay',
      'sát khuẩn',
      'cleanroom',
    ]),
    'procedure:cleanroom-entry',
  ],
  [
    phrases([
      '114',
      '113',
      'cháy',
      'cứu hỏa',
      'công an',
      'cảnh sát',
      'chập mạch',
      'đoản mạch',
      'bình chữa cháy',
      'fire',
      'extinguisher',
    ]),
    'emergency',
  ],
  [
    phrases(['lan', 'nhiều người', 'chơi chung', 'multiplayer', 'id phòng', 'máy chủ phòng']),
    'lan',
  ],
  [
    phrases([
      'menu',
      'tên lửa',
      'màn mở đầu',
      'danh mục thí nghiệm',
      'lưu tiến trình',
      'bản lưu',
      'rocket',
      'catalog',
      'save',
      'saves',
      'đồ họa',
      'đồ hoạ',
    ]),
    'menu-and-saves',
  ],
];

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
  const hinted = SECTION_HINTS.filter(([hint]) => hint(query))
    .map(([, id]) => all.find((d) => d.id === `builtin:game:${id}`))
    .filter((d): d is KnowledgeDocument => d !== undefined);
  const named = all
    .map((d) => ({ d, title: words(d.name.split(' · ').pop() ?? '') }))
    .filter(({ title }) => title.includes(' ') && asked.includes(` ${title} `))
    .sort((a, b) => b.title.length - a.title.length)
    .map(({ d }) => d);
  const ranked = [
    ...hinted,
    ...named,
    ...rankDocuments(query.replace(NAMES_THE_GAME, ' '), all, locale).map((r) => r.document),
  ].filter((d, i, list) => list.indexOf(d) === i);
  if (limit <= 1) return [ranked[0] ?? overview];
  return [overview, ...ranked.filter((d) => d !== overview)].slice(0, limit);
}
