import { translate, type Locale, type MessageKey, type MessageParams } from '@/app/i18n';
import type { LocalizedText } from '@/core/data/dataset';
import type { StudioScenario } from '../scenario';
import {
  ACTIVITY_KEY,
  withActions,
  withEngine,
  type ActionRecord,
  type EngineEvidence,
  type EngineFact,
  type Prediction,
  type StudioSession,
  type Verdict,
} from '../session';
import type { GuidedActivity, GuidedBinding } from './schema';

/**
 * Pure checking of a guided lesson: the learner's answer sheet lives in the session's action log
 * (one `answer` per row, "activity:row=value"), and the key is the lesson data itself. Nothing here
 * computes or invents a value: a check only says, row by row, whether the answer is the lesson's.
 */
export const GUIDED_MODEL = 'guided';
export const ANSWER_OP = 'answer';

export function guidedOf(s: StudioScenario): GuidedBinding | null {
  return s.binding.kind === 'guided' ? s.binding : null;
}

/** Row id → value: an order's position ("0", "1"…), a match's chosen pair id, a sort's group id. */
export type Answers = Record<string, string>;
/** Activity id → its answers. */
export type Sheet = Record<string, Answers>;

/* ---------------- Fixed shuffles ---------------- */

/** FNV-1a: a stable number from a text (the same on every build and machine). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fixed shuffle of `ids` (seeded by `seed`) that is never their own order when n ≥ 2. */
export function shuffled(ids: readonly string[], seed: string): string[] {
  const out = [...ids];
  const next = random(hash(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as string, out[i] as string];
  }
  // The shuffle landed on the answer: turn it by one place (still fixed, never the answer).
  if (out.length > 1 && out.every((id, i) => id === ids[i])) out.push(out.shift() as string);
  return out;
}

/** Where an order activity starts: its items, shuffled. */
export function startOrder(scenarioId: string, a: Extract<GuidedActivity, { kind: 'order' }>) {
  return shuffled(
    a.items.map((i) => i.id),
    `${scenarioId}/${a.id}`,
  );
}

/** The order a match activity lists its right-hand texts in (pair ids). */
export function optionOrder(scenarioId: string, a: Extract<GuidedActivity, { kind: 'match' }>) {
  return shuffled(
    a.pairs.map((p) => p.id),
    `${scenarioId}/${a.id}/options`,
  );
}

/** An order activity's answers from its item order (item id → position). */
export function orderAnswers(order: readonly string[]): Answers {
  return Object.fromEntries(order.map((id, i) => [id, String(i)]));
}

/** An order activity's item order from its answers (positions as stored). */
export function orderOf(answers: Answers): string[] {
  return Object.keys(answers).sort((x, y) => Number(answers[x]) - Number(answers[y]));
}

/* ---------------- The answer sheet ---------------- */

function rowIds(a: GuidedActivity): string[] {
  return a.kind === 'match' ? a.pairs.map((p) => p.id) : a.items.map((i) => i.id);
}

/** Whether `value` may answer a row of `a` (any row: every row offers the same values). */
function allowed(a: GuidedActivity, value: string): boolean {
  if (a.kind === 'order') return /^\d+$/.test(value) && Number(value) < a.items.length;
  if (a.kind === 'match') return a.pairs.some((p) => p.id === value);
  return a.groups.some((g) => g.id === value);
}

/**
 * The sheet rebuilt from the stored log. Entries for unknown activities, rows or values are
 * ignored (storage and files are untrusted); an order that is not a whole permutation of its items
 * falls back to the start order, so an order activity always has an answer.
 */
