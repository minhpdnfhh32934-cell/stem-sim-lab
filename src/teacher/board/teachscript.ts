/**
 * TeachScript 1.0 reader (docs/TEACHSCRIPT.md). Text outside tags is what the teacher says;
 * a tag's place in the text is when its action happens. The reader is fault tolerant: a broken
 * tag is dropped and its words are still spoken, unknown tags keep their text (hidden reasoning
 * such as <think> excepted: it is dropped whole), nothing throws. A `<write>` whose id is broken
 * or missing gets a repaired or automatic id (its text is never lost), an unclosed `<write>` ends
 * at its sentence, and "<" starts a tag only when a tag can stand there ("$x<y$ và $y>z$" is text).
 * The AI names intentions (zone, role, target), never coordinates: the layout engine places.
 * Each sentence records where it stands in the source (`start`/`end`), so "Viết tiếp" can skip
 * what was already taught by position, not by count.
 */
import { REASONING_TAGS, stripReasoningOutsideCode } from '@/ai/reasoning';

export type Zone = 'title' | 'main' | 'steps' | 'side_notes' | 'example' | 'diagram' | 'scratch';
export const ZONES: readonly Zone[] = [
  'title',
  'main',
  'steps',
  'side_notes',
  'example',
  'diagram',
  'scratch',
];
export type Role = 'heading' | 'body' | 'keyword' | 'note' | 'result';
export const ROLES: readonly Role[] = ['heading', 'body', 'keyword', 'note', 'result'];
export type MarkKind = 'underline' | 'circle' | 'box' | 'highlight';
export type DrawType = 'free_body' | 'axes' | 'plot' | 'vector' | 'flow' | 'table';
export const DRAW_TYPES: readonly DrawType[] = [
  'free_body',
  'axes',
  'plot',
  'vector',
  'flow',
  'table',
];

export type BoardAction =
  | {
      kind: 'write';
      id: string;
      zone: Zone;
      role: Role;
      math: boolean;
      text: string;
      speed: 'slow' | 'normal' | 'fast';
      noteFor?: string;
    }
  | { kind: 'mark'; mark: MarkKind; target: string; span?: string }
  | { kind: 'arrow'; from: string; to: string; label?: string }
  | { kind: 'point'; target: string }
  | { kind: 'erase'; target: string }
  | { kind: 'correct'; target: string; text: string }
  | { kind: 'newboard'; title?: string }
  | { kind: 'draw'; id: string; zone: Zone; type: DrawType; spec: Record<string, unknown> }
  | { kind: 'plot'; id: string; zone: Zone; fn: string; domain: [number, number]; label?: string };

export interface TimedAction {
  /** Character offset in the sentence's spoken text where the action starts. */
  at: number;
  action: BoardAction;
}

export interface Sentence {
  /** Words outside the tags (tags removed, whitespace collapsed). */
  speech: string;
  /**
   * What the teacher reads aloud and the subtitle shows (audit BRD-01): `speech` with what is
   * written on the board put back where its tag stood ("Đề cho <write>m = 2 kg</write>." is read
   * "Đề cho m = 2 kg."), formulas as `$…$` for the speech reader. A write the sentence already
   * says is not repeated.
   */
  spoken: string;
  actions: TimedAction[];
  /** Silence after the sentence (from `<pause>` tags), milliseconds. */
  pauseMs: number;
  /**
   * Where the sentence stands in the text the reader read (`teachScriptSource`, or the markdown
   * answer): from its first character or tag to just after its last one. Absent on sentences
   * built by hand.
   */
  start?: number;
  end?: number;
}

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

