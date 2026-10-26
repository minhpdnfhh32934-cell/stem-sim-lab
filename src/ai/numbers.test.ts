import { describe, expect, it } from 'vitest';
import { mentions, numbersIn, numberTokens, writtenSign } from './numbers';
import { mentions as mainMentions } from './numbersMain.fixture';

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

describe('no laxer than before (review of #89)', () => {
  it('never reads a power of ten whose mantissa it could not read', () => {
    for (const text of ['q = 2´10⁻⁸ C', 'q = 2 • 10⁻⁸ C', 'q = 2 10^-8 C']) {
      expect(mentions(text, 1e-8), text).toBe(false);
    }
    expect(mentions('F = 2 X 10^3 N', 1000)).toBe(false);
    // These multiplication signs are read, so the stated value passes.
    expect(mentions('q = 2´10⁻⁸ C', 2e-8)).toBe(true);
    expect(mentions('q = 2 • 10⁻⁸ C', 2e-8)).toBe(true);
    expect(mentions('F = 2 X 10^3 N', 2000)).toBe(true);
    expect(mentions('q = 2 \\cdot 10^{-8} C', 2e-8)).toBe(true);
    expect(mentions('q = 2 \\cdot 10^{-8} C', 1e-8)).toBe(false);
    // A name before the power is not a mantissa.
    expect(mentions('q2 = 10^-8 C', 1e-8)).toBe(true);
  });

  it('reads a superscript zero after a number as degrees, not as 10⁰ = 1', () => {
    expect(mentions('Góc nghiêng 10⁰.', 1)).toBe(false);
    expect(mentions('Góc nghiêng 10⁰.', 10)).toBe(true);
    expect(numberTokens('nhiệt độ 30⁰C')).toEqual([[30]]);
    expect(mentions('n = 10¹⁰', 1e10)).toBe(true);
  });
});

describe('a power of ten never stands for a mantissa it could not read (re-review of #89)', () => {
  // Every way of joining a mantissa to a power of ten: the AI's bare 10ⁿ must never pass.
  const joins = [
    '.',
    '×',
    'x',
    'X',
    '*',
    '·',
    '⋅',
    '∙',
    '•',
    '✕',
    '⨯',
    '´',
    ' ',
    ' lần ',
    'х',
    ' \\cdot ',
    '{\\cdot}',
    ' ×\\, ',
    '\\!\\cdot\\!',
    ' ×​',
  ];
  const mantissas = ['2', '2,5', '(2,5)', '(2,0 ± 0,1)'];
  const powers = (e: number) => [`10^${e}`, `10^(${e})`, `(10^${e})`, `[10^${e}]`, `10^{${e}}`];
  it('rejects 10ⁿ for every join, mantissa and form', () => {
    for (const e of [-8, 3]) {
      for (const m of mantissas) {
        for (const j of joins) {
          for (const pow of powers(e)) {
            const text = `q = ${m}${j}${pow} C`;
            expect(mentions(text, 10 ** e), text).toBe(false);
          }
        }
      }
    }
  });

  it('still reads a power of ten that has no mantissa', () => {
    expect(mentions('q = 10^-8 C', 1e-8)).toBe(true);
    expect(mentions('q2 = 10^-8 C', 1e-8)).toBe(true);
    expect(mentions('q = (10^-8) C', 1e-8)).toBe(true);
    // A list: only the power after the word "và" stands alone; "10⁻⁸, 10⁻⁹" could be a mantissa
    // and its power, so they are refused (unsure means refused, §2.1).
    const list = 'Ba điện tích 10⁻⁸, 10⁻⁹ và 10⁻¹⁰ C.';
    expect(mentions(list, 1e-10)).toBe(true);
    expect(mentions(list, 1e-9)).toBe(false);
  });

  it('never reads 10^0 as 1 (degrees typed with a caret)', () => {
    for (const text of ['góc 10^0', 'góc 10 ^0', 'góc 10^(0)', 'góc 10^{0}', 't = 10^0C']) {
      expect(mentions(text, 1), text).toBe(false);
      expect(mentions(text, 10), text).toBe(true);
    }
  });
});

