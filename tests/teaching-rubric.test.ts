import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scoreAnswer, summarize, type EvalItem } from '../scripts/teaching/rubric.mjs';

/** The AI Teacher evaluation set and its objective checks (audit EDU-02). */
const set = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'teaching/teaching-eval.json'), 'utf8'),
) as { items: EvalItem[]; review_status: string };

describe('teaching evaluation set', () => {
  it('covers three subjects and every question type, at least 30 items', () => {
    expect(set.items.length).toBeGreaterThanOrEqual(30);
    for (const subject of ['physics', 'chemistry', 'biology'] as const) {
      expect(set.items.filter((i) => i.subject === subject).length).toBeGreaterThanOrEqual(10);
    }
    const types = new Set(set.items.map((i) => i.type));
    for (const t of ['concept', 'problem', 'missing-data', 'misconception', 'followup', 'tool']) {
      expect(types).toContain(t);
    }
    expect(new Set(set.items.map((i) => i.id)).size).toBe(set.items.length);
    // Every pattern compiles.
    for (const i of set.items) for (const p of [...i.keyFacts.flat(), ...i.mustNot]) new RegExp(p);
    expect(set.review_status).toBe('pending');
  });

  it('scores a good answer above a wrong one', () => {
    const item = set.items.find((i) => i.id === 'B1');
    if (!item) throw new Error('B1 missing');
    const good =
      'Ở kì trung gian (pha S), ADN nhân đôi nên mỗi nhiễm sắc thể có 2 cromatit. Nhờ vậy mỗi tế bào con nhận đủ bộ 2n giống tế bào mẹ. Lỗi hay gặp: nghĩ ADN nhân đôi trong kì đầu. Em thử trả lời: pha nào ADN nhân đôi?';
    const wrong = 'ADN nhân đôi xảy ra ở pha M rồi chia đều cho các tế bào.';
    const a = scoreAnswer(item, good);
    const b = scoreAnswer(item, wrong);
    expect(a.keyFacts).toBe(1);
    expect(a.noKnownErrors).toBe(true);
    expect(a.checkQuestion).toBe(true);
    expect(b.noKnownErrors).toBe(false);
    expect(b.keyFacts).toBeLessThan(1);
  });

  it('expects a clarifying question when data is missing', () => {
    const item = set.items.find((i) => i.id === 'P5');
    if (!item) throw new Error('P5 missing');
    expect(scoreAnswer(item, 'Quãng đường là 100 m.').asksClarification).toBe(false);
    expect(
      scoreAnswer(item, 'Em cho thầy biết vận tốc và thời gian chuyển động là bao nhiêu nhé?')
        .asksClarification,
    ).toBe(true);
    expect(summarize([scoreAnswer(item, 'Em cho biết vận tốc là bao nhiêu?')]).n).toBe(1);
  });
});
