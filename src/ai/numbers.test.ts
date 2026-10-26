import { describe, expect, it } from 'vitest';
import { mentions, numbersIn, numberTokens, writtenSign } from './numbers';

describe('numbers the problem states (MASTER_PROMPT §2.1)', () => {
  it('reads a power of ten written on its own', () => {
    expect(mentions('Điện tích q = 10⁻⁸ C đặt tại A.', 1e-8)).toBe(true);
    expect(mentions('q = 10^-8 C', 1e-8)).toBe(true);
    expect(mentions('q = 10^(-8) C', 1e-8)).toBe(true);
    expect(numberTokens('q = 10⁻⁸ C')).toEqual([[1e-8]]);
  });

  it('compares relatively, so a tiny invented value is caught', () => {
    expect(mentions('q = 10⁻⁸ C', 2e-8)).toBe(false);
    expect(mentions('q = 5.10⁻¹⁰ C', 5e-10)).toBe(true);
    expect(mentions('q = 5.10⁻¹⁰ C', 7e-10)).toBe(false);
    expect(mentions('e = 1,6.10-19 C', 1.6e-19)).toBe(true);
    expect(mentions('e = 1,6.10-19 C', 1.7e-19)).toBe(false);
  });

  it('keeps ordinary numbers as they were', () => {
    expect(mentions('cách nhau 10 cm', 10)).toBe(true);
    expect(numberTokens('cách nhau 10 cm')).toEqual([[10]]);
    // Small decimals stay whole (the thousands group used to swallow ",000").
    expect(numberTokens('F = 0,000719 N')).toEqual([[0.000719, 719]]);
    expect(numberTokens('1.200.000 N, 1 200 N')).toEqual([[1200000], [1200]]);
    // A power of ten is not read inside a longer number or a mantissa.
    expect(numberTokens('210^2')).not.toContainEqual([100]);
    expect(numberTokens('q = 5.10^-10 C')).toEqual([[5e-10]]);
    expect(numbersIn('q = 5.10^-10 C')).not.toContain(1e-10);
    expect(mentions('q = 5 × 10⁻¹⁰ C', 1e-10)).toBe(false);
    // A dot operator "⋅" is a multiplication sign too: "2⋅10⁻⁸" is 2e-8, never 1e-8.
    expect(mentions('q = 2⋅10^-8 C', 2e-8)).toBe(true);
    expect(mentions('q = 2⋅10^-8 C', 1e-8)).toBe(false);
    expect(mentions('vật nằm yên', 0)).toBe(false);
    expect(mentions('v = 0 m/s', 0)).toBe(true);
  });
});

describe('the sign a problem gives a charge', () => {
  it('reads a minus or a plus written next to the number', () => {
    expect(writtenSign('q = −2 µC', 2)).toBe(-1);
    expect(writtenSign('q₂ = −4.10⁻⁸ C', 4e-8)).toBe(-1);
    expect(writtenSign('q = -10⁻⁸ C', 1e-8)).toBe(-1);
    expect(writtenSign('q = +3 nC', 3)).toBe(1);
    expect(writtenSign('q = 2 µC', 2)).toBe(1);
    // A range or a difference is not a sign.
    expect(writtenSign('từ 5-2 µC', 2)).toBe(1);
  });

  it('reads "âm"/"dương" in the same sentence, past a name such as q1', () => {
    expect(writtenSign('Một điện tích âm q1 = 2 µC đặt tại A.', 2)).toBe(-1);
    expect(writtenSign('Một điện tích âm, có độ lớn 3 nC.', 3)).toBe(-1);
    expect(writtenSign('Hạt mang điện dương q = 3 nC.', 3)).toBe(1);
    // Each number keeps the words between it and its neighbours.
    const two = 'Điện tích dương q1 = 2 µC đặt tại A, điện tích âm q2 = 3 µC đặt tại B.';
    expect(writtenSign(two, 2)).toBe(1);
    expect(writtenSign(two, 3)).toBe(-1);
    expect(writtenSign('q = 2 µC, mang dấu âm.', 2)).toBe(-1);
    const after = 'q1 = 2 µC mang dấu âm, q2 = 3 µC.';
    expect(writtenSign(after, 2)).toBe(-1);
    expect(writtenSign(after, 3)).toBe(1);
    // Sign words of another noun ("bản âm", "chiều âm") or of the next charge do not count.
    expect(
      writtenSign('Điện tích q1 = 2 µC đặt cách điện tích âm q2 = 3 µC một khoảng 10 cm.', 2),
    ).toBe(1);
    expect(writtenSign('Một hạt bụi mang điện tích 3 nC nằm cách bản âm 1 cm.', 3)).toBe(1);
    expect(writtenSign('Điện tích q = 2 µC chuyển động theo chiều âm của trục Ox.', 2)).toBe(1);
    expect(writtenSign('Hạt bụi mang điện tích âm có độ lớn 3 nC.', 3)).toBe(-1);
    // The previous sentence does not count.
    expect(writtenSign('Hạt bụi tích điện âm. Điện tích thử q = 2 nC.', 2)).toBe(1);
  });

  it('leaves the sign open when the text does', () => {
    expect(writtenSign('Hai điện tích trái dấu có độ lớn 2 µC.', 2)).toBe(0);
    expect(writtenSign('Điện tích có độ lớn 5 nC.', 5)).toBe(0);
  });

  it('uses the quote when the number appears with both signs', () => {
    const text = 'Hai điện tích q₁ = 4.10⁻⁸ C và q₂ = −4.10⁻⁸ C đặt tại A và B.';
    expect(writtenSign(text, 4e-8)).toBe(0);
    expect(writtenSign(text, 4e-8, 'q₂ = −4.10⁻⁸ C')).toBe(-1);
    expect(writtenSign(text, 4e-8, 'q₁ = 4.10⁻⁸ C')).toBe(1);
    // A quote that cut the minus off still points at the negative place.
    expect(writtenSign('q₁ = 4 µC, q₂ = −5 µC, q₃ = 5 µC', 5, '5 µC, q₃')).toBe(-1);
    expect(writtenSign(text, 4e-8, '4.10⁻⁸ C')).toBe(0);
  });
});
