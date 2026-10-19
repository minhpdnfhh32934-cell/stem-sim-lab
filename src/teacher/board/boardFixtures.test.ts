import { describe, expect, it } from 'vitest';
import fixtures from './boardFixtures.json';
import { lessonFor } from './lesson';
import type { BoardAction } from './teachscript';

/**
 * Item 1 on real answers: copies of on-device eval answers (tests/teaching/results, never edited)
 * and cloud-shaped synthetic ones. The board shows learning content only, and every conclusion
 * with a number is written and boxed exactly once.
 */

type Write = Extract<BoardAction, { kind: 'write' }>;

interface Fixture {
  id: string;
  answer: string;
  reviewed?: boolean;
}

const all: Fixture[] = [...fixtures.answers, ...fixtures.synthetic];

/** What may never stand on the board (item 1). */
const BANNED =
  /chào|tôi là (?:một )?AI|dưới đây|GHI CHÚ|^-{3}|<\/?[a-z]|\\\(|\*\*|https?:|bản nháp|<think|nháp nội bộ/iu;

/** A conclusion line with a number: "Đáp số: …", "Kết luận: …", or a "Kết luận:" label + its line. */
function conclusions(answer: string): string[] {
  const lines = answer
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map((l) =>
      l
        .replace(/[*_#>|]/g, '')
        .replace(/^\s*[-•]\s+/u, '')
        .trim(),
    )
    .filter(Boolean);
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (!/^(?:đáp số|kết luận)\s*:/iu.test(line)) return;
    const content = line.replace(/^(?:đáp số|kết luận)\s*:\s*/iu, '');
    const text = content || (lines[i + 1] ?? '');
    if (/\d/.test(text)) out.push(text);
  });
  return out;
}

describe.each(all)('board fixture $id', (fixture) => {
  const lesson = lessonFor(fixture.answer, { reviewed: fixture.reviewed === true });
  const actions = lesson.script.sentences.flatMap((s) => s.actions.map((a) => a.action));
  const writes = actions.filter((a): a is Write => a.kind === 'write');

  it('writes learning content only', () => {
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(w.text.trim(), w.id).not.toBe('');
      expect(w.text, w.id).not.toMatch(BANNED);
    }
    const said = lesson.script.sentences.map((s) => s.spoken).join(' ');
    expect(said).not.toMatch(/<think|nháp nội bộ|bản nháp|https?:/iu);
  });

  it('writes and boxes every conclusion with a number exactly once', () => {
    const boxes = actions.filter(
      (a): a is Extract<BoardAction, { kind: 'mark' }> => a.kind === 'mark' && a.mark === 'box',
    );
    const perTarget = new Map<string, number>();
    for (const b of boxes) perTarget.set(b.target, (perTarget.get(b.target) ?? 0) + 1);
    for (const count of perTarget.values()) expect(count).toBe(1);
    for (const target of perTarget.keys())
      expect(writes.find((w) => w.id === target)?.role).toBe('result');
    for (const conclusion of conclusions(fixture.answer)) {
      const number = conclusion.match(/\d+(?:[.,]\d+)?/)?.[0] ?? '';
      const results = writes.filter((w) => w.role === 'result' && w.text.includes(number));
      expect(results.length, conclusion).toBeGreaterThanOrEqual(1);
      expect(
        results.filter((w) => perTarget.has(w.id)),
        conclusion,
      ).toHaveLength(1);
    }
  });
});

describe('the fixtures', () => {
  it('cover greetings, prompt echoes, rules, links, labels alone, reasoning and reviewer notes', () => {
    const text = all.map((f) => f.answer).join('\n');
    for (const shape of [
      /Chào bạn/u,
      /\*\*GHI CHÚ:\*\*/u,
      /^---$/mu,
      /https?:/u,
      /^\*\*Kết luận:\*\*$/mu,
      /<think>/u,
      /<\/think>/u,
      /Nhận xét về bản nháp/u,
      /<sup>/u,
      /```/u,
    ])
      expect(text).toMatch(shape);
  });
});
