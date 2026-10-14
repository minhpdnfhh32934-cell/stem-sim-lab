/**
 * What of an AI Teacher answer may reach the learner (chat, voice and board). Removed, and only
 * removed (nothing is rewritten, no number is touched):
 *
 * - hidden reasoning: <think>…</think> and friends, unclosed or orphan (`src/ai/reasoning.ts`); a
 *   reasoning tag written as code ("`<think>`") is code and stays;
 * - <reference …>…</reference> blocks (the prompt's excerpts echoed back) and HTML comments;
 * - lines that only repeat a prompt label ("**GHI CHÚ:**", "KẾT QUẢ DO SIMLAB TÍNH", the screen
 *   context header…, `promptLabels.ts`). A label followed by real content stays, and so does a
 *   generic upper-case name used as a markdown heading ("## TÀI LIỆU THAM KHẢO") or the
 *   excerpt section's name above a bullet list of sources;
 * - for an answer written by the Think reviewer (`reviewed`), its wrapper, sentence by sentence
 *   from the start: remarks about the draft ("Bản nháp đã đúng.", "The draft is correct.") and the
 *   header that introduces the revision ("Bản đã sửa:", "Revised answer:", alone on its line or
 *   closed by ":"). The scan stops at the first sentence or line that is neither, so the lesson
 *   is never cut. A remark holding a number, a formula, a tag or code stays unless a revision
 *   header follows it (it may be a correction the learner needs). A closing paragraph that opens
 *   by naming the draft goes when it holds none of these. Feedback on the learner's own draft
 *   ("Bản nháp của em…", "Your draft…") is never a remark, and when the question is about the
 *   learner's draft nothing of the wrapper is removed.
 *
 * Code fences and inline code are never edited (reasoning around code excepted). Text without
 * anything to remove comes back exactly as it was; the result is idempotent. Pure: no store
 * imports, so the board and the voice can use it too.
 */
import { stripReasoningOutsideCode } from '@/ai/reasoning';
import { ECHO_HEADERS, EXCERPT_HEADER, REVIEW_DRAFT_LABEL } from './promptLabels';

export type CleanKind = 'reasoning' | 'review' | 'promptEcho' | 'reference' | 'comment';
const KINDS: readonly CleanKind[] = ['reasoning', 'review', 'promptEcho', 'reference', 'comment'];

export interface CleanedAnswer {
  text: string;
  /** What was removed (each kind once, in a fixed order); empty when the text is unchanged. */
  removed: CleanKind[];
}

export interface CleanOptions {
  /** The answer was written by the Think reviewer (its record has `checkedBy`). */
  reviewed?: boolean;
  /**
   * The learner's question. When it is about the learner's own draft ("nháp", "draft"), the
   * answer's words about a draft are feedback the learner asked for: the wrapper stays.
   */
  question?: string;
}

/** Cleans an answer (see the file comment). */
export function cleanAnswer(text: string, options: CleanOptions = {}): CleanedAnswer {
  const found = new Set<CleanKind>();
  const reviewed = options.reviewed === true && !asksAboutOwnDraft(options.question ?? '');
  let out = text;
  // Each pass only removes, so it ends; a second pass catches what the first one uncovered.
  for (let pass = 0; pass < 5; pass++) {
    const next = cleanOnce(out, reviewed, found);
    if (next === out) break;
    out = next;
  }
  if (found.size === 0) return { text, removed: [] };
  return { text: out, removed: KINDS.filter((k) => found.has(k)) };
}

function cleanOnce(text: string, reviewed: boolean, found: Set<CleanKind>): string {
  const reasoning = stripReasoningOutsideCode(text);
  if (reasoning.removed) found.add('reasoning');
  const masked = mask(reasoning.text);
  const start = masked ? masked.text : reasoning.text;
  let out = removeBlocks(start, found);
  out = removeEchoLines(out, found);
  if (reviewed) out = removeReviewWrapper(out, found);
  if (out !== start || reasoning.removed) out = tidy(out);
  return masked ? unmask(out, masked.spans) : out;
}

// ------------------------------------------------------------ protected spans

