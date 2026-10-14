/**
 * What the teacher will say, prepared apart from any voice (pure, no audio): internal markup is
 * removed, the pronunciation dictionary and the Vietnamese reader turn the text into words, and
 * the words are cut into chunks a voice says in one breath, each with the pause planned after it
 * and the prosody of its role (docs/AI_TUTOR.md, "Teacher voice").
 *
 * The chunks are tuned for the on-device MMS voice (VITS): it reads no punctuation, so a pause
 * exists only between chunks, and it renders a whole chunk before any of it is heard, so the
 * first chunk is kept short. A chunk never ends inside a number with its unit, a formula or a
 * name, and the chunks are the prepared text in order, word for word.
 */
import { applyPronunciations, type PronunciationEntry } from './pronunciations';
import { toSpeech, type SpeechChunk } from './vietnameseText';

/** The part a sentence plays in a lesson (from the board, or guessed from its words). */
export type SpeechRole =
  'plain' | 'heading' | 'concept' | 'step' | 'result' | 'keyword' | 'note' | 'check' | 'feedback';

export const SPEECH_ROLES: readonly SpeechRole[] = [
  'plain',
  'heading',
  'concept',
  'step',
  'result',
  'keyword',
  'note',
  'check',
  'feedback',
];

export interface RoleProsody {
  /** Speaking rate (1 = the voice's own pace; below 1 is slower), on top of the learner's speed. */
  rate: number;
  /** VITS `noise_scale`: how much the voice varies (pitch, timbre); 0.667 is the model's own. */
  noiseScale: number;
  /** VITS `noise_scale_duration`: how much the length of sounds varies; 0.8 is the model's own. */
  noiseScaleDuration: number;
}

/**
 * Prosody by role (the table in docs/AI_TUTOR.md). Rates stay within ±10 % so the voice keeps its
 * character; the noise values stay inside the range where MMS still sounds clean (0.5–0.8,
 * 0.6–1.0, `vitsControls.ts`). New concepts, results and key terms are slower and steadier;
 * a question and feedback are a little slower and livelier; a side note is a little quicker.
 */
export const ROLE_PROSODY: Readonly<Record<SpeechRole, RoleProsody>> = {
  plain: { rate: 1, noiseScale: 0.667, noiseScaleDuration: 0.8 },
  step: { rate: 1, noiseScale: 0.667, noiseScaleDuration: 0.8 },
  note: { rate: 1.03, noiseScale: 0.667, noiseScaleDuration: 0.8 },
  heading: { rate: 0.94, noiseScale: 0.6, noiseScaleDuration: 0.75 },
  concept: { rate: 0.92, noiseScale: 0.6, noiseScaleDuration: 0.75 },
  result: { rate: 0.9, noiseScale: 0.6, noiseScaleDuration: 0.7 },
  keyword: { rate: 0.9, noiseScale: 0.6, noiseScaleDuration: 0.7 },
  check: { rate: 0.96, noiseScale: 0.7, noiseScaleDuration: 0.85 },
  feedback: { rate: 0.94, noiseScale: 0.72, noiseScaleDuration: 0.85 },
};

/** What ends a chunk; it decides the pause after it. */
export type Boundary =
  'phrase' | 'emphasis' | 'comma' | 'clause' | 'sentence' | 'paragraph' | 'end';

/**
 * Pause after a chunk, milliseconds: comma < semicolon/colon < sentence < paragraph or list item.
 * A long phrase cut without punctuation gets a breath; a key term a short pause before it. The
 * last chunk has none (the board adds its own between sentences).
 */
export const PAUSE_MS: Readonly<Record<Boundary, number>> = {
  phrase: 80,
  emphasis: 120,
  comma: 150,
  clause: 280,
  sentence: 400,
  paragraph: 560,
  end: 0,
};

/** Longest chunk (characters of words): about 20 syllables, 4–5 s of speech. */
export const MMS_CHUNK_MAX = 100;
/** The first chunk is heard only once it is rendered: a shorter one starts the voice sooner. */
export const MMS_FIRST_CHUNK_MAX = 64;
/** A piece between punctuation marks with fewer words joins its neighbour (MMS says a lone word oddly). */
export const MIN_CHUNK_WORDS = 2;
/** A cut between words (no punctuation there) leaves at least this many words on each side. */
export const MIN_CUT_WORDS = 3;
/** Long answers are cut at a sentence end here, so the teacher never reads forever. */
export const MAX_SPEECH_CHARS = 2400;

