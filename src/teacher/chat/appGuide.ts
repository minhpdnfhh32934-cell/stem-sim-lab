import type { Locale } from '@/app/i18n/types';
import type { KnowledgeDocument } from './chatStore';
import { isGameQuestion, phrases } from './gameGuide';
import { rankDocuments } from './knowledge';

/*
 * What AI Teacher knows about the SimLab application itself (screens, tools, AI engines,
 * shortcuts, settings, curriculum, files, safety, updates): a guide generated from the code
 * (`npm run app-guide` → data/app_guide.json). Like the game guide it is searched only for a
 * question about the app, and on its own, so the science library's term weights and every other
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

/**
 * Names that only a question about the app uses: its own features (checked on every evaluation
 * and held-out question: none is an app question). Left out on purpose: what a learner asks AI
 * Teacher to do ("phân tích đề", "suy nghĩ kĩ", "soạn bài", "giảng trên bảng").
 */
const APP_FEATURES = phrases([
  'science studio',
  'virtual lab',
  'bảng giảng',
  'teachscript',
  'khoanh để hỏi',
  'circle to ask',
  'deepthink',
  'tôi hiểu đề như sau',
  'tự dựng cảnh',
  'manual scene builder',
  'thẻ khoa học',
  'science card',
  'học bằng khám phá',
  'sổ ghi',
  'run log',
  'quét tham số',
  'parameter sweep',
  'gemma',
  'qwen',
  'ollama',
  'lm studio',
  'llama cpp',
  'llama server',
  'webgpu',
  'gpu cho gemma',
  'ai trong simlab',
  'ai trên máy khác',
  'kết nối ai',
  'stemsim',
  'microsoft store',
  'smart app control',
  'smartscreen',
  'thư viện tri thức',
  'trí nhớ cuộc trò chuyện',
  'mms tts',
  'chế độ cơ bản',
  'chế độ nâng cao',
  'nguồn giả định',
  'thông tin máy',
]);

/** The app by name ("SimLab", "ứng dụng này"); a bare "ứng dụng" is also "an application of" a law. */
const APP_NAME = phrases([
  'simlab',
  'ứng dụng này',
  'phần mềm này',
  'app này',
  'this app',
  'the app',
]);
const APP_ASK = phrases([
  'là gì',
  'có gì',
  'làm được gì',
  'dùng',
  'phiên bản',
  'version',
  'cài đặt',
  'settings',
  'phím tắt',
  'shortcut',
  'shortcuts',
  'lưu',
  'mở tệp',
  'xuất csv',
  'xuất ảnh',
  'png',
  'lịch sử',
  '3d',
  'chủ đề',
  'mô phỏng',
  'lớp 10',
  'lớp 11',
  'lớp 12',
  'kết nối tri thức',
  'sgk',
  'ai',
  'api key',
  'groq',
  'gemini',
  'claude',
  '18',
  'cập nhật',
  'update',
  'what',
  'how',
]);

export function isAppQuestion(query: string): boolean {
  if (isGameQuestion(query)) return false;
  return APP_FEATURES(query) || (APP_NAME(query) && APP_ASK(query));
}

/** "Còn Ollama thì sao?", "What about Groq?": goes on with the question before it. */
const GOES_ON = /^\s*(?:còn|thế còn|vậy còn|vậy|thế|and|what about|how about)(?![\p{L}\p{N}])/iu;

/** A short follow-up to the learner's own question about the app before it. */
export function continuesApp(question: string, before: string): boolean {
  return GOES_ON.test(question) && isAppQuestion(before);
}

/** Words that only say "the app", never which part of it: left out when the guide is searched. */
const NAMES_THE_APP =
  /(?<![\p{L}\p{N}])(?:simlab|ứng dụng|ung dung|phần mềm|phan mem|app|application)(?![\p{L}\p{N}])/giu;

