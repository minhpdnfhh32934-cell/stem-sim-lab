import { describe, expect, it } from 'vitest';
import type { StudioScenario } from '../scenario';
import { builtInScenarios } from '../scenarios';
import { physicsFreeFall } from '../scenarios/physicsFreeFall';
import {
  MAX_LESSON_CHARS,
  MAX_LIST_ITEMS,
  MAX_TEXT_CHARS,
  MAX_TITLE_CHARS,
  sizeIssues,
} from './limits';

const text = (n: number) => ({ vi: 'a'.repeat(n), en: 'b' });

describe('lesson size limits', () => {
  it('every built-in scenario fits', () => {
    for (const s of builtInScenarios()) expect(sizeIssues(s)).toEqual([]);
  });

  it('refuses too many list items and over-long texts, naming the field', () => {
    const s: StudioScenario = {
      ...physicsFreeFall,
      title: text(MAX_TITLE_CHARS + 1),
      hints: Array.from({ length: MAX_LIST_ITEMS + 1 }, () => text(5)),
      limits: [text(MAX_TEXT_CHARS + 1)],
    };
    expect(sizeIssues(s)).toEqual([
      { code: 'listTooLong', params: { field: 'hints', max: MAX_LIST_ITEMS } },
      { code: 'textTooLong', params: { field: 'title', max: MAX_TITLE_CHARS } },
      { code: 'textTooLong', params: { field: 'limits', max: MAX_TEXT_CHARS } },
    ]);
    expect(sizeIssues({ ...physicsFreeFall, limits: [text(MAX_TEXT_CHARS)] })).toEqual([]);
  });

  it('caps the whole stored lesson even when each part is within its own limit', () => {
    const full = Array.from({ length: MAX_LIST_ITEMS }, () => text(MAX_TEXT_CHARS));
    const s: StudioScenario = { ...physicsFreeFall, hints: full, questions: full };
    expect(JSON.stringify(s).length).toBeGreaterThan(MAX_LESSON_CHARS);
    expect(sizeIssues(s).map((i) => i.code)).toEqual(['lessonTooLarge']);
  });
});
