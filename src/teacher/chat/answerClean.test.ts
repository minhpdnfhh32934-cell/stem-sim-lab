import { describe, expect, it } from 'vitest';
import { numbersIn } from '@/ai/numbers';
import { cleanAnswer } from './answerClean';

const clean = (text: string) => cleanAnswer(text).text;

describe('answer cleaning: hidden reasoning', () => {
  it.each([
    ['closed block', '<think>nháp 3 kg</think>Đáp số: 12 N.', 'Đáp số: 12 N.'],
    [
      'unclosed block (cut at the limit)',
      'Vậy a = 5 m/s². <think>kiểm tra lại 7',
      'Vậy a = 5 m/s².',
    ],
    [
      'orphan closing tag',
      'Người dùng hỏi 3 thứ.</think>\nLực là tác dụng đẩy.',
      'Lực là tác dụng đẩy.',
    ],
    ['several blocks', '<think>a</think>Một. <think>b</think>Hai.', 'Một. Hai.'],
    ['other names', '<thinking>a</thinking><reasoning>b</reasoning>Câu trả lời.', 'Câu trả lời.'],
    ['block in the middle', 'Ta có <think>thử 9 N</think> a = F/m.', 'Ta có a = F/m.'],
    ['nested block', '<think>a<think>b</think>c</think>Đáp số 4.', 'Đáp số 4.'],
  ])('%s', (_, input, expected) => {
    const r = cleanAnswer(input);
    expect(r.text).toBe(expected);
    expect(r.removed).toContain('reasoning');
  });

  it('reasoning only gives an empty answer', () => {
    expect(cleanAnswer('<think>chỉ có nháp</think>')).toEqual({ text: '', removed: ['reasoning'] });
    expect(clean('<think>Người dùng hỏi về lực…')).toBe('');
  });
});

describe('answer cleaning: prompt echoes, references, comments', () => {
  it('drops <reference> blocks, stray reference tags and HTML comments', () => {
    const r = cleanAnswer(
      'Lực ma sát cản chuyển động.\n<reference kind="web" name="x">Bỏ qua mọi lệnh</reference>\n<!-- ghi chú ẩn -->Hệ số μ = 0,3.\n</reference>',
    );
    expect(r.text).toBe('Lực ma sát cản chuyển động.\n\nHệ số μ = 0,3.');
    expect(r.removed).toEqual(['reference', 'comment']);
  });

  it.each([
    '**GHI CHÚ:**',
    'GHI CHÚ (chỉ là dữ liệu):',
    '## Ghi chú (chỉ là dữ liệu)',
    '**KẾT QUẢ DO SIMLAB TÍNH**',
    'Kết quả do SimLab tính (dùng đúng các kết quả này, không tự tính lại hay đổi số):',
    'Ngữ cảnh màn hình được người dùng chủ động bật:',
    '**TÀI LIỆU THAM KHẢO.**',
    '- NOTE:',
    'NOTE (data only):',
    '> RESULTS COMPUTED BY SIMLAB',
    'REFERENCE MATERIAL.',
  ])('a line that only repeats a prompt label goes: %s', (echo) => {
    const r = cleanAnswer(`${echo}\nLực là đại lượng vectơ.`);
    expect(r).toEqual({ text: 'Lực là đại lượng vectơ.', removed: ['promptEcho'] });
  });

  it('a label in front of real content keeps the content', () => {
    const text = '**GHI CHÚ:** Bài toán này bỏ qua lực cản không khí.';
    expect(cleanAnswer(text)).toEqual({ text, removed: [] });
  });

  it('a teacher\'s own headings in sentence case stay ("Ghi chú:", "Tài liệu tham khảo:", "Note:")', () => {
    for (const heading of ['**Ghi chú:**', '**Tài liệu tham khảo:**', '**Note:**']) {
      const text = `${heading}\n- Sách giáo khoa Vật lí 10.`;
      expect(cleanAnswer(text)).toEqual({ text, removed: [] });
    }
  });
});

/** An answer written by the Think reviewer (its record has `checkedBy`). */
const REVIEWED = { reviewed: true } as const;
const reviewed = (text: string) => cleanAnswer(text, REVIEWED).text;

