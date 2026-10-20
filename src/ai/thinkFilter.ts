/**
 * Removes a model's internal reasoning ("<think>…</think>" and friends) from an answer that
 * arrives in pieces, so the chat, the board and the voice only ever get learning content. The
 * web-side twin of `ReasoningStream` in src-tauri/src/ai/reasoning.rs, used where the page reads
 * a stream itself (the browser transport and the browser client for local runtimes); in the
 * desktop app Rust has already filtered the text.
 *
 * The rule is the one of src/ai/reasoning.ts (tags, code, rules 1–4; pinned by
 * tests/fixtures/reasoning-strip.json on both sides). This file only applies it piece by piece:
 *
 * - the final text (`finish`) is `stripReasoning` of everything received;
 * - before that, what is shown is always `hideUnfinishedReasoning` of what was received (tested
 *   after every piece): reasoning inside a block is never shown, a piece that may be the start of
 *   a tag is held back until it is complete, and a tag that may still turn out to be code (inside
 *   a fence or after a backtick still waiting for their end, `CodeTracker`) holds back everything
 *   from it until that is decided;
 * - rule 3 cannot be applied before its closing tag arrives, so streamed text is provisional: a
 *   late closing tag takes back what was shown with a `reset` event.
 *
 * Linear time: the scan resumes where it stopped, only the undecided tail is kept for the next
 * piece, and the whole answer is read only at the end (JavaScript strings built with `+=` are
 * copied when read, so nothing here reads the growing answer while it streams).
 */
import {
  nextTag,
  partialWait,
  skipBlanks,
  stripReasoning,
  TagPlacer,
  type CodeSpan,
  type ReasoningName,
  type StrippedReasoning,
  type Wait,
} from './reasoning';
import type { StreamEvent } from './types';

export { partialTagStart } from './reasoning';

const NL = 10;
const CR = 13;
const SPACE = 32;
const TAB = 9;
const BACKTICK = 96;
const TILDE = 126;

function isAsciiSpace(c: number): boolean {
  return c === SPACE || c === TAB || c === NL || c === 12 || c === CR;
}

function allAsciiSpace(s: string): boolean {
  for (let k = 0; k < s.length; k++) if (!isAsciiSpace(s.charCodeAt(k))) return false;
  return true;
}

function isContentSpace(c: number): boolean {
  return c === SPACE || c === TAB || c === NL || c === CR;
}

/** Where the current line stands for a fence: blanks only, a run of one mark, its trail, other. */
type Phase = 'indent' | 'run' | 'trail' | 'rest';

/**
 * `codeSpans(text, true)` of src/ai/reasoning.ts kept up to date as text arrives, reading each
 * character once: the closed code spans so far, and where undecided code starts (`open`).
 */
export class CodeTracker {
  /** Closed spans, in order (shared with a `TagPlacer`). */
  readonly spans: CodeSpan[] = [];
  private pos = 0;
  private lineStart = 0;
  private phase: Phase = 'indent';
  private mark = 0;
  private run = 0;
  /** The current line opens a fence (a run of three or more marks after blanks). */
  private opening = false;
  /** A backtick on this line waiting for its pair, and the content's bounds after it. */
  private tick = -1;
  private tickFirst = -1;
  private tickLast = -1;
  /** An opened fence waiting for its closing line. */
  private fence: { mark: number; run: number; start: number; first: number; last: number } | null =
    null;
  /** In a fence: the content bounds of the current line (content unless it closes the fence). */
  private lineFirst = -1;
  private lineLast = -1;

  /** Start of the first code that is not decided yet (the text's length when none). */
  get open(): number {
    if (this.fence) return this.fence.start;
    if (this.opening) return this.lineStart;
    if (this.tick >= 0) return this.tick;
    return this.pos;
  }

  push(piece: string): void {
    for (let k = 0; k < piece.length; k++) this.char(piece.charCodeAt(k), this.pos + k);
    this.pos += piece.length;
  }

  private newLine(p: number): void {
    this.lineStart = p + 1;
    this.phase = 'indent';
    this.run = 0;
    this.lineFirst = -1;
    this.lineLast = -1;
  }

