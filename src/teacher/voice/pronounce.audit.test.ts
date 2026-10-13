import { describe, expect, it } from 'vitest';
import { toSpeech } from './vietnameseText';

/** The pronunciation set of the 2026-10-13 audit (VOI-02): text → words a voice reads. */
const CASES: [string, RegExp | string][] = [
  ['g = 9,81 m/s²', 'gờ bằng chín phẩy tám mốt mét trên giây bình phương'],
  ['F = m·a', 'ép bằng mờ nhân a'],
  ['$a = \\frac{F}{m}$', 'a bằng ép trên mờ'],
  ['H2SO4 và CO2', 'hát hai ét ô bốn và xê ô hai'],
  ['pH = 7', 'pê hát bằng bảy'],
  ['25 °C', 'hai mươi lăm độ xê'],
  ['v = 36 km/h', 'vê bằng ba mươi sáu ki-lô-mét trên giờ'],
  ['1,6·10⁻¹⁹ C', 'một phẩy sáu nhân mười mũ trừ mười chín cu-lông'],
  ['Δv = 5 m/s', 'đen-ta vê bằng năm mét trên giây'],
  ['góc α = 30°', 'góc an-pha bằng ba mươi độ'],
  ['50%', 'năm mươi phần trăm'],
  // Wrong before the audit fix:
  ['NST 2n = 46', 'nờ ét tê hai nờ bằng bốn mươi sáu'],
  ['x² + 2x + 1 = 0', 'ích bình phương cộng hai ích cộng một bằng không'],
  ['Kì sau I', 'Kì sau một'],
  ['Kì đầu II của giảm phân', 'Kì đầu hai của giảm phân'],
  ['Giảm phân II', 'Giảm phân hai'],
  ['$v = \\frac{V_{max}[S]}{K_m + [S]}$', /nồng độ ét/],
  ['NaCl (aq)', /dung dịch/],
  ['H2O(l)', /lỏng/],
];

describe('reading scientific notation aloud (audit VOI-02)', () => {
  it.each(CASES)('%s', (input, expected) => {
    const out = toSpeech(input);
    if (typeof expected === 'string') expect(out).toBe(expected);
    else expect(out).toMatch(expected);
    expect(out).not.toMatch(/[[\]]/);
  });

  it('leaves citations and ordinary words alone', () => {
    expect(toSpeech('Xem tài liệu [1].')).toContain('một');
    expect(toSpeech('Có 3 con mèo.')).toBe('Có ba con mèo.');
  });
});
