import { describe, expect, it } from 'vitest';
import { buildStudioContext } from '../aiContext';
import { buildReport } from '../report';
import { scenarioSteps, type StudioScenario } from '../scenario';
import {
  ACTIVITY_KEY,
  createSession,
  engineEvidence,
  goTo,
  withPrediction,
  type StudioSession,
} from '../session';
import {
  ANSWER_OP,
  checkRecord,
  guidedOf,
  orderAnswers,
  orderOf,
  readSheet,
  scoreActivity,
  sheetComplete,
  shuffled,
  startOrder,
  withGuidedCheck,
  withSheet,
  writeSheet,
  type Sheet,
} from './check';
import { guidedScenarios } from './lessons';
import { sh10b03Levels } from './lessons/sh10b03Levels';
import { sh10b20MicrobeDiversity } from './lessons/sh10b20MicrobeDiversity';

/** Bài 3: an order activity, a match activity, then a sort activity. */
const levels: StudioScenario = sh10b03Levels;
const lb = guidedOf(levels);
/** Bài 20: a sort activity, then a match activity. */
const microbes: StudioScenario = sh10b20MicrobeDiversity;
const mb = guidedOf(microbes);
if (!lb || !mb) throw new Error('fixtures');
const [order, match] = lb.activities;
const [sort] = mb.activities;
if (order?.kind !== 'order' || match?.kind !== 'match' || sort?.kind !== 'sort') {
  throw new Error('fixture activities');
}

/** The whole answer key of a guided binding as a sheet. */
function key(b: NonNullable<ReturnType<typeof guidedOf>>): Sheet {
  const sheet: Sheet = {};
  for (const a of b.activities) {
    sheet[a.id] =
      a.kind === 'order'
        ? orderAnswers(a.items.map((i) => i.id))
        : a.kind === 'match'
          ? Object.fromEntries(a.pairs.map((p) => [p.id, p.id]))
          : Object.fromEntries(a.items.map((i) => [i.id, i.group]));
  }
  return sheet;
}

const predicted = (choice: string) =>
  withPrediction(createSession(levels, 0), { choice, label: choice, at: 1 });

describe('fixed shuffles', () => {
  it('are permutations, the same every time, and never the answer order', () => {
    for (let n = 2; n <= 8; n++) {
      const ids = Array.from({ length: n }, (_, i) => `i${String(i)}`);
      for (let seed = 0; seed < 200; seed++) {
        const s = shuffled(ids, `seed-${String(seed)}`);
        expect([...s].sort()).toEqual([...ids].sort());
        expect(s).not.toEqual(ids);
        expect(shuffled(ids, `seed-${String(seed)}`)).toEqual(s);
      }
    }
    expect(shuffled(['only'], 'x')).toEqual(['only']);
  });
});

describe('the answer sheet in the action log', () => {
  it('starts with the order activities shuffled and the others empty', () => {
    const sheet = readSheet(levels.id, lb, []);
    expect(orderOf(sheet[order.id] ?? {})).toEqual(startOrder(levels.id, order));
    expect(sheet[match.id]).toEqual({});
    expect(sheetComplete(lb, sheet)).toBe(false);
  });

  it('round-trips through the log', () => {
    const sheet = key(lb);
    const back = readSheet(levels.id, lb, writeSheet(lb, sheet, 5));
    expect(back).toEqual(sheet);
    expect(sheetComplete(lb, back)).toBe(true);
    for (const a of writeSheet(lb, sheet, 5)) {
      expect(a.op).toBe(ANSWER_OP);
      expect(a.arg?.length).toBeLessThanOrEqual(80);
    }
  });

  it('ignores junk: other operations, unknown activities, rows and values, half orders', () => {
    const good = writeSheet(lb, key(lb), 1);
    const junk = [
      { op: 'other', arg: `${match.id}:${match.pairs[0]?.id ?? ''}=x`, at: 1 },
      { op: ANSWER_OP, arg: null, at: 1 },
      { op: ANSWER_OP, arg: 'nope:a=b', at: 1 },
      { op: ANSWER_OP, arg: `${match.id}:nope=${match.pairs[0]?.id ?? ''}`, at: 1 },
      { op: ANSWER_OP, arg: `${match.id}:${match.pairs[0]?.id ?? ''}=nope`, at: 1 },
      { op: ANSWER_OP, arg: `${order.id}:${order.items[0]?.id ?? ''}=99`, at: 1 },
      // Non-canonical positions would score as wrong although the order looks right.
      { op: ANSWER_OP, arg: `${order.id}:${order.items[0]?.id ?? ''}=00`, at: 1 },
      { op: ANSWER_OP, arg: `${order.id}:${order.items[2]?.id ?? ''}=02`, at: 1 },
      { op: ANSWER_OP, arg: 'not even close', at: 1 },
    ];
    expect(readSheet(levels.id, lb, [...good, ...junk])).toEqual(key(lb));
    // A whole order spelled with "02" is not a whole order: the start order is used.
    const spelled = good.map((a) =>
      a.arg === `${order.id}:${order.items[2]?.id ?? ''}=2`
        ? { ...a, arg: `${order.id}:${order.items[2]?.id ?? ''}=02` }
        : a,
    );
    expect(orderOf(readSheet(levels.id, lb, spelled)[order.id] ?? {})).toEqual(
      startOrder(levels.id, order),
    );
    // An order with one item missing is not a whole order: the start order is used.
    const half = good.filter((a) => a.arg !== `${order.id}:${order.items[0]?.id ?? ''}=0`);
    expect(orderOf(readSheet(levels.id, lb, half)[order.id] ?? {})).toEqual(
      startOrder(levels.id, order),
    );
    // Two items on one place is not an order either.
    const twice = [
      ...good,
      { op: ANSWER_OP, arg: `${order.id}:${order.items[1]?.id ?? ''}=0`, at: 2 },
    ];
    expect(orderOf(readSheet(levels.id, lb, twice)[order.id] ?? {})).toEqual(
      startOrder(levels.id, order),
    );
  });
});