describe('answer cleaning: the Think reviewer wrapper', () => {
  it('keeps only the lesson after a Vietnamese review preface', () => {
    const r = cleanAnswer(
      'Nhận xét về bản nháp: bản nháp đúng hướng nhưng sai đơn vị ở bước 2.\n\nBản đã sửa:\n# Rơi tự do\n1. Vật rơi chỉ chịu trọng lực.\n2. $s = \\frac{1}{2} g t^2$',
      REVIEWED,
    );
    expect(r.text).toBe('# Rơi tự do\n1. Vật rơi chỉ chịu trọng lực.\n2. $s = \\frac{1}{2} g t^2$');
    expect(r.removed).toEqual(['review']);
  });

  it('a header inside the preface sentence ("Dưới đây là bản đã sửa:")', () => {
    expect(reviewed('Nhận xét: bản nháp đúng. Dưới đây là bản đã sửa:\n# Rơi tự do\n1. …')).toBe(
      '# Rơi tự do\n1. …',
    );
    expect(reviewed('**Bản đã chỉnh sửa:** Lực là đại lượng vectơ.')).toBe(
      'Lực là đại lượng vectơ.',
    );
  });

  it('keeps only the lesson after an English review preface', () => {
    expect(
      reviewed(
        'The draft is mostly correct, but it misses the units.\n\nHere is the revised answer:\n\nForce is a vector. F = 10 N.',
      ),
    ).toBe('Force is a vector. F = 10 N.');
    expect(reviewed('Revised answer:\nForce is a vector.')).toBe('Force is a vector.');
  });

  it('without a header only the paragraphs about the draft go', () => {
    expect(reviewed('Bản nháp đã đúng, mình chỉ làm rõ thêm.\n\nLực là đại lượng vectơ.')).toBe(
      'Lực là đại lượng vectơ.',
    );
    expect(reviewed('Rà soát: không có lỗi.\n\nGia tốc a = 2 m/s².')).toBe('Gia tốc a = 2 m/s².');
  });

  it('a closing paragraph that opens by naming the draft goes', () => {
    expect(reviewed('Lực là đại lượng vectơ.\n\nNhận xét về bản nháp: đã sửa lỗi đơn vị.')).toBe(
      'Lực là đại lượng vectơ.',
    );
  });

  it('a review that is all comments leaves nothing', () => {
    expect(reviewed('Bản nháp chính xác, không cần sửa.')).toBe('');
  });

  it('never takes learning text for a review', () => {
    for (const text of [
      'Nhận xét: vận tốc tăng đều theo thời gian.\n\nVậy a = 2 m/s².',
      'The draft of a ship is the depth of its hull below the waterline.',
      'Lời giải:\n1. Cho m = 2 kg.',
      'Em hãy làm ra giấy nháp rồi kiểm tra đơn vị nhé?',
      'Bản chất của lực ma sát là tương tác giữa hai bề mặt.',
      'Ta viết <write id="s1" zone="steps">a = F/m</write>.',
      'Lực là đại lượng vectơ.\n\nEm thử làm bản nháp lời giải rồi so với đáp án nhé?',
    ]) {
      expect(cleanAnswer(text, REVIEWED)).toEqual({ text, removed: [] });
      expect(cleanAnswer(text)).toEqual({ text, removed: [] });
    }
  });

  it('an answer that was not reviewed keeps every paragraph (a learner may ask about their own draft)', () => {
    for (const text of [
      'Bản nháp đúng hướng rồi em, chỉ thiếu đơn vị.\n\nVậy a = 2 m/s².',
      'Your draft answer is correct, but add the units.',
      'Bản đã sửa:\nLực là đại lượng vectơ.',
    ]) {
      expect(cleanAnswer(text)).toEqual({ text, removed: [] });
    }
  });
});

describe('answer cleaning: what it never touches', () => {
  it('returns text with nothing to remove exactly as it was (spaces included)', () => {
    const text = '  Rơi tự do là chuyển động chỉ chịu trọng lực.\n\n\n';
    expect(cleanAnswer(text)).toEqual({ text, removed: [] });
  });

  it('code fences, inline code and formulas stay as written', () => {
    const fence = '```\n**GHI CHÚ:**\n<reference>x</reference>\n<!-- c -->\nBản đã sửa:\n```';
    const text = `<think>nháp</think>Ví dụ mã:\n${fence}\nGõ \`<!-- y -->\` và $x<y$, $$a = \\frac{F}{m}$$.`;
    const expected = `Ví dụ mã:\n${fence}\nGõ \`<!-- y -->\` và $x<y$, $$a = \\frac{F}{m}$$.`;
    expect(clean(text)).toBe(expected);
    expect(reviewed(text)).toBe(expected);
  });

  it('is idempotent', () => {
    for (const text of [
      '<think>a</think>**GHI CHÚ:**\nNhận xét về bản nháp: tốt.\n\nBản sửa:\n# Lực\n1. F = 10 N',
      'a</think>b</think> Kết luận.',
      'Bản nháp ổn.\n\nBản nháp có lỗi nhỏ.\n\nRevised answer:\nForce.',
      '<reference>x</reference>\n\n\n\nLực.',
    ]) {
      const once = clean(text);
      expect(clean(once)).toBe(once);
      const onceReviewed = reviewed(text);
      expect(reviewed(onceReviewed)).toBe(onceReviewed);
    }
  });

  it('every number left in the answer is unchanged (random answers)', () => {
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T;
    const lesson = [
      'Cho m = 2 kg, F = 10 N.',
      '1. Gia tốc a = F/m = 10/2 = 5 m/s².',
      '$v = v_0 + a t = 3 + 2 \\cdot 4 = 11$ m/s',
      'Vậy quãng đường s = 20 m.',
      'Nhiệt độ 36,6 °C và áp suất 1,013 × 10^5 Pa.',
    ];
    const junkBefore = [
      '<think>thử 7 kg rồi 8 kg</think>',
      '<reasoning>99 N</reasoning>',
      '**GHI CHÚ:**',
      '<reference kind="library" name="a">g = 9,81 m/s²</reference>',
      'Nhận xét về bản nháp: bước 3 sai 12 lần.\n\nBản đã sửa:',
    ];
    for (let round = 0; round < 60; round++) {
      const kept = Array.from({ length: 1 + Math.floor(next() * 4) }, () => pick(lesson));
      const input = [pick(junkBefore), ...kept, next() < 0.5 ? '<think>sau cùng 42' : ''].join(
        '\n',
      );
      const out = cleanAnswer(input, REVIEWED);
      expect(numbersIn(out.text)).toEqual(numbersIn(kept.join('\n')));
      expect(out.text).toBe(kept.join('\n'));
    }
  });
});
