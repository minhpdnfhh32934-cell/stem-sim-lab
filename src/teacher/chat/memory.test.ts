import { describe, expect, it } from 'vitest';
import type { ChatMessageRecord } from './chatStore';
import {
  CLOUD_OUTPUT_TOKENS,
  contextBudget,
  EMPTY_ANSWER,
  FULL_PROMPT_CONTEXT,
  GEMMA_OUTPUT_TOKENS,
  LOCAL_CONTEXT_MARGIN,
  localContextWindow,
  joinContinuation,
  estimateTokens,
  fitHistory,
  questionBefore,
  sentText,
  summaryBlock,
  summaryRequest,
  unsummarized,
} from './memory';

function record(id: string, role: 'user' | 'assistant', content: string): ChatMessageRecord {
  return { id, role, content };
}

/** 20 turns; each message ~300 characters (~100 estimated tokens). */
const LONG_CHAT: ChatMessageRecord[] = Array.from({ length: 40 }, (_, i) =>
  record(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', `${i} `.padEnd(300, 'x')),
);

describe('AI Teacher memory', () => {
  it('budgets grow with "Dài" and stay far below the models’ limits', () => {
    expect(contextBudget('gemma', 'gemma3-1b', 'medium')).toEqual({ input: 4000, output: 1024 });
    expect(contextBudget('gemma', 'gemma3-270m', 'long').input).toBe(8000);
    expect(contextBudget('gemma', 'gemma4-e2b', 'long').input).toBe(16000);
    expect(contextBudget('cloud', 'gemma3-1b', 'medium')).toEqual({ input: 12000, output: 4096 });
    // Gemma 3 270M/1B: 32 768 tokens, Gemma 4 E2B: 131 072 (config.json, 2026-10-12).
    expect(contextBudget('gemma', 'gemma3-1b', 'long').input + 1024).toBeLessThan(32768);
    expect(contextBudget('gemma', 'gemma4-e2b', 'long').input + 1024).toBeLessThan(131072);
  });

  it('a local runtime: its known context caps the cloud table; unknown → the small budget', () => {
    // Unknown context ("Chưa xác minh"): the small on-device budget, whatever the length.
    expect(contextBudget('local', 'gemma3-1b', 'medium', null)).toEqual({
      input: 4000,
      output: GEMMA_OUTPUT_TOKENS,
    });
    expect(contextBudget('local', 'gemma3-1b', 'long', null).input).toBe(4000);
    // A large window: the cloud budget and answer length.
    expect(contextBudget('local', 'x', 'medium', 131072)).toEqual({
      input: 12000,
      output: CLOUD_OUTPUT_TOKENS,
    });
    expect(contextBudget('local', 'x', 'long', 131072).input).toBe(32000);
    // A 32k window with "Dài": never more than the window minus the answer and the margin.
    const long = contextBudget('local', 'x', 'long', 32768);
    expect(long.input).toBe(32768 - CLOUD_OUTPUT_TOKENS - LOCAL_CONTEXT_MARGIN);
    // Small windows: the whole request (question + answer + margin) still fits.
    for (const ctx of [2048, 4096, 8192, FULL_PROMPT_CONTEXT - 1, FULL_PROMPT_CONTEXT]) {
      for (const length of ['medium', 'long'] as const) {
        const b = contextBudget('local', 'x', length, ctx);
        expect(b.input + b.output + LOCAL_CONTEXT_MARGIN, `${ctx} ${length}`).toBeLessThanOrEqual(
          ctx,
        );
        expect(b.input).toBeGreaterThan(0);
        expect(localContextWindow(b, ctx)).toBeLessThanOrEqual(ctx);
      }
    }
  });

  it('asks a local runtime for the window this request needs, never more than its own', () => {
    const small = contextBudget('local', 'x', 'medium', null);
    expect(localContextWindow(small, null)).toBe(4000 + 1024 + LOCAL_CONTEXT_MARGIN);
    const big = contextBudget('local', 'x', 'medium', 131072);
    // Not the model's whole 128k window (the runtime would reserve memory for all of it).
    expect(localContextWindow(big, 131072)).toBe(12000 + 4096 + LOCAL_CONTEXT_MARGIN);
    expect(localContextWindow({ input: 100, output: 100 }, null)).toBe(2048);
    expect(localContextWindow({ input: 9000, output: 1024 }, 4096)).toBe(4096);
  });

  it('keeps far more history than the old "last 4 / last 12 messages"', () => {
    const fitted = fitHistory(LONG_CHAT, 3000);
    expect(fitted.messages.length).toBeGreaterThan(12);
    expect(fitted.messages.length + fitted.older.length).toBe(LONG_CHAT.length);
    // Newest kept, oldest first, nothing reordered.
    expect(fitted.messages.at(-1)?.content).toBe(LONG_CHAT.at(-1)?.content);
    expect(fitted.older.at(-1)?.id).toBe(`m${fitted.older.length - 1}`);
    const used = fitted.messages.reduce((n, m) => n + estimateTokens(m.content) + 6, 0);
    expect(used).toBeLessThanOrEqual(3000);
  });

  it('sends the full instruction of a quick button, not its short label', () => {
    const quick = { ...record('q', 'user', 'Chậm hơn'), prompt: 'Thầy giảng lại chậm hơn…' };
    expect(fitHistory([quick], 1000).messages[0]?.content).toBe('Thầy giảng lại chậm hơn…');
  });

  it('only the turns not covered by the summary yet are summarised again', () => {
    const older = LONG_CHAT.slice(0, 10);
    expect(unsummarized(older, null)).toHaveLength(10);
    expect(unsummarized(older, { text: 's', upto: 'm5' }).map((r) => r.id)).toEqual([
      'm6',
      'm7',
      'm8',
      'm9',
    ]);
    // The summary covers a message that is back in the request (the budget grew): nothing new.
    expect(unsummarized(older.slice(0, 3), { text: 's', upto: 'm5' }, LONG_CHAT)).toEqual([]);
    // The covered message was dropped from storage (80 kept): treat everything as new.
    expect(unsummarized(older, { text: 's', upto: 'gone' })).toHaveLength(10);
  });

  it('a very long backlog keeps every turn (shortened), so the topic set at the start survives', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      record(`b${i}`, i % 2 === 0 ? 'user' : 'assistant', `Lượt ${i} `.padEnd(2000, 'y')),
    );
    const text = summaryRequest('vi', null, many).messages[0]?.content ?? '';
    expect(text).toContain('Học sinh: Lượt 0 ');
    expect(text).toContain('Thầy: Lượt 199 ');
    expect(text.length).toBeLessThan(60000);
  });

  it('the summary request carries the old summary and asks for no new facts', () => {
    const req = summaryRequest(
      'vi',
      { text: 'Đang học con lắc.', upto: 'm1' },
      LONG_CHAT.slice(2, 4),
    );
    expect(req.system).toMatch(/không thêm kiến thức mới/);
    expect(req.messages[0]?.content).toContain('Đang học con lắc.');
    expect(req.messages[0]?.content).toContain('Học sinh: 2');
    expect(req.messages[0]?.content).toContain('Thầy: 3');
  });

  it('the summary is labelled as AI-written when added to the instruction', () => {
    expect(summaryBlock('vi', null)).toBe('');
    expect(summaryBlock('vi', { text: '- con lắc', upto: 'm1' })).toMatch(/do AI viết/);
  });
});

