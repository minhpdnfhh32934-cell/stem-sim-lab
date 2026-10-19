import { describe, expect, it } from 'vitest';
import { getDictionary, LOCALES } from '@/app/i18n';
import teachingEval from '../../../tests/teaching/teaching-eval.json';
import teachingHeldout from '../../../tests/teaching/teaching-heldout.json';
import { contextPrompt, turnKind } from './chatService';
import { CONTINUE_PROMPT } from './memory';

/**
 * Benchmark 2026-10-14 (docs/TEACHING_EVAL.md): with "answer directly in the first sentence",
 * Gemma 1B opened with "Đúng!" on a wrong premise and on a learner's wrong answer. Those turns
 * get their own opening instruction.
 */
const teacherAsked = [
  { role: 'user', content: 'Định luật II Newton nói gì?' },
  {
    role: 'assistant',
    content: 'a = F/m. Nếu khối lượng tăng gấp đôi mà lực giữ nguyên thì gia tốc thế nào?',
  },
];

describe('turn kinds (how an on-device answer opens)', () => {
  it('recognises a yes/no question built on an idea to confirm', () => {
    expect(turnKind('Có phải vật nặng rơi nhanh hơn vật nhẹ không?', [])).toBe('premise');
    expect(turnKind('Thực vật chỉ hô hấp vào ban đêm, đúng không?', [])).toBe('premise');
    expect(turnKind('Is it true that heavier objects fall faster?', [])).toBe('premise');
  });

  it('recognises a learner answering the teacher’s check question', () => {
    expect(turnKind('Gia tốc tăng gấp đôi ạ.', teacherAsked)).toBe('learnerReply');
    // A new question of its own after the teacher's question is not a reply.
    expect(
      turnKind('Vì sao trong chân không vật nặng và vật nhẹ rơi như nhau?', teacherAsked),
    ).toBe('question');
  });

  it('leaves ordinary questions as they were', () => {
    expect(turnKind('Lực ma sát nghỉ là gì?', [])).toBe('question');
    expect(turnKind('Tính gia tốc của vật 2 kg chịu lực 10 N.', [])).toBe('question');
  });
});

/**
 * Review finding (2026-10-14): CHECK_QUESTION makes concept answers end with "?", and every short
 * message without "?" after them was read as a reply to that question, so the quick buttons and
 * typed requests got "Không khen ngay… Chưa đúng" instead of being reworked.
 */
const teacherAskedEn = [
  { role: 'user', content: "What does Newton's second law say?" },
  {
    role: 'assistant',
    content: 'a = F/m. If the mass doubles and the force stays the same, what happens to a?',
  },
];
const askedIn = { vi: teacherAsked, en: teacherAskedEn } as const;

interface EvalItem {
  id: string;
  question: string;
  history?: readonly { role: string; content: string }[];
}
const evalItems: readonly EvalItem[] = [...teachingEval.items, ...teachingHeldout.items];
const evalReplies = evalItems.filter((item) => (item.history?.length ?? 0) > 0);