export function readSheet(
  scenarioId: string,
  b: GuidedBinding,
  actions: readonly ActionRecord[],
): Sheet {
  const raw: Sheet = {};
  for (const act of actions) {
    if (act.op !== ANSWER_OP || act.arg === null) continue;
    const m = /^([a-z0-9-]+):([a-z0-9-]+)=([a-z0-9-]+)$/.exec(act.arg);
    if (!m) continue;
    const [, activityId = '', row = '', value = ''] = m;
    const a = b.activities.find((x) => x.id === activityId);
    if (!a || !rowIds(a).includes(row) || !allowed(a, value)) continue;
    (raw[activityId] ??= {})[row] = value;
  }
  const sheet: Sheet = {};
  for (const a of b.activities) {
    const answers = raw[a.id] ?? {};
    if (a.kind === 'order') {
      const positions = new Set(Object.values(answers));
      const whole = a.items.every((i) => i.id in answers) && positions.size === a.items.length;
      sheet[a.id] = whole ? answers : orderAnswers(startOrder(scenarioId, a));
    } else {
      sheet[a.id] = answers;
    }
  }
  return sheet;
}

/** The sheet as a log, one entry per answered row, in the lesson's own order. */
export function writeSheet(b: GuidedBinding, sheet: Sheet, now: number): ActionRecord[] {
  const out: ActionRecord[] = [];
  for (const a of b.activities) {
    const answers = sheet[a.id] ?? {};
    for (const row of rowIds(a)) {
      const value = answers[row];
      if (value !== undefined) out.push({ op: ANSWER_OP, arg: `${a.id}:${row}=${value}`, at: now });
    }
  }
  return out;
}

/* ---------------- Scoring ---------------- */

export interface RowResult {
  id: string;
  /** The learner's value (null: not answered yet). */
  chosen: string | null;
  /** The lesson's value for this row. */
  expected: string;
  correct: boolean;
}

export interface ActivityScore {
  rows: RowResult[];
  correct: number;
  total: number;
  /** Every row has an answer (the check can run). */
  complete: boolean;
}

/** Each row against the lesson: an order item by its exact position, a match or sort by its value. */
export function scoreActivity(a: GuidedActivity, answers: Answers): ActivityScore {
  const expected: [string, string][] =
    a.kind === 'order'
      ? a.items.map((item, i) => [item.id, String(i)])
      : a.kind === 'match'
        ? a.pairs.map((p) => [p.id, p.id])
        : a.items.map((item) => [item.id, item.group]);
  const rows = expected.map(([id, want]) => {
    const chosen = answers[id] ?? null;
    return { id, chosen, expected: want, correct: chosen === want };
  });
  return {
    rows,
    correct: rows.filter((r) => r.correct).length,
    total: rows.length,
    complete: rows.every((r) => r.chosen !== null),
  };
}

export function sheetComplete(b: GuidedBinding, sheet: Sheet): boolean {
  return b.activities.every((a) => scoreActivity(a, sheet[a.id] ?? {}).complete);
}

/* ---------------- Texts of rows and values ---------------- */

function both(key: MessageKey, params?: MessageParams): LocalizedText {
  return { vi: translate('vi', key, params), en: translate('en', key, params) };
}

/** What a row shows on its left: the item's text, or a match pair's left-hand text. */
export function rowLabel(a: GuidedActivity, id: string): LocalizedText {
  if (a.kind === 'match') return a.pairs.find((p) => p.id === id)?.left ?? { vi: id, en: id };
  return a.items.find((i) => i.id === id)?.text ?? { vi: id, en: id };
}

export function rowWhy(a: GuidedActivity, id: string): LocalizedText | null {
  const row =
    a.kind === 'match' ? a.pairs.find((p) => p.id === id) : a.items.find((i) => i.id === id);
  return row?.why ?? null;
}

/** A value as the learner sees it: "vị trí 3", a right-hand text or a group's name. */
export function valueText(a: GuidedActivity, value: string): LocalizedText {
  if (a.kind === 'order') return both('studio.guided.position', { n: Number(value) + 1 });
  if (a.kind === 'match')
    return a.pairs.find((p) => p.id === value)?.right ?? { vi: value, en: value };
  return a.groups.find((g) => g.id === value)?.label ?? { vi: value, en: value };
}

/* ---------------- Session changes ---------------- */

const checkedOf = (s: StudioSession) =>
  s.evidence.some((e) => e.kind === 'engine' && e.key === ACTIVITY_KEY);

const BEYOND_INTERACT = new Set(['observe', 'explain', 'conclude', 'report']);

