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

  it('reads either separator and keeps every typed digit', () => {
    expect(parseField('0,25', 'vi')).toBe(0.25);
    expect(parseField('0.25', 'vi')).toBe(0.25);
    expect(parseField(' −0,04 ', 'vi')).toBe(-0.04);
    expect(parseField('33,33333333', 'vi')).toBe(33.33333333);
    expect(parseField('2e-3', 'en')).toBe(0.002);
    expect(parseField('', 'vi')).toBeNaN();
    expect(parseField('abc', 'vi')).toBeNaN();
  });

  it('thousands in the UI language are thousands, never a silent 1; odd forms are refused', () => {
    expect(parseField('1.000', 'vi')).toBe(1000);
    expect(parseField('12.345,6', 'vi')).toBe(12345.6);
    expect(parseField('1,000', 'en')).toBe(1000);
    expect(parseField('1.5', 'vi')).toBe(1.5);
    expect(parseField('1,5', 'en')).toBe(1.5);
    expect(parseField('0x10', 'vi')).toBeNaN();
    expect(parseField('Infinity', 'en')).toBeNaN();
    expect(parseField('1,2,3', 'vi')).toBeNaN();
  });
});