describe('requests after the teacher’s check question are not replies', () => {
  it('still reads every learner reply of the evaluation sets as a reply', () => {
    // P10, C10, B10 (teaching-eval) and H3, H8, H13 (held-out) at the time of writing.
    expect(evalReplies.length).toBeGreaterThanOrEqual(6);
    for (const item of evalReplies) {
      expect(turnKind(item.question, item.history ?? []), item.id).toBe('learnerReply');
    }
  });

  it('never reads a quick button as a reply (by its text alone, and when flagged)', () => {
    for (const locale of LOCALES) {
      const chips = Object.entries(getDictionary(locale).teacher.chipPrompts);
      expect(chips.length).toBeGreaterThanOrEqual(6);
      for (const [key, prompt] of chips) {
        expect(turnKind(prompt, askedIn[locale]), `${locale}.${key}`).not.toBe('learnerReply');
        expect(turnKind(prompt, askedIn[locale], { quickAction: true }), `${locale}.${key}`).toBe(
          'question',
        );
      }
    }
  });

  it('a quick button is never a reply, whatever it says', () => {
    expect(turnKind('Gia tốc tăng gấp đôi ạ.', teacherAsked, { quickAction: true })).toBe(
      'question',
    );
    expect(turnKind('Gia tốc tăng gấp đôi ạ.', teacherAsked, { quickAction: false })).toBe(
      'learnerReply',
    );
  });

  it('never reads "Viết tiếp" as a reply', () => {
    for (const locale of LOCALES) {
      expect(turnKind(CONTINUE_PROMPT[locale], askedIn[locale]), locale).not.toBe('learnerReply');
    }
  });

  it('reads typed requests as requests', () => {
    const vi = [
      'Tính gia tốc khi m = 4 kg, F = 10 N.',
      'Thầy giải thích lại giúp em.',
      'Dạ, thầy cho em thêm một ví dụ nữa.',
      'Cho em một ví dụ dễ hiểu hơn.',
      'Giải thích giúp em ý chính của chủ đề này.',
      'Em chưa hiểu chỗ này lắm.',
      'Dạ em vẫn không hiểu ạ.',
      'Nói lại chậm hơn được không ạ.',
      'Thầy ơi, nói chậm lại một chút.',
      'Giảng lại đơn giản hơn đi.',
      'Ví dụ khác đi thầy.',
      'Hướng dẫn em từng bước.',
      'Hãy vẽ giản đồ lực.',
      'So sánh ma sát nghỉ và ma sát trượt.',
      // Final review: short ways to say "I'm lost" or "redo it", a problem typed in textbook form.
      'Chưa hiểu ạ.',
      'Không hiểu ạ.',
      'Chưa hiểu lắm',
      'Khó hiểu quá thầy ạ.',
      'Em thấy khó hiểu quá.',
      'Em hiểu chưa rõ lắm',
      'Thầy, giải thích lại đi',
      'Thầy à, giải thích lại giúp em',
      'Vậy thầy giải thích lại giúp em',
      'Thế thầy cho em ví dụ khác đi',
      'Thầy làm lại giúp em',
      'Thầy chậm lại chút',
      'Chậm thôi thầy',
      'Dễ hiểu hơn đi ạ',
      'Nói dễ hiểu hơn',
      'Một ví dụ nữa ạ',
      'thay giai thich lai giup em',
      'Cho m = 4 kg, F = 10 N. Tính a.',
      'Một vật 2 kg chịu lực kéo 10 N trên mặt phẳng ngang không ma sát. Tính gia tốc của vật.',
      'Lực ma sát nghỉ là gì? Cho một ví dụ.',
    ];
    for (const text of vi) expect(turnKind(text, teacherAsked), text).toBe('question');
    const en = [
      'Explain it again.',
      'Calculate the acceleration for m = 4 kg and F = 10 N.',
      'Give me another example.',
      'Show me the steps.',
      'Again, more slowly please.',
      'Please say it more simply.',
      "I don't understand.",
      'Can you go over that once more.',
      'Simpler please',
      'Slower please',
      'More slowly',
      'In simpler words',
      "I didn't get that",
      'Go slower',
      'More examples please',
      'Find the acceleration for m = 4 kg and F = 10 N.',
      'A 2 kg mass is pulled by 10 N. Find the acceleration.',
    ];
    for (const text of en) expect(turnKind(text, teacherAskedEn), text).toBe('question');
  });

  it('reads no question of the evaluation sets as a reply when typed after a check question', () => {
    for (const item of evalItems.filter((i) => !(i.history?.length ?? 0))) {
      expect(turnKind(item.question, teacherAsked), item.id).not.toBe('learnerReply');
    }
  });

  it('keeps answers that start like a request word as replies', () => {
    const vi = [
      'Chậm hơn ạ.',
      'Tính ra 5 m/s² ạ.',
      'Tính theo a = F/m thì gia tốc giảm một nửa ạ.',
      'Ví dụ: đẩy tủ mà tủ chưa nhúc nhích ạ.',
      'Đơn giản là vì lực không đổi ạ.',
      'Thầy ơi, gia tốc giảm một nửa ạ.',
      'Chỉ còn một nửa ạ.',
      'Giảm một nửa, em tính bằng a = F/m.',
      // Final review: worked steps (the hint button asks the learner to try the step) and
      // content answers that open with a request-like word.
      'Tính a = F/m = 2,5 m/s² ạ.',
      'Tính: a = F/m = 10/4 = 2,5 m/s² ạ.',
      'Tính gia tốc trước: a = 2,5 m/s² ạ.',
      'Tính nhẩm ra 2,5 ạ',
      'Tính toán thì ra 2,5 ạ',
      'Tóm tắt: m = 2 kg, F = 10 N. a = F/m = 5 m/s².',
      'Chỉ cho dòng điện đi qua theo một chiều ạ.',
      'Chỉ cho các phân tử nhỏ đi qua ạ.',
      'Ví dụ khác là xe đỗ trên dốc ạ.',
      'Ví dụ đi bộ, chân không trượt nhờ ma sát nghỉ ạ.',
      'Ví dụ cụ thể là quyển sách nằm yên ạ.',
      'Chậm lại một chút ạ.',
      'Chậm lại thôi ạ, không dừng ngay.',
      'Cho con lắc dài hơn thì chu kì tăng ạ.',
      'Phân tích lực thì có trọng lực và phản lực ạ.',
      'So sánh thì vật A rơi nhanh hơn ạ.',
      'Giải thích là vì lực ma sát cân bằng lực kéo ạ.',
      'Gợi ý của thầy giúp em ra 2,5 ạ',
      'Em nghĩ là 5 m/s',
      'Vì lực ma sát',
      'Tính ra 20 N',
      'Do nhiễm sắc thể nhân đôi',
      'Tính chất này là do lực hút ạ.',
    ];
    for (const text of vi) expect(turnKind(text, teacherAsked), text).toBe('learnerReply');
    const en = [
      'It halves.',
      'It moves more slowly.',
      'Half as much, I think.',
      "Don't know.",
      'Calculate: a = 10/4 = 2.5',
      'Compute 10/4 = 2.5',
      'Solve: a = F/m = 2.5 m/s²',
      'Continue moving at the same speed',
      'Slow down and stop',
      'Show that a = F/m, so it halves.',
      'Say it halves.',
      'I want to say it halves.',
      'Again it halves.',
      'It will slow down',
      'So it halves',
    ];
    for (const text of en) expect(turnKind(text, teacherAskedEn), text).toBe('learnerReply');
  });

  it('still finds premise questions after the teacher’s question', () => {
    expect(turnKind('Có phải gia tốc giảm một nửa không?', teacherAsked)).toBe('premise');
    expect(turnKind('Thầy giải thích lại, gia tốc giảm đúng không?', teacherAsked)).toBe('premise');
    expect(turnKind('Is it true that it halves?', teacherAskedEn)).toBe('premise');
  });
});

