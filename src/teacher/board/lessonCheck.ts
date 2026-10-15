/**
 * The board shows learning content only (item 1, layer B; docs/TEACHSCRIPT.md §7.1). Every answer,
 * TeachScript or markdown, becomes a typed, checked lesson before anything is drawn:
 *
 * - each written text is cleaned of leftover markup (`sanitizeBoardText`) and classified
 *   (`classifyBoardText`): hidden reasoning, prompt echoes, source lines and bare markup are
 *   neither written nor said; greetings and remarks about the answer ("Dưới đây là…") are said,
 *   never written. Only positive evidence drops a text: when unsure, it stays. A link goes, the
 *   content around it stays ("g = 9,81 m/s² (https://…)");
 * - a label alone ("Kết luận:", "Cho:") is not written; its meaning goes to the next written text
 *   (a conclusion is boxed once, never as an empty box);
 * - every written part has a kind (title, given, step, result, check…) and a length limit. A
 *   text is never cut inside a number or a formula: a long one with numbers or a formula ("a =
 *   F/m", "A → B", "H₂O") is split at clause boundaries into at most three writes, or kept whole
 *   (`limitBoardText`). Formulas written as math are never split here (the layout does);
 * - marks, arrows, points and corrections on a text that was dropped go too; a write repeated
 *   in the same or the next sentence (a glitch) is written once and still said; the same text in
 *   another part of the answer or on another face is written again; tables, flows and new-board
 *   titles are capped;
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
  markupToText,
  mathScripts,
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

/** A web address (a bare one; a markdown link keeps its words), with the spaces before it. */
const URL = /[ \t]*(?:\bhttps?:\/\/[^\s<>()[\]]+|\bwww\.[a-z0-9-]+\.[^\s<>()[\]]+)/gi;
const HOLD = /\u{E010}(\d+)\u{E011}/gu;
/** A markdown link "[words](address)", with the spaces before it. */
const MD_LINK = /([ \t]*)\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g;
/** Link words that only name the link ("[nguồn](…)", "[link](…)"): they go with it. */
const CITATION_WORDS =
  /^(?:nguồn|nguồn tham khảo|tham khảo|xem thêm|tại đây|liên kết|link|source|here)$/iu;
/** The name of a source a link cites at the end of a sentence ("… lục lạp [Wikipedia](…)."). */
const SOURCE_NAME = /^(?:wikipedia|wiki|sgk)$/iu;
/** Only punctuation or brackets until the end of the line. */
const TRAILING = /^[ \t)\].,;:!?…]*(?:\n|$)/u;
/**
 * A markdown link's words (with the spaces before them), or nothing when they only name it, or
 * when they name the source it cites and the link ends its sentence ("Quang hợp diễn ra ở lục lạp
 * [Wikipedia](…)." → "Quang hợp diễn ra ở lục lạp."; "Theo [Wikipedia](…), lực…" keeps it).
 */
function linkWords(m: RegExpExecArray): string {
  const space = m[1] ?? '';
  const words = (m[2] ?? '').trim();
  if (CITATION_WORDS.test(words)) return '';
  if (SOURCE_NAME.test(words) && TRAILING.test(m.input.slice(m.index + m[0].length))) return '';
  return `${space}${m[2] ?? ''}`;
}
/**
 * A link in brackets (not a markdown link's address), with the words in front of it in the
 * brackets: "(https://…)", "(theo Wikipedia: https://…)", "(nguồn: https://…)".
 */
const BRACKET_LINK =
  /[ \t]*(?<!\])\(([^()\n]*?)[ \t]*(?:\bhttps?:\/\/[^\s<>()[\]]+|\bwww\.[a-z0-9-]+\.[^\s<>()[\]]+)[ \t]*\)/giu;
/** Words that only say where a link leads ("theo Wikipedia:", "nguồn:", "xem"), folded. */
const SOURCE_PHRASE =
  /^(?:(?:theo|nguon|xem|see|source|sources|via|from|tai lieu|tham khao|ref|link|lien ket|wikipedia|wiki|sgk)\b[^()]{0,40})?$/;
/**
 * A link in brackets whose words only say where it leads goes with them ("(theo Wikipedia:
 * https://…)" → nothing, never "(theo Wikipedia:)"); other words in the brackets stay (the
 * address goes later), and so do words with a formula, a quantity or a number that is not a
 * citation's ("(theo định luật II, F = ma https://…)" keeps "theo định luật II, F = ma").
 */
function bracketLink(m: RegExpExecArray): string {
  const raw = m[1] ?? '';
  const words = fold(raw).replace(/[\s:：,.\-–—]+$/u, '');
  if (holdsWork(raw) || (/\d/.test(words) && !CITATION.test(words))) return m[0];
  return SOURCE_PHRASE.test(words) ? '' : m[0];
}
/** Brackets left empty once their address went ("m/s (https://…)." → "m/s."). */
const EMPTY_BRACKETS = /[ \t]*\(\s*\)/g;

/** `text` with every match of `re` replaced by `by(match)` (the match keeps its index and input). */
function replaceEach(text: string, re: RegExp, by: (m: RegExpExecArray) => string): string {
  let out = '';
  let pos = 0;
  for (const m of text.matchAll(re)) {
    out += text.slice(pos, m.index) + by(m);
    pos = m.index + m[0].length;
  }
  return out + text.slice(pos);
}

/**
 * The text with its web addresses removed: "[words](link)" keeps the words, a bare link goes, and
 * a link in brackets goes with the words that only name its source.
 */
