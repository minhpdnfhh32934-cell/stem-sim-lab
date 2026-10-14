/**
 * The board shows learning content only (item 1, layer B; docs/TEACHSCRIPT.md §7.1). Every answer,
 * TeachScript or markdown, becomes a typed, checked lesson before anything is drawn:
 *
 * - each written text is cleaned of leftover markup (`sanitizeBoardText`) and classified
 *   (`classifyBoardText`): hidden reasoning, prompt echoes, links and bare markup are neither
 *   written nor said; greetings and remarks about the answer ("Dưới đây là…") are said, never
 *   written. Only positive evidence drops a text: when unsure, it stays;
 * - a label alone ("Kết luận:", "Cho:") is not written; its meaning goes to the next written text
 *   (a conclusion is boxed once, never as an empty box);
 * - every written part has a kind (title, given, step, result, check…) and a length limit. A
 *   text is never cut inside a number or a formula: a long one with numbers is split at clause
 *   boundaries into at most three writes, or kept whole (`limitBoardText`). Formulas written as
 *   math are never split here (the layout does);
 * - marks, arrows, points and corrections on a text that was dropped go too; duplicate writes go;
 *   tables, flows and new-board titles are capped;
 * - what the teacher says is recomputed from what is still written, so the voice never reads a
 *   dropped write; a sentence left with nothing to say or do goes, and its pause moves on.
 *
 * Nothing here changes, rounds or invents a number (property test in lessonCheck.test.ts). Pure:
 * no store imports, so the parsers and the tests use it directly.
 */
import {
  EXCERPT_HEADER,
  EXCERPT_HEADER_COMPACT,
  SCREEN_HEADER,
  TOOL_HEADER,
} from '@/teacher/chat/promptLabels';
import {
  alreadySaid,
  spokenSentence,
  type BoardAction,
  type ParsedScript,
  type Role,
  type Sentence,
  type TimedAction,
  type Zone,
} from './teachscript';

export type PartKind =
  | 'title'
  | 'goal'
  | 'given'
  | 'concept'
  | 'definition'
  | 'equation'
  | 'step'
  | 'example'
  | 'note'
  | 'result'
  | 'check';

/** What a text is to the learner: learning content, a greeting, a remark about the answer, or internal. */
export type TextClass = 'learning' | 'social' | 'meta' | 'internal';

/** Longest text of each kind written as it is (characters). */
export const PART_LIMIT: Record<PartKind, number> = {
  title: 60,
  goal: 80,
  given: 120,
  concept: 80,
  definition: 100,
  equation: 120,
  step: 80,
  example: 80,
  note: 80,
  result: 100,
  check: 100,
};

/** A step that holds numbers or a formula may be longer than a words-only key point. */
const MATERIAL_LIMIT: Partial<Record<PartKind, number>> = { step: 140 };

/** At most this many writes come out of one long text with numbers. */
const MAX_PIECES = 3;
/** Tables, flows and new-board titles (cells and steps are short labels). */
const TABLE_ROWS = 8;
const TABLE_COLUMNS = 5;
const CELL_CHARS = 40;
const FLOW_STEPS = 6;
const FLOW_CHARS = 40;
const NEWBOARD_TITLE_CHARS = 40;

export interface BoardPart {
  id: string;
  kind: PartKind;
  text: string;
  math: boolean;
  zone: Zone;
  role: Role;
}

export type DropReason =
  'internal' | 'social' | 'meta' | 'label' | 'duplicate' | 'empty' | 'orphan';

/** The lesson as the board teaches it. `dropped` holds kinds and counts only, never learner text. */
export interface LessonOutline {
  title: string | null;
  parts: BoardPart[];
  dropped: { reason: DropReason; count: number }[];
}

export interface ValidatedLesson {
  script: ParsedScript;
  outline: LessonOutline;
}

// ------------------------------------------------------------ text helpers

/** Lower case, without Vietnamese marks ("Chào bạn" → "chao ban"), so accentless input matches too. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const SUBSCRIPT: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
};
const SUPERSCRIPT: Record<string, string> = {
  '+': '⁺',
  '-': '⁻',
  '−': '⁻',
};

/** HTML a model may write around words; the words stay. Block tags leave a space. */
const INLINE_HTML =
  /<\/?(?:b|i|u|em|strong|span|small|big|mark|code|s|del|ins|font|tt|kbd|var|abbr)\b[^<>]*>/gi;
const BLOCK_HTML = /<\/?(?:br|p|div|hr|li|ul|ol|center|blockquote|h[1-6])\b[^<>]*\/?>/gi;
/**
 * Any other leftover tag, only when it reads as one (a name, then `name="value"` pairs): "x<y và
 * y>z" is a comparison, not a tag.
 */
