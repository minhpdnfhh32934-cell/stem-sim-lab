import { describe, expect, it } from 'vitest';
import { checkNumbers, sourceNumbers } from '@/teacher/board/provenance';
import fixtures from './provenance.fixtures.json';
import {
  MAX_LISTED,
  answerNumbers,
  chipNumbers,
  contextNumbers,
  unverifiedNumbers,
} from './provenance';

/** The numbers of `answer` that no context text gives (written by the learner: words count). */
const unverified = (answer: string, ...context: string[]) =>
  unverifiedNumbers(answer, contextNumbers(context, { words: true }));

describe('numbers the AI wrote that nobody gave it (real Gemma 1B answers)', () => {
  const saved = (id: string, variant: string) => {
    const item = fixtures.items.find((f) => f.id === id && f.variant === variant);
    if (!item) throw new Error(`${id} ${variant} missing`);
    // As in the app (chatService.givenNumbers): number words count in the learner's texts only.
    const learner = item.history.filter((m) => m.role === 'user').map((m) => m.content);
    const other = item.history.filter((m) => m.role !== 'user').map((m) => m.content);
    return unverifiedNumbers(item.answer, [
      ...contextNumbers([item.question, ...learner], { words: true }),
      ...contextNumbers([item.prompt, ...other]),
    ]);
  };

  it('flags invented results and assumed values', () => {
    // "Tính quãng đường ô tô đi được." has no data: both answers invented one.
    expect(saved('P5', 'after')).toEqual(['50 km']);
    expect(saved('P5', 'before')).toEqual(['60 km/h']);
    expect(saved('P4', 'before')).toEqual(
      expect.arrayContaining(['6.87 s', '6,87 giây', '6,9 giây']),
    );
    expect(saved('B5', 'after')).toEqual(['27', '729', '784']);
    expect(saved('C4', 'after')).toEqual(expect.arrayContaining(['5', '0.01 M', '6,48 V']));
    expect(saved('C1', 'after')).toEqual(['0.5', '6.97']);
  });

  it('never flags given values restated in the answer', () => {
    // C5 gives Na = 23, O = 16, H = 1; the answer restates them as "Na=23g, O=16g, H=1g".
    const c5 = saved('C5', 'after');
    expect(c5).toEqual(expect.arrayContaining(['20 g', '9,3', '7,0 g']));
    expect(c5.join(' ')).not.toMatch(/\b(23|16)\b/);
    // P8 gives 0,1 m; the answer writes "0.1 m" (other separator) and invents the rest.
    const p8 = saved('P8', 'before');
    expect(p8).toEqual(expect.arrayContaining(['130 N', '6.5 N']));
    expect(p8).not.toContain('0.1 m');
    // B10: 23 comes from the learner's own reply in the conversation.
    expect(saved('B10', 'after')).toEqual([]);
  });

  it('says nothing about answers without stated values', () => {
    expect(saved('P10', 'before')).toEqual([]);
    expect(saved('B6', 'after')).toEqual([]);
  });
});