  private char(c: number, p: number): void {
    if (this.fence) {
      this.inFence(c, p, this.fence);
      return;
    }
    if (c === NL) {
      if (this.opening) {
        this.fence = { mark: this.mark, run: this.run, start: this.lineStart, first: -1, last: -1 };
        this.opening = false;
      }
      this.tick = -1;
      this.newLine(p);
      return;
    }
    // A fence opening: blanks, then three or more of one mark (the rest of the line is its info).
    if (this.phase === 'indent') {
      if (c === BACKTICK || c === TILDE) {
        this.phase = 'run';
        this.mark = c;
        this.run = 1;
      } else if (c !== SPACE && c !== TAB) {
        this.phase = 'rest';
      }
    } else if (this.phase === 'run') {
      if (c === this.mark) {
        this.run++;
        if (this.run === 3) {
          this.opening = true;
          this.tick = -1;
        }
      } else {
        this.phase = 'rest';
      }
    }
    if (this.opening) return;
    // Inline code: a backtick, then the next one on the same line with something between.
    if (c === BACKTICK) {
      if (this.tick >= 0 && p > this.tick + 1) {
        this.spans.push({
          start: this.tick,
          end: p + 1,
          from: this.tick + 1,
          to: p,
          first: this.tickFirst,
          last: this.tickLast,
        });
        this.tick = -1;
      } else {
        this.tick = p;
        this.tickFirst = -1;
        this.tickLast = -1;
      }
    } else if (this.tick >= 0 && !isContentSpace(c)) {
      if (this.tickFirst < 0) this.tickFirst = p;
      this.tickLast = p;
    }
  }

  private inFence(
    c: number,
    p: number,
    fence: { mark: number; run: number; start: number; first: number; last: number },
  ): void {
    if (c === NL) {
      const closes = (this.phase === 'run' || this.phase === 'trail') && this.run >= fence.run;
      if (closes) {
        this.spans.push({
          start: fence.start,
          end: p,
          from: fence.start,
          to: p,
          first: fence.first,
          last: fence.last,
        });
        this.fence = null;
      } else if (this.lineFirst >= 0) {
        if (fence.first < 0) fence.first = this.lineFirst;
        fence.last = this.lineLast;
      }
      this.newLine(p);
      return;
    }
    // The closing line: blanks, at least as many of the mark, then spaces, tabs or a CR.
    if (this.phase === 'indent') {
      if (c === fence.mark) {
        this.phase = 'run';
        this.run = 1;
      } else if (c !== SPACE && c !== TAB) {
        this.phase = 'rest';
      }
    } else if (this.phase === 'run') {
      if (c === fence.mark) this.run++;
      else this.phase = c === SPACE || c === TAB || c === CR ? 'trail' : 'rest';
    } else if (this.phase === 'trail' && c !== SPACE && c !== TAB && c !== CR) {
      this.phase = 'rest';
    }
    if (!isContentSpace(c)) {
      if (this.lineFirst < 0) this.lineFirst = p;
      this.lineLast = p;
    }
  }
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
export interface Finished extends StrippedReasoning {
  /** The last change to what is shown, if any. */
  change: StreamEvent | null;
}

/** A possible tag at the end of what was received, and its text while its name may grow. */
interface Held {
  lt: number;
  wait: Wait;
  /** The tag so far (only kept while its name may still grow: a few characters). */
  text: string;
}

/** The reasoning rule for an answer that arrives in pieces (see the module documentation). */
export class ThinkFilter {
  /** Everything received (read only at the end). */
  private raw = '';
  /** `raw` from `base` on: the only part the scan may still read. */
  private window = '';
  private base = 0;
  /** `raw[..scanned]` is scanned; the rest is held back. */
  private scanned = 0;
  /** Where the scan looks for the next tag (index into `raw`). */
  private pos = 0;
  /** Start of scanned text not yet kept (outside a block). */
  private seg = 0;
  /** `seg` follows a closing tag: spaces and tabs there are still removed. */
  private blanks = false;
  /** Inside a block opened with this name, waiting for its closing tag. */
  private block: ReasoningName | null = null;
  private kept = new Kept();
  private removed = false;
  /** The last '<' of `raw` and what it waits for, while it may still become a tag. */
  private held: Held | null = null;
  /** Code spans as text arrives, and the tags placed against them. */
  private readonly code = new CodeTracker();
  private readonly placer = new TagPlacer(this.code.spans);
  /** The scan stopped at this tag: it may still turn out to be code. */
  private stop: number | null = null;
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
    this.code.push(piece);
    this.held = this.nextHeld(piece, before);
    // A stop waits until the code before its tag is decided.
    if (this.stop === null || this.code.open > this.stop) {
      this.advance(this.held ? this.held.lt : this.raw.length);
    }
    return this.change();
  }

