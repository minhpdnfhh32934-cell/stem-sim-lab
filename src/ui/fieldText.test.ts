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
    expect(parseField('0,25')).toBe(0.25);
    expect(parseField('0.25')).toBe(0.25);
    expect(parseField(' −0,04 ')).toBe(-0.04);
    expect(parseField('33,33333333')).toBe(33.33333333);
    expect(parseField('')).toBeNaN();
    expect(parseField('abc')).toBeNaN();
  });
});
