import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { complement, translate } from '@/biology/central/dogma';
import { cross, ratio } from '@/biology/genetics/mendel';
import { balance, parseEquation } from '@/chemistry/balance';
import { configString, elementBySymbol, shellOrder } from '@/chemistry/data/elements';
import { molarMass } from '@/chemistry/formula';
import { circular } from '@/physics/circular/model';
import { pendulumInput } from '@/physics/pendulum/engine';
import { numericPeriodPendulum } from '@/physics/pendulum/scenes';
import { fold, scoreAnswer, trapHandled, type EvalItem } from '../scripts/teaching/rubric.mjs';

type Item = EvalItem & { expected: string; review_status: string };
const set = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'teaching/teaching-heldout-2.json'), 'utf8'),
) as { review_status: string; items: Item[] };
const item = (id: string): Item => {
  const found = set.items.find((i) => i.id === id);
  if (!found) throw new Error(`no item ${id}`);
  return found;
};
/** The answer key's group `k` of item `id` accepts `text`. */
const accepts = (id: string, k: number, text: string) =>
  (item(id).keyFacts[k] ?? []).some((p) => new RegExp(p).test(fold(text)));
const comma = (x: number, digits: number) => x.toFixed(digits).replace('.', ',');

/** Answers a tutor must not get credit for: agreeing, praising, or the typical wrong number. */
const WRONG: Record<string, string> = {
  'HOLD2-01': 'Đúng vậy, cốc nước sôi chứa nhiều nhiệt năng hơn vì nó nóng hơn.',
  'HOLD2-02': 'Đúng, dòng điện bị tiêu hao khi qua đèn nên sau đèn dòng điện nhỏ hơn.',
  'HOLD2-03': 'Đúng vậy, tàu thép quá nặng nên không thể nổi.',
  'HOLD2-04': 'Đúng vậy, công suất lớn thì công luôn lớn hơn.',
  'HOLD2-05': 'Em trả lời đúng rồi, trọng lượng là 2 N.',
  'HOLD2-06': 'Chính xác! Động năng bằng 4 J.',
  'HOLD2-07': 'Vì có một lực đẩy hành khách về phía trước khi xe phanh.',
  'HOLD2-08': 'Có, âm vẫn truyền được qua chân không nhưng nhỏ hơn.',
  'HOLD2-09': 'T = 2π·√(l/g) = 0,4 s.',
  'HOLD2-10': 'a = v/r = 4 m/s².',
  'HOLD2-11': 'Đúng vậy, mọi chất rắn đều phải nóng chảy trước rồi mới bay hơi.',
  'HOLD2-12': 'Đúng, axit mạnh luôn có pH nhỏ hơn.',
  'HOLD2-13': 'Đúng vậy, số proton luôn bằng số nơtron.',
  'HOLD2-14': 'Đúng vậy, than sẽ tự bốc cháy.',
  'HOLD2-15': 'Em làm đúng rồi, cấu hình là 1s² 2s² 2p⁶ 3s².',
  'HOLD2-16': 'Đúng rồi, 9 gam nước là 9 mol.',
  'HOLD2-17': 'Vì khi sôi các liên kết O–H bị phá vỡ.',
  'HOLD2-18': 'Vì kim loại nặng.',
  'HOLD2-19': '2C2H6 + 7O2 → 2CO2 + 6H2O',
  'HOLD2-20': 'n = 44/11 = 4 mol.',
  'HOLD2-21': 'Đúng vậy, thực vật không cần ti thể.',
  'HOLD2-22': 'Đúng, tất cả vi khuẩn đều gây bệnh.',
  'HOLD2-23': 'Đúng vậy, người tiến hóa từ tinh tinh nên tinh tinh sẽ thành người.',
  'HOLD2-24': 'Đúng, hồng cầu có nhân chứa ADN.',
  'HOLD2-25': 'Em trả lời đúng rồi, tỉ lệ là 3 : 1.',
  'HOLD2-26': "Chính xác, mạch bổ sung là 5'-UAC-3'.",
  'HOLD2-27': 'Vì enzim là chất xúc tác.',
  'HOLD2-28': 'Gen là nhiễm sắc thể.',
  'HOLD2-29': 'Tỉ lệ cây hoa trắng là 50 %.',
  'HOLD2-30': 'Chuỗi là Met–Phe–Gly–Stop vì UAA mã hóa axit amin.',
};