describe('on-device prompt opening', () => {
  it('never asks to open with a direct answer on a premise question', async () => {
    const { system } = await contextPrompt(
      'Có phải khi vật chuyển động thẳng đều thì không có lực nào tác dụng lên vật không?',
      'vi',
      false,
      false,
      'compact',
    );
    expect(system).toContain('Không mở đầu bằng "Đúng", "Có" hay "Phải"');
    expect(system).not.toContain('Câu đầu: trả lời thẳng câu hỏi');
  });

  it('asks the model to check a learner’s answer before judging it', async () => {
    const { system } = await contextPrompt(
      'Gia tốc tăng gấp đôi ạ.',
      'vi',
      false,
      false,
      'compact',
      teacherAsked,
    );
    expect(system).toContain('Không khen ngay');
    expect(system).toContain('Chưa đúng');
    expect(system).not.toContain('Câu đầu: trả lời thẳng câu hỏi');
  });

  it('reworks the last answer for a quick button instead of judging a reply', async () => {
    for (const locale of LOCALES) {
      for (const [key, prompt] of Object.entries(getDictionary(locale).teacher.chipPrompts)) {
        const { system } = await contextPrompt(
          prompt,
          locale,
          false,
          false,
          'compact',
          askedIn[locale],
          { quickAction: true },
        );
        expect(system, `${locale}.${key}`).not.toMatch(/Không khen ngay|Do not praise at once/);
      }
    }
    // The flag alone decides: a quick button whose text looks like a reply is still reworked.
    const { system } = await contextPrompt(
      'Gia tốc tăng gấp đôi ạ.',
      'vi',
      false,
      false,
      'compact',
      teacherAsked,
      { quickAction: true },
    );
    expect(system).not.toContain('Không khen ngay');
  });

  it('keeps the direct first sentence for an ordinary question', async () => {
    const { system } = await contextPrompt('Lực ma sát nghỉ là gì?', 'vi', false, false, 'compact');
    expect(system).toContain('Câu đầu: trả lời thẳng câu hỏi');
  });
});
