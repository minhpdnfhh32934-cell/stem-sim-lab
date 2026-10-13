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
  // A chemical equation inside a formula: its arrow reads "tạo thành", not "suy ra".
  ['$2H_2 + O_2 \\rightarrow 2H_2O$', 'hai hát hai cộng ô hai tạo thành hai hát hai ô'],
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

describe('brackets, states, arrows and numerals only where they mean chemistry', () => {
  const STATE = /rắn|lỏng|khí|dung dịch/;

  it('reads a unit in brackets as a unit, never as a state symbol', () => {
    for (const text of [
      'Thời gian t (s) và quãng đường s (m).',
      'Khối lượng m (g)',
      'Thể tích V (l)',
      'Thể tích V1 (l) và V2 (l)',
      'Với 5 (s) thì',
      '| Thời gian (s) | Quãng đường (m) |\n|---|---|\n| 1 | 2 |',
    ]) {
      expect(toSpeech(text)).not.toMatch(STATE);
    }
  });

  it('reads state symbols right after a chemical formula', () => {
    expect(toSpeech('H2O(l)')).toBe('hát hai ô lỏng');
    expect(toSpeech('CO2(k)')).toBe('xê ô hai khí');
    expect(toSpeech('O₂ (k)')).toBe('ô hai khí');
    expect(toSpeech('NaCl (dd)')).toBe('nờ a xê lờ dung dịch');
    expect(toSpeech('NaCl (aq)')).toBe('nờ a xê lờ dung dịch');
    expect(toSpeech('CaCO₃(r)')).toBe('xê a xê ô ba rắn');
    expect(toSpeech('Fe(OH)3 (r)')).toBe('ép e ô hát ba rắn');
    expect(toSpeech('Na⁺(aq)')).toMatch(/nờ a cộng dung dịch/);
  });

  it('reads the state of a one-letter element inside an equation', () => {
    expect(toSpeech('C(r) + O2(k) → CO2(k)')).toMatch(/^xê rắn cộng ô hai khí/);
    expect(toSpeech('S(r) + O₂(k)')).toMatch(/^ét rắn/);
    expect(toSpeech('C(s) + O2(g) → CO2(g)')).toMatch(/^xê rắn/);
    // The state is read; "2K" itself is still read as kelvin by the unit rule (known limit).
    expect(toSpeech('2K(r) + 2H2O(l)')).toMatch(/rắn cộng hai hát hai ô lỏng/);
    // Outside an equation the same shape is a quantity and its unit.
    expect(toSpeech('Thể tích V (l) = 2')).not.toMatch(STATE);
    expect(toSpeech('Khối lượng M(g)')).not.toMatch(STATE);
  });

  it('never reads an interval, a list or a word citation as a concentration', () => {
    for (const text of [
      'Hàm số liên tục trên đoạn [a, b].',
      '$x \\in [a, b]$',
      '[t₁; t₂]',
      'Xem [Wikipedia]',
      'Xem [SGK].',
      'Chọn [A, B]',
    ]) {
      expect(toSpeech(text)).not.toMatch(/nồng độ/);
    }
  });

  it('reads one chemical species in brackets as its concentration, said once', () => {
    expect(toSpeech('[H+]')).toBe('nồng độ hát cộng');
    expect(toSpeech('[OH-]')).toBe('nồng độ ô hát trừ');
    expect(toSpeech('[Na⁺]')).toBe('nồng độ nờ a cộng');
    expect(toSpeech('[H2O]')).toBe('nồng độ hát hai ô');
    expect(toSpeech('Khi nồng độ cơ chất [S] tăng')).toBe('Khi nồng độ cơ chất ét tăng');
    expect(toSpeech('Nồng độ $[H^+]$ giảm')).not.toMatch(/nồng độ.*nồng độ/i);
  });

  it('reads an arrow as "tạo thành" only in a real chemical equation', () => {
    expect(toSpeech('$T_1 \\to T_2$')).toBe('tê một suy ra tê hai');
    expect(toSpeech('$E_3 \\rightarrow E_2$')).toBe('e ba suy ra e hai');
    expect(toSpeech('$CH_4 + 2O_2 \\to CO_2 + 2H_2O$')).toMatch(/tạo thành/);
    expect(toSpeech('$Fe + S \\rightarrow FeS$')).toMatch(/tạo thành/);
  });

  it('reads a Roman numeral after "lần" only when it is one', () => {
    expect(toSpeech('Mỗi lần I tăng gấp đôi.')).toBe('Mỗi lần i tăng gấp đôi.');
    expect(toSpeech('Mỗi lần V tăng thì I giảm.')).not.toMatch(/năm|một/);
    expect(toSpeech('Phân bào lần II')).toBe('Phân bào lần hai');
    expect(toSpeech('Phân bào lần I.')).toBe('Phân bào lần một.');
    expect(toSpeech('Đây là lần thứ II.')).toBe('Đây là lần thứ hai.');
  });
});
