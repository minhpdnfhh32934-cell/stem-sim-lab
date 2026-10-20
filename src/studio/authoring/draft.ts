import { z } from 'zod';
import type { LocalizedText, Source } from '@/core/data/dataset';
import {
  SCENARIO_SCHEMA_VERSION,
  type ScenarioBinding,
  type StudioScenario,
  type StudioSubject,
} from '../scenario';
import type { AuthorIssue } from './check';
import { templateFor } from './choices';

/**
 * Form model of the authoring studio. Teacher text is edited as plain strings (lists one item
 * per line); everything the studios run on stays in `binding`/`initial`, edited only through
 * the engine-derived choices in `bindingDraft.ts`.
 */
export interface TextPair {
  vi: string;
  /** Optional: an empty English line falls back to the Vietnamese one. */
  en: string;
}

export const LIST_FIELDS = ['objectives', 'hints', 'questions', 'assumptions', 'limits'] as const;
export type ListField = (typeof LIST_FIELDS)[number];

export interface AuthorDraft {
  /** Id of the stored scenario being edited, or null for a new one. */
  id: string | null;
  /** Fields the form does not edit (topic, tools, models, steps, completion flags). */
  base: StudioScenario;
  title: TextPair;
  objectives: TextPair;
  hints: TextPair;
  questions: TextPair;
  assumptions: TextPair;
  limits: TextPair;
  expectedConclusion: TextPair;
  /** The POE question of a chemistry or biology binding. */
  question: TextPair;
  /** One source per line: "citation | https://…" (the link is optional). */
  sources: string;
  level: StudioScenario['level'];
  difficulty: StudioScenario['difficulty'];
  explanationMinChars: number;
  initial: Record<string, number>;
  binding: ScenarioBinding;
}

export const MAX_MIN_CHARS = 2000;

const pair = (t: LocalizedText | undefined): TextPair => ({ vi: t?.vi ?? '', en: t?.en ?? '' });

function listPair(list: readonly LocalizedText[]): TextPair {
  return { vi: list.map((x) => x.vi).join('\n'), en: list.map((x) => x.en).join('\n') };
}

function lines(text: string): string[] {
  return text.split('\n').map((l) => l.trim());
}

/** Items of a list field; line i of the English text belongs to line i of the Vietnamese one. */
export function listItems(p: TextPair): LocalizedText[] {
  const vi = lines(p.vi);
  const en = lines(p.en);
  const out: LocalizedText[] = [];
  vi.forEach((v, i) => {
    if (v) out.push({ vi: v, en: en[i] || v });
  });
  return out;
}

export function textOf(p: TextPair): LocalizedText {
  const vi = p.vi.trim();
  return { vi, en: p.en.trim() || vi };
}

function sourceLine(s: Source): string {
  return s.url ? `${s.citation} | ${s.url}` : s.citation;
}

export type ParsedSources = { sources: Source[]; badLines: number[] };

/** Parses the sources field; ids of unchanged sources are kept, new ones get `teacher-n`. */
export function parseSources(text: string, previous: readonly Source[] = []): ParsedSources {
  const sources: Source[] = [];
  const badLines: number[] = [];
  const taken = new Set<string>();
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split(/\s+/);
    const last = parts[parts.length - 1] ?? '';
    let citation = line;
    let url: string | undefined;
    if (/^https?:\/\//i.test(last)) {
      if (!z.url().safeParse(last).success) {
        badLines.push(i + 1);
        return;
      }
      url = last;
      citation = line.slice(0, line.length - last.length).replace(/[\s|—–:-]+$/, '') || last;
    }
    const same = previous.find((p) => p.citation === citation && p.url === url && !taken.has(p.id));
    let id = same?.id;
    for (let n = sources.length + 1; !id || taken.has(id); n++) id = `teacher-${String(n)}`;
    taken.add(id);
    sources.push(url ? { id, citation, url } : { id, citation });
  });
  return { sources, badLines };
}