describe('third review of #89: allow-list for a lone power of ten', () => {
  it('never reads an infinite number (every value would then be "in the problem")', () => {
    for (const text of ['q = 2·10^400 C, AB = 6 cm', 'q = 10^309 C', 'E = 9·10⁹¹²³']) {
      for (const v of [7, 123.456, 42, 5]) expect(mentions(text, v), `${text} ${v}`).toBe(false);
    }
  });

  it('refuses the review examples: unknown joins, look-alike x, odd mantissas, trailing ones', () => {
    const texts = [
      'q = 2 LẦN 10⁻⁸ C',
      'q = 2 Lần 10⁻⁸ C',
      'q = 2 nhân 10⁻⁸ C',
      'q = 2 nhân với 10⁻⁸ C',
      'a charge of 2 times 10^-8 C',
      'q = 2&times;10^-8 C',
      'q = 2 \\text{ times } 10^{-8} C',
      'q = 2Х10^-8 C',
      'q = 2ｘ10^-8 C',
      'q = 2χ10^-8 C',
      'q = 2ˣ10^-8 C',
      'q = 2ⅹ10^-8 C',
      'q = ½·10⁻⁸ C',
      'q = ２×10⁻⁸ C',
      'q = ②·10⁻⁸ C',
      'q = .5 x (10^-8) C',
      'q = 1.200.000 lần 10^-8 C',
      'q = 10⁻⁸·2 C',
      'q = 10^-8 × 2,5 C',
    ];
    for (const text of texts) expect(mentions(text, 1e-8), text).toBe(false);
    // A decimal exponent is no power of ten the reader knows.
    expect(mentions('q = 10^-8,5 C', 1e-8)).toBe(false);
    expect(mentions('q = 10^2,5 C', 100)).toBe(false);
  });

  it('reads a lone power after the start, "=", "≈", ":" or an ordinary word', () => {
    expect(mentions('10^-8 C là điện tích của q.', 1e-8)).toBe(true);
    expect(mentions('q ≈ 10⁻⁸ C', 1e-8)).toBe(true);
    expect(mentions('Câu 1: 10^-8 C', 1e-8)).toBe(true);
    expect(mentions('Điện tích 10⁻⁸ C đặt tại A.', 1e-8)).toBe(true);
    expect(mentions('AB = 3 cm, q = 10⁻⁸ C', 1e-8)).toBe(true);
    expect(mentions('q = (10^-8) C', 1e-8)).toBe(true);
  });

  it('is never laxer than main: every sentence main refuses is refused, except lone powers', () => {
    const sup: Record<string, string> = { '-': '⁻', '0': '⁰', '2': '²', '3': '³', '8': '⁸' };
    const supOf = (e: number) => [...String(e)].map((c) => sup[c] ?? c).join('');
    const prefixes = ['q = ', 'Điện tích ', '', 'Câu 1: ', 'tăng 2 lần, '];
    const mantissas = ['', '2', '2,5', '(2,5)', '.5', '½', '２', '1.200.000'];
    const joins = [
      '',
      ' ',
      '.',
      '×',
      'x',
      'X',
      '*',
      '·',
      '⋅',
      '•',
      '´',
      ' lần ',
      ' LẦN ',
      ' nhân ',
      ' nhân với ',
      ' times ',
      '&times;',
      'Х',
      'ｘ',
      'χ',
      ' \\cdot ',
      '{\\cdot}',
    ];
    const powers = (e: number) => [
      `10^${e}`,
      `10^(${e})`,
      `(10^${e})`,
      `10^{${e}}`,
      `10${supOf(e)}`,
    ];
    const suffixes = [' C', '·2 C', ' × 2,5 C', ',5 C'];
    const laxer: string[] = [];
    for (const e of [-8, 3, 2]) {
      for (const pre of prefixes) {
        for (const m of mantissas) {
          for (const j of joins) {
            for (const pow of powers(e)) {
              for (const suf of suffixes) {
                const text = `${pre}${m}${j}${pow}${suf}`;
                if (!mentions(text, 10 ** e) || mainMentions(text, 10 ** e)) continue;
                // Opened on purpose: a power standing alone (nothing before it on its side of
                // the "=", ":" or word, nothing joined after it) is now read; main could not.
                const alone = m === '' && j.trim() === '' && suf === ' C';
                if (!alone) laxer.push(text);
              }
            }
          }
        }
      }
    }
    expect(laxer).toEqual([]);
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
    // One plural sign word covers every charge of its sentence.
    const both = 'Hai điện tích âm q1 = 2 µC và q2 = 3 µC đặt cách nhau 10 cm.';
    expect(writtenSign(both, 2)).toBe(-1);
    expect(writtenSign(both, 3)).toBe(-1);
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