function wordsOf(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * True when most words of `text` are already in `speech` (the teacher says it anyway). A write
 * with a number the sentence does not say ("… = 6 N" after "2 kg và 3") never is: the result
 * must be heard.
 */
export function alreadySaid(speech: string, text: string): boolean {
  const said = new Set(wordsOf(speech));
  const words = wordsOf(text);
  if (words.length === 0) return true;
  const saidNumbers = new Set(speech.match(/\d+/g) ?? []);
  if ((text.match(/\d+/g) ?? []).some((n) => !saidNumbers.has(n))) return false;
  return words.filter((w) => said.has(w)).length / words.length >= 0.6;
}

/** The sentence as read aloud: written texts spliced in at their tags. */
export function spokenSentence(speech: string, actions: readonly TimedAction[]): string {
  const inserts = actions
    .filter(
      (a): a is TimedAction & { action: Extract<BoardAction, { kind: 'write' | 'correct' }> } =>
        a.action.kind === 'write' || a.action.kind === 'correct',
    )
    .filter((a) => !alreadySaid(speech, a.action.text))
    .sort((a, b) => a.at - b.at);
  let out = '';
  let pos = 0;
  for (const { at, action } of inserts) {
    const before = speech.slice(pos, at);
    out += before;
    let text = action.text.trim();
    const math = action.kind === 'write' && action.math;
    if (!math) {
      // "Đề cho" + "Cho: m = 2 kg" → "Đề cho m = 2 kg" (the board's label is not read twice).
      const lastWord = /([\p{L}]+)\s*$/u.exec(out)?.[1];
      const first = /^([\p{L}]+)\s*:?\s*/u.exec(text);
      if (lastWord && first?.[1] && fold(first[1]) === fold(lastWord)) {
        text = text.slice(first[0].length);
      }
    }
    out += `${/\S$/.test(out) ? ' ' : ''}${math ? `$${text}$` : text}`;
    pos = at;
    if (/^[^\s.,;:!?…]/.test(speech.slice(pos))) out += ' ';
  }
  out += speech.slice(pos);
  return out
    .replace(/\s+([.,;:!?…])/g, '$1')
    .replace(/([,;:])(?=[.!?…])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Diagnostic {
  code:
    | 'unknown_tag'
    | 'bad_attribute'
    | 'missing_attribute'
    | 'unclosed_tag'
    | 'tag_too_long'
    | 'coordinates_removed'
    | 'unknown_zone'
    | 'unknown_role'
    | 'reasoning_removed'
    | 'id_repaired';
  tag?: string;
}

export interface ParsedScript {
  sentences: Sentence[];
  diagnostics: Diagnostic[];
  /** True when at least one board action was found (else the caller may use the markdown reader). */
  hasBoard: boolean;
}

const ID = /^[a-z][a-z0-9_]{0,31}$/;
const CONTAINERS = new Set(['write', 'correct', 'ask', 'emph', 'prosody', 'tone']);
const EMPTY = new Set([
  'pause',
  'face',
  'gaze',
  'nod',
  'smile',
  'underline',
  'circle',
  'box',
  'highlight',
  'arrow',
  'point',
  'erase',
  'newboard',
  'recall',
  'draw',
  'table',
  'plot',
  'wait_student',
  'checkpoint',
]);
/** Every TeachScript tag name (the voice removes these and a few HTML tags before reading). */
export const TEACHSCRIPT_TAGS: readonly string[] = [...CONTAINERS, ...EMPTY];
/** Names that are tags wherever they stand: TeachScript's own and hidden reasoning. */
const KNOWN_TAGS: ReadonlySet<string> = new Set([...TEACHSCRIPT_TAGS, ...REASONING_TAGS]);
/** Attributes that would be coordinates or sizes: never accepted from the AI (§7). */
const GEOMETRY = /^(x|y|x1|y1|x2|y2|left|top|right|bottom|width|height|px|size|pos|position)$/i;

const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
};

function decode(s: string): string {
  return s.replace(/&(lt|gt|amp|quot|apos);/g, (m) => ENTITIES[m] ?? m);
}

/**
 * `decode`, keeping for each character of the result the source offset it came from (an entity:
 * the offset of its last character, so a sentence ending with it ends after it).
 */
function decodeAt(raw: string, src: readonly number[]): { text: string; src: number[] } {
  let text = '';
  const out: number[] = [];
  const last = src[src.length - 1] ?? 0;
  for (let i = 0; i < raw.length;) {
    const entity = raw[i] === '&' ? /^&(?:lt|gt|amp|quot|apos);/.exec(raw.slice(i, i + 6)) : null;
    const length = entity ? entity[0].length : 1;
    text += entity ? (ENTITIES[entity[0]] ?? entity[0]) : (raw[i] ?? '');
    out.push(src[i + length - 1] ?? last);
    i += length;
  }
  return { text, src: out };
}

/** "S1" → "s1", "step-1" → "step_1"; null when no valid id comes out. */
function repairId(raw: string | undefined): string | null {
  const fixed = (raw ?? '').trim().toLowerCase().replace(/-/g, '_');
  return ID.test(fixed) ? fixed : null;
}

interface Token {
  type: 'text' | 'open' | 'close' | 'empty';
  name?: string;
  attrs?: Record<string, string>;
  text?: string;
  /** Where the token starts in the source, and just after its end. */
  start: number;
  end: number;
}

/** A tag name: TeachScript's are `[a-z_]+`; an HTML-like one may hold digits or "-" (<h1>). */
const TAG_NAME = /^([a-z][a-z0-9_-]*)/;

/** The attributes after a tag's name, or null when they do not follow `name="value"…`. */
function readAttributes(rest: string): Record<string, string> | null {
  const attrs: Record<string, string> = {};
  const attrRe = /\s+([a-zA-Z_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
  let pos = 0;
  while (pos < rest.length) {
    attrRe.lastIndex = pos;
    const m = attrRe.exec(rest);
    if (!m) return rest.slice(pos).trim() === '' ? attrs : null;
    attrs[m[1] ?? ''] = decode(m[2] ?? m[3] ?? '');
    pos = attrRe.lastIndex;
  }
  return attrs;
}

/**
 * A TeachScript or reasoning tag cut off at the very end of the answer ('<write id="s3" zone="ste',
 * an answer stopped at the output limit): markup, never words. Its name, or null when the tail
 * may be text ("x<y", "a<b" at the end).
 */
function cutTag(tail: string): string | null {
  const m = /^<(\/?)([a-z_]*)(\s[^<>]*)?$/.exec(tail);
  if (!m) return null;
  const name = m[2] ?? '';
  const typing = m[1] === '/' || m[3] !== undefined || name.length >= 2;
  return typing && [...KNOWN_TAGS].some((k) => k.startsWith(name)) ? name : null;
}

/**
 * Splits into text and tags; anything that does not parse as a tag stays text. A TeachScript or
 * reasoning name is always a tag (malformed attributes drop it); another name only when the rest
 * reads as a tag ("<foo bar="x">", "<b>", "</foo>"), so a comparison such as "$x<y$ và $y>z$"
 * keeps every character.
 */
function tokenize(input: string, diags: Diagnostic[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let text = '';
  let textStart = 0;
  const flush = () => {
    if (text) tokens.push({ type: 'text', text, start: textStart, end: textStart + text.length });
    text = '';
  };
  const literal = () => {
    if (!text) textStart = i;
    text += input[i] ?? '';
    i++;
  };
  while (i < input.length) {
    if (input[i] === '<' && /[a-z/]/.test(input[i + 1] ?? '')) {
      const end = input.indexOf('>', i);
      if (end < 0) {
        const cut = cutTag(input.slice(i));
        if (cut !== null) {
          diags.push({ code: 'unclosed_tag', tag: cut });
          break;
        }
        literal();
        continue;
      }
      if (end - i > 2000) {
        diags.push({ code: 'tag_too_long' });
        literal();
        continue;
      }
      const raw = input.slice(i + 1, end);
      const closing = raw.startsWith('/');
      const selfClosing = raw.endsWith('/');
      const body = raw.slice(closing ? 1 : 0, selfClosing ? -1 : undefined).trim();
      const name = TAG_NAME.exec(body)?.[1];
      if (!name) {
        literal();
        continue;
      }
      const attrs = readAttributes(body.slice(name.length));
      if (!KNOWN_TAGS.has(name) && (!attrs || (closing && Object.keys(attrs).length > 0))) {
        literal();
        continue;
      }
      flush();
      if (!attrs) {
        diags.push({ code: 'bad_attribute', tag: name });
        // Malformed attributes: the tag is dropped, nothing of it is spoken.
        i = end + 1;
        continue;
      }
      tokens.push({
        type: closing ? 'close' : selfClosing ? 'empty' : 'open',
        name,
        attrs,
        start: i,
        end: end + 1,
      });
      i = end + 1;
      continue;
    }
    literal();
  }
  flush();
  return tokens;
}

function zoneOf(v: string | undefined, diags: Diagnostic[]): Zone {
  if (!v) return 'main';
  if ((ZONES as readonly string[]).includes(v)) return v as Zone;
  diags.push({ code: 'unknown_zone', tag: v });
  return 'main';
}

function roleOf(v: string | undefined, diags: Diagnostic[]): Role {
  if (!v) return 'body';
  if ((ROLES as readonly string[]).includes(v)) return v as Role;
  diags.push({ code: 'unknown_role', tag: v });
  return 'body';
}

function cleanAttrs(attrs: Record<string, string>, diags: Diagnostic[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (GEOMETRY.test(k)) diags.push({ code: 'coordinates_removed', tag: k });
    else out[k] = v;
  }
  return out;
}

/** `spec` JSON for `<draw>`, with any geometry keys removed (the AI never places things). */
function readSpec(raw: string | undefined, diags: Diagnostic[]): Record<string, unknown> | null {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (GEOMETRY.test(k)) diags.push({ code: 'coordinates_removed', tag: k });
      else out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

function domainOf(raw: string | undefined): [number, number] | null {
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*\.\.\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(raw ?? '');
  if (!m) return null;
  const a = Number((m[1] ?? '').replace(',', '.'));
  const b = Number((m[2] ?? '').replace(',', '.'));
  return Number.isFinite(a) && Number.isFinite(b) && a < b ? [a, b] : null;
}

/** An empty tag as a board action (null when it is voice/face only or invalid). */
function emptyAction(
  name: string,
  rawAttrs: Record<string, string>,
  diags: Diagnostic[],
): BoardAction | null {
  const a = cleanAttrs(rawAttrs, diags);
  const need = (...keys: string[]) => {
    const missing = keys.filter((k) => !a[k]);
    if (missing.length) diags.push({ code: 'missing_attribute', tag: name });
    return missing.length === 0;
  };
  /** A drawing's id, repaired like a write's ("D1" → "d1"); null when none comes out. */
  const drawingId = (): string | null => {
    const id = repairId(a.id);
    if (id && id !== a.id) diags.push({ code: 'id_repaired', tag: name });
    return id;
  };
  switch (name) {
    case 'underline':
    case 'circle':
    case 'box':
    case 'highlight':
      if (!need('target')) return null;
      return {
        kind: 'mark',
        mark: name,
        target: a.target ?? '',
        ...(a.span ? { span: a.span } : {}),
      };
    case 'arrow':
      if (!need('from', 'to')) return null;
      return {
        kind: 'arrow',
        from: a.from ?? '',
        to: a.to ?? '',
        ...(a.label ? { label: a.label } : {}),
      };
    case 'point':
    case 'recall':
      if (!need('target')) return null;
      return { kind: 'point', target: a.target ?? '' };
    case 'erase':
      if (!need('target')) return null;
      return { kind: 'erase', target: a.target ?? '' };
    case 'newboard':
      return { kind: 'newboard', ...(a.title ? { title: a.title } : {}) };
    case 'draw': {
      if (!need('id', 'type')) return null;
      const type = a.type ?? '';
      const spec = readSpec(a.spec, diags);
      const id = drawingId();
      if (!(DRAW_TYPES as readonly string[]).includes(type) || !spec || !id) {
        diags.push({ code: 'bad_attribute', tag: name });
        return null;
      }
      return {
        kind: 'draw',
        id,
        zone: zoneOf(a.zone ?? 'diagram', diags),
        type: type as DrawType,
        spec,
      };
    }
    case 'plot': {
      if (!need('id', 'fn', 'domain')) return null;
      const domain = domainOf(a.domain);
      const id = drawingId();
      if (!domain || !id) {
        diags.push({ code: 'bad_attribute', tag: name });
        return null;
      }
      return {
        kind: 'plot',
        id,
        zone: zoneOf(a.zone ?? 'diagram', diags),
        fn: a.fn ?? '',
        domain,
        ...(a.label ? { label: a.label } : {}),
      };
    }
    default:
      return null;
  }
}

/** A "." that does not end its sentence; `before` is the sentence up to the dot. */
function notAnEnd(before: string, after: string): boolean {
  const word = /(\S+)$/.exec(before)?.[1] ?? '';
  const opens = before.slice(0, before.length - word.length).trim() === '';
  // A step "1." or an option "A." that opens the sentence.
  if (opens && /^(?:\d{1,2}|[A-F])$/.test(word)) return true;
  // A page "tr. 45".
  if (/^[Tt]r$/.test(word) && /^\s*\d/.test(after)) return true;
  // "v.v." in the middle of a sentence ("lực cản v.v. đều …").
  if (/(?:^|[\s(])v\.v$/.test(before) && /^\s+\p{Ll}/u.test(after)) return true;
  return false;
}

/**
 * Index just after the end of the sentence that `text` continues (`head` is what the sentence
 * already holds), or -1. Ends: . ! ? … followed by a space (not inside numbers like 9.81), except
 * the dots of `notAnEnd`; a sentence that opens with an option "A." also ends before the next
 * option ("A. 10 m/s B. 20 m/s"), and options after a colon start a sentence of their own
 * ("Câu hỏi: A. 10 m/s B. 20 m/s" → "Câu hỏi:" | "A. 10 m/s" | "B. 20 m/s").
 */
function sentenceEnd(head: string, text: string): number {
  const full = head + text;
  const base = head.length;
  let optionCut = -1;
  const marker = /^\s*[A-F][.)]\s/.exec(full);
  if (marker) {
    const next = /\s(?=[B-F][.)]\s)/g;
    next.lastIndex = Math.max(marker[0].length, base);
    const o = next.exec(full);
    if (o) optionCut = o.index - base;
  } else {
    // A list of options (an "A." and, later, a "B.") right after a colon.
    const colon = /:(?=[ \t]*A[.)]\s[\s\S]*?\sB[.)]\s)/.exec(full);
    if (colon) optionCut = Math.max(0, colon.index + 1 - base);
  }
  const ends = /[.!?…](?=\s|$)/g;
  for (let m = ends.exec(text); m; m = ends.exec(text)) {
    if (optionCut >= 0 && optionCut <= m.index) return optionCut;
    if (m[0] === '.' && notAnEnd(full.slice(0, base + m.index), text.slice(m.index + 1))) continue;
    return m.index + 1;
  }
  return optionCut;
}

/**
 * Where a `<write>` that was never closed ends: after its first sentence, or at its first line
 * break (a written text is one line); -1 when it holds neither.
 */
function firstBreak(raw: string): number {
  const lead = raw.length - raw.trimStart().length;
  const body = raw.slice(lead);
  const nl = body.indexOf('\n');
  for (const m of body.matchAll(/[.!?…](?=\s)/g)) {
    if (nl >= 0 && nl < m.index) break;
    if (m[0] === '.' && notAnEnd(body.slice(0, m.index), body.slice(m.index + 1))) continue;
    return lead + m.index + 1;
  }
  return nl >= 0 ? lead + nl : -1;
}

/** An action with the source range of its tag (a container: from its opening to its closing). */
interface SourcedAction extends TimedAction {
  from: number;
  to: number;
}

/** Text between two `<pause>` tags: what is said, the source offset of each character, actions. */
interface Segment {
  speech: string;
  src: number[];
  actions: SourcedAction[];
  pauseMs: number;
}

/** Splits spoken text into sentences, keeping actions anchored to their sentence. */
function sentencesOf(segments: Segment[]): Sentence[] {
  const out: Sentence[] = [];
  let speech = '';
  let src: number[] = [];
  let actions: SourcedAction[] = [];
  let pauseMs = 0;
  const push = () => {
    const trimmed = speech.replace(/\s+/g, ' ').trim();
    if (trimmed || actions.length) {
      const lead = speech.length - speech.trimStart().length;
      // Offsets follow the collapsed text: count the characters removed before each action.
      const collapsedAt = (at: number) =>
        speech.slice(lead, Math.max(lead, at)).replace(/\s+/g, ' ').length;
      const timed = actions.map((a) => ({
        at: Math.max(0, Math.min(trimmed.length, collapsedAt(a.at))),
        action: a.action,
      }));
      // Where the sentence stands in the source: its words and its tags.
      let start = Infinity;
      let end = -Infinity;
      for (let k = 0; k < speech.length; k++) {
        const at = src[k];
        if (at === undefined || /\s/.test(speech[k] ?? ' ')) continue;
        start = Math.min(start, at);
        end = Math.max(end, at + 1);
      }
      for (const a of actions) {
        start = Math.min(start, a.from);
        end = Math.max(end, a.to);
      }
      out.push({
        speech: trimmed,
        spoken: spokenSentence(trimmed, timed),
        actions: timed,
        pauseMs,
        ...(Number.isFinite(start) && Number.isFinite(end) ? { start, end } : {}),
      });
    }
    speech = '';
    src = [];
    actions = [];
    pauseMs = 0;
  };
  for (const seg of segments) {
    pauseMs += seg.pauseMs;
    // Sentence ends (`sentenceEnd`). Each action goes to the sentence in which its tag stood.
    let pending = [...seg.actions];
    let consumed = 0;
    let rest = seg.speech;
    let restSrc = seg.src;
    for (;;) {
      const cut = sentenceEnd(speech, rest);
      // An empty cut only closes a sentence that already holds words.
      if (cut < 0 || (cut === 0 && !speech.trim())) break;
      const end = consumed + cut;
      for (const a of pending.filter((x) => x.at <= end)) {
        actions.push({ ...a, at: speech.length + a.at - consumed });
      }
      pending = pending.filter((x) => x.at > end);
      speech += rest.slice(0, cut);
      src = src.concat(restSrc.slice(0, cut));
      rest = rest.slice(cut);
      restSrc = restSrc.slice(cut);
      consumed = end;
      push();
    }
    for (const a of pending) actions.push({ ...a, at: speech.length + a.at - consumed });
    speech += rest;
    src = src.concat(restSrc);
  }
  push();
  return out;
}

/**
 * The text the reader reads: NFC, hidden reasoning (<think>, <thinking>, <reasoning>,
 * <reflection>) removed with the shared rule (src/ai/reasoning.ts). Sentence offsets refer to it.
 * Idempotent, so a caller may read it first and hand it to `parseTeachScript`.
 */
export function teachScriptSource(input: string): string {
  return stripReasoningOutsideCode(input.normalize('NFC')).text;
}

/** Reads a TeachScript answer. Never throws. */
export function parseTeachScript(input: string): ParsedScript {
  const diagnostics: Diagnostic[] = [];
  // Hidden reasoning is a drop container: none of its text is spoken or written, also when it is
  // unclosed or its opening tag was pre-filled by a chat template. A tag between backticks is
  // code, not reasoning ("`<think>`"); a bare literal "<think>" in the text is reasoning (cut to
  // the end when unclosed). Other unknown tags keep their words (§6).
  const reasoning = stripReasoningOutsideCode(input.normalize('NFC'));
  if (reasoning.removed) diagnostics.push({ code: 'reasoning_removed' });
  const source = reasoning.text;
  const tokens = tokenize(source, diagnostics);

  // Ids the answer uses: an automatic id never takes one of them.
  const taken = new Set<string>();
  for (const m of source.matchAll(/\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const id = repairId(m[1] ?? m[2]);
    if (id) taken.add(id);
  }
  let autos = 0;
  /** A `<write>`'s id: as written, repaired ("S1" → "s1", "step-1" → "step_1") or automatic. */
  const writeId = (raw: string | undefined): string => {
    if (raw && ID.test(raw)) return raw;
    diagnostics.push({ code: 'id_repaired', tag: 'write' });
    const repaired = repairId(raw);
    if (repaired) return repaired;
    autos += 1;
    while (taken.has(`auto${String(autos)}`)) autos += 1;
    const id = `auto${String(autos)}`;
    taken.add(id);
    return id;
  };

  const segments: Segment[] = [];
  let speech = '';
  let speechSrc: number[] = [];
  let actions: SourcedAction[] = [];
  let open: {
    name: string;
    attrs: Record<string, string>;
    text: string;
    src: number[];
    start: number;
  } | null = null;
  let pauseMs = 0;
  const say = (text: string, src: readonly number[]) => {
    speech += text;
    for (const at of src) speechSrc.push(at);
  };
  const flushSegment = () => {
    segments.push({ speech, src: speechSrc, actions, pauseMs });
    speech = '';
    speechSrc = [];
    actions = [];
    pauseMs = 0;
  };

  /** Ends the open container; `closedAt` is just after its closing tag (null: never closed). */
  const closeContainer = (closedAt: number | null) => {
    if (!open) return;
    const { name, attrs, start } = open;
    let raw = open.text;
    let rawSrc = open.src;
    let rest: { raw: string; src: number[] } | null = null;
    if (closedAt === null && (name === 'write' || name === 'correct')) {
      // Never closed: the written text ends with its sentence (or line); the rest is speech.
      const cut = firstBreak(raw);
      if (cut > 0 && cut < raw.length) {
        rest = { raw: raw.slice(cut), src: rawSrc.slice(cut) };
        raw = raw.slice(0, cut);
        rawSrc = rawSrc.slice(0, cut);
      }
    }
    open = null;
    const to = closedAt ?? (rawSrc[rawSrc.length - 1] ?? start) + 1;
    const text = decode(raw).trim();
    const a = cleanAttrs(attrs, diagnostics);
    const at = speech.length;
    if (name === 'write') {
      if (!text) {
        diagnostics.push({ code: 'missing_attribute', tag: name });
      } else {
        actions.push({
          at,
          from: start,
          to,
          action: {
            kind: 'write',
            id: writeId(a.id),
            zone: zoneOf(a.zone, diagnostics),
            role: roleOf(a.role, diagnostics),
            math: a.math === 'true',
            text,
            speed: a.speed === 'slow' || a.speed === 'fast' ? a.speed : 'normal',
            ...(a['note-for'] ? { noteFor: a['note-for'] } : {}),
          },
        });
      }
    } else if (name === 'correct') {
      if (!text) {
        diagnostics.push({ code: 'missing_attribute', tag: name });
      } else if (!a.target) {
        // Nothing to correct on the board: the words are still said (§6, tag dropped, text kept).
        diagnostics.push({ code: 'missing_attribute', tag: name });
        const d = decodeAt(` ${raw} `, [start, ...rawSrc, to - 1]);
        say(d.text, d.src);
      } else {
        actions.push({ at, from: start, to, action: { kind: 'correct', target: a.target, text } });
      }
    } else if (name === 'ask') {
      // The question is spoken; quick answers come with the interaction phase (T5).
      const d = decodeAt(` ${raw} `, [start, ...rawSrc, to - 1]);
      say(d.text, d.src);
    }
    if (rest) {
      const d = decodeAt(rest.raw, rest.src);
      say(d.text, d.src);
    }
  };

  for (const tok of tokens) {
    if (tok.type === 'text') {
      const raw = tok.text ?? '';
      const src = Array.from({ length: raw.length }, (_, k) => tok.start + k);
      if (open && (open.name === 'write' || open.name === 'correct' || open.name === 'ask')) {
        open.text += raw;
        for (const at of src) open.src.push(at);
      } else {
        const d = decodeAt(raw, src);
        say(d.text, d.src);
      }
      continue;
    }
    const name = tok.name ?? '';
    if (tok.type === 'open') {
      if (name === 'write' || name === 'correct' || name === 'ask') {
        if (open) {
          diagnostics.push({ code: 'unclosed_tag', tag: open.name });
          closeContainer(null);
        }
        open = { name, attrs: tok.attrs ?? {}, text: '', src: [], start: tok.start };
      } else if (!CONTAINERS.has(name)) {
        diagnostics.push({ code: 'unknown_tag', tag: name });
      }
      // emph / prosody / tone: their words are spoken normally.
      continue;
    }
    if (tok.type === 'close') {
      if (open && open.name === name) closeContainer(tok.end);
      continue;
    }
    // Empty tags.
    if (!EMPTY.has(name)) {
      diagnostics.push({ code: 'unknown_tag', tag: name });
      continue;
    }
    if (open) {
      // Board tags inside <write> are not allowed; ignore them.
      continue;
    }
    if (name === 'pause') {
      const ms = Number(tok.attrs?.ms);
      pauseMs += Number.isFinite(ms) ? Math.min(3000, Math.max(50, ms)) : 400;
      flushSegment();
      continue;
    }
    const action = emptyAction(name, tok.attrs ?? {}, diagnostics);
    if (action) actions.push({ at: speech.length, from: tok.start, to: tok.end, action });
  }
  const left = open as { name: string } | null;
  if (left) {
    diagnostics.push({ code: 'unclosed_tag', tag: left.name });
    closeContainer(null);
  }
  flushSegment();
  const sentences = sentencesOf(segments);
  return {
    sentences,
    diagnostics,
    hasBoard: sentences.some((s) => s.actions.length > 0),
  };
}
