import { describe, expect, it } from 'vitest';
import curriculum from '@data/curriculum_kntt.json';

/**
 * User decision 16/11/2026: the app writes "hóa" (tone on the first vowel of an open "oa", "oe",
 * "uy" syllable: hóa, họa, hòa, khóa, tỏa, thủy), never "hoá". Files that read text typed by a
 * learner or written by an AI accept both spellings on purpose and are left out, and so is a KNTT
 * lesson title quoted verbatim ("Dao động điều hoà", data/curriculum_kntt.json).
 */
const SOURCES = import.meta.glob<string>(
  [
    '/src/**/*.{ts,tsx}',
    '!/src/**/*.test.{ts,tsx}',
    '!/src/teacher/chat/{knowledge,missingData,tools,topicLink,turnKind}.ts',
    '!/src/teacher/voice/vietnameseText.ts',
    '!/src/safety/moderation.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
);

const NEW_STYLE = /(?<!\p{L})(\p{L}*?)(?:o[àáảãạèéẻẽẹ]|u[ỳýỷỹỵ])(?!\p{L})/giu;

/** Lesson titles of the textbooks, as printed: quoting one is not a spelling of the app's own. */
const TITLES = curriculum.books.flatMap((b) =>
  b.chapters.flatMap((c) => c.lessons.map((l) => l.title)),
);
/** The match at `at` lies on a line that quotes a whole lesson title. */
function inTitle(text: string, at: number): boolean {
  const end = text.indexOf('\n', at);
  const line = text.slice(text.lastIndexOf('\n', at) + 1, end < 0 ? text.length : end);
  return TITLES.some((t) => line.includes(t));
}

describe('spelling', () => {
  it('reads the source files', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(500);
  });

  it('writes "hóa", not "hoá" (and the same for họa, hòa, khóa, tỏa, thủy…)', () => {
    const hits = Object.entries(SOURCES).flatMap(([file, text]) =>
      [...text.matchAll(NEW_STYLE)]
        .filter((m) => !/q$/i.test(m[1] ?? '') && !inTitle(text, m.index))
        .map((m) => `${file}: ${m[0]}`),
    );
    expect(hits).toEqual([]);
  });
});