describe('answers saved by an older version are sent back cleaned (review 2026-10-15)', () => {
  const think = (id: string, content: string): ChatMessageRecord => ({
    id,
    role: 'assistant',
    content,
    checkedBy: 'groq',
  });

  it('hidden reasoning and echoed labels never go back to the AI', () => {
    const old = record('a', 'assistant', '<think>thử 7 kg</think>**GHI CHÚ:**\nLực là vectơ.');
    expect(sentText(old)).toBe('Lực là vectơ.');
    const fitted = fitHistory([record('q', 'user', 'Lực là gì?'), old], 1000);
    expect(fitted.messages.map((m) => m.content)).toEqual(['Lực là gì?', 'Lực là vectơ.']);
    const summary = summaryRequest('vi', null, [record('q', 'user', 'Lực là gì?'), old]);
    expect(summary.messages[0]?.content).not.toContain('thử 7 kg');
    expect(summary.messages[0]?.content).toContain('Thầy: Lực là vectơ.');
  });

  it("a Think answer loses the reviewer's notes, read with the question before it", () => {
    const answer = think('a', 'Bản nháp đúng.\n\nBản đã sửa:\n# Rơi tự do\nv = gt');
    const records = [record('q', 'user', 'Rơi tự do là gì?'), answer];
    expect(fitHistory(records, 1000).messages[1]?.content).toBe('# Rơi tự do\nv = gt');
    expect(summaryRequest('vi', null, records).messages[0]?.content).toContain('Thầy: # Rơi tự do');
    // A question about the learner's own draft keeps the reviewed answer whole.
    const own = [record('q', 'user', 'Thầy xem nháp giúp em'), answer];
    expect(fitHistory(own, 1000).messages[1]?.content).toBe(answer.content);
    // Without the question, the notes are left as saved (they may be feedback asked for).
    expect(sentText(answer)).toBe(answer.content);
    expect(sentText(answer, 'Rơi tự do là gì?')).toBe('# Rơi tự do\nv = gt');
  });

  it('the question is the user turn right before the answer', () => {
    const records = [
      record('q1', 'user', 'Câu 1'),
      record('a1', 'assistant', 'Đáp 1'),
      record('q2', 'user', 'Câu 2'),
      record('a2', 'assistant', 'Đáp 2'),
    ];
    expect(questionBefore(records, 3)).toBe('Câu 2');
    expect(questionBefore(records, 1)).toBe('Câu 1');
    expect(questionBefore(records, 0)).toBe('');
  });

  it('a clean answer, a question and a quick button go as saved', () => {
    const clean = record('a', 'assistant', 'Lực là đại lượng vectơ.');
    expect(sentText(clean)).toBe(clean.content);
    const question = record('q', 'user', '<think> trong câu hỏi');
    expect(sentText(question)).toBe(question.content);
    const quick = { ...record('q', 'user', 'Chậm hơn'), prompt: 'Thầy giảng lại chậm hơn…' };
    expect(sentText(quick)).toBe('Thầy giảng lại chậm hơn…');
  });

  it('an answer that was all reasoning never goes back as reasoning, nor as an empty turn (review fix round 2)', () => {
    for (const content of [
      '<think>chỉ có nháp</think>',
      // Cut in the middle of the reasoning: no closing tag.
      '<think>chỉ có nháp, thử 7 kg',
      '<thinking>chỉ có nháp</thinking>\n\n',
    ]) {
      const only = record('a', 'assistant', content);
      expect(sentText(only), content).toBe(EMPTY_ANSWER);
      const records = [
        record('q', 'user', 'Lực là gì?'),
        only,
        record('q2', 'user', 'Còn khối lượng?'),
      ];
      const sent = fitHistory(records, 1000).messages.map((m) => m.content);
      expect(sent, content).toEqual(['Lực là gì?', EMPTY_ANSWER, 'Còn khối lượng?']);
      const summary = summaryRequest('vi', null, records).messages[0]?.content ?? '';
      expect(summary, content).not.toMatch(/<\/?think|chỉ có nháp|7 kg/);
      expect(summary, content).toContain(`Thầy: ${EMPTY_ANSWER}`);
    }
    // A Think answer that was all reviewer notes: the notes are not sent either.
    const notes = { ...record('a', 'assistant', 'Bản nháp đã đúng.'), checkedBy: 'groq' };
    expect(sentText(notes, 'Lực là gì?')).toBe(EMPTY_ANSWER);
    expect(EMPTY_ANSWER.trim()).not.toBe('');
  });
});