describe('what counts as a stated value', () => {
  const question = 'Thả một hòn bi từ độ cao 20 m, lấy g = 10 m/s². Tính thời gian rơi.';

  it('a computed result is unverified, the given data is not', () => {
    const answer = 'Cho h = 20 m, g = 10 m/s². Ta có t = √(2·20/10) = 2 s.';
    expect(unverified(answer, question)).toEqual(['2 s']);
  });

  it('values after "=", "≈", "khoảng", decimals and large numbers count', () => {
    expect(unverified('Vận tốc ≈ 3 m/s, khoảng 7 phút.')).toEqual(['3 m/s', '7 phút']);
    expect(unverified('x = 4')).toEqual(['4']);
    expect(unverified('Hệ số là 0,25.')).toEqual(['0,25']);
    expect(unverified('Năm 1905, Einstein giải thích hiện tượng này.')).toEqual(['1905']);
    expect(unverified('Năm 1905, Einstein…', 'Từ năm 1905')).toEqual([]);
  });

  it('list and step numbers, small counts and formula parts do not', () => {
    const answer = [
      '1. Xác định dữ kiện.',
      '2) Viết công thức K = 1/2 mv² và x² + 2x.',
      '**Bước 3:** Nguyên phân tạo ra 2 tế bào con qua 4 kì.',
      '- 11. Cân bằng: 2H2 + O2 → 2H2O, Fe2O3, 2πf, Step 12.',
    ].join('\n');
    expect(unverified(answer)).toEqual([]);
  });

  it('reads powers of ten and thousands either way', () => {
    expect(unverified('c = 3.10^8 m/s')).toEqual(['3.10⁸ m/s']);
    expect(unverified('c = 3.10^8 m/s', 'tốc độ 3×10⁸ m/s')).toEqual([]);
    expect(unverified('Q = 1200 J', 'Nhiệt lượng 1 200 J')).toEqual([]);
    expect(unverified('E = 1,6.10^-19 J', 'e = 1,6 × 10⁻¹⁹ C')).toEqual([]);
  });

  it('reads board lessons (tags and LaTeX) by their text only', () => {
    const board =
      '<write id="r1" zone="steps" role="result" math="true">a = \\frac{10}{2} = 5\\ \\text{m/s}^2</write><box target="r1"/>';
    expect(unverified(board, 'm = 2 kg, F = 10 N')).toEqual(['5 m/s²']);
    expect(answerNumbers('<plot id="p1" fn="x^2" domain="0..10"/>')).toEqual([]);
  });

  it('lists each number once, all of them: only the chip shortens the list', () => {
    const many = Array.from({ length: 9 }, (_, i) => `${i + 20} m`).join(', ');
    const list = unverified(`${many}, 20 m`);
    expect(list).toHaveLength(9);
    expect(new Set(list).size).toBe(9);
    expect(chipNumbers(list)).toEqual({ shown: list.slice(0, MAX_LISTED), more: 3 });
    expect(chipNumbers(['50 km'])).toEqual({ shown: ['50 km'], more: 0 });
  });
});

describe('review 2', () => {
  it('a "<" in the text is not a tag: what follows it is still read', () => {
    // The old tag filter removed everything from "pH < 7" to the ">" of "->".
    expect(
      unverified('pH < 7 nên có tính axit, [H⁺] = 0,001 M. Phản ứng NaOH -> Na⁺ + OH⁻'),
    ).toEqual(['0,001 M']);
    // A given number inside such a span still counts as given.
    expect(unverified('Quãng đường là 25 m.', 'Cho a < b, xe đi 25 m -> dừng lại')).toEqual([]);
  });

  it('numbers the learner wrote in words count as given', () => {
    expect(unverified('t = 2 giờ, s = v·t', 'Xe chạy hai giờ với tốc độ 40 km/h.')).toEqual([]);
    expect(unverified('t = 25 phút', 'Xe chạy hai mươi lăm phút.')).toEqual([]);
    expect(unverified('t = 2,5 giờ', 'Xe chạy hai giờ rưỡi.')).toEqual([]);
    expect(unverified('t = 0,5 giờ', 'Xe chạy nửa giờ.')).toEqual([]);
    expect(unverified('t = 2 hours', 'A car moves for two hours.')).toEqual([]);
    expect(unverified('m = 120 kg', 'one hundred and twenty kilograms')).toEqual([]);
    // "sau" (after) is not "sáu" (six).
    expect(unverified('t = 6 giây', 'Vật dừng sau khi trượt.')).toEqual(['6 giây']);
  });

  it('"là", "bằng", "is", "equals" before a value ending the sentence state a result', () => {
    expect(unverified('Gia tốc của vật là 5.')).toEqual(['5']);
    expect(unverified('Số tế bào con là 6')).toEqual(['6']);
    expect(unverified('Hiệu suất bằng 8.')).toEqual(['8']);
    expect(unverified('The acceleration is 5.')).toEqual(['5']);
    expect(unverified('The answer equals 7.')).toEqual(['7']);
    // A count with its noun stays a count.
    expect(unverified('Có hai cách, cách thứ nhất là 2 bước.')).toEqual([]);
    expect(unverified('Số tế bào con là 4', 'Một tế bào nguyên phân 2 lần.')).toEqual(['4']);
  });

  it('a result with right arithmetic is still listed: the board checks the sum, not the formula', () => {
    // B5 (Gemma 1B, 2026-10-13): 3 mitoses give 2³ = 8 cells; the answer wrote 1 × 3³ = 27.
    const question = 'Một tế bào nguyên phân 3 lần liên tiếp. Tạo ra bao nhiêu tế bào con?';
    const line = 'Số tế bào con = 1 * 3^3 = 27';
    expect(checkNumbers(line, sourceNumbers(question), []).status).toBe('checked');
    expect(unverified(line, question)).toEqual(['27']);
  });
});
