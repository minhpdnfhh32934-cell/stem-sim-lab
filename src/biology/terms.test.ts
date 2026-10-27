import { describe, expect, it } from 'vitest';

/** Every biology source file (the lessons' texts are inline LocalizedText); tests excluded. */
const SOURCES = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** One spelling per term across the biology lessons (UI audit UI-45): other spelling → the one kept. */
const OTHER_SPELLINGS: readonly [RegExp, string][] = [
  [/[Cc]romatit/, 'crômatit'],
  [/[Rr]ibôxôm/, 'ribosome (SGK, bài Tế bào)'],
  [/[Mm]inh hoạ/, 'minh họa'],
];

describe('biology terms', () => {
  it('reads the source files', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
  });

  it.each(OTHER_SPELLINGS)('no lesson writes %s (kept: %s)', (other) => {
    const hits = Object.entries(SOURCES)
      .filter(([, text]) => other.test(text))
      .map(([file]) => file);
    expect(hits).toEqual([]);
  });
});