const HOLD_OPEN = '\u{E000}';
const HOLD_CLOSE = '\u{E001}';
/** A closed code fence (``` or ~~~ at a line start, closed by the same marker). */
const FENCE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm;
const INLINE_CODE = /`[^`\n]+`/g;
const HELD = /\u{E000}(\d+)\u{E001}/gu;

/** Code is replaced by placeholders while the cleaning runs (null: the text has our markers). */
function mask(text: string): { text: string; spans: string[] } | null {
  if (text.includes(HOLD_OPEN) || text.includes(HOLD_CLOSE)) return null;
  const spans: string[] = [];
  const hold = (s: string) => {
    spans.push(s);
    return `${HOLD_OPEN}${String(spans.length - 1)}${HOLD_CLOSE}`;
  };
  return { text: text.replace(FENCE, hold).replace(INLINE_CODE, hold), spans };
}

function unmask(text: string, spans: readonly string[]): string {
  return text.replace(HELD, (_, i: string) => spans[Number(i)] ?? '');
}

/** Blank lines left by a removal are folded; the ends are trimmed. */
function tidy(text: string): string {
  return text.replace(/\n(?:[ \t\r]*\n){2,}/g, '\n\n').trim();
}

// ------------------------------------------------------------ references and comments

const REFERENCE_BLOCK = /<reference\b[^>]*>[\s\S]*?<\/reference\s*>[ \t]*/gi;
/** A reference tag left without its pair: the tag goes, the words stay. */
const REFERENCE_TAG = /<\/?reference\b[^>]*>[ \t]*/gi;
const COMMENT = /<!--[\s\S]*?-->[ \t]*/g;

function removeBlocks(text: string, found: Set<CleanKind>): string {
  const noReferences = text.replace(REFERENCE_BLOCK, '').replace(REFERENCE_TAG, '');
  if (noReferences !== text) found.add('reference');
  const noComments = noReferences.replace(COMMENT, '');
  if (noComments !== noReferences) found.add('comment');
  return noComments;
}

// ------------------------------------------------------------ prompt echoes

/** A line without its markdown dressing (quote, heading, bullet, emphasis, final colon or dot). */
function labelCore(line: string): string {
  return line
    .normalize('NFC')
    .replace(/^[ \t]*(?:>[ \t]*)*(?:#{1,6}[ \t]+)?(?:[-*+•][ \t]+)?/u, '')
    .replace(/[*_~]+/g, '')
    .replace(/[\s:.：]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface EchoForm {
  text: string;
  /** Short upper-case labels ("GHI CHÚ", "NOTE") count only in upper case: "Ghi chú:" is a teacher's heading. */
  exactCase: boolean;
  /**
   * A generic section name ("GHI CHÚ", "TÀI LIỆU THAM KHẢO") that a teacher may also use as a
   * markdown heading; one that names the app ("KẾT QUẢ DO SIMLAB TÍNH") is always an echo.
   */
  generic: boolean;
  /** The name of the excerpt section ("TÀI LIỆU THAM KHẢO"): above a bullet list it heads sources. */
  sources: boolean;
}

const nameOf = (header: string) => labelCore(header.split(/\s\(|[.:]/u)[0] ?? '');
const SOURCE_NAMES = new Set(Object.values(EXCERPT_HEADER).map(nameOf));

/** Each header whole (any case) and its name before "(", "." or ":" ("GHI CHÚ", "TÀI LIỆU THAM KHẢO"). */
const ECHO_FORMS: readonly EchoForm[] = ECHO_HEADERS.flatMap((header) => {
  const whole = labelCore(header);
  const name = nameOf(header);
  const forms: EchoForm[] = [
    { text: whole.toLowerCase(), exactCase: false, generic: false, sources: false },
  ];
  if (name && name !== whole) {
    const kind = { generic: !/simlab/iu.test(name), sources: SOURCE_NAMES.has(name) };
    forms.push(
      name === name.toUpperCase()
        ? { text: name, exactCase: true, ...kind }
        : { text: name.toLowerCase(), exactCase: false, ...kind },
    );
  }
  return forms;
});

const HEADING_LINE = /^[ \t]*(?:>[ \t]*)*#{1,6}[ \t]/u;
const BULLET_LINE = /^[ \t]*(?:>[ \t]*)*[-*+•][ \t]/u;

/** The line only repeats a prompt label; `next` is the next non-empty line. */
function isEcho(line: string, next: string | undefined): boolean {
  const core = labelCore(line);
  if (!core) return false;
  const lower = core.toLowerCase();
  const form = ECHO_FORMS.find((f) => (f.exactCase ? core === f.text : lower === f.text));
  if (!form) return false;
  // "## TÀI LIỆU THAM KHẢO", or that name above a bullet list of sources, is the teacher's own.
  if (form.generic && HEADING_LINE.test(line)) return false;
  if (form.sources && next !== undefined && BULLET_LINE.test(next)) return false;
  return true;
}

function removeEchoLines(text: string, found: Set<CleanKind>): string {
  const lines = text.split('\n');
  const kept = lines.filter(
    (line, i) =>
      !isEcho(
        line,
        lines.slice(i + 1).find((l) => l.trim()),
      ),
  );
  if (kept.length === lines.length) return text;
  found.add('promptEcho');
  return kept.join('\n');
}

// ------------------------------------------------------------ Think reviewer wrapper

/** The learner asked about their own draft ("xem nháp giúp em", "check my draft"). */
function asksAboutOwnDraft(question: string): boolean {
  return /nháp|\bdrafts?\b/iu.test(question.normalize('NFC'));
}

/**
 * Words about the learner's own draft (feedback they asked for, never the reviewer's notes):
 * "bản nháp của em", "bản nháp bạn gửi", "em đã viết bản nháp", "your draft", "the draft you…".
 */
const LEARNER_DRAFT: readonly RegExp[] = [
  /bản\s+nháp\s+(?:của\s+)?(?:các\s+)?(?:em|bạn|con|cậu)(?![\p{L}\p{M}])/giu,
  /(?<![\p{L}\p{M}])(?:em|bạn)(?:\s+[\p{L}\p{M}]+){0,3}\s+bản\s+nháp/giu,
  /\byour\s+(?:own\s+)?(?:[a-z]+\s+)?draft/gi,
  /\bthe\s+draft\s+you\b/gi,
];

/** Words that only a reviewer writes about the draft it was given. */
const DRAFT_STRONG = [
  /bản\s+nháp/iu,
  new RegExp(labelCore(REVIEW_DRAFT_LABEL.vi).replace(/\s+/g, String.raw`\s+`), 'iu'),
  /\bdraft\s+(?:answer|response|solution|version|lesson)\b/i,
  /\b(?:original|initial|previous|first)\s+draft\b/i,
  /\bthe\s+draft['’]s\b/i,
];
/** Opening a sentence: "Rà soát: …". */
const REVIEW_OPENING = /^[\s>#*_-]*rà\s+soát(?![\p{L}\p{M}])/iu;
/** "The draft is correct": a draft and a verdict in the same sentence. */
const DRAFT_EN = /\b(?:the|this)\s+draft\b/i;
const VERDICT_EN =
  /\b(?:correct|incorrect|wrong|error|mistake|accurate|inaccurate|missing|unclear|improv|fix|revis|review)/i;
/** A closing paragraph that opens by naming the draft as its topic. */
const DRAFT_TOPIC =
  /^[\s>#*_-]*(?:(?:nhận xét|đánh giá|ghi chú|lưu ý)(?:\s+(?:chung|thêm))?\s+(?:về\s+|cho\s+)?bản\s+nháp|(?:notes?|comments?|review)\s+(?:on|about|of)\s+the\s+draft)/iu;

/** The text with the learner's own draft taken out, for the tests below only. */
function reviewerWords(text: string): string {
  return LEARNER_DRAFT.reduce((t, re) => t.replace(re, ' … '), text.normalize('NFC'));
}

function aboutDraft(text: string): boolean {
  const t = reviewerWords(text);
  return (
    DRAFT_STRONG.some((re) => re.test(t)) ||
    REVIEW_OPENING.test(t) ||
    (DRAFT_EN.test(t) && VERDICT_EN.test(t))
  );
}

/** A list or quote marker at a line start ("1. ", "- ", "> ", "## "), not learning material. */
const LINE_MARKER = /^[ \t]*(?:>[ \t]*)*(?:#{1,6}[ \t]+)?(?:[-*+•][ \t]+|\d+[.)][ \t]+)?/gmu;
/** Learning material: a number, a formula sign, LaTeX, a tag (TeachScript, HTML) or code. */
const MATERIAL = /[\p{N}=≈≠≤≥±×÷√∑∫$\\]|<\/?[a-z]|\u{E000}/iu;

function holdsMaterial(text: string): boolean {
  return MATERIAL.test(text.replace(LINE_MARKER, ''));
}

/** Only a reviewer names its text so ("Bản đã sửa", "Revised answer"). */
const HEADER_VI = String.raw`(?:câu trả lời|lời giải|bài giảng|bài giải|bản)\s+(?:đã\s+)?(?:được\s+)?(?:chỉnh sửa|hiệu chỉnh|viết lại|sửa)|bản\s+(?:hoàn chỉnh|cuối cùng)`;
const HEADER_EN = String.raw`(?:revised|corrected|improved|updated|rewritten|fixed)\s+(?:answer|version|response|lesson|explanation|solution)`;
/** A teacher may also write these ("Câu trả lời cuối cùng: v = 20 m/s"). */
const HEADER_WEAK = String.raw`câu trả lời\s+(?:hoàn chỉnh|cuối cùng)`;
/** The phrase that names the revision; group 1 is set for a weak one. */
const HEADER_PHRASE = new RegExp(
  String.raw`(?<![\p{L}\p{M}])(?:(${HEADER_WEAK})|${HEADER_VI}|${HEADER_EN})(?![\p{L}\p{M}])`,
  'giu',
);
/**
 * What may follow the phrase in a header: a few function words ("như sau", "của em", "below"), a
 * short note in brackets without numbers, then ":" (content may follow on the line) or the end of
 * the line (the header alone on its line). Anything else ("là v = 20 m/s", "lỗi ADN gồm 3 bước")
 * makes the phrase part of a sentence.
 */
const HEADER_TAIL =
  /^(?:\s+(?:như\s+sau|dưới\s+đây|sau\s+đây|của\s+(?:mình|tôi|em|bạn)|cho\s+(?:em|bạn)|as\s+follows|follows|below))*(?:\s*\([^()\n\p{N}=$<>\\]{0,30}\))?[ \t]*[*_]*[ \t]*(?:[:：][*_]*|(?=[ \t*_]*$))/iu;
/** "Dưới đây là", "Here is the" right before a header. */
const INTRO_END =
  /(?:(?:dưới đây|sau đây|đây)\s+là|here\s+is|here['’]s|below\s+is|this\s+is)(?:\s+(?:the|my|a|an))?[\s*_]*$/iu;

/** Text before a header in its sentence that a reviewer may write: nothing, or words about the draft. */
function reviewerLead(before: string): boolean {
  const rest = before.replace(INTRO_END, '');
  return rest.replace(/[\s>#*_~\-–—:.,]/gu, '') === '' || aboutDraft(rest);
}

/**
 * End (within `unit`) of the last revision header that only reviewer words precede, or -1.
 * `lineEnd`: the unit ends its line, so a header without ":" may stand at its end. `strongOnly`:
 * only a phrase that a teacher never writes counts.
 */
function revisionHeaderEnd(unit: string, lineEnd: boolean, strongOnly: boolean): number {
  let end = -1;
  for (const m of unit.matchAll(HEADER_PHRASE)) {
    if (strongOnly && m[1] !== undefined) continue;
    const after = m.index + m[0].length;
    const tail = HEADER_TAIL.exec(unit.slice(after));
    if (!tail) continue;
    const closed = /[:：]/u.test(tail[0]);
    if (!closed && !lineEnd) continue;
    if (reviewerLead(unit.slice(0, m.index))) end = after + tail[0].length;
  }
  return end;
}

interface Range {
  start: number;
  end: number;
}

/** A list marker that is all a line has before its dot ("1.", "a."): no sentence end. */
const MARKER_ONLY = /^[ \t]*(?:>[ \t]*)*(?:\d+|[a-zA-Z])$/u;

/** Sentences of each line, as ranges of `text`: a sentence ends at ". ", "! ", "? " or "… ". */
function units(text: string): Range[] {
  const out: Range[] = [];
  let lineStart = 0;
  for (const line of text.split('\n')) {
    let start = 0;
    for (const m of line.matchAll(/[.!?…]+(?=[ \t]+\S)/gu)) {
      if (start === 0 && MARKER_ONLY.test(line.slice(0, m.index))) continue;
      const end = m.index + m[0].length;
      out.push({ start: lineStart + start, end: lineStart + end });
      start = end;
    }
    out.push({ start: lineStart + start, end: lineStart + line.length });
    lineStart += line.length + 1;
  }
  return out;
}

/** Paragraphs (separated by blank lines) as ranges of `text`. */
function paragraphs(text: string): Range[] {
  const out: Range[] = [];
  let start = 0;
  for (const m of text.matchAll(/\n[ \t\r]*\n/g)) {
    out.push({ start, end: m.index });
    start = m.index + m[0].length;
  }
  out.push({ start, end: text.length });
  return out;
}

/** A bare label a reviewer may open with ("## Nhận xét"); it goes only with the remark after it. */
const NEUTRAL_LABEL = /^(?:nhận xét|đánh giá|review|feedback|comments?|notes?)$/iu;
/** Lesson structure, never part of a reviewer's remarks: a tag, code or LaTeX. */
const STRUCTURE = /<\/?[a-z]|\u{E000}|[$\\]/iu;
const HEADING_START = /^[ \t]*(?:>[ \t]*)*#{1,6}[ \t]/u;
/**
 * After the opening remarks, at most this much text that does not name the draft ("Tuy nhiên,
 * bước 2 thiếu đơn vị.") still belongs to the reviewer when a revision header follows it.
 */
const GAP_UNITS = 4;
const GAP_CHARS = 500;

function removeReviewWrapper(text: string, found: Set<CleanKind>): string {
  // Leading, sentence by sentence: remarks about the draft and revision headers. `cut` moves past
  // a remark holding learning material only when a header follows it (`held`). Once the answer
  // opened with a remark, a few sentences that do not name the draft (`gap`) go only when a
  // reviewer-only header ("Bản đã sửa:") follows them, before any lesson structure.
  let cut = 0;
  let held = false;
  let opened = false;
  let gap: { start: number; units: number } | null = null;
  let lesson = -1;
  for (const u of units(text)) {
    const unit = text.slice(u.start, u.end);
    if (!unit.trim()) continue;
    const lineEnd = u.end === text.length || text[u.end] === '\n';
    // A weak header ("Câu trả lời cuối cùng:") counts only right after the reviewer's remarks.
    const header = revisionHeaderEnd(unit, lineEnd, gap !== null || !opened);
    if (header >= 0) {
      cut = u.start + header;
      held = false;
      opened = true;
      gap = null;
      if (text.slice(cut, u.end).trim()) {
        lesson = cut;
        break;
      }
      continue;
    }
    const lineStart = u.start === 0 || text[u.start - 1] === '\n';
    const structure = STRUCTURE.test(unit) || (lineStart && HEADING_START.test(unit));
    if (gap) {
      gap.units++;
      if (structure || gap.units > GAP_UNITS || u.end - gap.start > GAP_CHARS) break;
      continue;
    }
    if (NEUTRAL_LABEL.test(labelCore(unit))) continue;
    if (aboutDraft(unit)) {
      opened = true;
      if (held || holdsMaterial(unit)) held = true;
      else cut = u.end;
      continue;
    }
    if (!opened) {
      lesson = u.start;
      break;
    }
    gap = { start: u.start, units: 1 };
    if (structure) break;
  }
  // Where the lesson starts (the text from `cut` is kept): closing notes can only come after it.
  if (gap) lesson = gap.start;
  if (lesson < 0) lesson = cut;
  // Closing: paragraphs after the lesson's start that open by naming the draft, without material.
  let end = text.length;
  const parts = paragraphs(text);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (!p || p.start <= lesson) break;
    const body = text.slice(p.start, p.end);
    if (!body.trim()) continue;
    if (!DRAFT_TOPIC.test(reviewerWords(body)) || holdsMaterial(body)) break;
    end = p.start;
  }
  if (cut === 0 && end === text.length) return text;
  found.add('review');
  return text.slice(cut, Math.max(cut, end));
}
