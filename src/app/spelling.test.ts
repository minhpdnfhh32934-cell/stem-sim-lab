import { describe, expect, it } from 'vitest';

/**
 * User decision 16/11/2026: the app writes "hóa" (tone on the first vowel of an open "oa", "oe",
 * "uy" syllable: hóa, họa, hòa, khóa, tỏa, thủy), never "hoá". Files that read text typed by a
 * learner or written by an AI accept both spellings on purpose and are left out.
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

describe('spelling', () => {
  it('reads the source files', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(500);
  });

  it('writes "hóa", not "hoá" (and the same for họa, hòa, khóa, tỏa, thủy…)', () => {
    const hits = Object.entries(SOURCES).flatMap(([file, text]) =>
      [...text.matchAll(NEW_STYLE)]
        .filter((m) => !/q$/i.test(m[1] ?? ''))
        .map((m) => `${file}: ${m[0]}`),
    );
    expect(hits).toEqual([]);
  });
});
