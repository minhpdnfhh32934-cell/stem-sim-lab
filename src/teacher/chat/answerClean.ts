/**
 * What of an AI Teacher answer may reach the learner (chat, voice and board). Removed, and only
 * removed (nothing is rewritten, no number is touched):
 *
 * - hidden reasoning: <think>…</think> and friends, unclosed or orphan (`src/ai/reasoning.ts`);
 * - <reference …>…</reference> blocks (the prompt's excerpts echoed back) and HTML comments;
 * - lines that only repeat a prompt label ("**GHI CHÚ:**", "KẾT QUẢ DO SIMLAB TÍNH", the screen
 *   context header…, `promptLabels.ts`). A label followed by real content stays;
 * - for an answer written by the Think reviewer (`reviewed`), its wrapper: leading paragraphs
 *   about the draft ("Nhận xét về bản nháp…", "The draft is correct…") and the header that
 *   introduces the revision ("Bản đã sửa:", "Revised answer:"): only what follows the last such
 *   header is kept. A closing paragraph that opens by naming the draft goes too. Only for a
 *   reviewed answer, because a learner may ask the teacher to check their own draft, and the
 *   answer then talks about it ("Bản nháp của em đúng hướng…").
 *
 * Code fences and inline code are never edited (reasoning tags excepted: a model's reasoning may
 * itself contain a fence). Text without anything to remove comes back exactly as it was; the result
 * is idempotent. Pure: no store imports, so the board and the voice can use it too.
 */
import { stripAllReasoning } from '@/ai/reasoning';
import { ECHO_HEADERS, REVIEW_DRAFT_LABEL } from './promptLabels';

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
}

/** Cleans an answer (see the file comment). */
export function cleanAnswer(text: string, options: CleanOptions = {}): CleanedAnswer {
  const found = new Set<CleanKind>();
  const reviewed = options.reviewed === true;
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
  const reasoning = stripAllReasoning(text);
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
    return `${HOLD_OPEN}${spans.length - 1}${HOLD_CLOSE}`;
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
}