export interface PlannedChunk extends SpeechChunk {
  role: SpeechRole;
  /** What ends this chunk (`pauseMs` follows from it). */
  boundary: Boundary;
  /** The sentence of the plan this chunk belongs to (0-based). */
  sentence: number;
  rate: number;
  noiseScale: number;
  noiseScaleDuration: number;
}

export interface SpeechPlan {
  /** The whole text as the voice says it (the chunks are this text, in order). */
  text: string;
  chunks: PlannedChunk[];
}

export interface PrepareOptions {
  /** The sentence's role on the board; without it each sentence's role is guessed. */
  role?: SpeechRole;
  /** Key terms, as written (the board's keywords, the marked words): a short pause before them. */
  emphasis?: readonly string[];
  maxChunkChars?: number;
  firstChunkChars?: number;
  /** Tests give their own dictionary; the app uses pronunciations.json. */
  dictionary?: readonly PronunciationEntry[];
}

// ------------------------------------------------------------ markup

/**
 * Removes what is not meant to be heard: a model's hidden reasoning, reference blocks, comments,
 * tags (TeachScript, HTML; a ">" inside a quoted attribute does not end the tag), horizontal
 * rules and emoji. Markdown itself is read by `toSpeech`.
 */
export function stripInternalMarkup(text: string): string {
  return (
    text
      .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
      .replace(/<reference\b[\s\S]*?<\/reference>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(
        /<\/?[a-zA-Z][\w-]*(?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*\s*\/?>/g,
        ' ',
      )
      .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, '')
      // Emoji shown as emoji only: "↔", "↗", "✔" or "™" without the emoji selector are symbols.
      .replace(/\p{Emoji_Presentation}\u{fe0f}?|\p{Extended_Pictographic}\u{fe0f}/gu, '')
  );
}

// ------------------------------------------------------------ roles

const FEEDBACK =
  /^(?:chưa đúng|chưa chính xác|chưa hẳn|sai rồi|không đúng|đúng rồi|đúng vậy|chính xác|rất tốt|tốt lắm|giỏi lắm|làm tốt lắm|gần đúng|không sao|cố lên)(?![\p{L}])/u;
const RESULT = /^(?:vậy|do đó|kết quả|đáp số|kết luận|suy ra|như vậy|tóm lại)(?![\p{L}])/u;
const CONCEPT = /(?:được gọi là|(?<![\p{L}])gọi là|là gì|khái niệm|định nghĩa)(?![\p{L}])/u;
const STEP =
  /^(?:bước\s+\p{L}+|đầu tiên|tiếp theo|sau đó|cuối cùng|thứ (?:nhất|hai|ba|tư)|(?:một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười),)(?![\p{L}])/u;

/**
 * The role of a sentence from its words (spoken form): feedback ("Đúng rồi", "Chưa đúng"), a
 * check question ("…?"), a result ("Vậy …"), a new concept ("… được gọi là …"), a step.
 */
export function classifyRole(sentence: string): SpeechRole {
  const s = sentence.trim().toLowerCase();
  if (FEEDBACK.test(s)) return 'feedback';
  if (/\?[\s"'”)]*$/.test(s)) return 'check';
  if (RESULT.test(s)) return 'result';
  if (CONCEPT.test(s)) return 'concept';
  if (STEP.test(s)) return 'step';
  return 'plain';
}

/** The board's role wins for a heading or a result; a question or feedback heard in it wins otherwise. */
function sentenceRole(sentence: string, given: SpeechRole | undefined): SpeechRole {
  if (given === 'heading' || given === 'result') return given;
  const found = classifyRole(sentence);
  if (found === 'feedback' || found === 'check') return found;
  return given ?? found;
}

// ------------------------------------------------------------ protected spans

const MATH = /\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g;
const QUANTITY =
  /(?<![\p{L}\d])(?:\d+(?::\d+)+|[-−]?\d[\d.,\xa0\u{202f}]*(?:[ \xa0]\d{3})*)(?:\s?(?:%|°[CF]?|[A-Za-zµμΩ][A-Za-zµμΩ²³⁻¹·/]*)(?![\p{L}\d]))?/gu;
const SPECIES = String.raw`\d*[A-Z][A-Za-z0-9₀-₉()]*(?:[⁺⁻]|\^?\d*[+-])?(?:\s?\([a-z]{1,2}\))?`;
const EQUATION = new RegExp(String.raw`${SPECIES}(?:\s*(?:\+|→|->|⟶|⇌|=)\s*${SPECIES})+`, 'g');
/** Two or more capitalised words in a row: a name ("Lơ Sa-tơ-li-ê", "Hà Nội"). */
const NAME = /\p{Lu}[\p{L}'-]*(?:[ \t]+\p{Lu}[\p{L}'-]*)+/gu;

type Range = [number, number];

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;

/** Every place `form` (two words or more) is said in `spoken`, ignoring case. */
function occurrences(spoken: string, form: string, out: Range[]): void {
  const f = form
    .trim()
    .replace(/[.,;:!?…]+$/, '')
    .toLowerCase();
  if (words(f) < 2) return;
  const s = spoken.toLowerCase();
  for (let at = s.indexOf(f); at >= 0; at = s.indexOf(f, at + 1)) out.push([at, at + f.length]);
}

/**
 * Where a cut would split a number with its unit, a formula, an equation or a name: each is
 * found in the written text, read on its own, and its words are looked up in the spoken text.
 */
function protectedRanges(spoken: string, source: string, readings: readonly string[]): Range[] {
  const ranges: Range[] = [];
  const prose = source.replace(MATH, (m) => {
    occurrences(spoken, toSpeech(m), ranges);
    return ' ';
  });
  for (const m of prose.matchAll(QUANTITY)) occurrences(spoken, toSpeech(m[0]), ranges);
  for (const m of prose.matchAll(EQUATION)) occurrences(spoken, toSpeech(m[0]), ranges);
  for (const r of readings) occurrences(spoken, r, ranges);
  for (const m of spoken.matchAll(NAME)) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

const inside = (pos: number, ranges: readonly Range[]) =>
  ranges.some(([a, b]) => pos > a && pos < b);

// ------------------------------------------------------------ emphasis

const BOLD = /\*\*([^*\n]{1,80}?)\*\*(\s*:)?|__([^_\n]{1,80}?)__(\s*:)?/g;

/**
 * Key terms as written: bold words and the given ones. A label is not one: bold at the start of a
 * line that ends with or is followed by a colon ("**Bước 1:**", "- **Lưu ý**: …").
 */
function emphasisTerms(source: string, given: readonly string[]): string[] {
  const terms: string[] = [];
  for (const m of source.matchAll(BOLD)) {
    const term = (m[1] ?? m[3] ?? '').trim();
    const lineStart = /(?:^|\n)[ \t]*(?:[-*+][ \t]+|\d+[.)][ \t]+)?$/.test(
      source.slice(0, m.index),
    );
    const label = lineStart && (Boolean(m[2] ?? m[4]) || term.endsWith(':'));
    if (!label && term) terms.push(term);
  }
  terms.push(...given.map((t) => t.trim()).filter(Boolean));
  return terms.filter((t) => words(t) >= 1 && words(t) <= 5).slice(0, 8);
}

/** Where each key term starts in the spoken text (whole words, ignoring case). */
function emphasisStarts(spoken: string, terms: readonly string[], dict: Dict): number[] {
  const s = spoken.toLowerCase();
  const starts = new Set<number>();
  for (const term of terms) {
    const form = toSpeech(applyPronunciations(term, dict).text)
      .replace(/[.,;:!?…]+$/, '')
      .trim()
      .toLowerCase();
    if (!form) continue;
    for (let at = s.indexOf(form); at >= 0; at = s.indexOf(form, at + 1)) {
      const before = s[at - 1] ?? ' ';
      const after = s[at + form.length] ?? ' ';
      if (!/[\p{L}\d]/u.test(before) && !/[\p{L}\d]/u.test(after)) {
        starts.add(at);
        break;
      }
    }
  }
  return [...starts].sort((a, b) => a - b);
}

type Dict = readonly PronunciationEntry[] | undefined;

// ------------------------------------------------------------ cutting

interface Piece {
  start: number;
  end: number;
  boundary: Boundary;
  sentence: number;
  keyword: boolean;
}

const NUMBER_WORDS = new Set(
  'không một mốt hai ba bốn tư năm lăm sáu bảy tám chín mười mươi trăm nghìn ngàn triệu tỷ tỉ linh lẻ phẩy phần mũ nhân'.split(
    ' ',
  ),
);
const CONJUNCTIONS = [
  'và',
  'nhưng',
  'nên',
  'thì',
  'để',
  'vì',
  'khi',
  'mà',
  'rồi',
  'hoặc',
  'hay',
  'còn',
  'do',
  'nếu',
  'với',
  'tức là',
  'nghĩa là',
  'trong đó',
  'sau đó',
  'vì vậy',
  'do đó',
  'bởi vì',
  'cho nên',
  'tuy nhiên',
];

const lastWord = (s: string) => (/(\S+)\s*$/u.exec(s)?.[1] ?? '').toLowerCase();
const firstWord = (s: string) => (/^\s*(\S+)/u.exec(s)?.[1] ?? '').toLowerCase();

/**
 * The best place to cut a piece that has no punctuation where it needs one: between words,
 * never inside a protected span or between two number words, both sides long enough; before a
 * conjunction if possible, near the middle (or as late as `maxLeft` allows). Null when there is
 * none (or, with `conjunctionOnly`, none before a conjunction).
 */
function bestCut(
  text: string,
  piece: { start: number; end: number },
  ranges: readonly Range[],
  maxLeft: number,
  conjunctionOnly: boolean,
): number | null {
  const body = text.slice(piece.start, piece.end);
  let best: { at: number; score: number } | null = null;
  for (const m of body.matchAll(/\s+/g)) {
    const cut = piece.start + m.index + m[0].length;
    const left = text.slice(piece.start, piece.start + m.index);
    const right = text.slice(cut, piece.end);
    if (inside(cut, ranges) || inside(piece.start + m.index, ranges)) continue;
    if (words(left) < MIN_CUT_WORDS || words(right) < MIN_CUT_WORDS) continue;
    if (NUMBER_WORDS.has(lastWord(left)) && NUMBER_WORDS.has(firstWord(right))) continue;
    const r = right.toLowerCase();
    const conjunction = CONJUNCTIONS.some((c) => r.startsWith(`${c} `));
    if (conjunctionOnly && !conjunction) continue;
    const fits = left.length <= maxLeft;
    const middle = 1 - Math.abs(left.length - body.length / 2) / body.length;
    const score = (fits ? 4 : 0) + (conjunction ? 3 : 0) + middle * 2;
    if (!best || score > best.score) best = { at: cut, score };
  }
  return best?.at ?? null;
}

/** Paragraphs → sentences → clauses and commas, outside protected spans. */
function cutAtPunctuation(text: string, ranges: readonly Range[]): Piece[] {
  const pieces: Piece[] = [];
  let sentence = 0;
  const lines = [...text.matchAll(/[^\n]+/g)];
  lines.forEach((line, li) => {
    const base = line.index;
    let start = base;
    const marks = [...line[0].matchAll(/[.!?…]+(?=\s|$)|[;:](?=\s|$)|,(?=\s|$)/g)];
    const push = (end: number, boundary: Boundary) => {
      if (text.slice(start, end).trim())
        pieces.push({ start, end, boundary, sentence, keyword: false });
      start = end;
    };
    for (const m of marks) {
      const end = base + m.index + m[0].length;
      if (inside(base + m.index, ranges)) continue;
      const boundary: Boundary = /[.!?…]/.test(m[0])
        ? 'sentence'
        : /[;:]/.test(m[0])
          ? 'clause'
          : 'comma';
      push(end, boundary);
      if (boundary === 'sentence') sentence++;
    }
    push(base + line[0].length, li === lines.length - 1 ? 'end' : 'paragraph');
    const last = pieces.at(-1);
    if (last) last.boundary = li === lines.length - 1 ? 'end' : 'paragraph';
    if (last?.sentence === sentence) sentence++;
  });
  return pieces;
}

const stronger = (a: Boundary, b: Boundary) => (PAUSE_MS[a] >= PAUSE_MS[b] ? a : b);
const ends = (b: Boundary) => b === 'sentence' || b === 'paragraph' || b === 'end';

/** A piece of fewer than three words joins the next piece of its sentence (or the one before). */
function mergeTiny(text: string, pieces: Piece[]): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (!p) continue;
    const next = pieces[i + 1];
    if (words(text.slice(p.start, p.end)) < MIN_CHUNK_WORDS && !ends(p.boundary) && next) {
      next.start = p.start;
      continue;
    }
    const prev = out.at(-1);
    if (
      words(text.slice(p.start, p.end)) < MIN_CHUNK_WORDS &&
      prev &&
      prev.sentence === p.sentence &&
      !ends(prev.boundary)
    ) {
      prev.end = p.end;
      prev.boundary = p.boundary;
      continue;
    }
    out.push(p);
  }
  return out;
}