const LEFTOVER_TAG = /<\/?[a-z][a-z0-9_-]*(?:\s+[a-zA-Z_-]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*\/?>/g;
/** A web address (a bare one; a markdown link keeps its words). */
const URL = /\bhttps?:\/\/[^\s<>()[\]]+|\bwww\.[a-z0-9-]+\.[^\s<>()[\]]+/gi;
const HOLD = /\u{E010}(\d+)\u{E011}/gu;

/** The text with its web addresses removed: "[words](link)" keeps the words, a bare link goes. */
export function withoutLinks(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, '$1')
    .replace(URL, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ');
}

/**
 * A written text without leftover markup: bold and other markdown marks, quote marks, escapes,
 * links (their words stay, a bare address goes), HTML and other leftover tags; `\(…\)` and
 * `\[…\]` become `$…$`; `<sub>`/`<sup>` become subscripts and superscripts, except a power of a
 * number, which becomes `$10^{-3}$` so its digits stay visible to the number checks. Formulas
 * between `$` are not touched. For a math write, only `$…$` or `\(…\)` around the whole formula
 * go. Digits are never removed, except inside a web address.
 */
export function sanitizeBoardText(text: string, math = false): string {
  let t = text.normalize('NFC').trim();
  if (math) {
    const m = /^\$\$([\s\S]+)\$\$$|^\$([^$]+)\$$|^\\\(([\s\S]+)\\\)$|^\\\[([\s\S]+)\\\]$/.exec(t);
    if (m) t = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
    return t.replace(/\s+/g, ' ').trim();
  }
  t = t
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, tex: string) => `$${tex.trim()}$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, tex: string) => `$${tex.trim()}$`);
  const spans: string[] = [];
  t = t.replace(/\$[^$\n]+\$/g, (m) => {
    spans.push(m);
    return `\u{E010}${String(spans.length - 1)}\u{E011}`;
  });
  t = t
    .replace(/<sub>([^<>]{1,16})<\/sub>/gi, (_m, s: string) =>
      /^[0-9+-]+$/.test(s) ? Array.from(s, (c) => SUBSCRIPT[c] ?? c).join('') : `_${s}`,
    )
    .replace(
      /(\d+(?:[.,]\d+)?)?<sup>([^<>]{1,16})<\/sup>/gi,
      (_m, base: string | undefined, s: string) => {
        if (base && /\d/.test(s)) return `$${base}^{${s}}$`;
        if (base) return `${base}${superscript(s)}`;
        return superscript(s);
      },
    )
    .replace(INLINE_HTML, '')
    .replace(BLOCK_HTML, ' ')
    .replace(LEFTOVER_TAG, '');
  t = withoutLinks(t)
    .replace(/\*\*|__|~~/g, '')
    // *emphasis* (never "2 * 3 * 4": a space after the opening star is multiplication).
    .replace(/(?<![\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, '$1')
    .replace(/`([^`\n]*)`/g, '$1')
    .replace(/\\([*_#>~`[\]])/g, '$1')
    .replace(/^\s*(?:>\s*)+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.replace(HOLD, (_m, i: string) => spans[Number(i)] ?? '');
}

function superscript(s: string): string {
  if (/^[0-9+\-−]+$/.test(s)) {
    const digits = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    return Array.from(s, (c) =>
      /\d/.test(c) ? (digits[Number(c)] ?? c) : (SUPERSCRIPT[c] ?? c),
    ).join('');
  }
  return `^${s}`;
}

// ------------------------------------------------------------ classification

/** Only markup: "---", "***", "> ", "|", "```", "• •". */
const MARKUP_ONLY = /^[\s\-–—*_=~#>|`.·•:]*$/u;
const LINK = /https?:\/\/|\bwww\.[a-z0-9-]+\./i;
/**
 * A source line: a link with only a short name around it ("Wikipedia: https://…", "Luật II
 * Newton - [https://…](…)"). Longer text around a link is content; only the link goes.
 */
const SOURCE_NAME_CHARS = 60;
/** A line that cites sources ("Tài liệu tham khảo: …", "References: …"): not lesson content. */
const SOURCES_LINE = /^(?:tai lieu tham khao|nguon tham khao|references?|sources|bibliography)\s*:/;

/**
 * Hidden reasoning written as plain words, a Think reviewer's note about the draft: never said,
 * never written. Folded text (no marks, lower case). Narrow on purpose (high precision).
 */
const INTERNAL: readonly RegExp[] = [
  /^(?:ok(?:ay)?|alright|so)[, ]+(?:so |now )?(?:the user|let me think|i need to)\b/,
  /^let me (?:think|reconsider|re-?think|re-?check (?:my|the) (?:answer|reasoning|work))\b/,
  /^(?:the )?user (?:is asking|asks|asked|wants|wrote|said)\b/,
  /^i (?:need|should|must|have) to (?:answer|respond|reply|figure out|explain to the user)\b/,
  /^(?:nguoi dung|user) (?:dang )?(?:hoi|muon|yeu cau)\b/,
  /^(?:minh|toi) (?:can|phai) (?:tra loi cau hoi|suy nghi|nghi xem)\b/,
  /^(?:nhan xet|danh gia|ra soat)(?: chung)?(?: ve| cho| cua)? ban nhap\b/,
  /^ban (?:da )?(?:sua|chinh sua)\s*[:.]?$/,
  /^(?:revised|corrected) (?:answer|version)\s*[:.]?$/,
  /^(?:the )?draft (?:is|was|answer|response)\b/,
];

/** Greetings, self-introductions, wishes, offers of more help: said, never written. */
const SOCIAL: readonly RegExp[] = [
  /^(?:xin )?chao\b/,
  /^(?:hello|hi|hey|greetings)\b/,
  /\b(?:toi|minh|em) la (?:mot )?(?:ai|tro ly|gia su|tro giang|chatbot|mo hinh)\b/,
  /\bla ai teacher\b/,
  /^i(?:'m| am) (?:an? )?(?:ai|assistant|tutor|language model)\b/,
  /^hy vong\b/,
  /^(?:chuc (?:ban|em|cac ban|cac em)|cam on|rat vui)\b/,
  /^(?:i )?hope (?:this|that|it)\b/,
  /^(?:good luck|feel free|let me know|thanks|thank you)\b/,
  /^neu (?:ban|em|cac ban|cac em) (?:co|con) (?:bat ky |them )?(?:cau hoi|thac mac|gi chua ro)\b/,
  /^neu (?:ban|em) (?:can|muon) (?:them|giai thich|ho tro|tiep tuc|biet them|hoi them|tim hieu them)\b/,
  /^(?:ban|em) (?:co|con) (?:bat ky |them )?(?:cau hoi|thac mac)\b/,
  /^(?:duoc|vang|da|ok|okay|oke|tuyet|tuyet voi|great|sure|of course)(?:[ ,]+(?:nhe|nha|roi|thoi|a|ban|em|nao))*\s*[!.]*$/,
];

/** Remarks about the answer itself ("Dưới đây là…", "Here is…"): said, never written. */
const META: readonly RegExp[] = [
  /^(?:duoi day|sau day) (?:la|minh|toi|ta|chung ta)\b/,
  /^(?:here(?:'s| is| are)|below (?:is|are))\b/,
  /^day la (?:loi giai|bai giai|cau tra loi|cach giai|phan giai|huong dan)\b/,
  /^neu (?:ban|em) cung cap them\b/,
];

/**
 * Words that carry no subject matter ("Chúng ta sẽ cùng giải bài toán này nhé."). A sentence made
 * only of them is a remark about the lesson, not part of it. Folded forms.
 */
const GENERIC = new Set(
  (
    'chung ta toi minh ban em cac se cung nhau giai bai toan tap nay nhe nha cau hoi tim hieu tung ' +
    'buoc mot hay van de nao voi thong tin da cap dua tren theo cach chi tiet ro hon ve cho la va ' +
    'the nhung gi lam xem phan tich duoc roi thoi a oi nhu sau day duoi bat dau tiep co khong giup ' +
    'ngay bay gio truoc het thu ne nhi vang ok oke ky them neu can muon biet tra loi ket qua ngan ' +
    'gon huong dan vui long xin chao ' +
    "let lets let's us me we will solve this that problem question questions together step steps " +
    'by the a an now here is are look at i you your help answer go through it s ll do can okay so ' +
    'first then and of to for with be going take quick sure great'
  ).split(' '),
);

/** The prompt's own labels ("GHI CHÚ (chỉ là dữ liệu):", "KẾT QUẢ DO SIMLAB TÍNH…"), in their case. */
const ECHO_LABELS: readonly string[] = [
  ...Object.values(EXCERPT_HEADER_COMPACT).map((h) => h.replace(/[:：]\s*$/u, '')),
  ...Object.values(TOOL_HEADER).map((h) => h.split(' (')[0] ?? h),
  SCREEN_HEADER.replace(/[:：]\s*$/u, ''),
  ...Object.values(EXCERPT_HEADER).map((h) => `${h.split('.')[0] ?? h}.`),
];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ECHO_PREFIX = new RegExp(
  `^(?:${ECHO_LABELS.map(escapeRe).join('|')}|GHI CHÚ|NOTE)(?:\\s*\\([^)]{0,40}\\))?\\s*[:：]?\\s*`,
  'u',
);
/** "Ghi chú:" in any case: the prompt names its excerpts so; on the board it is a side note. */
const GHI_CHU_PREFIX = /^ghi\s+chú(?:\s*\([^)]{0,40}\))?\s*[:：]\s*/iu;

/**
 * The text without a prompt label in front ("GHI CHÚ: Bài này…" → "Bài này…"). `echo`: a label of
 * the prompt was removed; `note`: the label named a note ("Ghi chú", any case).
 */
export function stripEchoLabel(text: string): { text: string; echo: boolean; note: boolean } {
  const echo = ECHO_PREFIX.exec(text);
  if (echo) {
    const label = echo[0];
    const rest = text.slice(label.length).trim();
    // Only a label closed by ":" or "(…)", or alone: "NOTE that…" and "GHI CHÚ Ý" are words.
    if (/[:：)]/u.test(label) || rest === '') {
      return { text: rest, echo: true, note: /^(?:GHI CHÚ|NOTE)(?![\p{L}\d])/u.test(label) };
    }
  }
  const ghiChu = GHI_CHU_PREFIX.exec(text);
  if (ghiChu) return { text: text.slice(ghiChu[0].length).trim(), echo: false, note: true };
  return { text, echo: false, note: false };
}

export interface ClassifyOptions {
  /**
   * A title or heading: lesson structure, kept even when made of generic words only ("Bài tập");
   * the named greeting, remark and reasoning phrases still count.
   */
  structural?: boolean;
}

/**
 * What a text is to the learner. High precision: a text is dropped only on positive evidence
 * (a known reasoning or reviewer phrase, a prompt label, a link, bare markup); a greeting or a
 * remark about the answer is said but not written; anything else is learning content.
 */
export function classifyBoardText(text: string, options: ClassifyOptions = {}): TextClass {
  if (MARKUP_ONLY.test(text)) return 'internal';
  const plain = sanitizeBoardText(text);
  // Bare markup, a tag, a link alone or a link with only a short name around it.
  if (MARKUP_ONLY.test(plain)) return 'internal';
  if (LINK.test(text) && plain.replace(/[\s:：\-–—|·.,]+$/u, '').length <= SOURCE_NAME_CHARS) {
    return 'internal';
  }
  const stripped = stripEchoLabel(plain);
  if (!stripped.text) return stripped.echo ? 'internal' : 'meta';
  const f = fold(stripped.text);
  if (SOURCES_LINE.test(f)) return 'internal';
  if (INTERNAL.some((re) => re.test(f))) return 'internal';
  if (SOCIAL.some((re) => re.test(f))) return 'social';
  if (META.some((re) => re.test(f))) return 'meta';
  if (options.structural) return 'learning';
  const words = f.split(/[^a-z0-9']+/).filter(Boolean);
  if (words.length > 0 && words.every((w) => GENERIC.has(w))) return 'meta';
  return 'learning';
}

/** What a label alone ("Kết luận:", "Cho:") says about the text that follows it. */
export type LabelMeaning =
  | 'result'
  | 'given'
  | 'find'
  | 'note'
  | 'check'
  | 'example'
  /** "Tài liệu tham khảo:", "Nguồn:": a list of sources follows; the label is not even said. */
  | 'sources'
  | 'neutral';

/** A closed list (folded): a line is a label only when it is exactly one of these. */
const LABELS: readonly (readonly [RegExp, LabelMeaning])[] = [
  [
    /^(?:ket luan|dap an|dap so|ket qua|tom lai|tong ket|(?:final )?answer|results?|conclusion|summary)$/,
    'result',
  ],
  [/^(?:cho|tom tat(?: de(?: bai)?)?|du kien|de (?:bai )?cho|given|known)$/, 'given'],
  [/^(?:tim|hoi|yeu cau|can tim|find|unknowns?)$/, 'find'],
  [/^(?:luu y|chu y|ghi chu|ghi nho|meo|notes?|tips?)$/, 'note'],
  [
    /^(?:(?:tu )?kiem tra(?: lai| tu| nhanh)?|cau hoi (?:kiem tra|cung co|on tap)|thu suc|thu thach|check yourself|quiz|try it)$/,
    'check',
  ],
  [/^(?:vi du(?: minh hoa)?|examples?)$/, 'example'],
  [
    /^(?:phan tich|(?:loi |bai |cach |huong dan )?giai|tra loi|cau tra loi|giai thich(?: chi tiet(?: hon)?| them)?|tinh toan|ly do|phuong phap|cac buoc(?: giai)?|trong do|solution|analysis|explanation|steps|working|where)$/,
    'neutral',
  ],
  [/^(?:tai lieu tham khao|nguon(?: tham khao)?|references?|sources?|bibliography)$/, 'sources'],
];

/**
 * The label's meaning when `text` is a label alone, else null: a word of the closed list, closed
 * by ":" ("Kết luận:", "**Phân tích:**") or set in bold on its own ("**Kết luận**"). A bare word
 * ("Yêu cầu", "Giải") may be content and stays.
 */
export function labelOf(text: string): LabelMeaning | null {
  if (text.length > 60) return null;
  const plain = sanitizeBoardText(text);
  const bold = /^\s*(\*\*|__)[^*_]+\1\s*$/.test(text);
  if (!bold && !/[:：]\s*$/u.test(plain)) return null;
  const core = fold(plain).replace(/[\s:：.]+$/u, '');
  if (!core) return null;
  for (const [re, meaning] of LABELS) if (re.test(core)) return meaning;
  return null;
}

/** Sentences of a line: ". ", "! ", "? ", "… " end one; a step number "1." and a "$…$" do not. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of text.matchAll(/[.!?…]+(?=\s+\S)/g)) {
    const end = m.index + m[0].length;
    const head = text.slice(start, end);
    if (/^\s*(?:\*\*)?(?:\d{1,2}|[A-Fa-f])[.)]$/.test(head)) continue;
    if ((text.slice(0, m.index).match(/\$/g) ?? []).length % 2 === 1) continue;
    if (/(?:^|\s)(?:v\.v|tr|vd|e\.g|i\.e)\.$/i.test(head)) continue;
    out.push(head.trim());
    start = end;
  }
  const last = text.slice(start).trim();
  if (last) out.push(last);
  return out;
}

/**
 * The learning part of a line, sentence by sentence: `board` keeps the learning sentences (what
 * may be written), `speech` everything but internal ones (what may be said). The whole line's
 * class is `learning` when any sentence is.
 */
export function learningPart(
  text: string,
  options: ClassifyOptions = {},
): { board: string; speech: string; cls: TextClass } {
  const sentences = splitSentences(text);
  const classes = sentences.map((s) => classifyBoardText(s, options));
  if (classes.every((c) => c === 'learning')) return { board: text, speech: text, cls: 'learning' };
  const board = sentences.filter((_, i) => classes[i] === 'learning').join(' ');
  const speech = sentences.filter((_, i) => classes[i] !== 'internal').join(' ');
  const cls: TextClass = board
    ? 'learning'
    : classes.every((c) => c === 'internal')
      ? 'internal'
      : classes.includes('social')
        ? 'social'
        : 'meta';
  return { board, speech, cls };
}

// ------------------------------------------------------------ limits

/** The text without the step's own numbering ("2.", "Bước 2:", or both): that is not data. */
function stepBody(text: string): string {
  let body = text;
  for (let i = 0; i < 2; i++)
    body = body.replace(/^(?:(?:bước|step)\s*\d+|\d+[.)])\s*[:.]?\s*/i, '');
  return body;
}

/** Digits outside the step's own numbering, or a formula between `$`. */
function holdsMaterial(text: string): boolean {
  return /\d/.test(stepBody(text)) || /\$[^$]+\$/.test(text);
}

/**
 * The key point of a words-only text for the board (audit BRD-04); the whole text is still read
 * aloud. Text with numbers is kept whole (every number on the board is checked and must not be
 * cut), and a cut never falls inside a `$…$` formula.
 */
export function keyPoint(text: string, limit = PART_LIMIT.step): string {
  if (text.length <= limit || /\d/.test(stepBody(text))) return text;
  const head = text.slice(0, limit - 10);
  const clause = Math.max(head.lastIndexOf(','), head.lastIndexOf(';'), head.lastIndexOf(':'));
  const cut = clause >= Math.min(30, limit / 2) ? clause : head.lastIndexOf(' ');
  let at = cut > 0 ? cut : head.length;
  for (const m of text.matchAll(/\$[^$]+\$/g)) {
    const end = m.index + m[0].length;
    if (at > m.index && at < end) at = end;
  }
  if (at >= text.trimEnd().length) return text;
  return `${text.slice(0, at).trimEnd()}…`;
}

/** Where a long text may be cut: after ", " or "; ", before "nên", "suy ra"… (never in $…$ or brackets). */
function clauseCuts(text: string): { end: number; next: number }[] {
  const cuts: { end: number; next: number }[] = [];
  const re =
    /[,;]\s+|\s+(?=(?:nên|suy ra|do đó|vì vậy|vì thế|thì|therefore|hence|so that|then)\s)/giu;
  for (const m of text.matchAll(re)) {
    const before = text.slice(0, m.index);
    if ((before.match(/\$/g) ?? []).length % 2 === 1) continue;
    const depth = (before.match(/[([{]/g) ?? []).length - (before.match(/[)\]}]/g) ?? []).length;
    if (depth > 0) continue;
    const comma = /^[,;]/.test(m[0]);
    cuts.push({ end: comma ? m.index + 1 : m.index, next: m.index + m[0].length });
  }
  return cuts;
}

/** Greedy pieces of at most `limit` characters, cut only at `clauseCuts`; null when impossible. */
function splitClauses(text: string, limit: number): string[] | null {
  const ends = [...clauseCuts(text), { end: text.length, next: text.length }];
  const pieces: string[] = [];
  let start = 0;
  let i = 0;
  while (start < text.length) {
    let pick = -1;
    for (let j = i; j < ends.length; j++) {
      const e = ends[j];
      if (!e || e.end <= start) continue;
      if (e.end - start <= limit) pick = j;
      else break;
    }
    const chosen = ends[pick];
    if (!chosen) return null;
    pieces.push(
      text
        .slice(start, chosen.end)
        .replace(/[,;]\s*$/, '')
        .trim(),
    );
    start = chosen.next;
    i = pick + 1;
    if (pieces.length > MAX_PIECES) return null;
  }
  return pieces.filter(Boolean);
}

/**
 * A written text within its kind's limit. Math is never touched (the layout splits formulas). A
 * words-only text becomes its key point. A text with numbers or a formula is never cut inside one:
 * it is split at clause boundaries into at most three texts, or kept whole.
 */
export function limitBoardText(text: string, kind: PartKind, math = false): string[] {
  if (math) return [text];
  const material = holdsMaterial(text);
  const limit = material ? (MATERIAL_LIMIT[kind] ?? PART_LIMIT[kind]) : PART_LIMIT[kind];
  if (text.length <= limit) return [text];
  if (!material) return [keyPoint(text, limit)];
  if (kind === 'title') return [text];
  const pieces = splitClauses(text, limit);
  if (!pieces || pieces.length < 2 || pieces.length > MAX_PIECES) return [text];
  // A piece without numbers is held to the words-only limit like any other text.
  return pieces.map((p) => (holdsMaterial(p) ? p : keyPoint(p, PART_LIMIT[kind])));
}

/** A short label (table cell, flow step, new-board title): words cut, numbers kept whole. */
function shortLabel(text: string, limit: number): string {
  const clean = sanitizeBoardText(text);
  return clean.length <= limit || holdsMaterial(clean) ? clean : keyPoint(clean, limit);
}

// ------------------------------------------------------------ equations

export interface Equation {
  text: string;
  /** True for a `$…$` formula (KaTeX); plain-text equations are written as text. */
  math: boolean;
}

/** A symbol on the left of "=": "a", "v₀", "n(NaOH)", "Δt", "[OH-]". */
const LHS =
  /(?:^|[\s(:,;])((?:Δ|∆)?[A-Za-zαβγδεηθλμπρστφωΩ][A-Za-z0-9_₀-₉⁰-⁹'’]{0,5}(?:\([^()\s]{1,12}\))?|\[[A-Za-z0-9+\-⁺⁻]{1,10}\])\s*$/u;
/** Tokens an equation's right-hand side may hold: numbers, units, symbols, operators. */
const RHS_TOKEN = /^[A-Za-z0-9.,+\-−*/×·÷^=()[\]√π°%µΩΔ'’_⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀-₉{}\\]+$/u;
const RHS_STOP = new Set([
  'is',
  'are',
  'the',
  'and',
  'which',
  'so',
  'then',
  'for',
  'where',
  'with',
]);

/**
 * The equations of a long text, in order, at most `max`: every `$…$` formula, and plain-text
 * chains "a = F/m = 10/2 = 5 m/s²" whose right side holds a digit or an operator (written as text,
 * exactly as they stand).
 */
export function extractEquations(text: string, max = 4): Equation[] {
  const found: { at: number; eq: Equation }[] = [];
  const masked = text.replace(
    /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g,
    (m, a: string | undefined, b: string | undefined, offset: number) => {
      const tex = (a ?? b ?? '').trim();
      if (tex.length >= 2) found.push({ at: offset, eq: { text: tex, math: true } });
      return ' '.repeat(m.length);
    },
  );
  const bounds = [
    0,
    ...[
      ...masked.matchAll(
        /(?<=[.!?;])\s+|,\s+|\s+(?=(?:nên|suy ra|do đó|vì vậy|vì thế|thì|và|là)\s)/gu,
      ),
    ].map((m) => m.index),
    masked.length,
  ];
  for (let k = 0; k + 1 < bounds.length; k++) {
    const from = bounds[k] ?? 0;
    const clause = masked.slice(from, bounds[k + 1]);
    const eq = clause.indexOf('=');
    if (eq < 0) continue;
    const head = clause.slice(0, eq);
    const lhs = LHS.exec(head);
    if (!lhs?.[1]) continue;
    const lhsStart = head.lastIndexOf(lhs[1]);
    const tokens = clause.slice(eq + 1).split(/(\s+)/);
    let rhs = '';
    for (const tok of tokens) {
      if (/^\s+$/.test(tok) || tok === '') {
        rhs += tok;
        continue;
      }
      const word = tok.replace(/[.,;:!?]+$/, '');
      if (!RHS_TOKEN.test(word) || RHS_STOP.has(word.toLowerCase())) break;
      rhs += word;
      if (word !== tok) break;
    }
    rhs = rhs.trimEnd();
    if (!rhs.trim() || rhs.length > 120 || !/[\d+\-−*/×·÷^√]/.test(rhs)) continue;
    const start = from + lhsStart;
    const end = from + eq + 1 + rhs.length;
    found.push({ at: start, eq: { text: text.slice(start, end).trim(), math: false } });
  }
  return found
    .sort((a, b) => a.at - b.at)
    .slice(0, max)
    .map((f) => f.eq);
}

// ------------------------------------------------------------ the lesson

type Write = Extract<BoardAction, { kind: 'write' }>;

/** The kind of a written part, from its zone, role and words (no prompt change needed). */
function kindOf(w: Write, firstHeading: boolean): PartKind {
  if (w.zone === 'title' || (firstHeading && w.role === 'heading')) return 'title';
  if (w.role === 'result') return 'result';
  if (w.math) return 'equation';
  const f = fold(w.text);
  if (/\?\s*$/.test(w.text)) return 'check';
  if (/^(?:muc tieu|goal|objective)\b/.test(f)) return 'goal';
  if (
    w.zone === 'side_notes' &&
    /^(?:cho|tom tat|du kien|biet|given|de cho|tim|hoi|find)\b/.test(f)
  ) {
    return 'given';
  }
  if (w.role === 'note') return 'note';
  if (w.zone === 'example' || /^(?:vi du|example)\b/.test(f)) return 'example';
  if (/\b(?:duoc goi la|la dai luong|is defined as|is called)\b/.test(f)) return 'definition';
  if (w.role === 'keyword') return 'concept';
  return 'step';
}

/**
 * The question of a check written as several sentences ("Nếu … nhanh hơn. Hãy thử tính …?"):
 * the last sentence that asks, else the last one. The whole text is still said.
 */
export function questionOf(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return text;
  const asks = sentences.filter((s) => /\?\s*$/.test(s));
  return asks[asks.length - 1] ?? sentences[sentences.length - 1] ?? text;
}

/** A free id for the n-th piece of a split write; never of layout.freeId's `<id>_<n>` form. */
function pieceId(id: string, n: number, taken: Set<string>): string {
  let candidate = `${id}_p${String(n)}`;
  while (taken.has(candidate)) candidate += 'p';
  taken.add(candidate);
  return candidate;
}

function idsOf(script: ParsedScript): Set<string> {
  const ids = new Set<string>();
  for (const s of script.sentences)
    for (const { action: a } of s.actions)
      if (a.kind === 'write' || a.kind === 'draw' || a.kind === 'plot') ids.add(a.id);
  return ids;
}

/** Words put back into the speech where a dropped write stood (it is said instead of written). */
interface Insert {
  at: number;
  order: number;
  text: string;
}

/** The speech with `inserts` spliced in; the actions' offsets follow. */
function splice(
  speech: string,
  actions: { at: number; order: number; action: BoardAction }[],
  inserts: Insert[],
): { speech: string; actions: TimedAction[] } {
  if (inserts.length === 0)
    return { speech, actions: actions.map(({ at, action }) => ({ at, action })) };
  type Item =
    | { at: number; order: number; text: string }
    | { at: number; order: number; action: BoardAction };
  const items: Item[] = [...inserts, ...actions].sort((a, b) => a.at - b.at || a.order - b.order);
  let out = '';
  let pos = 0;
  const timed: TimedAction[] = [];
  for (const item of items) {
    const at = Math.min(speech.length, Math.max(pos, item.at));
    out += speech.slice(pos, at);
    pos = at;
    if ('text' in item) {
      const before = out && !/\s$/.test(out) ? ' ' : '';
      const after = /^[^\s.,;:!?…]/.test(speech.slice(pos)) ? ' ' : '';
      out += `${before}${item.text}${after}`;
    } else {
      timed.push({ at: out.length, action: item.action });
    }
  }
  out += speech.slice(pos);
  const said = out.trimEnd();
  return { speech: said, actions: timed.map((t) => ({ ...t, at: Math.min(t.at, said.length) })) };
}

/**
 * `speech` with every match of `re` replaced (by the result of `by`), the actions' offsets moved
 * with the text they stood at.
 */
function replaceInSpeech(
  speech: string,
  actions: readonly TimedAction[],
  re: RegExp,
  by: (m: RegExpExecArray) => string,
): { speech: string; actions: TimedAction[] } {
  const map: number[] = [];
  let out = '';
  let i = 0;
  for (const m of speech.matchAll(re)) {
    for (; i < m.index; i++) {
      map[i] = out.length;
      out += speech[i] ?? '';
    }
    const end = m.index + m[0].length;
    for (; i < end; i++) map[i] = out.length;
    out += by(m);
  }
  for (; i < speech.length; i++) {
    map[i] = out.length;
    out += speech[i] ?? '';
  }
  map[speech.length] = out.length;
  return {
    speech: out,
    actions: actions.map((a) => ({
      ...a,
      at: map[Math.max(0, Math.min(a.at, speech.length))] ?? out.length,
    })),
  };
}

/** The speech without web addresses (a markdown link keeps its words); actions move with it. */
function speechWithoutLinks(
  speech: string,
  actions: readonly TimedAction[],
): { speech: string; actions: TimedAction[] } {
  if (!LINK.test(speech)) return { speech, actions: [...actions] };
  const words = replaceInSpeech(
    speech,
    actions,
    /\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g,
    (m) => m[1] ?? '',
  );
  const bare = replaceInSpeech(words.speech, words.actions, URL, () => '');
  return replaceInSpeech(bare.speech, bare.actions, /\(\s*\)/g, () => '');
}

/** Caps a table or flow drawing (rows, columns, cell and step length). */
function capDrawing(a: Extract<BoardAction, { kind: 'draw' }>): BoardAction {
  if (a.type === 'table') {
    const cells = (row: unknown): string[] =>
      Array.isArray(row)
        ? row.slice(0, TABLE_COLUMNS).map((c) => shortLabel(String(c), CELL_CHARS))
        : [];
    const spec: Record<string, unknown> = { ...a.spec };
    if (Array.isArray(a.spec.header)) spec.header = cells(a.spec.header);
    if (Array.isArray(a.spec.rows)) spec.rows = a.spec.rows.slice(0, TABLE_ROWS).map(cells);
    return { ...a, spec };
  }
  if (a.type === 'flow' && Array.isArray(a.spec.steps)) {
    return {
      ...a,
      spec: {
        ...a.spec,
        steps: a.spec.steps.slice(0, FLOW_STEPS).map((s) => shortLabel(String(s), FLOW_CHARS)),
      },
    };
  }
  return a;
}

const sameText = (s: string) => fold(s).replace(/[\s.,;:!?…]+$/u, '');

/**
 * A written text without a label of the closed list in front that only names the part ("Trả
 * lời: Động năng là…" → "Động năng là…"); a label with a meaning ("Kết luận:", "Cho:") stays.
 */
export function withoutLeadLabel(text: string): string {
  const m = /^([^:：$]{2,30})[:：]\s+(\S[\s\S]*)$/u.exec(text);
  if (!m?.[1] || !m[2]) return text;
  return labelOf(`${m[1]}:`) === 'neutral' ? m[2] : text;
}

export interface ValidateOptions {
  /**
   * The script continues a lesson already on the board (only its new part is validated): it gets
   * no second title. A title before its first `<newboard>` becomes a heading among the steps.
   */
  append?: boolean;
}

/**
 * Validates a parsed lesson (TeachScript or markdown) before it is played: see the file comment.
 * Never throws; the script keeps its sentence structure (a sentence only disappears when nothing
 * is left to say or do in it) and each sentence keeps its place in the source (`start`/`end`).
 */
export function validateLesson(
  script: ParsedScript,
  options: ValidateOptions = {},
): ValidatedLesson {
  const counts = new Map<DropReason, number>();
  const drop = (reason: DropReason) => counts.set(reason, (counts.get(reason) ?? 0) + 1);
  const taken = idsOf(script);
  /** Ids whose write was dropped (marks on them go too). */
  const gone = new Set<string>();
  /** A duplicate's id → the id of the write it repeats. */
  const alias = new Map<string, string>();
  /** A split write's id → its pieces' ids (the first is the id itself). */
  const pieces = new Map<string, { ids: string[]; texts: string[] }>();
  const seen = new Map<string, string>();
  /** What each kept write (or piece) shows. */
  const written = new Map<string, string>();
  const parts: BoardPart[] = [];
  const out: Sentence[] = [];
  let title: string | null = null;
  let pending: LabelMeaning | null = null;
  let newboards = 0;
  let carryPause = 0;

  /** The id an action names, after duplicates and splits; null when its write was dropped. */
  const resolve = (id: string, pick: 'first' | 'last' | { span: string }): string | null => {
    const real = alias.get(id) ?? id;
    if (gone.has(real)) return null;
    const p = pieces.get(real);
    if (!p) return real;
    if (pick === 'first') return p.ids[0] ?? real;
    if (pick === 'last') return p.ids[p.ids.length - 1] ?? real;
    const i = p.texts.findIndex((t) => t.includes(pick.span));
    return p.ids[Math.max(0, i)] ?? real;
  };

  for (const s of script.sentences) {
    let order = 0;
    // Reasoning written as plain words in the speech, or a link alone, is never said; a link
    // inside a sentence is not read out (its words are).
    let speech = s.speech;
    let actions: readonly TimedAction[] = s.actions;
    if (/[\p{L}\p{N}]/u.test(speech) && classifyBoardText(speech) === 'internal') {
      speech = '';
      actions = actions.map((a) => ({ ...a, at: 0 }));
      drop('internal');
    } else {
      ({ speech, actions } = speechWithoutLinks(speech, actions));
    }
    const kept: { at: number; order: number; action: BoardAction }[] = [];
    const inserts: Insert[] = [];
    const keep = (at: number, action: BoardAction) => kept.push({ at, order: order++, action });
    /** Says `text` where the write stood, unless the sentence already says it. */
    const sayInstead = (at: number, text: string) => {
      const words = text.trim();
      const said = [speech, ...inserts.map((i) => i.text)].join(' ');
      if (words && !alreadySaid(said, words)) inserts.push({ at, order: order++, text: words });
    };
    const boxed = new Set(
      actions.flatMap((t) =>
        t.action.kind === 'mark' && t.action.mark === 'box' && !t.action.span
          ? [t.action.target]
          : [],
      ),
    );

    for (const { at, action: a } of actions) {
      switch (a.kind) {
        case 'write': {
          let text = sanitizeBoardText(a.text, a.math);
          if (!text) {
            gone.add(a.id);
            drop('empty');
            break;
          }
          let note = false;
          /** The text as the teacher means it (said whole when less is written). */
          let whole = text;
          if (!a.math) {
            const structural = a.zone === 'title' || a.role === 'heading';
            // A heading named "Kết luận" stays a heading.
            const label = structural ? null : labelOf(text);
            if (label) {
              // A label alone is said, never written; its meaning goes to the next write. The
              // name of a list of sources is not even said.
              pending = label;
              gone.add(a.id);
              drop('label');
              if (label !== 'sources') sayInstead(at, text);
              break;
            }
            const part = learningPart(text, { structural });
            if (part.cls === 'internal') {
              gone.add(a.id);
              drop('internal');
              break;
            }
            if (!part.board) {
              gone.add(a.id);
              drop(part.cls === 'social' ? 'social' : 'meta');
              sayInstead(at, part.speech);
              break;
            }
            // Greetings or remarks inside a written text are said, not written.
            if (part.board !== text) sayInstead(at, part.speech);
            const echo = stripEchoLabel(sanitizeBoardText(part.board));
            note = echo.note;
            whole = echo.text;
            text = structural ? echo.text : withoutLeadLabel(echo.text);
          }
          let w: Write = { ...a, text };
          let forced: PartKind | null = null;
          let box = false;
          const meaning: LabelMeaning | null = pending;
          pending = null;
          if (note || meaning === 'note') w = { ...w, zone: 'side_notes', role: 'note' };
          if (meaning === 'given' || meaning === 'find') w = { ...w, zone: 'side_notes' };
          if (meaning === 'result') {
            w = { ...w, role: 'result' };
            box = !boxed.has(a.id);
          }
          if (meaning === 'check') {
            // The learner's check question: a short side note.
            w = { ...w, zone: 'side_notes', role: 'note' };
            forced = 'check';
          }
          if (meaning === 'example') forced = 'example';
          if (options.append && newboards === 0 && w.zone === 'title')
            w = { ...w, zone: 'steps', role: 'heading' };
          if (w.noteFor) {
            // A note for a write that was dropped is a plain note.
            const target = resolve(w.noteFor, 'first');
            const rest: Write = { ...w };
            delete rest.noteFor;
            w = target ? { ...rest, noteFor: target } : rest;
          }
          const kind = forced ?? kindOf(w, title === null && w.zone !== 'steps');
          const key = `${w.zone}|${w.role}|${String(w.math)}|${sameText(w.text)}`;
          const first = seen.get(key);
          if (first !== undefined) {
            alias.set(a.id, first);
            drop('duplicate');
            break;
          }
          seen.set(key, a.id);
          if (kind === 'title') title ??= w.text;
          const board = kind === 'check' && !w.math ? questionOf(w.text) : w.text;
          const texts = limitBoardText(board, kind, w.math);
          // What is written is shorter than the text: the whole text is still said.
          if (texts.length > 1 || texts[0] !== whole) sayInstead(at, whole);
          const ids = texts.map((_, i) => (i === 0 ? a.id : pieceId(a.id, i + 1, taken)));
          if (texts.length > 1) pieces.set(a.id, { ids, texts });
          texts.forEach((t, i) => {
            const id = ids[i] ?? a.id;
            written.set(id, t);
            keep(at, { ...w, id, text: t });
            parts.push({ id, kind, text: t, math: w.math, zone: w.zone, role: w.role });
          });
          if (box) keep(at, { kind: 'mark', mark: 'box', target: ids[ids.length - 1] ?? a.id });
          break;
        }
        case 'mark': {
          const target = resolve(
            a.target,
            a.span ? { span: a.span } : a.mark === 'box' ? 'last' : 'first',
          );
          // Words that are no longer written (a label or a greeting taken off) are not marked.
          const shown = target === null ? undefined : written.get(target);
          if (target === null || (a.span && shown !== undefined && !shown.includes(a.span))) {
            drop('orphan');
          } else keep(at, { ...a, target });
          break;
        }
        case 'arrow': {
          const from = resolve(a.from, 'last');
          const to = resolve(a.to, 'first');
          if (from === null || to === null) drop('orphan');
          else keep(at, { ...a, from, to });
          break;
        }
        case 'point': {
          const target = resolve(a.target, 'first');
          if (target === null) drop('orphan');
          else keep(at, { ...a, target });
          break;
        }
        case 'correct': {
          const target = resolve(a.target, 'first');
          const text = sanitizeBoardText(a.text);
          if (target === null) {
            drop('orphan');
            // Nothing to correct on the board any more: the correction is still said.
            sayInstead(at, text);
          } else if (!text) drop('empty');
          else keep(at, { ...a, target, text });
          break;
        }
        case 'erase': {
          const real = alias.get(a.target) ?? a.target;
          if (gone.has(real)) {
            drop('orphan');
            break;
          }
          for (const id of pieces.get(real)?.ids ?? [real]) keep(at, { kind: 'erase', target: id });
          break;
        }
        case 'newboard': {
          newboards++;
          keep(
            at,
            a.title ? { kind: 'newboard', title: shortLabel(a.title, NEWBOARD_TITLE_CHARS) } : a,
          );
          break;
        }
        case 'draw':
          keep(at, capDrawing(a));
          break;
        case 'plot':
          keep(at, a);
          break;
      }
    }

    const spliced = splice(speech, kept, inserts);
    if (!spliced.speech.trim() && spliced.actions.length === 0) {
      // Nothing left to say or do: the sentence goes, its pause moves on.
      carryPause += s.pauseMs;
      continue;
    }
    out.push({
      speech: spliced.speech,
      spoken: spokenSentence(spliced.speech, spliced.actions),
      actions: spliced.actions,
      pauseMs: s.pauseMs + carryPause,
      ...(s.start !== undefined ? { start: s.start } : {}),
      ...(s.end !== undefined ? { end: s.end } : {}),
    });
    carryPause = 0;
  }
  const last = out[out.length - 1];
  if (carryPause > 0 && last) out[out.length - 1] = { ...last, pauseMs: last.pauseMs + carryPause };

  return {
    script: {
      sentences: out,
      diagnostics: script.diagnostics,
      hasBoard: out.some((s) => s.actions.length > 0),
    },
    outline: {
      title,
      parts,
      dropped: [...counts].map(([reason, count]) => ({ reason, count })),
    },
  };
}