describe('a question about part of the board (item 2)', () => {
  const asked: ChatMessageRecord = {
    id: 'q2',
    role: 'user',
    content: 'Chỗ này nghĩa là gì ạ?',
    boardRef: { face: 0, ids: ['f1'], excerpt: '$s = \\frac{1}{2} g t^2$' },
  };
  it('goes back to the AI with what was circled, so a follow-up knows what "chỗ này" was', () => {
    expect(sentText(asked)).toBe('Chỗ này nghĩa là gì ạ?\n«$s = \\frac{1}{2} g t^2$»');
    // A picture (nothing to quote) and an ordinary question go as typed.
    expect(sentText({ ...asked, boardRef: { face: 0, ids: [], excerpt: '' } })).toBe(
      'Chỗ này nghĩa là gì ạ?',
    );
    expect(sentText(record('q', 'user', 'Rơi tự do là gì?'))).toBe('Rơi tự do là gì?');
  });

  it('the history and the summary of older turns carry it too', () => {
    const records = [
      record('q1', 'user', 'Rơi tự do là gì?'),
      record('a1', 'assistant', 'Là…'),
      asked,
    ];
    expect(fitHistory(records, 10_000).messages.at(-1)?.content).toContain('«$s = ');
    const summary = summaryRequest('vi', null, records);
    expect(summary.messages[0]?.content).toContain('«$s = ');
  });
});

describe('"Viết tiếp" joins the rest of a cut answer', () => {
  it('a new list item, heading or formula starts a new line; a cut sentence continues', () => {
    expect(joinContinuation('3. Thay số.', '4. Kết luận.')).toBe('3. Thay số.\n4. Kết luận.');
    expect(joinContinuation('Bước 1\n', '## Bước 2')).toBe('Bước 1\n## Bước 2');
    expect(joinContinuation('Ta có', '$$F = ma$$')).toBe('Ta có\n$$F = ma$$');
    expect(joinContinuation('Vật rơi với gia', 'tốc g.')).toBe('Vật rơi với gia tốc g.');
    expect(joinContinuation('Vật rơi với ', 'gia tốc g.')).toBe('Vật rơi với gia tốc g.');
  });
});
