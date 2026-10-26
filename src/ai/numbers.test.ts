import { describe, expect, it } from 'vitest';
import { mentions, numbersIn, numberTokens, writtenSign } from './numbers';
import golden from '../../tests/golden/physics.json' with { type: 'json' };
import { mentions as mainMentions, numberTokens as mainNumberTokens } from './numbersMain.fixture';

const goldenItems = (
  golden as { items: { id: string; text: string; quantities: { key: string; value: number }[] }[] }
).items;

describe('numbers the problem states (MASTER_PROMPT §2.1)', () => {
  it('reads superscript exponents after a mantissa; a power alone is never read (as on main)', () => {
    expect(mentions('Điện tích q = 4.10⁻⁸ C đặt tại A.', 4e-8)).toBe(true);
    expect(numberTokens('q = 4.10⁻⁸ C')).toEqual([[4e-8]]);
    expect(mentions('n = 2.10¹⁰', 2e10)).toBe(true);
    // #89 decision after five review rounds: "10⁻⁸" without a mantissa is not read; the learner
    // enters the value in "Tôi hiểu đề như sau".
    for (const text of ['q = 10⁻⁸ C', 'q = 10^-8 C', 'q = 10^(-8) C', 'Điện tích 10⁻⁸ C.']) {
      expect(mentions(text, 1e-8), text).toBe(false);
    }
  });

  it('compares relatively, so a tiny invented value is caught', () => {
    expect(mentions('q = 1.10⁻⁸ C', 2e-8)).toBe(false);
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
    expect(numberTokens('q = 5.10^-10 C')).toEqual([[5e-10]]);
    expect(numbersIn('q = 5.10^-10 C')).not.toContain(1e-10);
    expect(mentions('q = 5 × 10⁻¹⁰ C', 1e-10)).toBe(false);
    expect(mentions('vật nằm yên', 0)).toBe(false);
    expect(mentions('v = 0 m/s', 0)).toBe(true);
  });

  it('reads the new multiplication signs only with a caret or a superscript exponent', () => {
    expect(mentions('q = 2´10⁻⁸ C', 2e-8)).toBe(true);
    expect(mentions('q = 2 • 10⁻⁸ C', 2e-8)).toBe(true);
    expect(mentions('q = 2⋅10^-8 C', 2e-8)).toBe(true);
    expect(mentions('F = 2 X 10^3 N', 2000)).toBe(true);
    expect(mentions('q = 2 \\cdot 10^{-8} C', 2e-8)).toBe(true);
    // Without a caret "X 10" is no power of ten.
    expect(mentions('F = 2 X 10 3 N', 2000)).toBe(false);
  });

  it('never reads an infinite number, a decimal exponent or 10⁰ as 1', () => {
    for (const text of ['q = 2·10^400 C, AB = 6 cm', 'q = 10^309 C', 'E = 9·10⁹¹²³']) {
      for (const v of [7, 123.456, 42, 5]) expect(mentions(text, v), `${text} ${v}`).toBe(false);
    }
    expect(mentions('q = 2.10^-8,5 C', 2e-8)).toBe(false);
    for (const text of ['Góc nghiêng 10⁰.', 'góc 10^0', 'góc 10^(0)', 'góc 10^{0}', 't = 10^0C']) {
      expect(mentions(text, 1), text).toBe(false);
      expect(mentions(text, 10), text).toBe(true);
    }
    expect(numberTokens('nhiệt độ 30⁰C')).toEqual([[30]]);
  });

  it('never reads the digit of a name such as q0, q_0 or q1 as a number of the problem', () => {
    expect(mentions('Điện tích thử q0 = 2 nC đặt tại M.', 0)).toBe(false);
    expect(mentions('Điện tích thử q_0 = 2 nC.', 0)).toBe(false);
    expect(numbersIn('q1 = 2 µC')).not.toContain(1);
    expect(mentions('q1 = 2 µC', 2)).toBe(true);
    expect(mentions('S = 20 cm2', 20)).toBe(true);
    expect(mentions('Điểm M(3; 0) trên trục Ox.', 0)).toBe(true);
  });
});