/**
 * Stores a new answer sheet (validated like stored data). A changed sheet makes the last check
 * stale: its record and the verdict are dropped, and a learner past the activities goes back to
 * them. The first answer after the prediction locks it (POE order).
 */
export function withSheet(
  scenario: StudioScenario,
  s: StudioSession,
  sheet: Sheet,
  now: number,
): StudioSession {
  const b = guidedOf(scenario);
  if (!b) return s;
  const clean = readSheet(scenario.id, b, writeSheet(b, sheet, now));
  const before = readSheet(scenario.id, b, s.actions);
  if (JSON.stringify(writeSheet(b, before, 0)) === JSON.stringify(writeSheet(b, clean, 0)))
    return s;
  // A sheet restored before any prediction (a file, undo) leaves the prediction open.
  const next = {
    ...withActions(s, writeSheet(b, clean, now), now),
    predictionLocked: s.predictionLocked || s.prediction !== null,
  };
  if (!checkedOf(next) && !next.verdict) return next;
  return {
    ...next,
    evidence: next.evidence.filter((e) => !(e.kind === 'engine' && e.key === ACTIVITY_KEY)),
    verdict: null,
    completedAt: null,
    step: BEYOND_INTERACT.has(next.step) ? 'interact' : next.step,
  };
}

/** The prediction against the lesson's answer. */
export function guidedVerdict(b: GuidedBinding, prediction: Prediction | null): Verdict {
  const choice = b.choices.find((c) => c.id === b.answer) ?? null;
  return {
    correct: b.answer,
    correctText: choice?.text ?? null,
    match: prediction ? prediction.choice === b.answer : null,
  };
}

function line(lang: Locale, a: GuidedActivity, r: RowResult): string {
  const why = rowWhy(a, r.id)?.[lang] ?? '';
  if (r.correct) return translate(lang, 'studio.guided.record.right', { why });
  return translate(lang, 'studio.guided.record.wrong', {
    chosen: r.chosen === null ? '—' : valueText(a, r.chosen)[lang],
    expected: valueText(a, r.expected)[lang],
    why,
  });
}

/**
 * The checked sheet as one engine record: facts only (the answer to the prediction, each row
 * right or wrong with its reason, each activity's score as text), never a quantity.
 */
export function checkRecord(
  scenario: StudioScenario,
  b: GuidedBinding,
  sheet: Sheet,
  now: number,
): EngineEvidence {
  const choice = b.choices.find((c) => c.id === b.answer);
  const facts: EngineFact[] = [
    {
      id: 'prediction',
      label: b.question,
      text: {
        vi: translate('vi', 'studio.guided.record.answer', {
          answer: choice?.text.vi ?? '',
          why: b.answerWhy.vi,
        }),
        en: translate('en', 'studio.guided.record.answer', {
          answer: choice?.text.en ?? '',
          why: b.answerWhy.en,
        }),
      },
    },
  ];
  for (const a of b.activities) {
    const score = scoreActivity(a, sheet[a.id] ?? {});
    facts.push({
      id: a.id,
      label: a.prompt,
      text: both('studio.guided.record.score', { correct: score.correct, total: score.total }),
    });
    for (const r of score.rows) {
      facts.push({
        id: `${a.id}:${r.id}`,
        label: rowLabel(a, r.id),
        text: { vi: line('vi', a, r), en: line('en', a, r) },
      });
    }
  }
  return {
    id: ACTIVITY_KEY,
    at: now,
    step: 'interact',
    kind: 'engine',
    key: ACTIVITY_KEY,
    model: GUIDED_MODEL,
    title: both('studio.guided.record.title'),
    conditions: [],
    quantities: [],
    facts,
    review_status: scenario.review_status,
  };
}

/** Checks a complete sheet against the lesson (an incomplete one is not checked). */
export function withGuidedCheck(
  scenario: StudioScenario,
  s: StudioSession,
  now: number,
): StudioSession {
  const b = guidedOf(scenario);
  if (!b) return s;
  const sheet = readSheet(scenario.id, b, s.actions);
  if (!sheetComplete(b, sheet)) return s;
  return withEngine(s, checkRecord(scenario, b, sheet, now), guidedVerdict(b, s.prediction));
}
