import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '@/chemistry/data/elements';
import golden from './pronounceGolden.json';
import raw from './pronunciations.json';
import {
  PRONUNCIATIONS,
  applyPronunciations,
  parsePronunciations,
  type PronunciationEntry,
} from './pronunciations';
import { readUnit, toSpeech } from './vietnameseText';

/**
 * The pronunciation dictionary (pronunciations.json) is applied before the rule-based reader:
 * its entries win, and it never changes what a formula, a number or an equation says.
 */
const entry = (term: string, reading: string): PronunciationEntry => ({
  term,
  reading,
  subject: 'general',
  review_status: 'pending',
});

const SYMBOLS = new Set(ELEMENTS.map((e) => e.symbol));
/** "NaCl", "Co", "CO2": element symbols one after another (with counts). */
const isFormula = (term: string) =>
  [...term.matchAll(/[A-Z][a-z]?\d*/g)].map((m) => m[0]).join('') === term &&
  [...term.matchAll(/[A-Z][a-z]?/g)].every((m) => SYMBOLS.has(m[0]));

const digits = (s: string) => s.replace(/\D/g, '');

describe('the pronunciation dictionary file', () => {
  it('loads, and every entry waits for or has a teacher review', () => {
    expect(PRONUNCIATIONS.length).toBeGreaterThan(20);
    for (const e of PRONUNCIATIONS) {
      expect(['pending', 'verified']).toContain(e.review_status);
      expect(['physics', 'chemistry', 'biology', 'general']).toContain(e.subject);
    }
  });

  it('never holds a unit symbol, a chemical formula, a digit or a single letter', () => {
    for (const e of PRONUNCIATIONS) {
      expect(readUnit(e.term), e.term).toBeNull();
      expect(isFormula(e.term), e.term).toBe(false);
      expect(e.term.length, e.term).toBeGreaterThan(1);
      expect(`${e.term}${e.reading}`, e.term).not.toMatch(/\d/);
    }
  });

  it('readings reach the voice unchanged (the rule-based reader leaves them alone)', () => {
    for (const e of PRONUNCIATIONS) {
      expect(toSpeech(e.reading), e.term).toBe(e.reading);
      expect(toSpeech(`Theo ${e.reading} thì đúng.`), e.term).toBe(`Theo ${e.reading} thì đúng.`);
    }
  });

  it('refuses a broken file: a number in a reading, a symbol, a term twice', () => {
    const file = (entries: unknown[]) => ({ version: 1, about: '', entries });
    expect(() => parsePronunciations(file([entry('Volt', 'Vôn 2')]))).toThrow(/words only/);
    expect(() => parsePronunciations(file([entry('m', 'mét')]))).toThrow();
    expect(() => parsePronunciations(file([entry('a=b', 'a bằng b')]))).toThrow();
    expect(() => parsePronunciations(file([entry('Volt', 'Vôn'), entry('Volt', 'Vôn')]))).toThrow(
      /twice/,
    );
    expect(() => parsePronunciations({ ...raw, entries: [{ term: 'Volt' }] })).toThrow();
  });
});

describe('dictionary entries win over the rule-based reader', () => {
  it('reads a shipped entry the rule reader does not know', () => {
    expect(toSpeech('Tần số đo bằng Hertz.')).toContain('Hertz');
    const { text, readings } = applyPronunciations('Tần số đo bằng Hertz.');
    expect(toSpeech(text)).toBe('Tần số đo bằng Héc.');
    expect(readings).toEqual(['Héc']);
    expect(toSpeech(applyPronunciations('nhà bác học Isaac Newton').text)).toBe(
      'nhà bác học I-xắc Niu-tơn',
    );
  });

  it('overrides a reading the rule reader has (an entry is the teacher’s choice)', () => {
    expect(toSpeech('Phân tử ADN')).toBe('Phân tử a đê nờ');
    const dict = [entry('ADN', 'a-đê-en')];
    expect(toSpeech(applyPronunciations('Phân tử ADN', dict).text)).toBe('Phân tử a-đê-en');
  });

  it('matches whole words, a lower-case loanword also at the start of a sentence', () => {
    const { text } = applyPronunciations('Enzyme xúc tác. Các enzyme và proteinase.');
    expect(text).toBe('En-zim xúc tác. Các en-zim và proteinase.');
    expect(applyPronunciations('Nguyên lí Le  Chatelier').text).toBe('Nguyên lí Lơ Sa-tơ-li-ê');
  });
});

describe('the dictionary never changes what a formula means', () => {
  const dict = [entry('AB', 'a bê dài'), entry('glucose', 'glu-cô-zơ')];

  it('leaves formulas, code and equations as written', () => {
    for (const formula of [
      '$AB = 5$ cm',
      '\\(AB^2\\)',
      '`AB`',
      'AB = 5 cm',
      'x = AB + 1',
      'C6H12O6 hay glucose → 2 pyruvat',
    ]) {
      expect(applyPronunciations(formula, dict).text).toBe(formula);
    }
    expect(applyPronunciations('Đoạn AB dài 5 cm.', dict).text).toBe('Đoạn a bê dài dài 5 cm.');
  });

  it('a reaction keeps its arrow: "tạo thành" between species, as without the dictionary', () => {
    const text = 'Đường phân: glucose → 2 pyruvat.';
    expect(toSpeech(applyPronunciations(text, dict).text)).toBe(toSpeech(text));
    expect(toSpeech(text)).toContain('tạo thành');
  });

  it('keeps every digit and every golden reading of the 40-sentence set', () => {
    for (const item of golden as { id: string; text: string; reading: string }[]) {
      const { text } = applyPronunciations(item.text);
      expect(digits(text), item.id).toBe(digits(item.text));
      expect(toSpeech(text), item.id).toBe(item.reading);
    }
  });
});