export function withoutLinks(text: string): string {
  return replaceEach(replaceEach(text, BRACKET_LINK, bracketLink), MD_LINK, linkWords)
    .replace(URL, '')
    .replace(EMPTY_BRACKETS, '')
    .replace(/[ \t]{2,}/g, ' ');
}

/**
 * A written text without leftover markup: bold and other markdown marks, quote marks, escapes,
 * links (their words stay, a bare address goes; a link in brackets goes with the words that only
 * name its source), HTML and other leftover tags; `\(…\)` and `\[…\]` become `$…$`;
 * `<sub>`/`<sup>` become subscripts and superscripts, except a power of a number, which becomes
 * `$10^{-3}$` so its digits stay visible to the number checks. Formulas between `$` are not
 * touched, except that a `<sub>`/`<sup>` in them becomes TeX's `_{…}`/`^{…}`. For a math write,
 * only `$…$` or `\(…\)` around the whole formula go. Digits are never removed, except inside a web
 * address or a source named in a link's brackets.
 */
export function sanitizeBoardText(text: string, math = false): string {
  let t = text.normalize('NFC').trim();
  if (math) {
    const m = /^\$\$([\s\S]+)\$\$$|^\$([^$]+)\$$|^\\\(([\s\S]+)\\\)$|^\\\[([\s\S]+)\\\]$/.exec(t);
    if (m) t = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
    return mathScripts(t).replace(/\s+/g, ' ').trim();
  }
  t = t
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, tex: string) => `$${tex.trim()}$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, tex: string) => `$${tex.trim()}$`);
  const spans: string[] = [];
  t = t.replace(/\$[^$\n]+\$/g, (m) => {
    spans.push(m);
    return `\u{E010}${String(spans.length - 1)}\u{E011}`;
  });
  t = markupToText(t);
  t = withoutLinks(t)
    // Bold marks; a blank to fill in ("F = ____ N") keeps its underscores.
    .replace(/\*\*|~~/g, '')
    .replace(/(?<!_)__(?!_)/g, '')
    // *emphasis* (never "2 * 3 * 4": a space after the opening star is multiplication).
    .replace(/(?<![\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, '$1')
    .replace(/`([^`\n]*)`/g, '$1')
    .replace(/\\([*_#>~`[\]])/g, '$1')
    .replace(/^\s*(?:>\s*)+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.replace(HOLD, (_m, i: string) => mathScripts(spans[Number(i)] ?? ''));
}

// ------------------------------------------------------------ classification

/** Only markup: "---", "***", "> ", "|", "```", "• •". */
const MARKUP_ONLY = /^[\s\-–—*_=~#>|`.·•:]*$/u;
const LINK = /https?:\/\/|\bwww\.[a-z0-9-]+\./i;
/**
 * A source line: a link with only a short name around it ("Wikipedia: https://…", "Luật II
 * Newton - [https://…](…)", "Nguồn: Halliday (2011) https://…"). Longer text around a link is
 * content; only the link goes. So is a short one that holds a formula, a quantity, or a number
 * that is not a citation's ("g = 9,81 m/s² (https://…)."), and a short sentence ("Lực hấp dẫn là
 * lực hút giữa hai vật (https://…).", "Năm 1687, Newton công bố ba định luật (https://…)."): its
 * link goes, its words and numbers stay (`sourceLine`).
 */
const SOURCE_NAME_CHARS = 60;
/** What a source line opens with (folded): a source word, a source's name. */
const SOURCE_LEAD =
  /^(?:nguon|tai lieu|tham khao|xem them|xem|see|source|sources|references?|ref|wikipedia|wiki|sgk|link|lien ket)\b/;
/** A link that ends the line: only brackets and punctuation after it. */
const LINK_LAST = /(?:\bhttps?:\/\/|\bwww\.)[^\s<>]*[\s)\].,;:!?…]*$/i;
/** Words that make a sentence of a few words ("… là …", "… is …"), folded. */
const COPULA = /(?:^| )(?:la|is|are|was|were)(?: |$)/;

/**
 * `text` (with a link; `plain` is it sanitized, without the link) is a source line: what is left
 * is a source's name, not a sentence. It opens with a source word ("Nguồn:", "Wikipedia:", "SGK
 * …"); or the link ends the line after a name and ":" or "-" ("Chu kì tế bào: https://…"); or
 * the link ends the line and what is left is at most six words that neither end a sentence nor
 * say what something is ("… là …"). A formula, a quantity or a number that is not a citation's is
 * content. Only positive evidence: when unsure, the line stays and only its link goes.
 */
function sourceLine(text: string, plain: string): boolean {
  const rest = plain.replace(/[\s:：\-–—|·.,]+$/u, '');
  if (rest.length > SOURCE_NAME_CHARS) return false;
  const f = fold(rest);
  // "g = 9,81 m/s² (https://…)": the link goes, the content stays.
  if (holdsWork(rest) || (/\d/.test(rest) && !CITATION.test(f))) return false;
  // "Wikipedia là bách khoa toàn thư mở (https://…).": a sentence, also about a source.
  if (COPULA.test(f)) return false;
  if (SOURCE_LEAD.test(f)) return true;
  if (!LINK_LAST.test(text)) return false;
  if (/[:：\-–—|]\s*$/u.test(plain)) return true;
  if (/[.!?…]["”')\]]*\s*$/u.test(plain)) return false;
  return f.split(/[^\p{L}\p{N}]+/u).filter(Boolean).length <= 6;
}
/** A line that cites sources ("Tài liệu tham khảo: …", "References: …"): not lesson content. */
const SOURCES_LINE = /^(?:tai lieu tham khao|nguon tham khao|references?|sources|bibliography)\s*:/;
/**
 * What a citation's numbers look like (folded): a source word in front, an index "[1]", a year,
 * a page, a textbook's grade ("SGK Vật lý 10").
 */
const CITATION =
  /^(?:nguon|tai lieu|tham khao|xem them|xem|see|source|references?|ref|wikipedia|wiki|sgk|sach|giao trinh|bai bao|link|lien ket)\b|\[\d{1,3}\]|\b(?:1[5-9]|20)\d\d\b|\b(?:tr|trang|p|pp|page)\.?\s*\d|\b(?:vat ly|hoa hoc|sinh hoc|toan|physics|chemistry|biology) \d{1,2}\b/;

/**
 * Hidden reasoning written as plain words, a Think reviewer's note about the draft: never said,
 * never written. Folded text (no marks, lower case). Narrow on purpose (high precision): a
 * sentence about "the user" or the reply itself, never one about the lesson ("Mình cần suy nghĩ
 * xem vật chịu những lực nào.", "I need to answer two parts: speed and time.").
 */
const INTERNAL: readonly RegExp[] = [
  /^(?:ok(?:ay)?|alright|so)[, ]+(?:so |now )?(?:the user|let me think)\b/,
  /^let me (?:think|reconsider|re-?think|re-?check (?:my|the) (?:answer|reasoning|work))\b/,
  /^(?:the )?user (?:is asking|asks|asked|wants|wrote|said)\b/,
  /^(?:(?:ok(?:ay)?|alright|so|well|now)[, ]+)*i (?:need|should|must|have) to (?:respond|reply)\b/,
  /^(?:(?:ok(?:ay)?|alright|so|well|now)[, ]+)*i (?:need|should|must|have) to (?:answer|explain|figure out|address|help)\b.*\b(?:the user|user's|their question)\b/,
  /^(?:nguoi dung|user) (?:dang )?(?:hoi|muon|yeu cau)(?:\s*[:,.?!]|$| (?:ve|biet|minh|toi|giai thich|giai|tinh|hieu|tim hieu|lam ro|rang|la|xem|cach|tai sao|vi sao)\b)/,
  /^(?:minh|toi) (?:can|phai|nen) (?:tra loi|suy nghi|nghi)\b.*\b(?:nguoi dung|user|cach tra loi|cau tra loi cua minh|ban nhap|tra loi (?:the nao|ra sao|nhu the nao))\b/,
  /^(?:nhan xet|danh gia|ra soat)(?: chung)?(?: ve| cho| cua)? ban nhap\b/,
  /^ban (?:da )?(?:sua|chinh sua)\s*[:.]?$/,
  /^(?:revised|corrected) (?:answer|version)\s*[:.]?$/,
  /^(?:the )?draft (?:is|was|answer|response)\b/,
];

/** A text written with Vietnamese marks (not accentless). */
const hasMarks = (text: string): boolean => /[\u0300-\u036f]|đ/iu.test(text.normalize('NFD'));

/**
 * A greeting: "Chào …", "Xin chào …". Compared with the marks when the text has them: "Cháo là
 * thức ăn…" and "Chào mào là loài chim…" are lessons.
 */
function greets(text: string): boolean {
  const t = text.normalize('NFC').toLowerCase().trimStart();
  if (hasMarks(t)) return /^(?:xin )?chào(?! mào)(?![\p{L}\d])/u.test(t);
  return /^(?:xin )?chao(?! mao)\b/.test(fold(t));
}

/** Self-introductions, wishes, offers of more help: said, never written. Folded text. */
const SOCIAL: readonly RegExp[] = [
  /^(?:hello|hi|hey|greetings)(?![\w-])/,
  /^(?:toi|minh|em) la (?:mot )?(?:ai|tro ly|gia su|tro giang|chatbot|mo hinh)\b/,
  /\bla ai teacher\b/,
  /^i(?:'m| am) (?:an? )?(?:ai|assistant|tutor|language model)\b/,
  /^hy vong (?:rang|la|ban|em|cac ban|cac em|minh|toi|giai thich|bai giang|bai hoc|cau tra loi|loi giai|dieu nay|nhung|nay|se)\b/,
  /^(?:chuc (?:ban|em|cac ban|cac em)|rat vui)\b/,
  // Thanks to a person or for the question ("Cảm ơn bạn!", "Cảm ơn câu hỏi của em", "Cảm ơn sự
  // kiên nhẫn của bạn."), never "Cảm ơn lực ma sát, xe mới dừng được." (a lesson).
  /^cam on(?:\s*[!.,…]|\s*$| (?:ban|em|cac ban|cac em|thay|co|moi nguoi|nhieu|rat|vi|da|cau hoi|nhe|nha|a)\b)/,
  /^cam on [^,;:]* cua (?:ban|em|cac ban|cac em|moi nguoi)\s*[!.…]*$/,
  /^(?:i )?hope (?:this|that|it)\b/,
  /^(?:good luck|feel free|let me know|thanks(?! to\b)|thank you)\b/,
  /^neu (?:(?:ban|em|cac ban|cac em) )?(?:co|con) (?:bat ky |bat cu |them )?(?:cau hoi|thac mac|gi chua ro)\b/,
  /^neu (?:ban|em) (?:can|muon) (?:them|giai thich|ho tro|tiep tuc|biet them|hoi them|tim hieu them)\b/,
  /^(?:ban|em) (?:co|con) (?:bat ky |bat cu |them )?(?:cau hoi|thac mac)\b/,
  /^cau hoi (?:cua (?:ban|em) )?(?:rat |that |qua )?(?:hay|thu vi|tot)\b/,
  /^(?:dung ngan ngai|don'?t hesitate)\b/,
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
 * only of them is a remark about the lesson, not part of it. Compared with their marks: folded,
 * "có" and "cơ", "rồi" and "rơi", "đây" and "dây", "độ" and "do" would be one word.
 */
const GENERIC_VI = (
  'chúng ta tôi mình bạn em các sẽ cùng nhau giải bài toán tập này nhé nha câu hỏi tìm hiểu từng ' +
  'bước một hãy vấn đề nào với thông tin đã cung cấp đưa dựa trên theo cách chi tiết rõ hơn về ' +
  'cho là và thế những gì làm xem phân tích được rồi thôi à ạ ơi như sau đây dưới bắt đầu tiếp ' +
  'có không giúp ngay bây giờ trước hết thử nè nhỉ vâng ok oke kỹ kĩ thêm nếu cần muốn biết trả ' +
  'lời kết quả ngắn gọn hướng dẫn vui lòng xin chào'
)
  .normalize('NFC')
  .split(' ');
const GENERIC_EN = (
  "let lets let's us me we we'll will solve this that problem question questions together step " +
  "steps by the an now here here's is are look at you your help answer go through it it's do can " +
  "okay so first then and of to for with be going take quick sure great i'll i'm"
).split(' ');
/** Generic words of a text written with Vietnamese marks (or of an English text). */
const GENERIC = new Set([...GENERIC_VI, ...GENERIC_EN]);
/**
 * Generic words of a text written without marks ("Chung ta se cung giai"): folded forms, without
 * those that would also be a subject word ("co" cơ, "roi" rơi, "day" dây, "do" độ, "tim" tim…).
 */
const FOLDED_COLLISIONS = new Set(
  'co khong do dan hoi roi day tim qua cau van nao bay gio vang dau'.split(' '),
);
const GENERIC_FOLDED = new Set([
  ...GENERIC_VI.map(fold).filter((w) => !FOLDED_COLLISIONS.has(w)),
  ...GENERIC_EN,
]);
/**
 * A verdict on its own, perhaps after a label: "Không.", "Có không.", "Kết quả: Có", "Được.",
 * "Không được.", "Vâng.", "Dạ." ("Được nhé!" is a reply, not a verdict).
 */
const VERDICT =
  /^(?:[^:：]{1,30}[:：]\s*)?(?:(?:có thể|đúng vậy|không đúng|có|không|đúng|sai|vâng|dạ|yes|no)(?:\s+(?:có|không|đâu|ạ|nhé))?\s*[.!]*|(?:không )?được\s*\.?)$/iu;
/** A formula, an unknown or a symbol: never a remark. */
const SUBJECT_MARK = /[=?≈≤≥<>$\dͰ-Ͽ₀-₉⁰-⁹²³¹√∆∑∫]/u;

/**
 * A text made only of generic words (a remark about the lesson). `extra`: more words that carry
 * no subject matter where the caller looks.
 */
function isGeneric(text: string, extra: readonly string[] = []): boolean {
  if (SUBJECT_MARK.test(text) || VERDICT.test(text.trim())) return false;
  const marked = hasMarks(text);
  const words = text
    .normalize('NFC')
    .replace(/[’‘]/g, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
  if (words.length === 0) return false;
  return words.every((w) => {
    // A single letter is a symbol ("Tìm a.", "s"), except the English "I" and the particles.
    if (w.length === 1) return w === 'I' || w === 'à' || w === 'ạ';
    const lower = w.toLowerCase();
    return marked
      ? GENERIC.has(lower) || extra.includes(lower)
      : GENERIC_FOLDED.has(lower) || extra.some((e) => fold(e) === lower);
  });
}

/** "Mình hiểu ý (bạn)", "Tôi đã hiểu câu hỏi", "Tôi hiểu yêu cầu" (folded). */
const UNDERSTOOD = /^(?:toi|minh) (?:da |rat )?hieu (?:cau hoi|yeu cau|y)\b/;

/**
 * "Mình hiểu ý bạn.", "Tôi hiểu yêu cầu của bạn.": a remark, unless something about the lesson
 * follows ("Mình hiểu ý bạn là vật trượt không ma sát." is an assumption to write). `f` is `text`
 * folded.
 */
function understood(text: string, f: string): boolean {
  const m = UNDERSTOOD.exec(f);
  if (!m) return false;
  const rest = text.normalize('NFC').trim().split(/\s+/).slice(m[0].split(' ').length).join(' ');
  return !/[\p{L}\p{N}]/u.test(rest) || isGeneric(rest, ['của']);
}

/** A computation or a quantity with its unit ("v = 20 m/s", "sau 2 s"); "3 bước" is not one. */
const EQUATION_MARK = /[=≈≤≥≠]|\$[^$]+\$/u;
const QUANTITY =
  /\d(?:[.,]\d+)?\s*(?:km\/h|m\/s²?|m\/s\^?2|kg|mol|ml|mL|cm|mm|km|kPa|Pa|Hz|kJ|kW|°C|°|%|Ω|[mgsNJWVAKL])(?![\p{L}\d])/u;
const holdsWork = (text: string): boolean => EQUATION_MARK.test(text) || QUANTITY.test(text);

/** Where a greeting or a remark may end and the content start: after ":" or ",". */
const REMARK_END = /[:：](?:\*\*|__)?\s+|,(?:\*\*|__)?\s+/gu;
/** A reason after a remark ("Câu hỏi hay đấy, vì trọng lực…"): content even without a formula. */
const REASON_LEAD = /^(?:vì|bởi vì|bởi|do|because|since)(?![\p{L}])/iu;

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

/** A text's class, and for learning content the part of it that may be written. */
interface Classified {
  cls: TextClass;
  board: string;
}

/**
 * What a text is to the learner. High precision: a text is dropped only on positive evidence
 * (a known reasoning or reviewer phrase, a prompt label, a link, bare markup); a greeting or a
 * remark about the answer is said but not written, unless a computation follows it ("Chào em,
 * v = gt = 19,6 m/s."): then that computation is learning content; anything else is learning
 * content.
 */
export function classifyBoardText(text: string, options: ClassifyOptions = {}): TextClass {
  return classify(text, options).cls;
}

function classify(text: string, options: ClassifyOptions): Classified {
  const internal: Classified = { cls: 'internal', board: '' };
  if (MARKUP_ONLY.test(text)) return internal;
  const plain = sanitizeBoardText(text);
  // Bare markup, a tag, a link alone or a link with only a short name around it.
  if (MARKUP_ONLY.test(plain)) return internal;
  if (LINK.test(text) && sourceLine(text, plain)) return internal;
  const stripped = stripEchoLabel(plain);
  if (!stripped.text) return stripped.echo ? internal : { cls: 'meta', board: '' };
  const f = fold(stripped.text);
  if (SOURCES_LINE.test(f)) return internal;
  if (INTERNAL.some((re) => re.test(f))) return internal;
  // A verdict ("Được.", "Không.") answers the question: it is content.
  if (VERDICT.test(stripped.text.trim())) return { cls: 'learning', board: text };
  const remark: TextClass | null =
    greets(stripped.text) || SOCIAL.some((re) => re.test(f)) || understood(stripped.text, f)
      ? 'social'
      : META.some((re) => re.test(f))
        ? 'meta'
        : null;
  if (remark) {
    // "Dưới đây là công thức: a = F/m = 5 m/s²": the computation after the remark is written;
    // so is a reason after ":" or ", vì" ("Here is why: the net force is zero.").
    for (const m of text.matchAll(REMARK_END)) {
      const before = text.slice(0, m.index);
      if ((before.match(/\$/g) ?? []).length % 2 === 1) continue;
      const rest = text.slice(m.index + m[0].length).trim();
      const clean = sanitizeBoardText(rest);
      if (!rest || !/[\p{L}\p{N}]/u.test(clean)) continue;
      const colon = /^[:：]/u.test(m[0]);
      const reason = (colon || REASON_LEAD.test(clean)) && !isGeneric(clean);
      if (holdsWork(clean) || reason) {
        const after = classify(rest, options);
        if (after.cls === 'learning') return after;
      }
    }
    // A remark with a computation that no ":" or "," sets apart: when unsure, it stays.
    if (holdsWork(stripped.text)) return { cls: 'learning', board: text };
    return { cls: remark, board: '' };
  }
  if (!options.structural && isGeneric(stripped.text)) return { cls: 'meta', board: '' };
  return { cls: 'learning', board: text };
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

/** The name of a list of sources (folded). */
const SOURCES_LABEL =
  /^(?:tai lieu tham khao|nguon(?: tham khao)?|references?|sources?|bibliography)$/;

/** A closed list (folded): a line is a label only when it is exactly one of these. */
const LABELS: readonly (readonly [RegExp, LabelMeaning])[] = [
  [
    /^(?:ket luan|dap an|dap so|ket qua|tom lai|tong ket|(?:final )?answer|results?|conclusion|summary)$/,
    'result',
  ],
  [/^(?:cho|tom tat(?: de(?: bai)?)?|du kien|de (?:bai )?cho|given|known)$/, 'given'],
  [/^(?:tim|hoi|yeu cau|can tim|find|unknowns?)$/, 'find'],
  [/^(?:luu y|chu y|ghi chu|ghi nho|meo|notes?|tips?)(?: them)?$/, 'note'],
  [
    /^(?:tu kiem tra|kiem tra (?:tu|nhanh)|cau hoi (?:tu )?(?:kiem tra|cung co|on tap)|thu suc|thu thach|check yourself|quiz|try it)$/,
    'check',
  ],
  [/^(?:vi du(?: minh hoa)?|examples?)$/, 'example'],
  [
    // "Kiểm tra (lại):" in a solution means "verify the answer": a computation follows.
    /^(?:phan tich|(?:loi |bai |cach |huong dan )?giai|tra loi|cau tra loi|giai thich(?: chi tiet(?: hon)?| them)?|tinh toan|ly do|phuong phap|cac buoc(?: giai)?|trong do|kiem tra(?: lai)?|solution|analysis|explanation|steps|working|where|check|verification)$/,
    'neutral',
  ],
  [SOURCES_LABEL, 'sources'],
];

/**
 * The label's meaning when `text` is a label alone, else null: a word of the closed list, closed
 * by ":" ("Kết luận:", "**Phân tích:**") or set in bold on its own ("**Kết luận**"). A bare word
 * ("Yêu cầu", "Giải") may be content and stays. A label that says in brackets that sources follow
 * ("Ghi chú thêm (tài liệu tham khảo):") names a list of sources.
 */
export function labelOf(text: string): LabelMeaning | null {
  if (text.length > 60) return null;
  const plain = sanitizeBoardText(text);
  const bold = /^\s*(\*\*|__)[^*_]+\1\s*$/.test(text);
  if (!bold && !/[:：]\s*$/u.test(plain)) return null;
  let core = fold(plain).replace(/[\s:：.]+$/u, '');
  const bracket = /^(.+?)\s*\(([^()]{1,40})\)$/.exec(core);
  if (bracket?.[1] && bracket[2]) {
    if (SOURCES_LABEL.test(bracket[2].trim())) return 'sources';
    core = bracket[1];
  }
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
  const parts = sentences.map((s) => classify(s, options));
  const classes = parts.map((p) => p.cls);
  if (parts.every((p, i) => p.cls === 'learning' && p.board === sentences[i]))
    return { board: text, speech: text, cls: 'learning' };
  const board = parts.flatMap((p) => (p.cls === 'learning' ? [p.board] : [])).join(' ');
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

/**
 * A formula written as text: an equation or comparison sign, a reaction arrow, a sub- or
 * superscript digit ("a = F/m", "HCl + NaOH → NaCl + H₂O", "p = mv").
 */
const FORMULA_MARK = /[=≈≤≥≠→⇌⟶⇄↔₀-₉⁰-⁹²³¹]|\$[^$]+\$/u;

/** Digits outside the step's own numbering, or a formula (between `$` or written as text). */
export function holdsMaterial(text: string): boolean {
  return /\d/.test(stepBody(text)) || FORMULA_MARK.test(text);
}

/**
 * Where the last formula of a text ends: a `$…$`, or a sign or arrow written as text with the
 * rest of its clause ("p = mv, …" ends at the comma). 0 when it holds none.
 */
function formulaEnd(text: string): number {
  let end = 0;
  const masked = text.replace(/\$[^$]+\$/g, (m, at: number) => {
    end = Math.max(end, at + m.length);
    return ' '.repeat(m.length);
  });
  for (const m of masked.matchAll(/[=≈≤≥≠→⇌⟶⇄↔]/gu)) {
    const rest = masked.slice(m.index + 1);
    const stop = /[,;](?=\s)|[.!?…](?=\s|$)/u.exec(rest);
    end = Math.max(end, stop ? m.index + 1 + stop.index : text.length);
  }
  return end;
}

/**
 * The key point of a words-only text for the board (audit BRD-04); the whole text is still read
 * aloud. Text with numbers is kept whole (every number on the board is checked and must not be
 * cut), and a cut never falls inside or before a formula (`$…$`, "a = F/m", "A → B"): a text
 * whose formula ends it is kept whole.
 */
export function keyPoint(text: string, limit = PART_LIMIT.step): string {
  if (text.length <= limit || /\d/.test(stepBody(text))) return text;
  const head = text.slice(0, limit - 10);
  const clause = Math.max(head.lastIndexOf(','), head.lastIndexOf(';'), head.lastIndexOf(':'));
  const cut = clause >= Math.min(30, limit / 2) ? clause : head.lastIndexOf(' ');
  const at = Math.max(cut > 0 ? cut : head.length, formulaEnd(text));
  if (at >= text.replace(/[\s.!?…]+$/u, '').length) return text;
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

/** A symbol on the left of "=": "a", "v₀", "Wđ", "μn", "n(NaOH)", "Δt", "[OH-]". */
const LHS =
  /(?:^|[\s(:,;])((?:Δ|∆)?[A-Za-zα-ωΩ][A-Za-z0-9_₀-₉⁰-⁹'’đα-ω]{0,5}(?:\([^()\s]{1,12}\))?|\[[A-Za-z0-9+\-⁺⁻]{1,10}\])\s*$/u;
/**
 * Tokens an equation's right-hand side may hold: numbers, units, symbols (Greek letters, "½"),
 * operators, functions ("cos α").
 */
const RHS_TOKEN = /^[A-Za-z0-9.,+\-−*/×·⋅∙÷^=()[\]√π°%µΩΔ'’_⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀-₉{}\\½¼¾⅓⅔α-ωΑ-Ωđ≈]+$/u;
/** A right-hand side that does not end there: after an operator, "(", or a function name. */
const OPEN_END = /(?:[+\-−*/×·⋅∙÷^=([{\\√]|\b(?:sin|cos|tan|cot|log|ln|exp|sqrt))\s*$/u;

/** Brackets in order and closed: "½·(−2)·25" yes, "250 ml (dung" or "0)" no. */
function balanced(text: string): boolean {
  let depth = 0;
  for (const c of text) {
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}
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
    // "(μn = 0)": the bracket closes one opened before the symbol, not part of the formula.
    if (/\)$/.test(rhs) && !balanced(rhs) && head.slice(0, lhsStart).trimEnd().endsWith('(')) {
      rhs = rhs.slice(0, -1).trimEnd();
    }
    if (!rhs.trim() || rhs.length > 120 || !/[\d+\-−*/×·⋅∙÷^√½]/.test(rhs)) continue;
    // Written whole or not at all: a right side that stops after an operator, a "(" or a
    // function name, or with brackets left open, stopped inside the formula ("T = R *").
    if (OPEN_END.test(rhs) || !balanced(rhs)) continue;
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
  // A question in the side notes is the learner's check; one among the steps is lesson content
  // ("… sau 10 s dừng. Tính quãng đường?"), except the final one (`finalCheck`).
  if (w.zone === 'side_notes' && w.role === 'note' && asks(w.text)) return 'check';
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

const QUESTION = /\?\s*$/;
/** One of the text's sentences asks something ("Nếu … thì sao? Thử với m = 2 kg."). */
const asks = (text: string): boolean => splitSentences(text).some((s) => QUESTION.test(s));
/**
 * A sentence that answers the question before it: "Vì…", "Do…", "Because…", "Không, vì…". A
 * hint or data after a question ("Thử với m = 2 kg.") is not an answer.
 */
const ANSWER_LEAD =
  /^(?:(?:có|không|đúng|sai|yes|no)\s*[,:.]\s*)?(?:(?:đó là |là )?(?:vì|bởi vì|bởi|tại vì|do(?! (?:the|it|this|you|not|we)\b))|because|since)(?![\p{L}])/iu;

/**
 * The text asks the learner something: its last question is its last sentence, or only hints and
 * data follow it. "Vì sao vật rơi nhanh dần? Vì trọng lực không đổi…" is a question the teacher
 * answers, not a check.
 */
export function asksLearner(text: string): boolean {
  const sentences = splitSentences(text);
  let last = -1;
  sentences.forEach((s, i) => {
    if (QUESTION.test(s)) last = i;
  });
  return last >= 0 && sentences.slice(last + 1).every((s) => !ANSWER_LEAD.test(s.trim()));
}

/**
 * The question of a check written as several sentences ("Hãy nghĩ kỹ. Nếu … thì sao?"): the
 * last sentence that asks (else the last one), and every sentence with numbers or a formula (data
 * the learner needs is never dropped). The whole text is still said.
 */
export function questionOf(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return text;
  let ask = sentences.length - 1;
  sentences.forEach((s, i) => {
    if (QUESTION.test(s)) ask = i;
  });
  return sentences
    .filter((s, i) => i === ask || holdsMaterial(s) || EQUATION_MARK.test(s))
    .join(' ');
}

/**
 * The id of the lesson's final check question: its last written text, when that is a question
 * (a label, a greeting or a remark is not written, so it does not count).
 */
function finalCheck(script: ParsedScript): string | null {
  let last: { id: string; question: boolean } | null = null;
  for (const s of script.sentences)
    for (const { action: a } of s.actions) {
      if (a.kind !== 'write') continue;
      if (a.math) {
        last = { id: a.id, question: false };
        continue;
      }
      const text = sanitizeBoardText(a.text);
      const structural = a.zone === 'title' || a.role === 'heading';
      if (!text || (!structural && labelOf(text))) continue;
      const board = learningPart(text, { structural }).board;
      if (board) last = { id: a.id, question: !structural && asksLearner(board) };
    }
  return last?.question ? last.id : null;
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

/**
 * The speech without web addresses, by the rules of `withoutLinks` (a markdown link keeps its
 * words, a link in brackets goes with the words that only name its source); actions move with it.
 */
function speechWithoutLinks(
  speech: string,
  actions: readonly TimedAction[],
): { speech: string; actions: TimedAction[] } {
  if (!LINK.test(speech)) return { speech, actions: [...actions] };
  const named = replaceInSpeech(speech, actions, BRACKET_LINK, bracketLink);
  const words = replaceInSpeech(named.speech, named.actions, MD_LINK, linkWords);
  const bare = replaceInSpeech(words.speech, words.actions, URL, () => '');
  return replaceInSpeech(bare.speech, bare.actions, EMPTY_BRACKETS, () => '');
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

/**
 * A write's text as a repeat is compared: NFC, spaces collapsed, without its end punctuation. The
 * case counts ("F = 0" and "f = 0", "T" and "t" are different symbols), and so do the Vietnamese
 * marks ("Vật rơi" and "Vật rời" are two texts).
 */
const sameText = (s: string) =>
  s
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.,;:!?…]+$/u, '');

/**
 * A sentence that opens a new part of the answer ("Ở câu b, …", "b) …", "Bài 2: …", "Trường hợp
 * 2: …", "TH2", "Cách 2", "Vật B …", "Lần 2").
 */
const NEW_PART =
  /^(?:(?:ở|với|trong|sang|đến|còn|xét|tiếp theo,?|for|in)\s+)?(?:(?:câu|phần|ý|bài|trường hợp|cách|vật|lần|part|question|problem|case|method)\s+(?:[a-h]|\d{1,2})|th\s?\d{1,2})(?![\p{L}\d])|^[a-h][).](?:\s|$)/iu;

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
  /**
   * Writes by their text (zone, role, math and `sameText`): where each stood (sentence, offset in
   * its speech, face). A repeat is a glitch only right after the first in the same sentence
   * (nothing but blanks or punctuation said between them), or in the next sentence, on the same
   * face, in the same part of the answer. An erased write is forgotten (written again, it is new).
   */
  const seen = new Map<string, { id: string; sentence: number; at: number; face: number }>();
  /** Final checks written as results: a box on them is not drawn (a question is not an answer). */
  const unboxed = new Set<string>();
  /** Marks kept (kind, target, span): a mark moved from a dropped repeat is not drawn twice. */
  const marked = new Set<string>();
  const markKey = (a: Extract<BoardAction, { kind: 'mark' }>) =>
    `${a.mark}|${a.target}|${a.span ?? ''}`;
  /** What each kept write (or piece) shows. */
  const written = new Map<string, string>();
  const parts: BoardPart[] = [];
  const out: Sentence[] = [];
  let title: string | null = null;
  let pending: LabelMeaning | null = null;
  let newboards = 0;
  let carryPause = 0;
  const check = finalCheck(script);
  /** Writes the script boxes itself, in any sentence (the validator then adds no box). */
  const boxed = new Set(
    script.sentences.flatMap((s) =>
      s.actions.flatMap((t) =>
        t.action.kind === 'mark' && t.action.mark === 'box' && !t.action.span
          ? [t.action.target]
          : [],
      ),
    ),
  );

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
  /** Every id a write became (its pieces, or itself); null when it was dropped. */
  const resolveAll = (id: string): string[] | null => {
    const real = alias.get(id) ?? id;
    if (gone.has(real)) return null;
    return pieces.get(real)?.ids ?? [real];
  };

  let index = -1;
  for (const s of script.sentences) {
    index += 1;
    let order = 0;
    // "Ở câu b, …": the same result in another part of the answer is written again.
    if (NEW_PART.test(sanitizeBoardText(s.speech))) seen.clear();
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
    const keep = (at: number, action: BoardAction) => {
      if (action.kind === 'mark') marked.add(markKey(action));
      kept.push({ at, order: order++, action });
    };
    /** Says `text` where the write stood, unless the sentence already says it. */
    const sayInstead = (at: number, text: string) => {
      const words = text.trim();
      const said = [speech, ...inserts.map((i) => i.text)].join(' ');
      if (words && !alreadySaid(said, words)) inserts.push({ at, order: order++, text: words });
    };

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
          const isFinalCheck = a.id === check && !w.math;
          if (isFinalCheck && w.role === 'result') {
            // The final check asks the learner ("Vậy nếu m tăng gấp đôi thì…?"): a side note,
            // never a boxed result (a question is not the answer).
            w = { ...w, zone: 'side_notes', role: 'note', speed: 'normal' };
            box = false;
            unboxed.add(a.id);
          }
          const kind =
            forced ?? (isFinalCheck ? 'check' : kindOf(w, title === null && w.zone !== 'steps'));
          const key = `${w.zone}|${w.role}|${String(w.math)}|${sameText(w.text)}`;
          const first = seen.get(key);
          // "Vật A có a = 2 m/s² và vật B cũng có a = 2 m/s²": words between, two writes.
          const backToBack =
            first?.sentence === index && !/[\p{L}\p{N}]/u.test(speech.slice(first.at, at));
          if (first && first.face === newboards && (backToBack || first.sentence === index - 1)) {
            // The same write again right after the first (a glitch): not written twice. Its
            // marks go to the first (on the same face); a repeat in the next sentence is still
            // said where it stood.
            alias.set(a.id, first.id);
            drop('duplicate');
            if (first.sentence !== index) sayInstead(at, w.math ? `$${whole}$` : whole);
            break;
          }
          seen.set(key, { id: a.id, sentence: index, at, face: newboards });
          if (kind === 'title') title ??= w.text;
          // Only the learner's check is shortened to its question (and its sentences with data);
          // a question among the steps ("… sau 10 s dừng. Tính quãng đường?") is written whole.
          const board =
            (forced === 'check' || isFinalCheck) && !w.math ? questionOf(w.text) : w.text;
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
          // A final check is never boxed like a result.
          if (a.mark === 'box' && unboxed.has(alias.get(a.target) ?? a.target)) break;
          // A mark of a dropped repeat lands on the first write, unless that one has it already.
          const moved = alias.has(a.target);
          const keepMark = (target: string) => {
            const mark = { ...a, target };
            if (moved && marked.has(markKey(mark))) drop('duplicate');
            else keep(at, mark);
          };
          if (!a.span && a.mark !== 'box') {
            // The whole write is marked: every piece of it.
            const targets = resolveAll(a.target);
            if (targets === null) drop('orphan');
            else for (const target of targets) keepMark(target);
            break;
          }
          const target = resolve(a.target, a.span ? { span: a.span } : 'last');
          // Words that are no longer written (a label or a greeting taken off) are not marked.
          const shown = target === null ? undefined : written.get(target);
          if (target === null || (a.span && shown !== undefined && !shown.includes(a.span))) {
            drop('orphan');
          } else keepMark(target);
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
          // A write split into pieces: every piece is struck, the correction stands after the
          // last (the wrong figure may be in any of them).
          const targets = resolveAll(a.target);
          const target = targets?.[targets.length - 1] ?? null;
          const text = sanitizeBoardText(a.text);
          if (target === null) {
            drop('orphan');
            // Nothing to correct on the board any more: the correction is still said.
            sayInstead(at, text);
          } else if (!text) drop('empty');
          else {
            const strike = targets?.slice(0, -1) ?? [];
            const rest: BoardAction = { kind: 'correct', target, text };
            keep(at, strike.length > 0 ? { ...rest, strike } : rest);
          }
          break;
        }
        case 'erase': {
          const real = alias.get(a.target) ?? a.target;
          if (gone.has(real)) {
            drop('orphan');
            break;
          }
          for (const id of pieces.get(real)?.ids ?? [real]) keep(at, { kind: 'erase', target: id });
          // Erased, it is no longer on the board: the same text written again is written.
          for (const [k, v] of seen) if (v.id === real) seen.delete(k);
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