/** A draft of a stored (or built-in) scenario, for editing or duplicating. */
export function toDraft(s: StudioScenario, id: string | null): AuthorDraft {
  const b = s.binding;
  return {
    id,
    base: s,
    title: pair(s.title),
    objectives: listPair(s.objectives),
    hints: listPair(s.hints),
    questions: listPair(s.questions),
    assumptions: listPair(s.assumptions),
    limits: listPair(s.limits),
    expectedConclusion: pair(s.expectedConclusion),
    question: pair(b.kind === 'physics' ? undefined : b.question),
    sources: s.sources.map(sourceLine).join('\n'),
    level: s.level,
    difficulty: s.difficulty,
    explanationMinChars: s.completion.explanationMinChars,
    initial: { ...s.initial },
    binding: structuredClone(b),
  };
}

/** A new draft for `subject`: the built-in template's engine binding, no teacher text. */
export function newDraft(subject: StudioSubject): AuthorDraft | null {
  const template = templateFor(subject);
  if (!template) return null;
  const empty: TextPair = { vi: '', en: '' };
  return {
    ...toDraft(template, null),
    title: empty,
    objectives: empty,
    hints: empty,
    questions: empty,
    assumptions: empty,
    limits: empty,
    expectedConclusion: empty,
    question: empty,
    sources: '',
  };
}

/** The scenario the draft describes, with `id`. Always teacher content, never reviewed yet. */
export function fromDraft(d: AuthorDraft, id: string): StudioScenario {
  const b = d.binding;
  const binding: ScenarioBinding =
    b.kind === 'physics'
      ? structuredClone(b)
      : { ...structuredClone(b), question: textOf(d.question) };
  return {
    ...d.base,
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id,
    title: textOf(d.title),
    objectives: listItems(d.objectives),
    level: d.level,
    difficulty: d.difficulty,
    initial: { ...d.initial },
    hints: listItems(d.hints),
    questions: listItems(d.questions),
    completion: { ...d.base.completion, explanationMinChars: d.explanationMinChars },
    expectedConclusion: textOf(d.expectedConclusion),
    sources: parseSources(d.sources, d.base.sources).sources,
    assumptions: listItems(d.assumptions),
    limits: listItems(d.limits),
    review_status: 'pending',
    author: 'teacher',
    binding,
  };
}

/** Problems a teacher can fix in the form (the engine check runs on the built scenario). */
export function draftIssues(d: AuthorDraft): AuthorIssue[] {
  const out: AuthorIssue[] = [];
  if (!d.title.vi.trim()) out.push({ code: 'titleRequired' });
  if (listItems(d.objectives).length === 0) out.push({ code: 'objectiveRequired' });
  if (!d.expectedConclusion.vi.trim()) out.push({ code: 'conclusionRequired' });
  if (d.binding.kind !== 'physics' && !d.question.vi.trim()) out.push({ code: 'questionRequired' });
  for (const field of LIST_FIELDS) {
    const p = d[field];
    const viCount = lines(p.vi).filter(Boolean).length;
    const enCount = lines(p.en).filter(Boolean).length;
    if (enCount > viCount) out.push({ code: 'enLines', params: { field } });
  }
  const n = d.explanationMinChars;
  if (!Number.isInteger(n) || n < 0 || n > MAX_MIN_CHARS) {
    out.push({ code: 'minChars', params: { max: MAX_MIN_CHARS } });
  }
  for (const line of parseSources(d.sources).badLines) {
    out.push({ code: 'sourceUrl', params: { line } });
  }
  const b = d.binding;
  if (b.kind === 'physics') {
    if (b.controls.length === 0) out.push({ code: 'controlsRequired' });
    for (const [key, v] of Object.entries(d.initial)) {
      if (!Number.isFinite(v)) out.push({ code: 'initialNumber', params: { param: key } });
    }
  } else if (b.kind === 'chemistry') {
    if (b.inventory.length < 2 || b.inventory.length > 8) out.push({ code: 'inventorySize' });
    if (b.target[0] === b.target[1] || b.target.some((f) => !b.inventory.includes(f))) {
      out.push({ code: 'targetInInventory' });
    }
  } else if (b.parts.length < 2 || b.parts.length > 8) {
    out.push({ code: 'partsSize' });
  }
  return out;
}
