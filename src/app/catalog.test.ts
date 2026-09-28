import { describe, expect, it } from 'vitest';
import { CATALOG, normalizeForSearch } from './catalog';
import { LOCALES, translate } from './i18n';

describe('topic catalog', () => {
  const all = Object.values(CATALOG).flat();

  it.each(LOCALES)('every chapter and topic has a real "%s" label', (locale) => {
    for (const chapter of all) {
      expect(translate(locale, chapter.titleKey)).not.toBe(chapter.titleKey);
      for (const topic of chapter.topics) {
        expect(translate(locale, topic.titleKey), topic.id).not.toBe(topic.titleKey);
      }
    }
  });

  it('topic ids are unique', () => {
    const ids = all.flatMap((c) => c.topics.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('normalizeForSearch()', () => {
  it('ignores Vietnamese diacritics and đ', () => {
    expect(normalizeForSearch('Dao động')).toBe('dao dong');
    expect(normalizeForSearch('ĐỘNG HỌC')).toBe('dong hoc');
    expect(normalizeForSearch('  Rơi tự do ')).toBe('roi tu do');
  });
});
