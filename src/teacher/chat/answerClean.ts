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
 *   from the start: remarks about the draft or the answer under review ("Bản nháp đã đúng.", "The
 *   draft is correct.", "Review: The answer is correct…", "Bản trả lời ban đầu đã đúng.") and the
 *   header that introduces the revision ("Bản đã sửa:", "Revised answer:", alone on its line or
 *   closed by ":"). The scan stops at the first sentence or line that is neither, so the lesson
 *   is never cut; only a reviewer-only header alone on its line also ends a few opening
 *   sentences without learning material ("Chào em!\n\nBản đã sửa:"). A remark holding a number,
 *   a formula, a tag or code, or going on with more than a few words after "nhưng"/"rằng"/"but",
 *   stays unless a revision header follows it (it may be a correction the learner needs). A
 *   closing paragraph that opens by naming the draft goes when it holds none of these. Feedback
 *   on the learner's own draft or answer ("Bản nháp của em…", "Your answer…") is never a remark;
 *   when the question is about the learner's draft nothing of the wrapper is removed, and when it
 *   asks for a correction a header alone does not end the opening sentences.
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
  const question = options.question ?? '';
  const review: ReviewMode | null =
    options.reviewed === true && !asksAboutOwnDraft(question)
      ? { correction: asksForCorrection(question) }
      : null;
  let out = text;
  // Each pass only removes, so it ends; a second pass catches what the first one uncovered.
  for (let pass = 0; pass < 5; pass++) {
    const next = cleanOnce(out, review, found);
    if (next === out) break;
    out = next;
  }
  if (found.size === 0) return { text, removed: [] };
  return { text: out, removed: KINDS.filter((k) => found.has(k)) };
}

/** How the Think reviewer's wrapper is looked for. */
interface ReviewMode {
  /**
   * The learner asked for a correction or a check ("sửa giúp em", "check this"): the teacher's
   * feedback may then judge "câu trả lời" (the learner's) or open with "Nhận xét:" and come
   * before a "Bản đã sửa:" of its own. Only words about the draft ("bản nháp", "Rà soát:") mark
   * the reviewer's notes then; a header alone does not end the opening sentences.
   */
  correction: boolean;
}

