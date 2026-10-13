import { describe, expect, it } from 'vitest';
import fixtures from './provenance.fixtures.json';
import { answerNumbers, contextNumbers, unverifiedNumbers } from './provenance';

/** The numbers of `answer` that no context text gives. */
const unverified = (answer: string, ...context: string[]) =>
  unverifiedNumbers(answer, contextNumbers(context));

describe('numbers the AI wrote that nobody gave it (real Gemma 1B answers)', () => {
  const saved = (id: string, variant: string) => {
    const item = fixtures.items.find((f) => f.id === id && f.variant === variant);
    if (!item) throw new Error(`${id} ${variant} missing`);
    return unverified(
      item.answer,
      item.question,
      item.prompt,
      ...item.history.map((m) => m.content),
    );
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

  it('lists each number once and at most six', () => {
    const many = Array.from({ length: 9 }, (_, i) => `${i + 20} m`).join(', ');
    expect(unverified(`${many}, 20 m`)).toHaveLength(6);
  });
});
