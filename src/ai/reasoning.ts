/**
 * A model's hidden reasoning (<think>…</think> and friends) is never shown, spoken or written on
 * the board. One rule, shared with the Rust side (src-tauri/src/ai/reasoning.rs) through the
 * vectors in tests/fixtures/reasoning-strip.json (read the "about" fields there):
 *
 * Tags: `think`, `thinking`, `reasoning`, `reflection`, ASCII case-insensitive, with optional
 * attributes (`<think type="x">`). A name followed by more letters (`<thinker>`) is not a tag, and
 * neither is `<y` in `$x<y$`. `<think/>` and `<think />` are self-closing: an empty block.
 *
 * Code: a closed code fence (a line of at least three backticks or tildes, closed by a later line
 * of at least as many of the same mark) and inline code (`…` on one line) are found first
 * (`codeSpans`). An opening or self-closing tag in code is code, not reasoning; so is a closing
 * tag in code once an opening tag of the same name was written in code before it. Any other
 * closing tag counts even in code (it ends a block, or marks reasoning whose opening tag a chat
 * template pre-filled); when it is all its code span holds ("`</think>`", or a fence holding only
 * it), the backticks or fence lines go with it.
 *
 * 1. Every closed block `<name …>…</name>` (same name; the first such closing tag) is removed,
 *    together with the spaces or tabs right after it. A self-closing tag is an empty block.
 * 2. An opening tag left without its closing tag: everything from it to the end is removed
 *    (`unclosed`, e.g. an answer stopped at the output limit).
 * 3. A closing tag outside a block (no opening tag left for it): everything up to and including it
 *    is removed, plus the spaces or tabs after it (the LAST such tag wins).
 * 4. When anything was removed, leading and trailing whitespace is trimmed; when nothing was
 *    removed the text is returned unchanged.
 *
 * `stripReasoning` is that rule, the one Rust applies to every answer and the stream filters
 * (`ThinkFilter` in thinkFilter.ts, `ReasoningStream` in Rust) end with. `hideUnfinishedReasoning`
 * is what a stream shows before its end: the rule applied to the text up to the first tag that is
 * not decided yet (a tag still being typed, or one that may still turn out to be code).
 * `stripReasoningOutsideCode` is what the page uses on a whole answer (chat, voice, board): the
 * same tags and code, plus a nested block ending at its balancing tag and a stray closing tag
 * after a block removed as a tag (its neighbours kept).
 *
 * Positions are UTF-16 indices; every character the rule looks at is ASCII, so Rust's byte
 * indices find the same places.
 */

/** The tag names of hidden reasoning (lower case). */
export const REASONING_TAGS = ['think', 'thinking', 'reasoning', 'reflection'] as const;
export type ReasoningName = (typeof REASONING_TAGS)[number];

/** Length of the longest name: a longer run of letters after '<' is never a tag. */
const MAX_NAME = 10;

const LT = 60;
const GT = 62;
const SLASH = 47;
const BACKTICK = 96;
const TILDE = 126;
const NL = 10;
const CR = 13;
const SPACE = 32;
const TAB = 9;

export interface StrippedReasoning {
  text: string;
  /** Something was removed. */
  removed: boolean;
  /** An opening tag had no closing tag: everything after it was cut. */
  unclosed: boolean;
}

function isAsciiLetter(c: number): boolean {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}

/** Rust's `u8::is_ascii_whitespace`: space, \t, \n, \f and \r (not \v). */
function isAsciiSpace(c: number): boolean {
  return c === SPACE || c === TAB || c === NL || c === 12 || c === CR;
}

/** Blank in code content: a span holding only a tag and these holds only the tag. */
function isContentSpace(c: number): boolean {
  return c === SPACE || c === TAB || c === NL || c === CR;
}

/** End of the letters of a possible tag name from `i` (at most one more than MAX_NAME). */
function nameEnd(s: string, i: number, end: number): number {
  const start = i;
  while (i < end && i - start <= MAX_NAME && isAsciiLetter(s.charCodeAt(i))) i++;
  return i;
}

function nameAt(s: string, from: number, to: number): ReasoningName | undefined {
  const word = s.slice(from, to).toLowerCase();
  return REASONING_TAGS.find((n) => n === word);
}

export type TagKind = 'open' | 'close' | 'empty';

/** A reasoning tag found in the text. */
export interface ReasoningTag {
  /** Index of its '<'. */
  start: number;
  /** Index just after its '>'. */
  end: number;
  name: ReasoningName;
  /** `empty`: self-closing (`<think/>`, `<think />`). */
  kind: TagKind;
}

