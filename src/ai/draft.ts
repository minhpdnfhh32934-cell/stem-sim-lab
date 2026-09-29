import type { LocalizedText } from '@/core/data/dataset';
import { toSI, unitLabel } from '@/core/units';
import { applyAutoDefaults } from '@/physics/autoDefaults';
import type { ParamSource, Params, PhysicsScene } from '@/physics/types';
import { mentions, quoteInText } from './numbers';
import { allowedUnits, type Extraction } from './spec';

export type IssueKind =
  | 'notInText'
  | 'quoteMismatch'
  | 'badUnit'
  | 'unknownKey'
  | 'outOfRange'
  | 'duplicate'
  | 'badChoice'
  | 'invalidScene';

export interface Issue {
  kind: IssueKind;
  key?: string;
  message: LocalizedText;
  /** Blocking issues drop the value; warnings keep it but flag it. */
  blocking: boolean;
}

/** What the user reviews in "Tôi hiểu đề như sau" before anything is simulated. */
export interface Draft {
  topic: string;
  problemText: string;
  params: Params;
  sources: Record<string, ParamSource>;
  /** Value as written in the problem, with its unit, for display. */
  written: Record<string, { value: number; unit: string; quote: string }>;
  questions: string[];
  assumptions: string[];
  unsupported: string[];
  clarifications: string[];
  /** Required parameters the problem did not state — the user must fill them in. */
  missing: string[];
  issues: Issue[];
}

const L = (vi: string, en: string): LocalizedText => ({ vi, en });

/**
 * Values that Vietnamese problems state in words rather than digits. The AI may return
 * them only together with a quote containing one of these phrases (checked against the
 * problem text), so no number is ever invented.
 */
const IMPLIED: { keys: RegExp; value: number; phrases: string[] }[] = [
  {
    // initial velocities
    keys: /^(v0|vA|vB|v1|v2|v0x|omega0)$/,
    value: 0,
    phrases: [
      'nghỉ',
      'đứng yên',
      'không vận tốc đầu',
      'không vận tốc ban đầu',
      'không có vận tốc đầu',
      'thả rơi',
      'thả nhẹ',
      'buông nhẹ',
      'thả tay',
      'bắt đầu chuyển động',
      'từ trạng thái nghỉ',
      'rồi thả',
    ],
  },
  {
    keys: /^(mu|muS|muK|c|b)$/,
    value: 0,
    phrases: ['không ma sát', 'bỏ qua ma sát', 'nhẵn', 'bỏ qua lực cản', 'không lực cản'],
  },
  {
    keys: /^(h0|xA|x0|s0)$/,
    value: 0,
    phrases: ['mặt đất', 'gốc tọa độ', 'chân dốc', 'từ a', 'tại a'],
  },
  { keys: /^e$/, value: 1, phrases: ['đàn hồi'] },
  { keys: /^e$/, value: 0, phrases: ['va chạm mềm', 'dính vào nhau', 'dính nhau', 'dính liền'] },
  { keys: /^angle$/, value: 0, phrases: ['ném ngang', 'phương ngang', 'nằm ngang'] },
  { keys: /^beta$/, value: 0, phrases: ['phương ngang', 'nằm ngang', 'song song', 'dọc theo'] },
];

/** True when `value` for `key` is stated in words by a phrase inside a genuine quote. */
export function impliedByWords(key: string, value: number, quote: string, text: string): boolean {
  if (!quote || !quoteInText(text, quote)) return false;
  const q = quote.toLowerCase();
  return IMPLIED.some(
    (rule) =>
      rule.keys.test(key) && rule.value === value && rule.phrases.some((ph) => q.includes(ph)),
  );
}

/**
 * Validates an AI extraction against the problem text and the scene, and fills
 * defaults in code (never in the AI): §2.1 of MASTER_PROMPT.
 */
