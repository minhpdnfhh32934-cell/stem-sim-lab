/**
 * The teacher's pronunciation dictionary (`pronunciations.json`): how the voice says a name or a
 * loanword ("Hertz" → "Héc"). It is applied before the rule-based reader (`vietnameseText.ts`),
 * so an entry always wins, and only to words in prose: never inside a formula (`$…$`, code), never
 * next to an operator or an arrow ("AB = 5", "glucose → pyruvat"), so a formula keeps its
 * meaning. A reading is words only: the dictionary can never add, remove or change a number.
 */
import { z } from 'zod';
import { ReviewStatusSchema } from '@/core/data/dataset';
import raw from './pronunciations.json';

export const PRONUNCIATION_SUBJECTS = ['physics', 'chemistry', 'biology', 'general'] as const;

const EntrySchema = z.object({
  /** Two characters at least: a single letter is a symbol in formulas ("m", "F"). */
  term: z
    .string()
    .min(2)
    .regex(/^[\p{L}][\p{L}' -]*[\p{L}]$/u, 'a term is letters only (no digit, no symbol)'),
  reading: z
    .string()
    .min(1)
    .regex(/^[\p{L}][\p{L}' -]*$/u, 'a reading is words only (no digit, no symbol)'),
  subject: z.enum(PRONUNCIATION_SUBJECTS),
  review_status: ReviewStatusSchema,
  note: z.string().optional(),
});

export type PronunciationEntry = z.infer<typeof EntrySchema>;

const FileSchema = z.object({
  version: z.number().int().positive(),
  about: z.string(),
  entries: z.array(EntrySchema).min(1),
});

/** Parses a dictionary file; a broken file is a bug and throws with a readable message. */
export function parsePronunciations(data: unknown): PronunciationEntry[] {
  const result = FileSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid pronunciations.json: ${z.prettifyError(result.error)}`);
  }
  const seen = new Set<string>();
  for (const e of result.data.entries) {
    if (seen.has(e.term)) throw new Error(`Invalid pronunciations.json: "${e.term}" twice`);
    seen.add(e.term);
  }
  return result.data.entries;
}

export const PRONUNCIATIONS: readonly PronunciationEntry[] = parsePronunciations(raw);

/** Formulas, LaTeX and code: the dictionary never looks inside them. */
const PROTECTED =
  /```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g;

/** A term next to one of these is a symbol in a formula or an equation: it is left alone. */
const OPERATORS = new Set('=+−×·*/^_<>≈≠≤≥→⟶⇌↑↓'.split(''));

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Matcher {
  re: RegExp;
  readings: Map<string, string>;
}

const matchers = new WeakMap<readonly PronunciationEntry[], Matcher>();

/** One regular expression for the whole dictionary, longest terms first. */
function matcherFor(entries: readonly PronunciationEntry[]): Matcher {
  const known = matchers.get(entries);
  if (known) return known;
  const readings = new Map<string, string>();
  for (const e of entries) {
    readings.set(e.term, e.reading);
    // A lower-case loanword also opens a sentence: "Enzyme là…" → "En-zim là…".
    const first = e.term[0] ?? '';
    if (first !== first.toUpperCase()) {
      const upper = first.toUpperCase() + e.term.slice(1);
      if (!readings.has(upper)) {
        readings.set(upper, (e.reading[0] ?? '').toUpperCase() + e.reading.slice(1));
      }
    }
  }
  const terms = [...readings.keys()].sort((a, b) => b.length - a.length);
  const body = terms.map((t) => escape(t).replace(/ /g, String.raw`\s+`)).join('|');
  const re = new RegExp(String.raw`(?<![\p{L}\d_\\])(?:${body})(?![\p{L}\d_])`, 'gu');
  const matcher = { re, readings };
  matchers.set(entries, matcher);
  return matcher;
}

export interface AppliedPronunciations {
  text: string;
  /** The readings put into the text, in order (the speech plan keeps each one whole). */
  readings: string[];
}

/** Replaces the dictionary's terms in prose; formulas, code and equations are left as written. */
export function applyPronunciations(
  text: string,
  entries: readonly PronunciationEntry[] = PRONUNCIATIONS,
): AppliedPronunciations {
  const readings: string[] = [];
  if (entries.length === 0) return { text, readings };
  const { re, readings: table } = matcherFor(entries);
  const prose = (part: string) =>
    part.replace(re, (term: string, offset: number) => {
      const before = part.slice(0, offset).trimEnd().at(-1) ?? '';
      const after = part.slice(offset + term.length).trimStart()[0] ?? '';
      if (OPERATORS.has(before) || OPERATORS.has(after)) return term;
      const reading = table.get(term.replace(/\s+/g, ' '));
      if (!reading) return term;
      readings.push(reading);
      return reading;
    });
  let out = '';
  let last = 0;
  for (const m of text.matchAll(PROTECTED)) {
    out += prose(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  out += prose(text.slice(last));
  return { text: out, readings };
}
