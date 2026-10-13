import { describe, expect, it } from 'vitest';
import { languageName, shortVoiceName, voiceChoices } from './voiceChoices';

const voice = (name: string, lang: string) => ({ voiceURI: `${name}|${lang}`, name, lang });

describe('voice list in Settings', () => {
  it('drops the language Windows appends to the voice name', () => {
    expect(shortVoiceName('Microsoft David - English (United States)')).toBe('Microsoft David');
    expect(shortVoiceName('Microsoft An Online (Natural) - Vietnamese (Vietnam)')).toBe(
      'Microsoft An Online (Natural)',
    );
    expect(shortVoiceName('Google US English')).toBe('Google US English');
  });

  it('names the language in the learner language, or keeps an unknown code', () => {
    expect(languageName('vi-VN', 'vi')).toMatch(/^Tiếng Việt/);
    expect(languageName('en_US', 'en')).toMatch(/English/);
    expect(languageName('not a tag!', 'vi')).toBe('not a tag!');
  });

  it('puts Vietnamese voices first and sorts the others by language', () => {
    const { vietnamese, others } = voiceChoices(
      [
        voice('Google 日本語', 'ja-JP'),
        voice('Microsoft David - English (United States)', 'en-US'),
        voice('Microsoft An - Vietnamese (Vietnam)', 'vi-VN'),
        voice('Google Deutsch', 'de-DE'),
      ],
      'vi',
    );
    expect(vietnamese.map((v) => v.label)).toEqual([expect.stringMatching(/^Microsoft An · /)]);
    expect(others).toHaveLength(3);
    expect(others.every((v) => !v.label.includes('United States'))).toBe(true);
    const languages = others.map((v) => v.label.split(' · ')[1] ?? '');
    expect([...languages].sort((a, b) => a.localeCompare(b, 'vi'))).toEqual(languages);
  });
});
