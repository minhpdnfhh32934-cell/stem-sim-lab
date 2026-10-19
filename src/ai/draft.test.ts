import { describe, expect, it } from 'vitest';
import { loadScene } from '@/physics/registry';
import { buildDraft, impliedByWords } from './draft';
import type { Extraction } from './spec';

/** One quantity the AI says is stated in words, with its quote. */
function extraction(key: string, value: number, quote: string): Extraction {
  return {
    quantities: [{ key, value, unit: '1', quote }],
    questions: [],
    assumptions: [],
    unsupported_parts: [],
    clarifications: [],
  };
}

describe('values stated in words (MASTER_PROMPT §2.1)', () => {
  it('accepts a phrase that states the value', () => {
    const text = 'Vật được thả nhẹ trên mặt bàn nhẵn rồi va chạm đàn hồi với vật thứ hai.';
    expect(impliedByWords('v0', 0, 'thả nhẹ', text)).toBe(true);
    expect(impliedByWords('muK', 0, 'mặt bàn nhẵn', text)).toBe(true);
    expect(impliedByWords('e', 1, 'va chạm đàn hồi', text)).toBe(true);
    const full = 'Hai vật va chạm hoàn toàn đàn hồi trong không khí, vật B đứng yên.';
    expect(impliedByWords('e', 1, 'va chạm hoàn toàn đàn hồi', full)).toBe(true);
    // "không khí" (air) is a noun, not a negation.
    expect(impliedByWords('vB', 0, 'trong không khí, vật B đứng yên', full)).toBe(true);
  });

  it('never accepts a negated phrase', () => {
    const cases: [string, number, string][] = [
      ['e', 1, 'Hai vật trượt tới rồi va chạm không đàn hồi.'],
      ['e', 1, 'Va chạm giữa hai xe không hoàn toàn đàn hồi.'],
      ['e', 0, 'Hai vật không dính vào nhau sau va chạm.'],
      ['muK', 0, 'Vật trượt trên mặt bàn không nhẵn.'],
      ['v0', 0, 'Lúc đầu xe không đứng yên mà đang chạy.'],
      ['v0', 0, 'Xe chưa từng nghỉ trên đoạn đường đó.'],
      ['angle', 0, 'Vật được ném không nằm ngang.'],
    ];
    for (const [key, value, text] of cases) {
      expect(impliedByWords(key, value, text, text), text).toBe(false);
    }
  });

  it('needs the whole phrase: a spring\'s "đàn hồi" is not an elastic collision', () => {
    const text = 'Lò xo có độ cứng đàn hồi tốt, hai vật va chạm với nhau.';
    expect(impliedByWords('e', 1, 'Lò xo có độ cứng đàn hồi tốt', text)).toBe(false);
  });

  it('drops a negated value in the draft instead of marking it as stated', async () => {
    const collisions = await loadScene('collisions');
    const text = 'Vật nặng 2 kg trượt với vận tốc 3 m/s tới vật 5 kg rồi va chạm không đàn hồi.';
    const draft = buildDraft(collisions, extraction('e', 1, 'va chạm không đàn hồi'), text, 9.81);
    expect(draft.sources.e).not.toBe('problem');
    expect(draft.issues.map((i) => [i.kind, i.key])).toContainEqual(['notInText', 'e']);

    const pulley = await loadScene('pulley');
    const rough = 'Vật 2 kg nằm trên mặt bàn không nhẵn, nối qua ròng rọc với vật 3 kg.';
    const second = buildDraft(pulley, extraction('muK', 0, 'mặt bàn không nhẵn'), rough, 9.81);
    expect(second.sources.muK).not.toBe('problem');
    expect(second.issues.map((i) => [i.kind, i.key])).toContainEqual(['notInText', 'muK']);
  });
});