/** The reasoning tag starting at `at` (which holds '<'), reading no further than `end`. */
export function tagAt(s: string, at: number, end: number): ReasoningTag | null {
  let i = at + 1;
  const closing = i < end && s.charCodeAt(i) === SLASH;
  if (closing) i++;
  const nameStart = i;
  i = nameEnd(s, i, end);
  const name = nameAt(s, nameStart, i);
  if (name === undefined) return null;
  if (closing) {
    while (i < end && isAsciiSpace(s.charCodeAt(i))) i++;
    return i < end && s.charCodeAt(i) === GT
      ? { start: at, end: i + 1, name, kind: 'close' }
      : null;
  }
  if (i >= end) return null;
  const c = s.charCodeAt(i);
  if (c === GT) return { start: at, end: i + 1, name, kind: 'open' };
  if (c === SLASH) {
    return i + 1 < end && s.charCodeAt(i + 1) === GT
      ? { start: at, end: i + 2, name, kind: 'empty' }
      : null;
  }
  if (!isAsciiSpace(c)) return null;
  // Attributes run to the next '>'; another '<' first means this is not a tag. A '/' right
  // before the '>' (blanks aside) makes it self-closing.
  for (let k = i; k < end; k++) {
    const b = s.charCodeAt(k);
    if (b === GT) {
      let last = k - 1;
      while (last > i && isAsciiSpace(s.charCodeAt(last))) last--;
      const kind: TagKind = s.charCodeAt(last) === SLASH ? 'empty' : 'open';
      return { start: at, end: k + 1, name, kind };
    }
    if (b === LT) return null;
  }
  return null;
}

/** The next reasoning tag in `s[from..end]`. */
export function nextTag(s: string, from: number, end: number): ReasoningTag | null {
  let pos = from;
  while (pos < end) {
    const k = s.indexOf('<', pos);
    if (k < 0 || k >= end) return null;
    const tag = tagAt(s, k, end);
    if (tag) return tag;
    pos = k + 1;
  }
  return null;
}

/** Skips the spaces and tabs at `from`. */
export function skipBlanks(s: string, from: number, end: number): number {
  while (from < end) {
    const c = s.charCodeAt(from);
    if (c !== SPACE && c !== TAB) break;
    from++;
  }
  return from;
}

// ------------------------------------------------------------ tags still being typed

/** What a possible tag at the end of a text still waits for. */
export type Wait =
  /** "<", "</", "<thi", "</think": the name may still grow. */
  | 'name'
  /** "<think type=\"x": an opening (or self-closing) tag waiting for its '>'. */
  | 'attrs'
  /** "</think  ": a closing tag waiting for its '>'. */
  | 'closeSpace'
  /** "<think/": a self-closing tag waiting for its '>'. */
  | 'slash';

/**
 * `s[start]` is '<' and `s[start+1..]` holds no other '<': what it waits for while it may still
 * become a reasoning tag, or null when it is already a whole tag or can never be one. Either
 * answer is final once null: more text cannot make it a possible tag again.
 */
export function partialWait(s: string, start: number): Wait | null {
  const end = s.length;
  let i = start + 1;
  const closing = i < end && s.charCodeAt(i) === SLASH;
  if (closing) i++;
  const nameStart = i;
  i = nameEnd(s, i, end);
  const word = s.slice(nameStart, i).toLowerCase();
  if (i === end) return REASONING_TAGS.some((n) => n.startsWith(word)) ? 'name' : null;
  if (!REASONING_TAGS.some((n) => n === word)) return null;
  if (closing) {
    for (let k = i; k < end; k++) if (!isAsciiSpace(s.charCodeAt(k))) return null;
    return 'closeSpace';
  }
  const c = s.charCodeAt(i);
  if (c === SLASH) return i + 1 === end ? 'slash' : null;
  if (!isAsciiSpace(c)) return null;
  for (let k = i; k < end; k++) if (s.charCodeAt(k) === GT) return null;
  return 'attrs';
}

/** Index of a possible tag still being typed at the end of `raw`, or `raw.length`. */
export function partialTagStart(raw: string): number {
  const lt = raw.lastIndexOf('<');
  return lt >= 0 && partialWait(raw, lt) !== null ? lt : raw.length;
}

// ------------------------------------------------------------ code

