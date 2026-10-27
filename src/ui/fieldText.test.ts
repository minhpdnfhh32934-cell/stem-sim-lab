import { describe, expect, it } from 'vitest';
import { fieldText, parseField } from './fieldText';

describe('number field text (UI-17)', () => {
  it('shows a decimal comma in Vietnamese, a point in English, no grouping', () => {
    expect(fieldText('vi', 0.25)).toBe('0,25');
    expect(fieldText('vi', -0.04)).toBe('-0,04');
    expect(fieldText('vi', 9.81)).toBe('9,81');
    expect(fieldText('vi', 12345.6)).toBe('12345,6');
    expect(fieldText('en', 0.25)).toBe('0.25');
    expect(fieldText('vi', 1 / 3)).toBe('0,333333');
  });

  it('one "." or "," is the decimal mark, in either language; every typed digit is kept', () => {
    for (const [text, v] of [
      ['0.125', 0.125],
      ['0.005', 0.005],
      ['-0.125', -0.125],
      ['2.500', 2.5],
      ['9.81', 9.81],
      ['9,81', 9.81],
      ['1.000', 1],
      ['0,125', 0.125],
      ['1,000', 1],
      [' −0,04 ', -0.04],
      ['33,33333333', 33.33333333],
      ['2e-3', 0.002],
    ] as const)
      expect(parseField(text), text).toBe(v);
  });

  it('two separators, hex, Infinity, out-of-range and empty text are refused', () => {
    for (const text of ['1.000.5', '1.000,5', '0x10', 'Infinity', '1e400', '', 'abc'])
      expect(parseField(text), text).toBeNaN();
  });
});