describe('never laxer than main (#89)', () => {
  const sup: Record<string, string> = { '-': '⁻', '0': '⁰', '2': '²', '3': '³', '8': '⁸' };
  const supOf = (e: number) => String(e).replace(/[-0-9]/g, (c) => sup[c] ?? c);
  const prefixes = ['q = ', 'Điện tích ', '', 'Câu 1: ', 'tăng 2 lần, ', 'AB = 3 cm, q = '];
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
    ' nhan ',
    ' nhân cho ',
    ' chia ',
    ' times ',
    '&times;',
    '&middot',
    'cdot',
    'Х',
    'ｘ',
    'χ',
    ' twice ',
    ' gấp đôi ',
    ' \\cdot ',
    '{\\cdot}',
    ' ×\\, ',
    '\\!\\cdot\\!',
    ' ×​',
  ];
  const powers = (e: number) => [`10^${e}`, `10^(${e})`, `(10^${e})`, `10^{${e}}`, `10${supOf(e)}`];
  const suffixes = [' C', '·2 C', ' × 2,5 C', ',5 C', ' chia 2 C', ' . 2 C', ' × ba C'];
  // Readings main could not make at all: a superscript exponent of several characters.
  const superscript = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]{2,}/u;

  it('accepts nothing main refuses (a bare 10ⁿ above all)', () => {
    const laxer: string[] = [];
    for (const e of [-8, 3, 2]) {
      for (const pre of prefixes) {
        for (const m of mantissas) {
          for (const j of joins) {
            for (const pow of powers(e)) {
              for (const suf of suffixes) {
                const text = `${pre}${m}${j}${pow}${suf}`;
                for (const v of [10 ** e, 7, 1]) {
                  if (!mentions(text, v) || mainMentions(text, v)) continue;
                  laxer.push(`${text} | ${v}`);
                }
              }
            }
          }
        }
      }
    }
    // Only a mantissa with a superscript exponent main could not read may be new (its own value).
    expect(laxer.filter((x) => !superscript.test(x))).toEqual([]);
  });

  it('accepts every value of the golden set that main accepts', () => {
    const missed: string[] = [];
    for (const item of goldenItems) {
      for (const q of item.quantities) {
        if (mainMentions(item.text, q.value) && !mentions(item.text, q.value)) {
          missed.push(`${item.id} ${q.key}`);
        }
      }
    }
    expect(missed).toEqual([]);
  });

  it('flags in an explanation every number main flags (numberTokens as explain.ts uses it)', () => {
    // Same rule as explain.ts `unknownNumbers`, run with each reader's tokens.
    const flags = (tokens: number[][], allowed: number[]) =>
      tokens.some(
        (r) =>
          !r.some(
            (n) =>
              (Number.isInteger(n) && n <= 4) ||
              allowed.some((a) => Math.abs(a - n) <= 0.01 * Math.max(Math.abs(a), 1e-9)),
          ),
      );
    const texts = [
      'tăng x9 lần',
      'E \\approx7200 V/m',
      'khoảng7200',
      'gấp9',
      'q0 = 7 nC',
      'E = 7200 V/m',
      'q = 1,6.10-19 C',
      'E1 = 9 V/m',
      'v_0 = 9 m/s',
      'x = 2X10^3 m',
    ];
    const allowedSets = [[], [9], [7200], [1.6e-19], [7], [2000]];
    const laxer: string[] = [];
    for (const text of texts) {
      for (const allowed of allowedSets) {
        if (flags(mainNumberTokens(text), allowed) && !flags(numberTokens(text), allowed)) {
          laxer.push(`${text} | ${allowed.join(',')}`);
        }
      }
    }
    // On purpose: a new multiplication sign with a caret is read ("2X10^3" = 2000, the engine's own
    // number); main split it into 2, 10, 3.
    expect(laxer).toEqual(['x = 2X10^3 m | 2000']);
  });
});

describe('the sign a problem gives a charge', () => {
  it('reads a minus or a plus written next to the number', () => {
    expect(writtenSign('q = −2 µC', 2)).toBe(-1);
    expect(writtenSign('q₂ = −4.10⁻⁸ C', 4e-8)).toBe(-1);
    expect(writtenSign('q = -1.10⁻⁸ C', 1e-8)).toBe(-1);
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
    const differ = 'Hai điện tích khác dấu q1 = 2 µC và q2 = 3 µC đặt tại A và B.';
    expect(writtenSign(differ, 2)).toBe(0);
    expect(writtenSign(differ, 3)).toBe(0);
    expect(writtenSign('Hai điện tích ngược dấu có độ lớn bằng nhau, q1 = 4 nC.', 4)).toBe(0);
    expect(writtenSign('Hạt bụi (điện tích âm) có q = 5 nC.', 5)).toBe(-1);
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