describe('scoring', () => {
  it('order: each item by its exact place', () => {
    const ids = order.items.map((i) => i.id);
    expect(scoreActivity(order, orderAnswers(ids))).toMatchObject({ correct: 8, total: 8 });
    // Moving the first item to the end puts every item off by one place.
    const turned = [...ids.slice(1), ids[0] ?? ''];
    const s = scoreActivity(order, orderAnswers(turned));
    expect(s).toMatchObject({ correct: 0, total: 8, complete: true });
    // Swapping two neighbours costs exactly those two.
    const swapped = [ids[1] ?? '', ids[0] ?? '', ...ids.slice(2)];
    expect(scoreActivity(order, orderAnswers(swapped)).correct).toBe(6);
  });

  it('match and sort: each row by its value; an unanswered row is not complete', () => {
    const [p0, p1] = match.pairs;
    if (!p0 || !p1) throw new Error('pairs');
    const answers = { [p0.id]: p1.id, [p1.id]: p0.id };
    const m = scoreActivity(match, answers);
    expect(m).toMatchObject({ correct: 0, total: match.pairs.length, complete: false });
    expect(m.rows[0]).toEqual({ id: p0.id, chosen: p1.id, expected: p0.id, correct: false });
    const s = scoreActivity(sort, key(mb)[sort.id] ?? {});
    expect(s).toMatchObject({ correct: sort.items.length, complete: true });
  });
});

describe('checking a sheet', () => {
  it('an incomplete sheet is not checked', () => {
    const s = predicted('te-bao');
    expect(withGuidedCheck(levels, s, 9)).toBe(s);
  });

  it('writes one facts-only record and the verdict from the prediction', () => {
    const answered = withSheet(levels, predicted('mo'), key(lb), 2);
    const checked = withGuidedCheck(levels, answered, 3);
    const [rec, ...others] = engineEvidence(checked);
    expect(others).toEqual([]);
    expect(rec).toMatchObject({
      key: ACTIVITY_KEY,
      model: 'guided',
      conditions: [],
      quantities: [],
      review_status: 'pending',
    });
    // The prediction, one score per activity, one line per row.
    const rows = lb.activities.reduce(
      (n, a) => n + (a.kind === 'match' ? a.pairs.length : a.items.length),
      0,
    );
    expect(rec?.facts).toHaveLength(1 + lb.activities.length + rows);
    expect(rec?.facts?.find((f) => f.id === order.id)?.text.vi).toBe('Đúng 8/8');
    expect(rec?.facts?.find((f) => f.id === 'prediction')?.text.vi).toMatch(/^Đáp án: Tế bào\./);
    expect(checked.verdict).toMatchObject({ correct: 'te-bao', match: false });
    expect(
      withGuidedCheck(levels, withSheet(levels, predicted('te-bao'), key(lb), 2), 3).verdict,
    ).toMatchObject({ match: true });
  });

  it('a wrong row says what was chosen, what the lesson says, and why', () => {
    const sheet = key(lb);
    const [p0, p1] = match.pairs;
    if (!p0 || !p1) throw new Error('pairs');
    sheet[match.id] = { ...sheet[match.id], [p0.id]: p1.id };
    const rec = checkRecord(levels, lb, sheet, 1);
    const line = rec.facts?.find((f) => f.id === `${match.id}:${p0.id}`)?.text.vi ?? '';
    expect(line).toContain(`em chọn “${p1.right.vi}”`);
    expect(line).toContain(`đáp án là “${p0.right.vi}”`);
    expect(line).toContain(p0.why.vi);
  });

  it('changing an answer drops the check and the verdict, and goes back to the activities', () => {
    const checked = withGuidedCheck(levels, withSheet(levels, predicted('te-bao'), key(lb), 2), 3);
    const later = { ...checked, step: 'conclude' as const, completedAt: 4 };
    const sheet = key(lb);
    const ids = order.items.map((i) => i.id);
    sheet[order.id] = orderAnswers([ids[1] ?? '', ids[0] ?? '', ...ids.slice(2)]);
    const changed = withSheet(levels, later, sheet, 5);
    expect(engineEvidence(changed)).toEqual([]);
    expect(changed).toMatchObject({ verdict: null, completedAt: null, step: 'interact' });
    // The same sheet again changes nothing.
    expect(withSheet(levels, checked, key(lb), 6)).toBe(checked);
  });

  it('the first answer locks a made prediction; a sheet restored before one leaves it open', () => {
    const locked = withSheet(levels, predicted('te-bao'), key(lb), 2);
    expect(locked.predictionLocked).toBe(true);
    const restored = withSheet(levels, createSession(levels, 0), key(lb), 2);
    expect(restored.predictionLocked).toBe(false);
    expect(withPrediction(restored, { choice: 'mo', label: 'Mô', at: 3 }).prediction?.choice).toBe(
      'mo',
    );
  });

  it('leaving Predict with a choice locks it: the activities cannot be read, then the choice changed', () => {
    const opened = goTo(levels, predicted('mo'), 'interact');
    expect(opened).toMatchObject({ step: 'interact', predictionLocked: true });
    const back = goTo(levels, opened, 'predict');
    expect(back.step).toBe('predict');
    expect(withPrediction(back, { choice: 'te-bao', label: 'Tế bào', at: 9 })).toBe(back);
    // Staying on Predict, or being stopped there with no choice, locks nothing.
    expect(goTo(levels, predicted('mo'), 'predict').predictionLocked).toBe(false);
    const fresh = createSession(levels, 0);
    expect(goTo(levels, fresh, 'interact')).toBe(fresh);
  });
});

