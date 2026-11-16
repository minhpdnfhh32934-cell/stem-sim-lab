import { CURRICULUM, type Curriculum } from '@/app/curriculum';
import { L } from '@/biology/common';
import type { Source } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import type { StudioScenario } from '../scenario';
import { guidedOf } from './check';

/** The textbook lesson a guided lesson follows, read from the generated curriculum data. */
export interface KnttLesson {
  bookTitle: string;
  url: string;
  number: number;
  /** Exactly as the table of contents prints it. */
  title: string;
  from: number;
  /** Last printed page: the page before the next lesson (null for a book's last lesson). */
  to: number | null;
}

export function knttLesson(
  kntt: { book: string; lesson: number },
  data: Curriculum = CURRICULUM,
): KnttLesson | null {
  const book = data.books.find((b) => b.id === kntt.book);
  if (!book) return null;
  const lessons = book.chapters.flatMap((c) => c.lessons);
  const lesson = lessons.find((l) => l.number === kntt.lesson);
  if (!lesson) return null;
  const next = lessons.filter((l) => l.page > lesson.page).sort((a, b) => a.page - b.page)[0];
  return {
    bookTitle: book.title,
    url: book.url,
    number: kntt.lesson,
    title: lesson.title,
    from: lesson.page,
    to: next ? next.page - 1 : null,
  };
}

/** The lesson's citation, built from the curriculum data (never typed by hand). */
export function knttSource(kntt: { book: string; lesson: number }): Source | null {
  const l = knttLesson(kntt);
  if (!l) return null;
  const pages = l.to === null ? `tr. ${l.from}` : `tr. ${l.from}–${l.to}`;
  return {
    id: `kntt-${kntt.book.toLowerCase()}-${l.number}`,
    citation: `SGK ${l.bookTitle} “Kết nối tri thức với cuộc sống”, NXB Giáo dục Việt Nam — Bài ${l.number}. ${l.title}, ${pages}`,
    url: l.url,
  };
}

const DESCRIPTIVE = L(
  'Bài học mô tả theo sách giáo khoa, bằng lời văn của SimLab: không có thí nghiệm, phép đo hay phép tính.',
  'A descriptive lesson that follows the textbook, in SimLab’s own words: no experiment, measurement or calculation.',
);

/** How each kind of activity is named in the card's model line. */
const KIND = {
  order: L('sắp xếp', 'order'),
  match: L('ghép đôi', 'match'),
  sort: L('phân loại', 'sort'),
} as const;

/** "a, b và c" / "a, b and c". */
function list(words: string[], and: string): string {
  const last = words.at(-1) ?? '';
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} ${and} ${last}` : last;
}

/**
 * Science Card of a guided lesson: qualitative, no equation, the lesson's own assumptions and
 * limits, and the textbook lesson as its source.
 */
export function guidedCard(scenario: StudioScenario): ScienceCardData {
  const b = guidedOf(scenario);
  const source = b ? knttSource(b.kntt) : null;
  // Only the kinds this lesson has, in the order it first uses them.
  const kinds = [...new Set(b?.activities.map((a) => a.kind) ?? [])].map((k) => KIND[k]);
  return {
    title: scenario.title,
    model: L(
      `Bài học có hướng dẫn theo sách giáo khoa: một câu dự đoán và các hoạt động ${list(
        kinds.map((k) => k.vi),
        'và',
      )}. Đáp án là chính nội dung bài, ứng dụng chỉ so câu trả lời với đáp án.`,
      `A guided lesson that follows the textbook: one prediction and activities that ${list(
        kinds.map((k) => k.en),
        'and',
      )}. The answers are the lesson’s own content; the app only compares each answer with them.`,
    ),
    equations: [],
    assumptions: [DESCRIPTIVE, ...scenario.assumptions, ...scenario.limits],
    confidence: 'qualitative',
    userIntervened: false,
    // The book first; a lesson that also uses another source names it too.
    sources: [...(source ? [source] : []), ...scenario.sources],
    reviewStatus: scenario.review_status,
  };
}
