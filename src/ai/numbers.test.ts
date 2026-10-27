import { describe, expect, it } from 'vitest';
import { unknownNumbers } from './explain';
import { mentions, numbersIn, numberTokens, writtenSign } from './numbers';
import golden from '../../tests/golden/physics.json' with { type: 'json' };
import { mentions as mainMentions, numberTokens as mainNumberTokens } from './numbersMain.fixture';

const goldenItems = (
  golden as { items: { id: string; text: string; quantities: { key: string; value: number }[] }[] }
).items;

describe('numbers the problem states (MASTER_PROMPT §2.1)', () => {
  it('reads a superscript exponent after a mantissa as one power', () => {
    expect(mentions('Điện tích q = 4.10⁻⁸ C đặt tại A.', 4e-8)).toBe(true);
    expect(numberTokens('q = 4.10⁻⁸ C')).toEqual([[4e-8]]);
    expect(mentions('q = 5.10⁻¹⁰ C', 5e-10)).toBe(true);
    expect(mentions('e = 1,6.10⁻¹⁹ C', 1.6e-19)).toBe(true);
    // As on main, a power of ten without a mantissa is not read: the learner enters it (#89).
    expect(mentions('q = 10⁻⁸ C', 1e-8)).toBe(false);
    expect(mentions('q = 10^-8 C', 1e-8)).toBe(false);
  });

  it('reads a superscript zero after a digit as degrees, not as 10⁰ = 1', () => {
    expect(mentions('Góc nghiêng 10⁰.', 1)).toBe(false);
    expect(mentions('Góc nghiêng 10⁰.', 10)).toBe(true);
    expect(numberTokens('nhiệt độ 30⁰C')).toEqual([[30]]);
  });

  it('compares relatively, so a tiny invented value is caught', () => {
    expect(mentions('q = 1.10⁻⁸ C', 2e-8)).toBe(false);
    expect(mentions('q = 5.10⁻¹⁰ C', 7e-10)).toBe(false);
    expect(mentions('e = 1,6.10-19 C', 1.6e-19)).toBe(true);
    expect(mentions('e = 1,6.10-19 C', 1.7e-19)).toBe(false);
    expect(mentions('v = 0 m/s', 0)).toBe(true);
    expect(mentions('vật nằm yên', 0)).toBe(false);
  });

  it('never reads an infinite number (every value would then be "in the problem")', () => {
    for (const text of ['q = 2·10^400 C, AB = 6 cm', 'q = 2.10^309 C', 'E = 9.10⁹¹²³ V/m']) {
      expect(numbersIn(text).every(Number.isFinite), text).toBe(true);
      for (const v of [7, 123.456, 42, 5]) expect(mentions(text, v), `${text} ${v}`).toBe(false);
    }
  });

  it('leaves out the digit of a one- or two-letter symbol, never of a word', () => {
    expect(mentions('Điện tích thử q0 = 2 nC đặt tại M.', 0)).toBe(false);
    expect(mentions('Điện tích thử q_0 = 2 nC.', 0)).toBe(false);
    expect(mentions('v_0 = 5 m/s', 0)).toBe(false);
    expect(numbersIn('q1 = 2 µC')).not.toContain(1);
    expect(mentions('R1 = 10 Ω', 1)).toBe(false);
    expect(mentions('R1 = 10 Ω', 10)).toBe(true);
    // Round 6: words keep their numbers, as on main.
    expect(mentions('Hai điện tích cách nhau10 cm.', 10)).toBe(true);
    expect(mentions('Xe chạy với vận tốc72 km/h.', 72)).toBe(true);
    expect(mentions('Mặt phẳng nghiêng góc30°.', 30)).toBe(true);
    expect(mentions('Điểm M(3; 0) trên trục Ox.', 0)).toBe(true);
  });

  it('reads decimals and lists as main does (round 6)', () => {
    expect(mentions('x = 0,0025 m', 25)).toBe(false);
    expect(mentions('x = 7,2000 m', 72000)).toBe(false);
    const list = 'q₁ = 2.10^-8,3.10^-8 C';
    expect(mentions(list, 2e-8)).toBe(true);
    expect(mentions(list, 3e-8)).toBe(true);
    expect(mentions(list, 8.3e-8)).toBe(false);
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

  it('accepts nothing main refuses (every round of the review, in one grid)', () => {
    const laxer: string[] = [];
    for (const e of [-8, 3, 2]) {
      for (const pre of prefixes) {
        for (const m of mantissas) {
          for (const j of joins) {
            for (const pow of powers(e)) {
              for (const suf of suffixes) {
                const text = `${pre}${m}${j}${pow}${suf}`;
                for (const v of [10 ** e, 7, 1, 0]) {
                  if (!mentions(text, v) || mainMentions(text, v)) continue;
                  laxer.push(`${text} | ${v}`);
                }
              }
            }
          }
        }
      }
    }
    // Only a superscript exponent main could not read may give a new (right) reading.
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

  it('flags in an explanation every number main flags (explain.ts unknownNumbers)', () => {
    // explain.ts on main: tokens from main's reader, 1 % tolerance with an absolute floor.
    const mainFlags = (text: string, allowed: number[]) =>
      mainNumberTokens(text).some(
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
      'E = 2.10^400 V/m',
      'F = 3,2.10-15 N',
      'x = 0,0025 m',
      'x = 7,2000 m',
      'q = 2.10^-8,3.10^-8 C',
      'cách nhau10 cm',
    ];
    const allowedSets = [[], [9], [7200], [1.6e-19], [7], [2000], [25], [72000], [8.3e-8]];
    const laxer: string[] = [];
    for (const text of texts) {
      for (const allowed of allowedSets) {
        if (mainFlags(text, allowed) && unknownNumbers(text, allowed).length === 0) {
          laxer.push(`${text} | ${allowed.join(',')}`);
        }
      }
    }
    expect(laxer).toEqual([]);
  });

  it('flags overflowed and invented tiny numbers in an explanation (round 6)', () => {
    expect(unknownNumbers('E = 2.10^400 V/m', [2])).not.toEqual([]);
    expect(unknownNumbers('F = 3,2.10⁻¹⁵ N', [1.6e-19])).not.toEqual([]);
    expect(unknownNumbers('e = 1,6.10⁻¹⁹ C', [1.6e-19])).toEqual([]);
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