describe('wording', () => {
  /** A guided lesson at every point: before and after the prediction and the check, every step. */
  function sessionsOf(s: StudioScenario) {
    const b = guidedOf(s);
    if (!b) throw new Error(s.id);
    const fresh = createSession(s, 0);
    const predicted = withPrediction(fresh, { choice: b.answer, label: b.answer, at: 1 });
    const checked = withGuidedCheck(s, withSheet(s, predicted, key(b), 2), 3);
    const unchecked = withSheet(s, checked, {}, 4);
    const steps = scenarioSteps(s).flatMap((step) => [
      { ...fresh, step },
      { ...checked, step },
    ]);
    return { checked, all: [fresh, predicted, checked, unchecked, ...steps] };
  }

  /** Never a simulation, never the data library, never the internal model id 'guided'. */
  const WRONG = {
    vi: /mô phỏng|thư viện dữ liệu|guided/i,
    en: /simulat|data library|\(guided\)|model guided/i,
  } as const;

  it('no report of a guided lesson speaks of a simulation, at any point of the lesson', () => {
    for (const s of guidedScenarios()) {
      for (const session of sessionsOf(s).all) {
        for (const locale of ['vi', 'en'] as const) {
          const text = buildReport({ scenario: s, session, locale, generatedAt: 0 });
          expect(text, `${s.id} ${locale}`).not.toMatch(WRONG[locale]);
        }
      }
      const checked = buildReport({
        scenario: s,
        session: sessionsOf(s).checked,
        locale: 'vi',
        generatedAt: 0,
      });
      expect(checked).toContain('## Đáp án và kết quả kiểm tra các hoạt động');
      expect(checked).toContain('Đáp án và lí do chép từ nội dung bài học');
      expect(checked).toContain('“Đáp án và kết quả kiểm tra”, chép từ nội dung bài học');
    }
  });

  it('nor does what AI Teacher is told, and the step names are the lesson’s own', () => {
    // Every line built, before the budget trims any of them.
    const told = (s: StudioScenario, session: StudioSession, locale: 'vi' | 'en') =>
      Object.values(buildStudioContext(s, session, locale))
        .flat()
        .join('\n');
    for (const s of guidedScenarios()) {
      const { checked, all } = sessionsOf(s);
      for (const session of all) {
        for (const locale of ['vi', 'en'] as const) {
          expect(told(s, session, locale), s.id).not.toMatch(WRONG[locale]);
        }
      }
      expect(told(s, { ...checked, step: 'interact' }, 'vi')).toContain(
        'Học sinh đang ở bước 2/6: Hoạt động',
      );
      const observe = told(s, { ...checked, step: 'observe' }, 'vi');
      expect(observe).toContain('Học sinh đang ở bước 3/6: Xem đáp án');
      expect(observe).toContain('ĐÁP ÁN VÀ KẾT QUẢ KIỂM TRA');
      expect(observe).toContain('Dự đoán khớp với đáp án của bài học.');
      expect(told(s, createSession(s, 0), 'vi')).toContain('Chưa kiểm tra các hoạt động.');
    }
  });
});