function cleanOnce(text: string, review: ReviewMode | null, found: Set<CleanKind>): string {
  const reasoning = stripReasoningOutsideCode(text);
  if (reasoning.removed) found.add('reasoning');
  const masked = mask(reasoning.text);
  const start = masked ? masked.text : reasoning.text;
  let out = removeBlocks(start, found);
  out = removeEchoLines(out, found);
  if (review) out = removeReviewWrapper(out, review, found);
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
 * The learner asked for a correction or a check ("sửa giúp em", "fix this"): a teacher's
 * feedback may then come before a "Bản đã sửa:" of its own, so that header alone, without a
 * remark about the draft before it, does not mark the reviewer's notes.
 */
function asksForCorrection(question: string): boolean {
  return /sửa|chỉnh|viết lại|kiểm tra|xem (?:lại|giúp|hộ)|chấm|góp ý|nhận xét|\b(?:correct|fix|revise|rewrite|edit|check|review|grade|feedback|improve)/iu.test(
    question.normalize('NFC'),
  );
}

/** A whole Vietnamese word or phrase out of `words` (letters around it break the match). */
const viWords = (words: string) => String.raw`(?<![\p{L}\p{M}])(?:${words})(?![\p{L}\p{M}])`;

/**
 * Words about the learner's own draft or answer (feedback they asked for, never the reviewer's
 * notes): "bản nháp của em", "bản nháp bạn gửi", "em đã viết bản nháp", "câu trả lời của em",
 * "your draft", "your answer", "the draft you…".
 */
const LEARNER_DRAFT: readonly RegExp[] = [
  /bản\s+nháp\s+(?:của\s+)?(?:các\s+)?(?:em|bạn|con|cậu)(?![\p{L}\p{M}])/giu,
  /(?<![\p{L}\p{M}])(?:em|bạn)(?:\s+[\p{L}\p{M}]+){0,3}\s+bản\s+nháp/giu,
  /(?:câu|bản)\s+trả\s+lời\s+(?:của\s+)?(?:các\s+)?(?:em|bạn|con|cậu)(?![\p{L}\p{M}])/giu,
  /\byour\s+(?:own\s+)?(?:[a-z]+\s+)?(?:draft|answer|response|solution)/gi,
  /\bthe\s+draft\s+you\b/gi,
];

/** A verdict on a text: "đúng", "thiếu đơn vị", "correct", "lacks units"… */
const VERDICT_VI = new RegExp(
  viWords(
    'đúng|sai|chính xác|thiếu|chưa|lỗi|nhầm|ổn|tốt|hợp lý|đầy đủ|rõ ràng|cần|sửa|chỉnh|bổ sung|cải thiện|bỏ sót',
  ),
  'iu',
);
const VERDICT_EN =
  /\b(?:correct|incorrect|wrong|error|mistake|accurate|inaccurate|missing|unclear|improv|fix|revis|review|lacks?|needs?|complete|incomplete)/i;
const hasVerdict = (t: string) => VERDICT_VI.test(t) || VERDICT_EN.test(t);

/** Words that only a reviewer writes about the draft it was given. */
const DRAFT_STRONG = [
  // "Nhận xét về bản nháp", "Rà soát bản nháp", "bản nháp trên": the draft under review.
  new RegExp(
    `${viWords('nhận xét|đánh giá|rà soát|ghi chú|lưu ý')}(?:\\s+(?:chung|thêm|lại))?\\s+(?:về\\s+|cho\\s+|của\\s+)?bản\\s+nháp|bản\\s+nháp\\s+${viWords('trên|ban đầu|gốc|đã cho|được cung cấp|được đưa ra')}`,
    'iu',
  ),
  new RegExp(labelCore(REVIEW_DRAFT_LABEL.vi).replace(/\s+/g, String.raw`\s+`), 'iu'),
  /\bdraft\s+(?:answer|response|solution|version|lesson)\b/i,
  /\b(?:original|initial|previous|first)\s+draft\b/i,
  /\bthe\s+draft['’]s\b/i,
];
/** "Bản nháp đúng": a draft with a verdict (a lesson may name a report's "bản nháp"). */
const DRAFT_VI = /bản\s+nháp/iu;
/** "The draft is correct": a draft (not "the draft of a ship") and a verdict. */
const DRAFT_EN = /\b(?:the|this)\s+draft\b(?!\s+(?:of|for)\b)/i;
/** "Câu trả lời ban đầu", "the original answer": the answer under review, with a verdict. */
const ANSWER_UNDER_REVIEW = new RegExp(
  `(?:câu|bản)\\s+trả\\s+lời\\s+${viWords('ban đầu|trên|gốc|cần rà soát|được cung cấp|được đưa ra')}|\\bthe\\s+(?:original|initial|above|given|provided|previous)\\s+(?:answer|response|solution)\\b|\\bthe\\s+(?:answer|response|solution)\\s+above\\b`,
  'iu',
);
/** A reviewer's label opening the sentence: "Review:", "**Đánh giá:**", "Rà soát:". */
const REVIEW_LABEL =
  /^[\s>#*_-]*(?:review|feedback|assessment|verdict|nhận xét|đánh giá|rà soát)[*_]*\s*[:：][*_]*\s*/iu;
/** After the label, the answer itself ("Câu trả lời đúng…", "The answer is correct…"). */
const ANSWER_ANY = /^(?:(?:câu|bản)\s+trả\s+lời|(?:the|this)\s+(?:answer|response|solution)\b)/iu;
/** After the label, a bare verdict ("Đúng.", "Correct, but…"); "sai số" is no verdict. */
const BARE_VERDICT =
  /^(?:(?:rất|hoàn toàn|nhìn chung|về cơ bản|mostly|fully|largely)\s+)?(?:đúng|chính xác|ổn|hợp lý|correct|incorrect|accurate|inaccurate|wrong)[*_]*\s*(?:[.,;!]|$)/iu;
/** "Rà soát xong, …", "Rà soát cho thấy …": a review reported without a label. */
const REVIEW_DONE =
  /^[\s>#*_-]*rà\s+soát[*_]*\s+(?:xong|cho\s+thấy|không\s+(?:thấy|phát\s+hiện))/iu;
/** A closing paragraph that opens by naming the draft as its topic. */
const DRAFT_TOPIC =
  /^[\s>#*_-]*(?:(?:nhận xét|đánh giá|ghi chú|lưu ý)(?:\s+(?:chung|thêm))?\s+(?:về\s+|cho\s+)?bản\s+nháp|(?:notes?|comments?|review)\s+(?:on|about|of)\s+the\s+draft)/iu;

/** The text with the learner's own draft taken out, for the tests below only. */
function reviewerWords(text: string): string {
  return LEARNER_DRAFT.reduce((t, re) => t.replace(re, ' … '), text.normalize('NFC'));
}

/**
 * What a sentence is to the reviewer's wrapper. `remark`: about the draft or the answer under
 * review ("Bản nháp đúng.", "Review: The answer is correct…", "Đánh giá: Đúng."). `tentative`: a
 * reviewer's label with a verdict on something else ("Nhận xét: bước 2 sai."); a teacher may write
 * that too, so it goes only when a reviewer-only header follows it. With `correction` (the learner
 * asked for one), only words about the draft count: "câu trả lời" and "Nhận xét:" may then be
 * the teacher's feedback on the learner's answer.
 */
function remarkKind(text: string, correction: boolean): 'remark' | 'tentative' | null {
  const t = reviewerWords(text);
  if (
    DRAFT_STRONG.some((re) => re.test(t)) ||
    ((DRAFT_VI.test(t) || DRAFT_EN.test(t)) && hasVerdict(t)) ||
    REVIEW_DONE.test(t)
  ) {
    return 'remark';
  }
  const label = REVIEW_LABEL.exec(t);
  // "Rà soát:" names the review itself.
  if (label && /rà\s+soát/iu.test(label[0])) return 'remark';
  if (correction) return null;
  if (ANSWER_UNDER_REVIEW.test(t) && hasVerdict(t)) return 'remark';
  if (!label) return null;
  const rest = t.slice(label[0].length);
  if ((ANSWER_ANY.test(rest) && hasVerdict(rest)) || BARE_VERDICT.test(rest)) return 'remark';
  return hasVerdict(rest) ? 'tentative' : null;
}

const aboutDraft = (text: string, correction: boolean) => remarkKind(text, correction) === 'remark';

/**
 * The remark goes on after "nhưng", "rằng", "but", "that"… with more than a few words: it may
 * state a fact the learner needs ("Bản nháp đúng nhưng cần nói rõ rằng gia tốc rơi tự do không
 * phụ thuộc khối lượng."), so it stays unless a revision header follows it.
 */
const GOES_ON = new RegExp(
  `${viWords('nhưng|tuy nhiên|song|rằng')}|\\b(?:but|however|though|although|that)\\b`,
  'iu',
);
const GOES_ON_WORDS = 6;

function goesOn(remark: string): boolean {
  const m = GOES_ON.exec(remark);
  if (!m) return false;
  const words = remark.slice(m.index + m[0].length).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  return words.length > GOES_ON_WORDS;
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
function reviewerLead(before: string, correction: boolean): boolean {
  const rest = before.replace(INTRO_END, '');
  return rest.replace(/[\s>#*_~\-–—:.,]/gu, '') === '' || aboutDraft(rest, correction);
}

/**
 * End (within `unit`) of the last revision header that only reviewer words precede, or -1.
 * `lineEnd`: the unit ends its line, so a header without ":" may stand at its end. `strongOnly`:
 * only a phrase that a teacher never writes counts.
 */
function revisionHeaderEnd(
  unit: string,
  lineEnd: boolean,
  strongOnly: boolean,
  correction: boolean,
): number {
  let end = -1;
  for (const m of unit.matchAll(HEADER_PHRASE)) {
    if (strongOnly && m[1] !== undefined) continue;
    const after = m.index + m[0].length;
    const tail = HEADER_TAIL.exec(unit.slice(after));
    if (!tail) continue;
    const closed = /[:：]/u.test(tail[0]);
    if (!closed && !lineEnd) continue;
    if (reviewerLead(unit.slice(0, m.index), correction)) end = after + tail[0].length;
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
const NEUTRAL_LABEL = /^(?:nhận xét|đánh giá|rà soát|review|feedback|comments?|notes?)$/iu;
/** Lesson structure, never part of a reviewer's remarks: a tag, code or LaTeX. */
const STRUCTURE = /<\/?[a-z]|\u{E000}|[$\\]/iu;
const HEADING_START = /^[ \t]*(?:>[ \t]*)*#{1,6}[ \t]/u;
/**
 * After the opening remarks, at most this much text that does not name the draft ("Tuy nhiên,
 * bước 2 thiếu đơn vị.") still belongs to the reviewer when a revision header follows it.
 */
const GAP_UNITS = 4;
const GAP_CHARS = 500;

interface Gap {
  start: number;
  units: number;
  /**
   * Before any remark: only a reviewer-only header alone on its line ends it, and a sentence
   * with learning material ends the scan (unless it is a tentative remark).
   */
  early: boolean;
}

function removeReviewWrapper(text: string, review: ReviewMode, found: Set<CleanKind>): string {
  // Leading, sentence by sentence: remarks about the draft and revision headers. `cut` moves past
  // a remark holding learning material, or going on with more than a few words, only when a
  // header follows it (`held`). Once the answer opened with a remark, a few sentences that do not
  // name the draft (`gap`) go only when a reviewer-only header ("Bản đã sửa:") follows them,
  // before any lesson structure. Before any remark (`early`), the same holds for a tentative
  // remark and for sentences without learning material, when that header stands alone on its
  // line; not when the learner asked for a correction.
  const { correction } = review;
  let cut = 0;
  let held = false;
  let opened = false;
  let gap: Gap | null = null;
  let lesson = -1;
  for (const u of units(text)) {
    const unit = text.slice(u.start, u.end);
    if (!unit.trim()) continue;
    const lineEnd = u.end === text.length || text[u.end] === '\n';
    // A weak header ("Câu trả lời cuối cùng:") counts only right after the reviewer's remarks.
    const header = revisionHeaderEnd(unit, lineEnd, gap !== null || !opened, correction);
    if (header >= 0) {
      const after = text.slice(u.start + header, u.end).trim();
      // "Bản đã sửa: lực là vectơ." after a sentence that is no remark is a teacher's correction.
      if (gap?.early && (after || !lineEnd)) break;
      cut = u.start + header;
      held = false;
      opened = true;
      gap = null;
      if (after) {
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
      if (gap.early && holdsMaterial(unit) && remarkKind(unit, correction) !== 'tentative') break;
      continue;
    }
    if (NEUTRAL_LABEL.test(labelCore(unit))) continue;
    const kind = remarkKind(unit, correction);
    if (kind === 'remark') {
      opened = true;
      if (held || holdsMaterial(unit) || goesOn(unit)) held = true;
      else cut = u.end;
      continue;
    }
    if (!opened) {
      if (correction || structure || (kind !== 'tentative' && holdsMaterial(unit))) {
        lesson = u.start;
        break;
      }
      gap = { start: u.start, units: 1, early: true };
      continue;
    }
    gap = { start: u.start, units: 1, early: false };
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