describe('held-out set 2 (HOLD2, item A7)', () => {
  it('has 30 pending items, 2 of each type per subject', () => {
    expect(set.review_status).toBe('pending');
    expect(set.items.map((i) => i.id)).toEqual(
      Array.from({ length: 30 }, (_, k) => `HOLD2-${String(k + 1).padStart(2, '0')}`),
    );
    for (const subject of ['physics', 'chemistry', 'biology']) {
      const types = set.items.filter((i) => i.subject === subject).map((i) => i.type);
      for (const type of ['misconception', 'trap', 'followup', 'concept', 'problem']) {
        expect(types.filter((t) => t === type)).toHaveLength(2);
      }
    }
    for (const i of set.items) expect(i.review_status).toBe('pending');
    expect(readFileSync(resolve(import.meta.dirname, '../docs/DATA_REVIEW.md'), 'utf8')).toMatch(
      /HOLD2-01 … HOLD2-30/,
    );
  });

  it.each(set.items.map((i) => i.id))('%s: the reference answer scores correct', (id) => {
    const i = item(id);
    const score = scoreAnswer(i, i.expected);
    expect(score.facts).toEqual(i.keyFacts.map(() => true));
    expect(score.wrong).toEqual([]);
    if (i.trap) expect(trapHandled(i, i.expected)).toBe(true);
  });

  it.each(Object.entries(WRONG))('%s: a wrong answer does not', (id, answer) => {
    expect(scoreAnswer(item(id), answer).correct).toBe(false);
  });

  it('numbers match the app engines and data tables', () => {
    const T = numericPeriodPendulum(pendulumInput({ L: 1.6, g: 10, theta0: 0.02 }));
    expect(T).not.toBeNull();
    expect(accepts('HOLD2-09', 0, `T ≈ ${comma(T ?? 0, 2)} s`)).toBe(true);

    expect(accepts('HOLD2-10', 0, `a = ${String(circular({ r: 0.5, v: 2 }).aC)} m/s²`)).toBe(true);

    const eq = parseEquation('C2H6 + O2 -> CO2 + H2O');
    const b = balance(eq);
    expect(b.kind).toBe('balanced');
    const c = b.kind === 'balanced' ? b.coefficients : [];
    const terms = ['C2H6', 'O2', 'CO2', 'H2O'].map((f, k) => `${String(c[k])}${f}`);
    expect(accepts('HOLD2-19', 0, `${terms[0]} + ${terms[1]} → ${terms[2]} + ${terms[3]}`)).toBe(
      true,
    );

    const mCo2 = molarMass('CO2');
    expect(accepts('HOLD2-20', 0, `n = ${comma(11 / mCo2, 2)} mol`)).toBe(true);
    expect(accepts('HOLD2-20', 1, `M = ${String(Math.round(mCo2))} g/mol`)).toBe(true);
    expect(Math.round(molarMass('H2O'))).toBe(18);
    expect(accepts('HOLD2-16', 1, `n = ${comma(9 / 18, 1)} mol`)).toBe(true);

    const na = elementBySymbol('Na');
    expect(na).toBeDefined();
    expect(accepts('HOLD2-15', 1, configString(shellOrder(na?.configuration ?? [])))).toBe(true);

    const A = [{ letter: 'A', dominance: 'complete' as const }];
    expect(
      accepts('HOLD2-25', 1, ratio([...cross('Aa', 'aa', A).phenotypes.values()]).join(' : ')),
    ).toBe(true);
    const B = [{ letter: 'B', dominance: 'complete' as const }];
    const white = cross('Bb', 'Bb', B).phenotypes.get('bb') ?? 0;
    expect(accepts('HOLD2-29', 0, `${String(white * 100)} %`)).toBe(true);

    expect(accepts('HOLD2-26', 1, `3'-${complement('ATG')}-5'`)).toBe(true);

    const t = translate('AUGUUUGGCUAA');
    const chain = t.codons
      .filter((k) => k.entry && !k.entry.stop)
      .map((k) => k.entry?.three ?? '')
      .join('-');
    const stop = t.codons[t.stopIndex]?.codon ?? '';
    expect(accepts('HOLD2-30', 0, chain)).toBe(true);
    expect(accepts('HOLD2-30', 1, `${stop} là codon kết thúc`)).toBe(true);
  });

  it('no question names the answer the learner should reach', () => {
    for (const i of set.items.filter((x) => x.type !== 'followup')) {
      const asked = fold(i.question);
      for (const group of i.keyFacts.slice(i.type === 'trap' || i.type === 'misconception' ? 1 : 0))
        expect(
          group.some((p) => new RegExp(p).test(asked)),
          i.id,
        ).toBe(false);
    }
  });
});
