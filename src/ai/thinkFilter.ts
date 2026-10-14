/**
 * Removes a model's internal reasoning ("<think>…</think>" and friends) from an answer that
 * arrives in pieces, so the chat, the board and the voice only ever get learning content. The
 * web-side twin of `ReasoningStream` in src-tauri/src/ai/reasoning.rs, used where the page reads
 * a stream itself (the browser transport and the browser client for local runtimes); in the
 * desktop app Rust has already filtered the text.
 *
 * The rule is the shared one, pinned by tests/fixtures/reasoning-strip.json (src/ai/reasoning.ts
 * and src-tauri/src/ai/reasoning.rs test the same vectors):
 *
 * Tag names: `think`, `thinking`, `reasoning`, `reflection`, ASCII case-insensitive, with optional
 * attributes (`<think type="x">`). A name followed by more letters (`<thinker>`) is not a tag, and
 * neither is `<y` in `$x<y$`.
 *
 * 1. Every closed block `<name …>…</name>` (same name) is removed, together with the spaces or
 *    tabs right after its closing tag.
 * 2. An opening tag left without its closing tag: everything from it to the end is removed.
 * 3. A closing tag with no opening tag before it: everything up to and including the LAST such
 *    closing tag is removed, plus the spaces or tabs after it.
 * 4. When anything was removed, leading and trailing whitespace is trimmed; when nothing was
 *    removed the text is returned unchanged.
 *
 * While streaming, reasoning inside a block is never shown, a piece that may be the start of a
 * tag is held back until it is complete, and the final text is always exactly the rule applied to
 * everything received. Rule 3 cannot be applied before its closing tag arrives, so streamed text
 * is provisional: a late closing tag takes back what was shown with a `reset` event.
 *
 * Linear time: the scan resumes where it stopped, only the possibly unfinished tag at the end is
 * kept for the next piece, and the whole answer is read only at the end (JavaScript strings built
 * with `+=` are copied when read, so nothing here reads the growing answer while it streams).
 */
import type { StreamEvent } from './types';

/** Reasoning tag names (lower case). */
const NAMES = ['think', 'thinking', 'reasoning', 'reflection'] as const;
type Name = (typeof NAMES)[number];

/** Length of the longest name: a longer run of letters after '<' is never a tag. */
const MAX_NAME = 10;

const LT = 60;
const GT = 62;
const SLASH = 47;

function isAsciiLetter(c: number): boolean {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}

/** Rust's `u8::is_ascii_whitespace`: space, \t, \n, \f and \r (not \v). */
function isAsciiSpace(c: number): boolean {
  return c === 32 || c === 9 || c === 10 || c === 12 || c === 13;
}

/** End of the letters of a possible tag name from `i` (at most one more than MAX_NAME). */
function nameEnd(s: string, i: number, end: number): number {
  const start = i;
  while (i < end && i - start <= MAX_NAME && isAsciiLetter(s.charCodeAt(i))) i++;
  return i;
}

/** The tag name written at `s[from..to]` (ASCII letters only), if it is one. */
function nameAt(s: string, from: number, to: number): Name | undefined {
  const word = s.slice(from, to).toLowerCase();
  return NAMES.find((n) => n === word);
}

interface Tag {
  /** Index of its '<'. */
  start: number;
  /** Index just after its '>'. */
  end: number;
  name: Name;
  closing: boolean;
}

/** The reasoning tag starting at `at` (which holds '<'), reading no further than `end`. */
function tagAt(s: string, at: number, end: number): Tag | null {
  let i = at + 1;
  const closing = i < end && s.charCodeAt(i) === SLASH;
  if (closing) i++;
  const nameStart = i;
  i = nameEnd(s, i, end);
  const name = nameAt(s, nameStart, i);
  if (name === undefined) return null;
  if (closing) {
    while (i < end && isAsciiSpace(s.charCodeAt(i))) i++;
    return i < end && s.charCodeAt(i) === GT ? { start: at, end: i + 1, name, closing } : null;
  }
  if (i >= end) return null;
  const c = s.charCodeAt(i);
  if (c === GT) return { start: at, end: i + 1, name, closing };
  if (!isAsciiSpace(c)) return null;
  // Attributes run to the next '>'; another '<' first means this is not a tag.
  for (let k = i; k < end; k++) {
    const b = s.charCodeAt(k);
    if (b === GT) return { start: at, end: k + 1, name, closing };
    if (b === LT) return null;
  }
  return null;
}

