import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTexts, ENGLISH, fill, type Language, localized, placeholders } from './i18n';

const catalogs = { vi: { hello: 'Xin chào', count: '{name}: {n} lần chạy' } };

describe('texts', () => {
  it('gives the chosen language’s text for a key, else the English written with it', () => {
    let language: Language = 'vi';
    const texts = createTexts(catalogs, () => language);
    expect(texts.ui('hello', 'Hello')).toBe('Xin chào');
    expect(texts.ui('missing', 'Only in English')).toBe('Only in English');
    language = 'en'; // one instance follows a change of language
    expect(texts.ui('hello', 'Hello')).toBe('Hello');
  });

  it('fills placeholders in each language’s own order; an unknown one stays as written', () => {
    const vi = createTexts(catalogs, () => 'vi');
    expect(ENGLISH.ui('count', '{n} runs of {name}', { n: 3, name: 'free fall' })).toBe(
      '3 runs of free fall',
    );
    expect(vi.ui('count', '{n} runs of {name}', { n: 3, name: 'rơi tự do' })).toBe(
      'rơi tự do: 3 lần chạy',
    );
    expect(fill('{n} runs of {name}', { n: 3 })).toBe('3 runs of {name}');
  });

  it('reads content’s own translation of a field, else its English', () => {
    const moon = { label: 'Moon', value: 1.62, vi: { label: 'Mặt Trăng' } };
    const earth = { label: 'Earth', value: 9.81 };
    const vi = createTexts({}, () => 'vi');
    expect(vi.of(moon, 'label')).toBe('Mặt Trăng');
    expect(vi.of(earth, 'label')).toBe('Earth');
    expect(ENGLISH.of(moon, 'label')).toBe('Moon');
  });

  it('lists placeholders sorted, so two languages of one text can be compared', () => {
    expect(placeholders('{n} runs of {name}')).toEqual(['n', 'name']);
    expect(placeholders('{name}: {n} lần chạy')).toEqual(['n', 'name']);
    expect(placeholders('No placeholder')).toEqual([]);
  });

  it('validates content translations: optional, non-empty, only of the fields named', () => {
    const Preset = z.object({ label: z.string(), value: z.number(), ...localized('label') });
    expect(Preset.safeParse({ label: 'Moon', value: 1.62 }).success).toBe(true);
    expect(Preset.parse({ label: 'Moon', value: 1.62, vi: { label: 'Mặt Trăng' } }).vi).toEqual({
      label: 'Mặt Trăng',
    });
    expect(Preset.safeParse({ label: 'Moon', value: 1.62, vi: { label: '' } }).success).toBe(false);
    expect(Preset.safeParse({ label: 'Moon', value: 1.62, vi: { lable: 'x' } }).success).toBe(
      false,
    );
  });
});
