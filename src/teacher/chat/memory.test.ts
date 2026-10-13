import { describe, expect, it } from 'vitest';
import type { ChatMessageRecord } from './chatStore';
import {
  contextBudget,
  joinContinuation,
  estimateTokens,
  fitHistory,
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

describe('"Viết tiếp" joins the rest of a cut answer', () => {
  it('a new list item, heading or formula starts a new line; a cut sentence continues', () => {
    expect(joinContinuation('3. Thay số.', '4. Kết luận.')).toBe('3. Thay số.\n4. Kết luận.');
    expect(joinContinuation('Bước 1\n', '## Bước 2')).toBe('Bước 1\n## Bước 2');
    expect(joinContinuation('Ta có', '$$F = ma$$')).toBe('Ta có\n$$F = ma$$');
    expect(joinContinuation('Vật rơi với gia', 'tốc g.')).toBe('Vật rơi với gia tốc g.');
    expect(joinContinuation('Vật rơi với ', 'gia tốc g.')).toBe('Vật rơi với gia tốc g.');
  });
});
