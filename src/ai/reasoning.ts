/**
 * A model's hidden reasoning (<think>…</think> and friends) is never shown, spoken or written on
 * the board. One rule, shared with the Rust side through the vectors in
 * tests/fixtures/reasoning-strip.json (read the "about" field there):
 *
 * 1. Everything up to and including the LAST closing reasoning tag that has no opening reasoning
 *    tag before it (a chat template that pre-filled the opening tag) is removed, together with the
 *    spaces or tabs right after it.
 * 2. Then, repeatedly, the first opening tag: when its same-name closing tag follows, the block is
 *    removed with the spaces or tabs after it; otherwise everything from the opening tag to the end
 *    is cut (`unclosed`, e.g. an answer stopped at the output limit).
 * 3. Leading and trailing whitespace is trimmed only when something was removed.
 *
 * Tag names: think, thinking, reasoning, reflection, any case, optional attributes. A longer name
 * (<thinker>) is not a tag, and "x<y" is a comparison.
 */

/** The tag names of hidden reasoning. */
export const REASONING_TAGS: readonly string[] = ['think', 'thinking', 'reasoning', 'reflection'];

export interface StrippedReasoning {
  text: string;
  /** Something was removed. */
  removed: boolean;
  /** An opening tag had no closing tag: everything after it was cut. */
  unclosed: boolean;
}

const NAME = '(thinking|think|reasoning|reflection)';
/**
 * An opening tag: the name, then nothing or whitespace and attributes, then ">". The name must be
 * followed by whitespace or ">", so "<thinker>" is not a tag.
 */
const OPEN = new RegExp(`<${NAME}(?:\\s[^<>]*)?>`, 'i');
const CLOSE_ALL = new RegExp(`</${NAME}\\s*>`, 'gi');
const SPACES_AFTER = /^[ \t]*/;

/** Removes hidden reasoning with the shared rule above. */
export function stripReasoning(text: string): StrippedReasoning {
  return strip(text, false);
}

/**
 * The closing tag of the block opened by `open`: the first same-name closing tag (the shared
 * rule), or with `nested` the one that balances it ("<think>a<think>b</think>c</think>").
 */
function closingTag(out: string, open: RegExpExecArray, nested: boolean): RegExpExecArray | null {
  const name = (open[1] ?? '').toLowerCase();
  const tags = nested
    ? new RegExp(`<${name}(?:\\s[^<>]*)?>|</${name}\\s*>`, 'gi')
    : new RegExp(`</${name}\\s*>`, 'gi');
  tags.lastIndex = open.index + open[0].length;
  let depth = 1;
  for (let m = tags.exec(out); m; m = tags.exec(out)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return m;
  }
  return null;
}

function strip(text: string, nested: boolean): StrippedReasoning {
  let out = text;
  let removed = false;
  let unclosed = false;

  // 1) Orphan closing tags: those before the first opening tag.
  const firstOpen = OPEN.exec(out)?.index ?? out.length;
  let orphanEnd = -1;
  for (const m of out.matchAll(CLOSE_ALL)) {
    if (m.index >= firstOpen) break;
    orphanEnd = m.index + m[0].length;
  }
  if (orphanEnd >= 0) {
    out = out.slice(orphanEnd).replace(SPACES_AFTER, '');
    removed = true;
  }

  // 2) Blocks, first opening tag first.
  for (let open = OPEN.exec(out); open; open = OPEN.exec(out)) {
    removed = true;
    const end = closingTag(out, open, nested);
    if (!end) {
      out = out.slice(0, open.index);
      unclosed = true;
      break;
    }
    out = out.slice(0, open.index) + out.slice(end.index + end[0].length).replace(SPACES_AFTER, '');
  }

  return removed ? { text: out.trim(), removed, unclosed } : { text, removed, unclosed };
}

/** A closing tag left behind by a block, with the spaces or tabs after it. */
const STRAY_CLOSE = new RegExp(`</${NAME}\\s*>[ \\t]*`, 'gi');

/**
 * What the app uses (chat, voice, board): the shared rule, except that a block ends at the
 * closing tag that balances it ("<think>a<think>b</think>c</think>d" → "d"), and a closing tag
 * left after that is removed as a tag, its neighbours kept: it had an opening tag before it, so it
 * is no orphan ("a <think>x</think> b </think> c" → "a b c"). Repeated until nothing changes
 * (removing a tag can join the pieces of another), so the result holds no reasoning tag and a
 * second call changes nothing. On every shared vector it gives the same result as
 * `stripReasoning` (tested).
 */
export function stripAllReasoning(text: string): StrippedReasoning {
  let out = text;
  let removed = false;
  let unclosed = false;
  // Every round that changes the text makes it shorter, so this ends.
  for (;;) {
    const pass = strip(out, true);
    const next = pass.text.replace(STRAY_CLOSE, '');
    if (!pass.removed && next === out) break;
    removed = true;
    unclosed ||= pass.unclosed;
    out = next.trim();
  }
  return removed ? { text: out, removed, unclosed } : { text, removed, unclosed };
}

const PARTIAL_TAG = /<(\/?)([a-z]*)(\s[^<>]*)?$/i;

/**
 * The answer so far, for a streaming preview: reasoning blocks removed (an unfinished one hides
 * everything after its opening tag) and a tag still being typed at the very end ("<thi",
 * "<think type=\"x") hidden until it is known not to open a reasoning block. A closing tag left
 * without its opening tag (pre-filled template) can only be recognised once it has arrived.
 */
export function hideUnfinishedReasoning(partial: string): string {
  const { text } = stripAllReasoning(partial);
  const tail = PARTIAL_TAG.exec(text);
  if (!tail) return text;
  const name = (tail[2] ?? '').toLowerCase();
  const attributes = tail[3] !== undefined;
  const pending = attributes
    ? REASONING_TAGS.includes(name)
    : REASONING_TAGS.some((tag) => tag.startsWith(name));
  return pending ? text.slice(0, tail.index) : text;
}
