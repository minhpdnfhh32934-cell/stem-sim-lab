import { describe, expect, it } from 'vitest';
import { texNum } from './tex';

describe('texNum', () => {
  it('groups thousands like formatNumber and keeps the decimal comma in Vietnamese', () => {
    expect(texNum('vi', 35950)).toBe('35{.}950');
    expect(texNum('en', 35950)).toBe('35{,}950');
    expect(texNum('vi', 8000)).toBe('8{.}000');
    expect(texNum('vi', -1234.5)).toBe('-1{.}235');
    expect(texNum('vi', 9.81)).toBe('9{,}81');
    expect(texNum('en', 9.81)).toBe('9.81');
    expect(texNum('vi', 999.5)).toBe('999{,}5');
    expect(texNum('vi', 123456)).toBe('123{.}500');
    expect(texNum('vi', 1.6e-19)).toBe('1{,}6 \\cdot 10^{-19}');
  });
});