/** Inline code or a closed code fence. */
export interface CodeSpan {
  /** The span with its dressing: from the first backtick (fence: its first line's start)… */
  start: number;
  /** …to just after the last backtick (fence: the end of its closing line, before its "\n"). */
  end: number;
  /** A tag whose '<' is in `[from, to)` is in code (inline: between the backticks; fence: all). */
  from: number;
  to: number;
  /** First and last index of the content that is not a space, tab, CR or LF (-1: none). */
  first: number;
  last: number;
}

/** The span holds the tag and blanks only (its dressing then goes with the tag). */
function holdsOnly(span: CodeSpan, tag: ReasoningTag): boolean {
  return span.first === tag.start && span.last === tag.end - 1;
}

/** The content bounds of `s[from..to)`. */
function contentBounds(s: string, from: number, to: number): { first: number; last: number } {
  let first = -1;
  let last = -1;
  for (let p = from; p < to; p++) {
    if (isContentSpace(s.charCodeAt(p))) continue;
    if (first < 0) first = p;
    last = p;
  }
  return { first, last };
}

/** A line of only blanks, at least `run` of `mark`, then spaces, tabs or a CR. */
function closesFence(s: string, from: number, to: number, mark: number, run: number): boolean {
  let k = skipBlanks(s, from, to);
  const start = k;
  while (k < to && s.charCodeAt(k) === mark) k++;
  if (k - start < run) return false;
  for (; k < to; k++) {
    const c = s.charCodeAt(k);
    if (c !== SPACE && c !== TAB && c !== CR) return false;
  }
  return true;
}

/**
 * The closed fence opening at the line starting at `lineStart`: 'open' when (with `partial`) its
 * closing line may still come, null when there is none. `failed` remembers, per mark, the
 * shortest run that found no closing line: a longer one later cannot find one either.
 */
function fenceAt(
  s: string,
  lineStart: number,
  partial: boolean,
  failed: Map<number, number>,
): CodeSpan | 'open' | null {
  const n = s.length;
  const k = skipBlanks(s, lineStart, n);
  const mark = k < n ? s.charCodeAt(k) : -1;
  if (mark !== BACKTICK && mark !== TILDE) return null;
  let r = k;
  while (r < n && s.charCodeAt(r) === mark) r++;
  const run = r - k;
  if (run < 3) return null;
  const eol = s.indexOf('\n', r);
  if (eol < 0) return partial ? 'open' : null;
  if (!partial && run >= (failed.get(mark) ?? Infinity)) return null;
  let first = -1;
  let last = -1;
  for (let ls = eol + 1; ls <= n;) {
    let le = s.indexOf('\n', ls);
    const complete = le >= 0;
    if (!complete) le = n;
    // While text still arrives (`partial`), only a whole line closes a fence.
    if ((complete || !partial) && closesFence(s, ls, le, mark, run)) {
      return { start: lineStart, end: le, from: lineStart, to: le, first, last };
    }
    if (!complete) break;
    const b = contentBounds(s, ls, le);
    if (b.first >= 0) {
      if (first < 0) first = b.first;
      last = b.last;
    }
    ls = le + 1;
  }
  if (partial) return 'open';
  failed.set(mark, Math.min(failed.get(mark) ?? Infinity, run));
  return null;
}

/**
 * The code spans of a text, in order: at a line start a fence is tried first, otherwise a backtick
 * starts inline code that ends at the next backtick on the same line (`` `` `` holds nothing, so
 * its second backtick may start one). With `partial` (text still arriving), `open` is where code
 * that is not decided yet starts (a fence or a backtick still waiting for its end); otherwise, or
 * when there is none, it is the text's length.
 */
export function codeSpans(text: string, partial = false): { spans: CodeSpan[]; open: number } {
  const n = text.length;
  const spans: CodeSpan[] = [];
  const failed = new Map<number, number>();
  let i = 0;
  while (i < n) {
    if (i === 0 || text.charCodeAt(i - 1) === NL) {
      const fence = fenceAt(text, i, partial, failed);
      if (fence === 'open') return { spans, open: i };
      if (fence) {
        spans.push(fence);
        i = fence.end;
        continue;
      }
    }
    if (text.charCodeAt(i) !== BACKTICK) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < n) {
      const c = text.charCodeAt(j);
      if (c === BACKTICK || c === NL) break;
      j++;
    }
    if (j < n && text.charCodeAt(j) === BACKTICK && j > i + 1) {
      spans.push({ start: i, end: j + 1, from: i + 1, to: j, ...contentBounds(text, i + 1, j) });
      i = j + 1;
      continue;
    }
    if (j === n && partial) return { spans, open: i };
    // A newline ends the attempt; a second backtick right away may start the next one.
    i = j;
  }
  return { spans, open: n };
}

