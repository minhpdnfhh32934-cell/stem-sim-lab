import { describe, expect, it } from 'vitest';
import { toSpeech } from '@/teacher/voice/vietnameseText';

// Final review 2026-10-14: the digit of a negative exponent was read on its own
// ("10^{-3}" → "mười - ba", which the voice model says as "mười ba" = 13).
describe('negative powers are read as powers', () => {
  it.each([
    ['10^{-3} m', 'mười mũ trừ ba mét'],
    ['10^-3 m', 'mười mũ trừ ba mét'],
    ['10^{−3} m', 'mười mũ trừ ba mét'],
    ['$2^{-1}$', 'hai mũ trừ một'],
    ['x^{-2}', 'ích mũ trừ hai'],
    ['q = 1,6 × 10^{-19} C', 'quy bằng một phẩy sáu nhân mười mũ trừ mười chín cu-lông'],
    ['λ = 5.10^{-7} m', 'lam-đa bằng năm nhân mười mũ trừ bảy mét'],
  ])('%s', (input, spoken) => {
    expect(toSpeech(input)).toBe(spoken);
  });
});