/** The next reasoning tag in `s[from..end]`. */
function nextTag(s: string, from: number, end: number): Tag | null {
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

/** The first closing tag named `name` in `s[from..end]`. */
function closingTag(s: string, from: number, end: number, name: Name): Tag | null {
  let pos = from;
  for (;;) {
    const tag = nextTag(s, pos, end);
    if (!tag) return null;
    if (tag.closing && tag.name === name) return tag;
    pos = tag.start + 1;
  }
}

/** Skips the spaces and tabs at `from`. */
function skipBlanks(s: string, from: number, end: number): number {
  while (from < end) {
    const c = s.charCodeAt(from);
    if (c !== 32 && c !== 9) break;
    from++;
  }
  return from;
}

/** The result of the rule applied to a whole answer. */
export interface Stripped {
  text: string;
  /** Something was removed. */
  removed: boolean;
  /** An opening tag had no closing tag (the answer was probably cut while reasoning). */
  unclosed: boolean;
}

/**
 * The rule applied to a whole answer: what `ThinkFilter.finish` returns for everything received,
 * and the same result as `stripReasoning` in src/ai/reasoning.ts (both are pinned by
 * tests/fixtures/reasoning-strip.json). Kept here so the stream filter stands on its own.
 */
export function stripWhole(text: string): Stripped {
  const end = text.length;
  let kept = '';
  let seg = 0;
  let pos = 0;
  let removed = false;
  let unclosed = false;
  for (;;) {
    const tag = nextTag(text, pos, end);
    if (!tag) break;
    removed = true;
    if (tag.closing) {
      // Rule 3: an orphan closing tag removes everything before it.
      kept = '';
    } else {
      kept += text.slice(seg, tag.start);
      const close = closingTag(text, tag.end, end, tag.name);
      if (!close) {
        // Rule 2: unclosed, everything to the end goes.
        unclosed = true;
        break;
      }
      // Rule 1: a closed block.
      seg = skipBlanks(text, close.end, end);
      pos = seg;
      continue;
    }
    seg = skipBlanks(text, tag.end, end);
    pos = seg;
  }
  if (!removed) return { text, removed: false, unclosed: false };
  if (!unclosed) kept += text.slice(seg);
  return { text: kept.trim(), removed: true, unclosed };
}

/** What a possible tag at the end of a streamed text still waits for. */
type Wait =
  /** "<", "</", "<thi", "</think": the name may still grow. */
  | 'name'
  /** "<think type=\"x": an opening tag waiting for its '>'. */
  | 'attrs'
  /** "</think  ": a closing tag waiting for its '>'. */
  | 'closeSpace';

/**
 * `s[start]` is '<' and `s[start+1..]` holds no other '<': what it waits for while it may still
 * become a reasoning tag, or null when it is already a whole tag or can never be one. Either
 * answer is final once null: more text cannot make it a possible tag again.
 */
function partialWait(s: string, start: number): Wait | null {
  const end = s.length;
  let i = start + 1;
  const closing = i < end && s.charCodeAt(i) === SLASH;
  if (closing) i++;
  const nameStart = i;
  i = nameEnd(s, i, end);
  const word = s.slice(nameStart, i).toLowerCase();
  if (i === end) {
    return NAMES.some((n) => n.startsWith(word)) ? 'name' : null;
  }
  if (!NAMES.some((n) => n === word)) return null;
  if (closing) {
    for (let k = i; k < end; k++) if (!isAsciiSpace(s.charCodeAt(k))) return null;
    return 'closeSpace';
  }
  if (!isAsciiSpace(s.charCodeAt(i))) return null;
  for (let k = i; k < end; k++) if (s.charCodeAt(k) === GT) return null;
  return 'attrs';
}

/** Index of a possible tag held back at the end of `raw`, or `raw.length` (tests). */
export function partialTagStart(raw: string): number {
  const lt = raw.lastIndexOf('<');
  return lt >= 0 && partialWait(raw, lt) !== null ? lt : raw.length;
}

function allAsciiSpace(s: string): boolean {
  for (let k = 0; k < s.length; k++) if (!isAsciiSpace(s.charCodeAt(k))) return false;
  return true;
}

/**
 * The kept text of a stream, with the bounds of its trimmed form, and what was added since the
 * shown text was last brought up to date (so a change never reads the whole text).
 */
class Kept {
  text = '';
  /** First index that is not whitespace (as String.prototype.trim sees it). */
  private lead: number | null = null;
  /** Just after the last index that is not whitespace. */
  private end = 0;
  /** Whitespace after `end`: shown only once more text follows it. */
  private tailSpace = '';
  /** Everything kept since the last take. */
  private fresh = '';
  /** What the trimmed text grew by since the last take. */
  private grown = '';

  push(s: string): void {
    if (s === '') return;
    const base = this.text.length;
    this.text += s;
    this.fresh += s;
    const content = s.trimEnd();
    if (content === '') {
      // Only whitespace: shown when something follows it (leading whitespace never is).
      if (this.lead !== null) this.tailSpace += s;
      return;
    }
    if (this.lead === null) {
      const first = s.search(/\S/);
      this.lead = base + first;
      this.grown += content.slice(first);
    } else {
      this.grown += this.tailSpace + content;
    }
    this.tailSpace = s.slice(content.length);
    this.end = base + content.length;
  }

  clear(): void {
    this.text = '';
    this.lead = null;
    this.end = 0;
    this.tailSpace = '';
    this.fresh = '';
    this.grown = '';
  }

  /** The kept text trimmed (reads the whole text: only for a reset). */
  trimmed(): string {
    return this.lead === null ? '' : this.text.slice(this.lead, this.end);
  }

  /** What was added since the last take: the trimmed growth, or everything kept. */
  take(trimmed: boolean): string {
    const added = trimmed ? this.grown : this.fresh;
    this.grown = '';
    this.fresh = '';
    return added;
  }
}

/** The end of a filtered stream. */
export interface Finished extends Stripped {
  /** The last change to what is shown, if any. */
  change: StreamEvent | null;
}

/** The reasoning rule for an answer that arrives in pieces (see the module documentation). */
export class ThinkFilter {
  /** Everything received (read only at the end). */
  private raw = '';
  /** `raw` from `base` on: the only part the scan may still read. */
  private window = '';
  private base = 0;
  /** `raw[..scanned]` is scanned; the rest is a possible tag held back. */
  private scanned = 0;
  /** Where the scan looks for the next tag (index into `raw`). */
  private pos = 0;
  /** Start of scanned text not yet kept (outside a block). */
  private seg = 0;
  /** `seg` follows a closing tag: spaces and tabs there are still removed. */
  private blanks = false;
  /** Inside a block opened with this name, waiting for its closing tag. */
  private block: Name | null = null;
  private kept = new Kept();
  private removed = false;
  /** The last '<' of `raw` and what it waits for, while it may still become a tag. */
  private held: { lt: number; wait: Wait } | null = null;
  /** What the learner sees. */
  private shownText = '';
  /** `shown` may no longer be the start of the visible text: the next change compares all. */
  private reset = false;

  /** What the learner sees now. */
  get shown(): string {
    return this.shownText;
  }

  /** Everything received so far, reasoning included. */
  get received(): string {
    return this.raw;
  }

  /** Adds a piece; returns how the shown text changes, if it does. */
  push(piece: string): StreamEvent | null {
    if (piece === '') return null;
    const before = this.raw.length;
    this.raw += piece;
    this.window += piece;
    const k = piece.lastIndexOf('<');
    if (k >= 0) {
      const lt = before + k;
      const wait = partialWait(this.window, lt - this.base);
      this.held = wait ? { lt, wait } : null;
    } else if (this.held) {
      // The held tag is still the last '<': only the new piece can change it.
      const { lt, wait } = this.held;
      if (wait === 'name') {
        const next = partialWait(this.window, lt - this.base);
        this.held = next ? { lt, wait: next } : null;
      } else if (wait === 'attrs') {
        if (piece.includes('>')) this.held = null;
      } else if (!allAsciiSpace(piece)) {
        this.held = null;
      }
    }
    this.advance(this.held ? this.held.lt : this.raw.length);
    return this.change();
  }

  /** Continues the scan up to index `upto` of `raw`. */
  private advance(upto: number): void {
    if (upto <= this.scanned) return;
    const w = this.window;
    const b = this.base;
    const end = upto - b;
    let pos = this.pos - b;
    let seg = this.seg - b;
    for (;;) {
      if (this.block !== null) {
        const close = closingTag(w, pos, end, this.block);
        if (!close) {
          // Rule 2 so far: everything from the opening tag is left out.
          pos = end;
          break;
        }
        // Rule 1: the block is closed.
        this.block = null;
        seg = close.end;
        pos = close.end;
        this.blanks = true;
      }
      if (this.blanks) {
        seg = skipBlanks(w, seg, end);
        pos = Math.max(pos, seg);
        // Spaces arriving with the next piece are still removed.
        this.blanks = seg === end;
      }
      const tag = nextTag(w, pos, end);
      if (!tag) {
        this.kept.push(w.slice(seg, end));
        seg = end;
        pos = end;
        break;
      }
      if (!this.removed) {
        this.removed = true;
        this.reset = true;
      }
      if (tag.closing) {
        // Rule 3: an orphan closing tag removes everything before it.
        this.kept.clear();
        this.reset = true;
        this.blanks = true;
      } else {
        this.kept.push(w.slice(seg, tag.start));
        this.block = tag.name;
      }
      seg = tag.end;
      pos = tag.end;
    }
    this.scanned = upto;
    this.pos = pos + b;
    this.seg = seg + b;
    // Everything before `upto` is decided: only the held tail is read again.
    this.window = w.slice(end);
    this.base = upto;
  }

  /** The change to what is shown since the last piece. */
  private change(): StreamEvent | null {
    if (this.reset) {
      this.reset = false;
      this.kept.take(this.removed);
      return this.show(this.removed ? this.kept.trimmed() : this.kept.text);
    }
    // The kept text only grew, so what is shown is the start of the visible text and the new
    // part is what follows it.
    const added = this.kept.take(this.removed);
    if (added === '') return null;
    this.shownText += added;
    return { kind: 'delta', text: added };
  }

  private show(now: string): StreamEvent | null {
    if (now === this.shownText) return null;
    const change: StreamEvent = now.startsWith(this.shownText)
      ? { kind: 'delta', text: now.slice(this.shownText.length) }
      : { kind: 'reset', text: now };
    this.shownText = now;
    return change;
  }

  /** The end of the answer: the final text (the rule applied to everything received). */
  finish(): Finished {
    const all = stripWhole(this.raw);
    return { ...all, change: this.show(all.text) };
  }
}