/** A tag with what it is in this text. */
export interface PlacedTag extends ReasoningTag {
  /** Written as code: not reasoning. */
  inert: boolean;
  /** What goes with the tag: the tag, or its whole code span when the span holds only it. */
  cutStart: number;
  cutEnd: number;
}

/**
 * Places tags one by one, in order, against the code spans: an opening or self-closing tag in
 * code is code, and so is a closing tag in code after an opening tag of the same name in code.
 * The stream filter uses it too, with the spans it finds as text arrives.
 */
export class TagPlacer {
  private next = 0;
  private readonly openedInCode = new Set<ReasoningName>();

  constructor(private readonly spans: readonly CodeSpan[]) {}

  /** `tag`, found `offset` characters into the text; tags must come in order. */
  place(tag: ReasoningTag, offset = 0): PlacedTag {
    const start = tag.start + offset;
    const end = tag.end + offset;
    let span = this.spans[this.next];
    while (span && span.end <= start) span = this.spans[++this.next];
    const placed = { ...tag, start, end, inert: false, cutStart: start, cutEnd: end };
    if (!span || start < span.from || start >= span.to) return placed;
    if (tag.kind === 'open') {
      this.openedInCode.add(tag.name);
      placed.inert = true;
    } else if (tag.kind === 'empty' || this.openedInCode.has(tag.name)) {
      placed.inert = true;
    } else if (holdsOnly(span, placed)) {
      placed.cutStart = span.start;
      placed.cutEnd = span.end;
    }
    return placed;
  }
}

/** Every tag of a text, placed against `spans` (by default, the text's own code spans). */
function placedTags(text: string, spans: readonly CodeSpan[] = codeSpans(text).spans): PlacedTag[] {
  const placer = new TagPlacer(spans);
  const out: PlacedTag[] = [];
  for (let t = nextTag(text, 0, text.length); t; t = nextTag(text, t.end, text.length)) {
    out.push(placer.place(t));
  }
  return out;
}

// ------------------------------------------------------------ the rule

interface ScanMode {
  /** A block ends at the closing tag that balances it (`<think>a<think>b</think>c</think>`). */
  nested: boolean;
  /** A closing tag outside a block after a first opening tag goes alone, its neighbours kept. */
  strayAsTag: boolean;
  /** Code is set apart (off only for `stripAllReasoning`). */
  code: boolean;
  /**
   * The code spans to read, when they were found in a longer text than `text` (the preview: code
   * closed after the point where the shown text stops is still code).
   */
  spans?: readonly CodeSpan[];
}

function scan(text: string, mode: ScanMode): StrippedReasoning {
  const tags = mode.code
    ? placedTags(text, mode.spans)
    : (() => {
        const out: PlacedTag[] = [];
        for (let t = nextTag(text, 0, text.length); t; t = nextTag(text, t.end, text.length)) {
          out.push({ ...t, inert: false, cutStart: t.start, cutEnd: t.end });
        }
        return out;
      })();
  const n = text.length;
  let kept = '';
  let seg = 0;
  let removed = false;
  let opened = false;
  let block: { name: ReasoningName; depth: number } | null = null;
  for (const t of tags) {
    if (t.inert) continue;
    if (block) {
      if (t.name !== block.name || t.kind === 'empty') continue;
      if (t.kind === 'open') {
        if (mode.nested) block.depth++;
        continue;
      }
      if (--block.depth > 0) continue;
      // Rule 1: the block is closed.
      block = null;
      seg = skipBlanks(text, t.cutEnd, n);
      continue;
    }
    removed = true;
    if (t.kind === 'close') {
      // Rule 3 (or, for the page, a stray tag after a block that goes alone).
      if (mode.strayAsTag && opened) kept += text.slice(seg, Math.max(seg, t.cutStart));
      else kept = '';
      seg = skipBlanks(text, t.cutEnd, n);
    } else if (t.kind === 'empty') {
      kept += text.slice(seg, Math.max(seg, t.cutStart));
      seg = skipBlanks(text, t.cutEnd, n);
    } else {
      opened = true;
      kept += text.slice(seg, Math.max(seg, t.cutStart));
      block = { name: t.name, depth: 1 };
    }
  }
  if (!removed) return { text, removed: false, unclosed: false };
  // Rule 2: an unclosed block takes everything after its opening tag.
  if (!block) kept += text.slice(seg);
  return { text: kept.trim(), removed: true, unclosed: block !== null };
}