  /** The possible tag at the end after `piece` (read from the piece alone). */
  private nextHeld(piece: string, before: number): Held | null {
    const k = piece.lastIndexOf('<');
    if (k >= 0) {
      const wait = partialWait(piece, k);
      return wait ? { lt: before + k, wait, text: wait === 'name' ? piece.slice(k) : '' } : null;
    }
    const held = this.held;
    if (!held) return null;
    // The held tag is still the last '<': only the new piece can change it.
    switch (held.wait) {
      case 'name': {
        const text = held.text + piece;
        const wait = partialWait(text, 0);
        return wait ? { lt: held.lt, wait, text: wait === 'name' ? text : '' } : null;
      }
      case 'attrs':
        return piece.includes('>') ? null : held;
      case 'closeSpace':
        return allAsciiSpace(piece) ? held : null;
      case 'slash':
        // Its '>' completes it, anything else ends it: either way it is decided.
        return null;
    }
  }

  /** Continues the scan up to index `upto` of `raw`, stopping at a tag that may be code. */
  private advance(upto: number): void {
    if (this.stop === null && upto <= this.scanned) return;
    this.stop = null;
    const w = this.window;
    const b = this.base;
    const end = upto - b;
    const open = this.code.open;
    let pos = this.pos - b;
    let seg = this.seg - b;
    let stop: number | null = null;
    scan: for (;;) {
      if (this.block !== null) {
        let closed = false;
        for (let tag = nextTag(w, pos, end); tag; tag = nextTag(w, tag.end, end)) {
          if (tag.start + b >= open) {
            stop = tag.start;
            pos = tag.start;
            break scan;
          }
          const t = this.placer.place(tag, b);
          pos = tag.end;
          if (t.inert || t.kind !== 'close' || t.name !== this.block) continue;
          // Rule 1: the block is closed.
          this.block = null;
          seg = t.cutEnd - b;
          pos = seg;
          this.blanks = true;
          closed = true;
          break;
        }
        if (!closed) {
          // Rule 2 so far: everything from the opening tag is left out.
          pos = end;
          break;
        }
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
      if (tag.start + b >= open) {
        this.kept.push(w.slice(seg, tag.start));
        seg = tag.start;
        pos = tag.start;
        stop = tag.start;
        break;
      }
      const t = this.placer.place(tag, b);
      if (t.inert) {
        pos = tag.end;
        continue;
      }
      if (!this.removed) {
        this.removed = true;
        this.reset = true;
      }
      if (t.kind === 'close') {
        // Rule 3: an orphan closing tag removes everything before it.
        this.kept.clear();
        this.reset = true;
        this.blanks = true;
        seg = t.cutEnd - b;
      } else {
        this.kept.push(w.slice(seg, tag.start));
        if (t.kind === 'empty') this.blanks = true;
        else this.block = t.name;
        seg = tag.end;
      }
      pos = seg;
    }
    const done = stop ?? end;
    this.stop = stop === null ? null : stop + b;
    this.scanned = done + b;
    this.pos = pos + b;
    this.seg = seg + b;
    // Everything before `done` is decided: only the undecided tail is read again.
    if (done > 0) {
      this.window = w.slice(done);
      this.base = done + b;
    }
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
    const all = stripReasoning(this.raw);
    return { ...all, change: this.show(all.text) };
  }
}