/** Splits before each key term (a short pause first) and marks the piece that holds it. */
function splitForEmphasis(
  text: string,
  pieces: Piece[],
  starts: readonly number[],
  ranges: readonly Range[],
): Piece[] {
  const out: Piece[] = [];
  for (const p of pieces) {
    let current = p;
    for (const at of starts) {
      if (at < current.start || at >= current.end) continue;
      const before = text.slice(current.start, at);
      const free = !inside(at, ranges) && !inside(at - 1, ranges);
      if (free && words(before) >= MIN_CUT_WORDS && words(text.slice(at, current.end)) >= 1) {
        out.push({ ...current, end: at, boundary: 'emphasis' });
        current = { ...current, start: at, keyword: true };
      } else if (words(before) < MIN_CUT_WORDS) {
        current = { ...current, keyword: true };
      }
    }
    out.push(current);
  }
  return out;
}

/** Cuts pieces longer than `max` between words; the first one also at a conjunction past `first`. */
function splitLong(
  text: string,
  pieces: Piece[],
  ranges: readonly Range[],
  max: number,
  first: number,
): Piece[] {
  const out: Piece[] = [];
  const queue = [...pieces];
  while (queue.length > 0) {
    const p = queue.shift();
    if (!p) break;
    const length = text.slice(p.start, p.end).trim().length;
    const opening = out.length === 0;
    const limit = opening ? first : max;
    const cut =
      length > max
        ? bestCut(text, p, ranges, limit, false)
        : opening && length > first
          ? bestCut(text, p, ranges, first, true)
          : null;
    if (cut === null) {
      out.push(p);
      continue;
    }
    queue.unshift({ ...p, end: cut, boundary: 'phrase' }, { ...p, start: cut, keyword: false });
  }
  return out;
}

