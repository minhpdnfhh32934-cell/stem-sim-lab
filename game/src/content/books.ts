import { z } from 'zod';

/**
 * The knowledge books on the hub's laptop (Phase F-2): Physics, Chemistry and Biology for grades
 * 10, 11 and 12 (Vietnam's 2018 curriculum, in the lesson order of the "Kết nối tri thức" books),
 * written as a textbook but closer to the student. One JSON file a book in `content/books/`,
 * loaded only when a book is opened (`loadBook`), checked here.
 *
 * Language: the books are Vietnamese study material (the curriculum's own language) — a SPEC
 * DEVIATION from "every content text in English and Vietnamese": the laptop's own interface is
 * translated, the books are not.
 *
 * Formulas are in the formula notation the board and the dialogue draw (core/formula.ts):
 * `m_A`, `x^2`, `a/b` as a fraction, `√(2h/g)`.
 */
const Text = z.string().min(1);

export const SectionSchema = z.object({
  heading: Text,
  paragraphs: z.array(Text).min(1),
  formulas: z.array(Text).min(1).optional(),
  example: z.object({ question: Text, steps: z.array(Text).min(1) }).optional(),
  tip: Text.optional(),
});

export const LessonSchema = z.object({
  id: z.string().regex(/^(physics|chemistry|biology)-1[0-2]-\d{2}$/),
  title: Text,
  hook: Text,
  sections: z.array(SectionSchema).min(1),
  remember: z.array(Text).min(1),
  check: z.object({ question: Text, answer: Text }),
  lab: z.string().min(1).optional(),
});

export const BookSchema = z.object({
  id: z.string().regex(/^(physics|chemistry|biology)-1[0-2]$/),
  subject: z.enum(['physics', 'chemistry', 'biology']),
  grade: z.union([z.literal(10), z.literal(11), z.literal(12)]),
  title: Text,
  tagline: Text,
  chapters: z.array(z.object({ title: Text, lessons: z.array(LessonSchema).min(1) })).min(1),
});

export type Book = z.infer<typeof BookSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type BookSubject = Book['subject'];

/** The nine books, in the desktop's order. */
export const BOOK_IDS = [
  'physics-10',
  'physics-11',
  'physics-12',
  'chemistry-10',
  'chemistry-11',
  'chemistry-12',
  'biology-10',
  'biology-11',
  'biology-12',
] as const;

const files = import.meta.glob<{ default: unknown }>('./books/*.json');

/** A book, fetched and checked; null with the reason when it is missing or does not fit. */
export async function loadBook(id: string): Promise<Book | { problem: string }> {
  const load = files[`./books/${id}.json`];
  if (!load) return { problem: `no book "${id}"` };
  const parsed = BookSchema.safeParse((await load()).default);
  return parsed.success ? parsed.data : { problem: parsed.error.issues[0]?.message ?? 'invalid' };
}