export function buildDraft(
  scene: PhysicsScene,
  extraction: Extraction,
  problemText: string,
  defaultGravity: number,
): Draft {
  const params: Params = { ...scene.defaults };
  const sources: Record<string, ParamSource> = {};
  for (const k of Object.keys(params)) sources[k] = 'default';
  if (scene.usesGravity) {
    params.g = defaultGravity;
    sources.g = 'default';
  }
  const written: Draft['written'] = {};
  const issues: Issue[] = [];
  const seen = new Set<string>();

  for (const q of extraction.quantities) {
    const def = scene.params.find((d) => d.key === q.key);
    const name = def ? def.label : L(q.key, q.key);
    if (!def) {
      issues.push({
        kind: 'unknownKey',
        key: q.key,
        blocking: true,
        message: L(
          `Đại lượng "${q.key}" không thuộc chủ đề này.`,
          `"${q.key}" is not a parameter of this topic.`,
        ),
      });
      continue;
    }
    if (seen.has(q.key)) {
      issues.push({
        kind: 'duplicate',
        key: q.key,
        blocking: true,
        message: L(
          `${name.vi}: AI trả về hai giá trị, giữ giá trị đầu.`,
          `${name.en}: two values returned, kept the first.`,
        ),
      });
      continue;
    }
    if (!Number.isFinite(q.value)) continue;
    if (def.kind !== 'number') {
      const ok =
        def.kind === 'toggle'
          ? q.value === 0 || q.value === 1
          : (def.choices ?? []).some((c) => c.value === q.value);
      if (!ok) {
        issues.push({
          kind: 'badChoice',
          key: q.key,
          blocking: true,
          message: L(`${name.vi}: lựa chọn không hợp lệ.`, `${name.en}: invalid choice.`),
        });
        continue;
      }
      seen.add(q.key);
      params[q.key] = q.value;
      sources[q.key] = 'problem';
      written[q.key] = { value: q.value, unit: '1', quote: q.quote };
      continue;
    }
    if (!allowedUnits(scene, q.key).includes(q.unit)) {
      issues.push({
        kind: 'badUnit',
        key: q.key,
        blocking: true,
        message: L(
          `${name.vi}: đơn vị "${q.unit}" không phù hợp.`,
          `${name.en}: unit "${q.unit}" does not fit.`,
        ),
      });
      continue;
    }
    // §2.1: the number must literally appear in the problem, or be stated in words
    // ("thả nhẹ" → v₀ = 0) with a verifiable quote.
    const inWords = impliedByWords(q.key, q.value, q.quote, problemText);
    if (!inWords && !mentions(problemText, q.value)) {
      issues.push({
        kind: 'notInText',
        key: q.key,
        blocking: true,
        message: L(
          `${name.vi}: giá trị ${q.value} ${unitLabel(q.unit)} không có trong đề — đã bỏ qua (AI không được tự đưa số).`,
          `${name.en}: ${q.value} ${unitLabel(q.unit)} is not in the problem — ignored (the AI may not invent numbers).`,
        ),
      });
      continue;
    }
    if (q.quote && !quoteInText(problemText, q.quote)) {
      issues.push({
        kind: 'quoteMismatch',
        key: q.key,
        blocking: false,
        message: L(
          `${name.vi}: trích dẫn của AI không khớp nguyên văn đề, hãy kiểm tra lại.`,
          `${name.en}: the AI's quote does not match the text; please check.`,
        ),
      });
    }
    const si = toSI(q.value, q.unit);
    const lo = def.min !== undefined && def.unit ? toSI(def.min, def.unit) : -Infinity;
    const hi = def.max !== undefined && def.unit ? toSI(def.max, def.unit) : Infinity;
    if (si < Math.min(lo, hi) - 1e-12 || si > Math.max(lo, hi) + 1e-12) {
      issues.push({
        kind: 'outOfRange',
        key: q.key,
        blocking: false,
        message: L(
          `${name.vi}: giá trị nằm ngoài phạm vi mô phỏng hỗ trợ.`,
          `${name.en}: value outside the supported range.`,
        ),
      });
    }
    seen.add(q.key);
    params[q.key] = si;
    sources[q.key] = 'problem';
    written[q.key] = { value: q.value, unit: q.unit, quote: q.quote };
  }

  // Code-side defaults derived from the stated values (never from the AI).
  Object.assign(params, applyAutoDefaults(scene, params, sources));

  const missing = scene.required.filter((k) => {
    const def = scene.params.find((d) => d.key === k);
    if (def?.when && !def.when(params)) return false;
    return sources[k] !== 'problem';
  });

  for (const m of scene.validate?.(params) ?? []) {
    issues.push({ kind: 'invalidScene', blocking: false, message: m });
  }

  return {
    topic: scene.id,
    problemText,
    params,
    sources,
    written,
    questions: extraction.questions,
    assumptions: extraction.assumptions,
    unsupported: extraction.unsupported_parts,
    clarifications: extraction.clarifications,
    missing,
    issues,
  };
}

/**
 * Manual mode ("Tự dựng cảnh"): a draft from the scene's defaults, nothing from AI.
 * There is no problem text, so nothing is "missing": every value is visibly a default
 * until the user changes it.
 */
export function manualDraft(scene: PhysicsScene, defaultGravity: number): Draft {
  const draft = buildDraft(
    scene,
    { quantities: [], questions: [], assumptions: [], unsupported_parts: [], clarifications: [] },
    '',
    defaultGravity,
  );
  return { ...draft, missing: [] };
}