/** Cuts at a sentence end at most `max` characters in (whole words when there is none). */
function capLength(spoken: string, max: number): string {
  if (spoken.length <= max) return spoken;
  const head = spoken.slice(0, max);
  const end = Math.max(...[...head.matchAll(/[.!?…](?=\s)/g)].map((m) => m.index + 1), -1);
  if (end > max / 2) return head.slice(0, end).trim();
  return head.slice(0, Math.max(head.lastIndexOf(' '), 1)).trim();
}

// ------------------------------------------------------------ plan

/** Prepares `text` for the teacher's voice (see the file comment). Pure: same text, same plan. */
export function prepareSpeech(text: string, opts: PrepareOptions = {}): SpeechPlan {
  const max = opts.maxChunkChars ?? MMS_CHUNK_MAX;
  const first = Math.min(max, opts.firstChunkChars ?? MMS_FIRST_CHUNK_MAX);
  const dict = opts.dictionary;
  const source = stripInternalMarkup(text);
  const { text: pronounced, readings } = applyPronunciations(source, dict);
  const spoken = capLength(toSpeech(pronounced), MAX_SPEECH_CHARS);
  if (!spoken) return { text: '', chunks: [] };

  const ranges = protectedRanges(spoken, pronounced, readings);
  const terms = emphasisTerms(source, opts.emphasis ?? []);
  let pieces = mergeTiny(spoken, cutAtPunctuation(spoken, ranges));
  pieces = splitForEmphasis(spoken, pieces, emphasisStarts(spoken, terms, dict), ranges);
  pieces = splitLong(spoken, pieces, ranges, max, first);

  // A sentence's role is decided on all its words.
  const sentenceText = new Map<number, string>();
  for (const p of pieces) {
    sentenceText.set(
      p.sentence,
      `${sentenceText.get(p.sentence) ?? ''} ${spoken.slice(p.start, p.end)}`,
    );
  }
  const roles = new Map<number, SpeechRole>();
  for (const [i, s] of sentenceText) roles.set(i, sentenceRole(s, opts.role));

  const chunks = pieces.map((p, i): PlannedChunk => {
    const boundary: Boundary = i === pieces.length - 1 ? 'end' : p.boundary;
    const role: SpeechRole = p.keyword ? 'keyword' : (roles.get(p.sentence) ?? 'plain');
    const prosody = ROLE_PROSODY[role];
    return {
      text: spoken.slice(p.start, p.end).trim(),
      pauseMs: PAUSE_MS[boundary],
      boundary,
      role,
      sentence: p.sentence,
      ...prosody,
    };
  });
  // A pause before a key term is never shorter than the emphasis pause.
  chunks.forEach((c, i) => {
    const next = chunks[i + 1];
    if (next?.role === 'keyword' && c.role !== 'keyword') {
      c.boundary = stronger(c.boundary, 'emphasis');
      c.pauseMs = PAUSE_MS[c.boundary];
    }
  });
  return { text: spoken, chunks: chunks.filter((c) => c.text) };
}
