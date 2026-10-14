import { describe, expect, it } from 'vitest';
import { contextPrompt, turnKind } from './chatService';

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

  it('keeps the direct first sentence for an ordinary question', async () => {
    const { system } = await contextPrompt('Lực ma sát nghỉ là gì?', 'vi', false, false, 'compact');
    expect(system).toContain('Câu đầu: trả lời thẳng câu hỏi');
  });
});
