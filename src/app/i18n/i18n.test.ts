import { describe, expect, it } from 'vitest';
import { LOCALES, formatNumber, getDictionary, translate } from './index';

/** Collects every dotted leaf key of a nested message object. */
function keysOf(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keysOf(v as object, `${prefix}${k}.`),
  );
}

describe('i18n dictionaries', () => {
  const viKeys = keysOf(getDictionary('vi')).sort();

  it.each(LOCALES)('locale "%s" has exactly the same keys as Vietnamese', (locale) => {
    expect(keysOf(getDictionary(locale)).sort()).toEqual(viKeys);
  });

  it.each(LOCALES)('locale "%s" has no empty strings', (locale) => {
    const dict = getDictionary(locale);
    for (const key of keysOf(dict)) {
      const value = key
        .split('.')
        .reduce<unknown>((n, p) => (n as Record<string, unknown>)[p], dict);
      expect(value, key).not.toBe('');
    }
  });

  it('Vietnamese strings are NFC-normalised (diacritics render consistently)', () => {
    const dict = getDictionary('vi');
    for (const key of keysOf(dict)) {
      const value = key
        .split('.')
        .reduce<unknown>((n, p) => (n as Record<string, unknown>)[p], dict) as string;
      expect(value, key).toBe(value.normalize('NFC'));
    }
  });
});

describe('translate()', () => {
  it('returns the string for the requested locale', () => {
    expect(translate('vi', 'subjects.physics')).toBe('Vật lý');
    expect(translate('en', 'subjects.physics')).toBe('Physics');
  });

  it('never crashes on an unknown key: returns the key itself', () => {
    // @ts-expect-error — deliberately invalid key
    expect(translate('vi', 'does.not.exist')).toBe('does.not.exist');
  });
});

describe('formatNumber()', () => {
  it('uses a decimal comma in Vietnamese and a decimal point in English', () => {
    expect(formatNumber('vi', 9.81)).toBe('9,81');
    expect(formatNumber('en', 9.81)).toBe('9.81');
  });
});