/** Each header whole (any case) and its name before "(", "." or ":" ("GHI CHÚ", "TÀI LIỆU THAM KHẢO"). */
const ECHO_FORMS: readonly EchoForm[] = ECHO_HEADERS.flatMap((header) => {
  const whole = labelCore(header);
  const name = labelCore(header.split(/\s\(|[.:]/u)[0] ?? '');
  const forms: EchoForm[] = [{ text: whole.toLowerCase(), exactCase: false }];
  if (name && name !== whole)
    forms.push(
      name === name.toUpperCase()
        ? { text: name, exactCase: true }
        : { text: name.toLowerCase(), exactCase: false },
    );
  return forms;
});

function isEcho(line: string): boolean {
  const core = labelCore(line);
  if (!core) return false;
  const lower = core.toLowerCase();
  return ECHO_FORMS.some((f) => (f.exactCase ? core === f.text : lower === f.text));
}

function removeEchoLines(text: string, found: Set<CleanKind>): string {
  const lines = text.split('\n');
  const kept = lines.filter((line) => !isEcho(line));
  if (kept.length === lines.length) return text;
  found.add('promptEcho');
  return kept.join('\n');
}

// ------------------------------------------------------------ Think reviewer wrapper

/** Words that only a reviewer writes about the draft it was given. */
const DRAFT_STRONG = [
  /bản\s+nháp/iu,
  new RegExp(labelCore(REVIEW_DRAFT_LABEL.vi).replace(/\s+/g, String.raw`\s+`), 'iu'),
  /\bdraft\s+(?:answer|response|solution|version|lesson)\b/i,
  /\b(?:original|initial|previous|first)\s+draft\b/i,
  /\bthe\s+draft['’]s\b/i,
];
/** Opening a paragraph: "Rà soát: …". */
const REVIEW_OPENING = /^[\s>#*_-]*rà\s+soát(?![\p{L}\p{M}])/iu;
/** "The draft is correct": a draft and a verdict in the same paragraph. */
const DRAFT_EN = /\b(?:the|this|your)\s+draft\b/i;
const VERDICT_EN =
  /\b(?:correct|incorrect|wrong|error|mistake|accurate|inaccurate|missing|unclear|improv|fix|revis|review)/i;
/** A closing paragraph that opens by naming the draft as its topic. */
const DRAFT_TOPIC =
  /^[\s>#*_-]*(?:(?:nhận xét|đánh giá|ghi chú|lưu ý)(?:\s+(?:chung|thêm))?\s+(?:về\s+|cho\s+)?bản\s+nháp|(?:notes?|comments?|review)\s+(?:on|about|of)\s+the\s+draft)/iu;

function aboutDraft(paragraph: string): boolean {
  return (
    DRAFT_STRONG.some((re) => re.test(paragraph)) ||
    REVIEW_OPENING.test(paragraph) ||
    (DRAFT_EN.test(paragraph) && VERDICT_EN.test(paragraph))
  );
}

const HEADER_VI = String.raw`(?:câu trả lời|lời giải|bài giảng|bài giải|bản)\s+(?:đã\s+)?(?:được\s+)?(?:chỉnh sửa|hiệu chỉnh|viết lại|sửa)|bản\s+(?:hoàn chỉnh|cuối cùng)|câu trả lời\s+(?:hoàn chỉnh|cuối cùng)`;
const HEADER_EN = String.raw`(?:revised|corrected|improved|updated|rewritten|fixed)\s+(?:answer|version|response|lesson|explanation|solution)`;
/** The header that introduces the revision: the phrase, a few words, then ":" or the line's end. */
const REVISION_HEADER = new RegExp(
  String.raw`(?<![\p{L}\p{M}])(?:${HEADER_VI}|${HEADER_EN})(?![\p{L}\p{M}])[^:\n]{0,30}?(?::|(?=[\s*_]*$))[*_]*`,
  'giu',
);
/** "Dưới đây là", "Here is the" right before a header. */
const INTRO_END =
  /(?:(?:dưới đây|sau đây|đây)\s+là|here\s+is|here['’]s|below\s+is|this\s+is)(?:\s+(?:the|my|a|an))?[\s*_]*$/iu;

/** Text before a header that a reviewer may write: nothing, or words about the draft. */
function reviewerLead(before: string): boolean {
  const rest = before.replace(INTRO_END, '');
  return rest.replace(/[\s>#*_~\-–—:.]/gu, '') === '' || aboutDraft(rest);
}

/** End of the last revision header in `paragraph` that only reviewer words precede, or -1. */
function revisionHeaderEnd(paragraph: string): number {
  let end = -1;
  let lineStart = 0;
  for (const line of paragraph.split('\n')) {
    for (const m of line.matchAll(REVISION_HEADER)) {
      if (reviewerLead(paragraph.slice(0, lineStart + m.index))) {
        end = lineStart + m.index + m[0].length;
      }
    }
    lineStart += line.length + 1;
  }
  return end;
}

interface Range {
  start: number;
  end: number;
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

function removeReviewWrapper(text: string, found: Set<CleanKind>): string {
  const parts = paragraphs(text);
  // Leading: paragraphs about the draft and revision headers; the lesson starts after them.
  let cut = 0;
  let first = 0;
  for (; first < parts.length; first++) {
    const p = parts[first];
    if (!p) break;
    const body = text.slice(p.start, p.end);
    const header = revisionHeaderEnd(body);
    if (header >= 0) {
      cut = p.start + header;
      if (body.slice(header).trim()) break;
      continue;
    }
    if (!aboutDraft(body)) break;
    cut = p.end;
  }
  // Closing: paragraphs that open by naming the draft ("Nhận xét về bản nháp: …").
  let end = text.length;
  for (let i = parts.length - 1; i > first; i--) {
    const p = parts[i];
    if (!p || !DRAFT_TOPIC.test(text.slice(p.start, p.end))) break;
    end = p.start;
  }
  if (cut === 0 && end === text.length) return text;
  found.add('review');
  return text.slice(cut, Math.max(cut, end));
}