/** Which section a question's words point to first, in order. */
const APP_HINTS: [(query: string) => boolean, string][] = [
  [
    phrases([
      'phân tích đề',
      'tôi hiểu đề',
      'tự dựng cảnh',
      'manual scene',
      'camera',
      'chụp ảnh',
      'bộ nhớ đệm',
    ]),
    'app-problem-reading',
  ],
  [
    phrases(['khoanh để hỏi', 'circle to ask', 'bảng giảng', 'teachscript', 'whiteboard']),
    'app-whiteboard',
  ],
  [
    phrases([
      'deepthink',
      'gemma',
      'qwen',
      'ollama',
      'lm studio',
      'llama',
      'webgpu',
      'groq',
      'gemini',
      'claude',
      'api key',
      'vram',
      'gpu',
      'kết nối ai',
      'ai trong simlab',
      'ai trên máy khác',
      'loopback',
    ]),
    'app-ai-engines',
  ],
  [phrases(['science studio', 'soạn bài', 'poe', 'dự đoán', 'hỏi thầy']), 'app-science-studio'],
  [
    phrases([
      'thẻ khoa học',
      'science card',
      'học bằng khám phá',
      'thử thách',
      'độ tin cậy',
      'định lượng',
      'cơ bản',
      'nâng cao',
    ]),
    'app-science-card',
  ],
  [
    phrases(['ai teacher', 'gia sư', 'orb', 'ghi nhớ', 'lượt dùng', 'viết tiếp', 'hoàn tác']),
    'app-ai-teacher',
  ],
  [
    phrases(['kết nối tri thức', 'kntt', 'sgk', 'lớp 10', 'lớp 11', 'lớp 12']),
    'app-curriculum-kntt',
  ],
  [
    phrases([
      'phím tắt',
      'shortcut',
      'shortcuts',
      'ctrl',
      'cài đặt',
      'settings',
      'stemsim',
      'xuất csv',
      'xuất ảnh',
      'png',
      'lịch sử',
      'tệp',
      'file',
      'thư viện tri thức',
      'trí nhớ',
      'giọng đọc',
    ]),
    'app-files-shortcuts-settings',
  ],
  [
    phrases([
      '18',
      'tuổi',
      'an toàn',
      'báo cáo',
      'microsoft store',
      'smartscreen',
      'smart app control',
      'cập nhật',
      'update',
      'quyền riêng tư',
      'dữ liệu',
    ]),
    'app-safety-updates',
  ],
  [
    phrases([
      'quét tham số',
      'parameter sweep',
      'sổ ghi',
      'run log',
      'đồ thị',
      'lời giải',
      'vật lý',
      'vật lí',
      'physics',
      'đồng hồ bấm giờ',
      'thước đo',
    ]),
    'app-physics',
  ],
  [
    phrases([
      'hóa học',
      'sinh học',
      'chemistry',
      'biology',
      'bảng tuần hoàn',
      'nguyên phân',
      'giảm phân',
      'cân bằng phương trình',
      'chuẩn độ',
    ]),
    'app-chemistry-biology',
  ],
];

const NAME: Record<Locale, string> = { vi: 'Hướng dẫn SimLab', en: 'SimLab guide' };
const SOURCE: Record<Locale, string> = { vi: 'Nguồn', en: 'Source' };
const PENDING: Record<Locale, string> = {
  vi: 'Trạng thái: hướng dẫn này chưa được giáo viên duyệt.',
  en: 'Status: this guide is not yet reviewed by a teacher.',
};

let guide: Promise<Guide> | null = null;

/** The guide's sections as library documents (loaded on the first app question). */
export async function appKnowledge(locale: Locale): Promise<KnowledgeDocument[]> {
  guide ??= import('@data/app_guide.json').then((m) => m.default as Guide);
  const { sections, reviewStatus } = await guide;
  return sections.map((s) => ({
    id: `builtin:app:${s.id}`,
    name: `${NAME[locale]} · ${s[locale].title}`,
    text: [
      s[locale].text,
      `${SOURCE[locale]}: SimLab, ${s.source}`,
      ...(reviewStatus === 'pending' ? [PENDING[locale]] : []),
    ].join('\n'),
    addedAt: 0,
  }));
}

/**
 * Guide sections for an app question: a cloud prompt gets the overview and the best matches
 * (`limit` in all), an on-device prompt its one best match, or the overview when nothing matches.
 */
export async function searchAppGuide(
  query: string,
  locale: Locale,
  limit: number,
): Promise<KnowledgeDocument[]> {
  const all = await appKnowledge(locale);
  const overview = all[0] as KnowledgeDocument;
  const hinted = APP_HINTS.filter(([hint]) => hint(query))
    .map(([, id]) => all.find((d) => d.id === `builtin:app:${id}`))
    .filter((d): d is KnowledgeDocument => d !== undefined);
  const ranked = [
    ...hinted,
    ...rankDocuments(query.replace(NAMES_THE_APP, ' '), all, locale).map((r) => r.document),
  ].filter((d, i, list) => list.indexOf(d) === i);
  if (limit <= 1) return [ranked[0] ?? overview];
  return [overview, ...ranked.filter((d) => d !== overview)].slice(0, limit);
}