/** Removes hidden reasoning with the shared rule (see the file comment). */
export function stripReasoning(text: string): StrippedReasoning {
  return scan(text, { nested: false, strayAsTag: false, code: true });
}

/** Repeats a page pass until nothing changes (removing a tag can join the pieces of another). */
function untilStable(text: string, mode: ScanMode): StrippedReasoning {
  let out = text;
  let removed = false;
  let unclosed = false;
  // Every pass that removes something makes the text shorter, so this ends.
  for (;;) {
    const pass = scan(out, mode);
    if (!pass.removed) break;
    removed = true;
    unclosed ||= pass.unclosed;
    out = pass.text;
  }
  return removed ? { text: out, removed, unclosed } : { text, removed, unclosed };
}

/**
 * The page's rule without code set apart: a block ends at the closing tag that balances it
 * ("<think>a<think>b</think>c</think>d" → "d"), a closing tag before any opening tag removes what
 * comes before it, and a closing tag left after a block is removed as a tag, its neighbours kept
 * ("a <think>x</think> b </think> c" → "a b c"). Repeated until nothing changes, so the result
 * holds no reasoning tag and a second call changes nothing.
 */
export function stripAllReasoning(text: string): StrippedReasoning {
  return untilStable(text, { nested: true, strayAsTag: true, code: false });
}

/**
 * What the app uses on a whole answer (chat, voice, board): `stripAllReasoning` with code set
 * apart as in `stripReasoning` ("Qwen dùng thẻ `<think>`" is code; "`</think>`" alone in code
 * still counts and takes its backticks with it).
 */
export function stripReasoningOutsideCode(text: string): StrippedReasoning {
  return untilStable(text, { nested: true, strayAsTag: true, code: true });
}

/**
 * Where a stream's shown text ends: before a tag still being typed at the very end ("<thi",
 * "<think type=\"x"), or before the first tag that may still turn out to be code (inside a fence
 * or after a backtick still waiting for their end). Text without tags after that point is shown.
 */
export function previewEnd(raw: string): number {
  return previewCut(raw, codeSpans(raw, true).open);
}

/** `previewEnd` with the start of undecided code (`codeSpans(raw, true).open`) already known. */
function previewCut(raw: string, open: number): number {
  let cut = partialTagStart(raw);
  if (open < cut) {
    const tag = nextTag(raw, open, cut);
    if (tag) cut = tag.start;
  }
  return cut;
}

/**
 * The answer so far, for a streaming preview: the shared rule applied up to `previewEnd`, with the
 * code spans of everything received (a fence or a backtick closed after that point still makes
 * the tags before it code: "```\n<think />\n<think \n```\n" shows "```\n<think />\n"). An
 * unfinished block hides everything after its opening tag; a closing tag left without its opening
 * tag (pre-filled template) can only be recognised once it has arrived.
 *
 * The one preview rule. This is its whole-text form, for a caller that gets the raw answer so far
 * (the Gemma worker's partial answers in chatService.ts); `ThinkFilter` (thinkFilter.ts) and
 * Rust's `ReasoningStream` are its incremental form for streams and show exactly this after every
 * piece (tested on every shared vector cut at every character, and on random streams with code).
 * A stream's shown text is already filtered: it is never passed through this again.
 */
export function hideUnfinishedReasoning(partial: string): string {
  const { spans, open } = codeSpans(partial, true);
  const shown = partial.slice(0, previewCut(partial, open));
  return scan(shown, { nested: false, strayAsTag: false, code: true, spans }).text;
}

/** The text is one whole JSON value (Rust's `is_json`). */
function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The text of a whole answer a learner may see, as the Rust gateway gives every answer
 * (`visible_answer`, `visible_structured`): reasoning removed with the shared rule, or `null` when
 * the answer was nothing but reasoning (the caller reports "reasoningOnly"). With `structured` (a
 * JSON schema request), a whole JSON value is kept exactly as sent: a string in it may hold
 * "</think>" as data.
 */
export function visibleAnswer(text: string, structured = false): string | null {
  if (structured && isJson(text)) return text;
  const s = stripReasoning(text);
  return s.removed && s.text.trim() === '' ? null : s.text;
}
