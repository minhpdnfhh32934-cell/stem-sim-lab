import { describe, expect, it } from 'vitest';
import { DIM } from '@/core/units';
import { loadScene } from '@/physics/registry';
import type { PhysicsScene } from '@/physics/types';
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

  it('finds the negation in the problem even when the quote leaves it out', () => {
    const cases: [string, number, string, string][] = [
      ['muK', 0, 'nhẵn', 'Vật 2 kg nằm trên mặt bàn không nhẵn, nối qua ròng rọc với vật 3 kg.'],
      ['v0', 0, 'đứng yên', 'Lúc đầu xe không đứng yên mà đang chạy.'],
      ['e', 0, 'dính vào nhau', 'Hai vật không dính vào nhau sau va chạm.'],
      ['e', 1, 'hoàn toàn đàn hồi', 'Va chạm giữa hai xe không hoàn toàn đàn hồi.'],
      ['e', 1, 'Đàn hồi hoàn toàn', 'Va chạm chưa  đàn hồi hoàn toàn.'],
      ['v0', 0, 'nghỉ', 'Xe chưa từng nghỉ trên đoạn đường đó.'],
    ];
    for (const [key, value, quote, text] of cases) {
      expect(impliedByWords(key, value, quote, text), `${quote} | ${text}`).toBe(false);
    }
  });

  it('refuses a quote that also stands in a negated sentence, accepts a precise one', () => {
    const text = 'Vật A đứng yên, vật B không đứng yên mà chạy tới với vận tốc 2 m/s.';
    expect(impliedByWords('vA', 0, 'đứng yên', text)).toBe(false);
    expect(impliedByWords('vA', 0, 'Vật A đứng yên', text)).toBe(true);
    expect(impliedByWords('vB', 0, 'vật B không đứng yên', text)).toBe(false);
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

  it('drops a value whose bare-phrase quote comes from a negated sentence', async () => {
    const pulley = await loadScene('pulley');
    const rough = 'Vật 2 kg nằm trên mặt bàn không nhẵn, nối qua ròng rọc với vật 3 kg.';
    const draft = buildDraft(pulley, extraction('muK', 0, 'nhẵn'), rough, 9.81);
    expect(draft.sources.muK).not.toBe('problem');
    expect(draft.issues.map((i) => [i.kind, i.key])).toContainEqual(['notInText', 'muK']);

    const collisions = await loadScene('collisions');
    const text = 'Xe 2 kg chạy với vận tốc 3 m/s tới xe 5 kg; va chạm không hoàn toàn đàn hồi.';
    const second = buildDraft(collisions, extraction('e', 1, 'hoàn toàn đàn hồi'), text, 9.81);
    expect(second.sources.e).not.toBe('problem');
    expect(second.issues.map((i) => [i.kind, i.key])).toContainEqual(['notInText', 'e']);

    // The same bare quote from a plain sentence is still accepted.
    const smooth = 'Vật 2 kg nằm trên mặt bàn nhẵn, nối qua ròng rọc với vật 3 kg.';
    const third = buildDraft(pulley, extraction('muK', 0, 'nhẵn'), smooth, 9.81);
    expect(third.sources.muK).toBe('problem');
    expect(third.issues.filter((i) => i.key === 'muK')).toEqual([]);
  });
});

describe('the sign of a charge (trap 3 of #37 §8.2)', () => {
  // A stand-in scene: the electric-field topic itself comes with #76 stage 2.
  const scene = {
    id: 'chargeStub',
    params: [
      {
        key: 'q1',
        label: { vi: 'q₁', en: 'q₁' },
        symbol: 'q_1',
        kind: 'number',
        dim: DIM.charge,
        unit: 'uC',
        min: -10,
        max: 10,
      },
    ],
    defaults: { q1: 1e-6 },
    required: [],
  } as unknown as PhysicsScene;
  const charge = (value: number, unit: string, quote: string): Extraction => ({
    quantities: [{ key: 'q1', value, unit, quote }],
    questions: [],
    assumptions: [],
    unsupported_parts: [],
    clarifications: [],
  });
  const flagged = (text: string, value: number, unit: string, quote: string) =>
    buildDraft(scene, charge(value, unit, quote), text, 9.81).issues.some(
      (i) => i.kind === 'signMismatch' && i.key === 'q1' && !i.blocking,
    );

  it('flags a sign the AI changed, keeps the value for the learner to confirm', () => {
    const text = 'Điện tích q₁ = −2 µC đặt tại A.';
    expect(flagged(text, 2, 'uC', 'q₁ = −2 µC')).toBe(true);
    expect(flagged(text, -2, 'uC', 'q₁ = −2 µC')).toBe(false);
    expect(buildDraft(scene, charge(2, 'uC', 'q₁ = −2 µC'), text, 9.81).params.q1).toBeCloseTo(
      2e-6,
      15,
    );
    expect(flagged('Điện tích âm q₁ có độ lớn 10⁻⁸ C.', 1e-8, 'C', '10⁻⁸ C')).toBe(true);
    expect(flagged('Điện tích q₁ = 10⁻⁸ C.', -1e-8, 'C', 'q₁ = 10⁻⁸ C')).toBe(true);
    expect(flagged('Điện tích q₁ = 10⁻⁸ C.', 1e-8, 'C', 'q₁ = 10⁻⁸ C')).toBe(false);
  });

  it('asks for confirmation when the problem leaves the sign open', () => {
    expect(flagged('Hai điện tích trái dấu có độ lớn 2 µC.', 2, 'uC', 'độ lớn 2 µC')).toBe(true);
  });
});
