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
 *   is never cut; only a header naming the reviewer's revision of the answer ("Bản đã sửa",
 *   "Revised answer", not "Bài giải đã sửa") alone on its line also ends a few opening sentences
 *   without learning material ("Chào em!\n\nBản đã sửa:"). At the very start, words only a
 *   reviewer writes ("mình giữ nguyên nội dung", "No changes needed.") are remarks too. A remark
 *   holding a number, a formula, a tag or code, or going on with more than a few words after
 *   "nhưng"/"rằng"/"but", stays unless a revision header follows it (it may be a correction the
 *   learner needs). A closing paragraph that opens by naming the draft goes when it holds none of
 *   these. Feedback on the learner's own draft or answer ("Bản nháp của em…", "Your answer…") is
 *   never a remark; when the question is about the learner's draft nothing of the wrapper is
 *   removed, and when it asks for a correction or a check of the learner's own work ("sửa giúp
 *   em", "em làm … đúng không?", "em lam dung khong a?" typed without accents, "is my answer
 *   right?") only words about the draft or the version under review count and a header alone
 *   does not end the opening sentences.
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

/** A whole Vietnamese word or phrase out of `words` (letters around it break the match). */
const viWords = (words: string) => String.raw`(?<![\p{L}\p{M}])(?:${words})(?![\p{L}\p{M}])`;

/** The learner speaking of themself ("em", "mình", "con", "tớ", "tôi"; "con người" is "humans"). */
const ME = String.raw`em|mình|con(?!\s+người)|tớ|tôi`;
/** "For me": `giúp`, `hộ`… ("giúp ích" is "is useful", not a request). */
const FOR_ME = String.raw`giúp(?!\s+ích)|hộ|dùm|giùm`;
/** Done for the learner: "giúp (em)", "hộ", or "cho em" ("cho" alone is no request). */
const BENEFIT = String.raw`(?:${FOR_ME})(?:\s+(?:${ME}))?|cho\s+(?:${ME})`;
/** Words that close a request: "với", "nhé", "ạ", "thầy ơi"… */
const PARTICLES = String.raw`(?:\s+(?:với|nhé|nha|ạ|à|thầy|cô|anh|chị|bạn|ơi))*`;
/** A sentence or the question ends: punctuation, or nothing more. */
const ENDS = String.raw`\s*(?:[?.!,;…]|$)`;
/**
 * `BENEFIT` after the work it is about: "giúp em", "cho em", or a bare "giúp" that ends the
 * request ("Sửa bài giúp với"; "Enzyme sửa lỗi giúp tế bào…" is biology).
 */
const BENEFIT_AFTER = String.raw`(?:${FOR_ME})\s+(?:${ME})|cho\s+(?:${ME})|(?:${FOR_ME})(?=${PARTICLES}${ENDS})`;
/** Verbs that correct or grade: with a piece of work they always mean the learner's own. */
const FIX = String.raw`sửa|chữa|chấm(?:\s+điểm)?|kiểm\s+tra|check`;
/** Verbs that judge a piece of work ("nhận xét bài này giúp em"), not a topic. */
const JUDGE = String.raw`nhận\s+xét|góp\s+ý|đánh\s+giá`;
/** A piece of work: "bài (làm/giải/tập)", "lời giải", "đáp án", "kết quả", "lỗi (sai)", "sai"… */
const WORK = String.raw`bài(?:\s+(?:làm|giải|tập))?|lời\s+giải|đáp\s+án|kết\s+quả|câu\s+trả\s+lời|cách\s+(?:làm|giải)|phần\s+(?:làm|giải)|lỗi(?:\s+sai)?|chỗ\s+sai|sai`;
/** What the learner made, for "xem" ("xem kết quả của mình" is a simulation's result). */
const OWN_WORK = String.raw`bài(?:\s+(?:làm|giải|tập))?|lời\s+giải|đáp\s+án|câu\s+trả\s+lời|cách\s+(?:làm|giải)|phần\s+(?:làm|giải)`;
/**
 * The work is the learner's: "của em", "em làm", "mình giải", a bare "em"/"mình" ("kết quả con
 * lắc" is a pendulum's, so a bare "con" is not).
 */
const MINE = String.raw`của\s+(?:${ME})|(?:${ME})\s+(?:đã\s+)?(?:làm|giải|viết|tính)|em|mình|tớ|tôi`;
/** "này", "đó": the work named before a request ("sửa bài này giúp em"). */
const THIS = String.raw`(?:\s+(?:này|đó|ấy))?`;
/** Where in the work: "sửa lỗi sai trong bài của em", "chỗ sai ở lời giải này giúp em". */
const IN_WORK = String.raw`(?:\s+(?:trong|ở)\s+(?:${OWN_WORK})${THIS})?`;
/**
 * What a bare request ("sửa giúp em") may go on with: nothing (the request ends: "Kiểm tra lại
 * giúp em.", "Sửa giúp em, v = …"), or the work it is about, then the end or ":" ("Thầy chữa giúp
 * em bài này", "Kiểm tra giúp em bài này: v = 20 m/s", "sửa giúp em chỗ này với"). A topic after
 * it ("kiểm tra giúp em điều kiện cân bằng…", "sửa giúp em lỗi chính tả…", "chữa giúp em bài tập
 * 5") is no request about the learner's work.
 */
const REQUEST_TAIL = String.raw`(?=${PARTICLES}${ENDS})|\s+(?:(?:${WORK})${THIS}${IN_WORK}|(?:cái|chỗ|đoạn|phần|câu)\s+(?:này|đó|ấy))(?=${PARTICLES}(?:${ENDS}|\s*:))`;
/** "không", "chưa" and their casual spellings ("k", "ko", "hông", "hk", "hok"). */
const NOT = String.raw`không|chưa|ko|k|hông|hk|hok`;
/** Words that may close a yes/no check: "ạ", "nhỉ", "thầy ơi"… */
const CHECK_PARTICLES = String.raw`(?:\s+(?:ạ|à|ha|nhỉ|nhé|nha|vậy|thế|hả|ơi|thầy|cô|anh|chị|bạn))*`;
/** "em làm vậy", "mình giải như thế này", "em tính kiểu này": the learner's own way of working. */
const OWN_WAY = String.raw`(?:${ME})\s+(?:đã\s+)?(?:làm|giải|tính|viết)(?:\s+bài(?:\s+(?:này|đó))?)?\s+(?:như\s+)?(?:vậy|vầy|thế(?:\s+này)?|này|kiểu\s+này|cách\s+này)`;

/**
 * Requests about the learner's own work, whole words only: "sửa giúp (em)" or "sửa cho em" that
 * ends or names the work, "chấm/chữa/kiểm tra bài giúp em", "sửa lỗi giúp em", "giúp em sửa bài
 * này", "nhận xét bài này giúp em", "xem giúp bài làm của em", "bài làm của em" anywhere, "em làm
 * … đúng không (thầy ơi)?", "đúng k ạ", "đúng hk thầy", "có sai không ạ?", "em sai ở đâu?", "xem
 * có sai chỗ nào không", "Em làm vậy ổn/được không?", "Em chọn đáp án C có được không?", "Đáp án A
 * đúng không thầy?", "check/fix/grade my …", "is my answer correct?", "is it right?" or "fix
 * this" at the end of the question, "am I right?", "did I solve this correctly?", "did I make a
 * mistake?", "where did I go wrong?", "Is answer A right?", "Is 20 m/s correct?", "I got 20 m/s,
 * right?". Not "Thầy xem giúp em bài này: …" or "Bài tập của em: …" (a new exercise), "xem kết
 * quả của mình" (a simulation's result), "con người", "con lắc", "nhận xét về …", "chỉnh lưu",
 * "điều chỉnh", "sửa sai ADN", "kiểm tra giúp em <a topic>", "… còn đúng không?", "Which … is
 * correct?", "Check this: <a new task>", "Why is it wrong to …?", "How do I fix this?" or "review
 * <topic>". Typed without accents: `FOLDED_REQUESTS`.
 */
const CORRECTION_REQUESTS: readonly RegExp[] = [
  // "sửa giúp em", "chữa lại hộ", "chấm điểm giúp", "kiểm tra lại giúp em", "sửa cho em", "check
  // giúp em bài này với: …", when the request ends or names the work (`REQUEST_TAIL`).
  new RegExp(viWords(String.raw`(?:${FIX})(?:\s+lại)?\s+(?:${BENEFIT})(?:${REQUEST_TAIL})`), 'iu'),
  // "sửa bài giúp em", "chữa bài cho em", "sửa lỗi giúp em", "sửa sai giúp em", "sửa bài của em",
  // "chấm bài em làm", "nhận xét bài này giúp em", "đánh giá lời giải của mình", "sửa lỗi sai
  // trong bài của em".
  new RegExp(
    viWords(
      String.raw`(?:${FIX}|${JUDGE})(?:\s+lại)?(?:\s+(?:${BENEFIT}))?\s+(?:${WORK})${THIS}${IN_WORK}\s+(?:${BENEFIT_AFTER}|${MINE})`,
    ),
    'iu',
  ),
  // "…, thầy xem giúp em", "Thầy nhận xét giúp em nhé": a look asked for at the very end, after
  // what the learner wrote ("Thầy xem giúp em bài này: …" goes on with a new exercise).
  new RegExp(
    String.raw`(?<![\p{L}\p{M}])(?:xem|${JUDGE})(?:\s+lại)?\s+(?:${BENEFIT})${PARTICLES}\s*[?.!…]*\s*$`,
    'iu',
  ),
  // "xem giúp bài làm của em", "xem bài em làm": "xem" only with work marked as the learner's.
  new RegExp(
    viWords(
      String.raw`xem(?:\s+lại)?(?:\s+(?:${BENEFIT}))?\s+(?:${OWN_WORK})${THIS}\s+(?:${MINE})`,
    ),
    'iu',
  ),
  // "xem giúp em bài làm này": "bài làm" after a request is the learner's work by itself.
  new RegExp(
    viWords(String.raw`(?:${FIX}|${JUDGE}|xem)(?:\s+lại)?(?:\s+(?:${BENEFIT}))?\s+bài\s+làm`),
    'iu',
  ),
  // "Bài làm của em: …", "lời giải của mình", "bài em làm", "Kết quả của em là …": the learner's
  // own work, anywhere. Not "bài (tập) của em" ("Bài tập của em hôm nay: …" is a new exercise),
  // "bài của mình" ("our lesson") or "kết quả của mình: đồ thị" (a simulation's result).
  new RegExp(
    viWords(
      String.raw`(?:bài\s+(?:làm|giải)|lời\s+giải|cách\s+(?:làm|giải)|phần\s+(?:làm|giải)|đáp\s+án|câu\s+trả\s+lời)\s+của\s+(?:${ME})|bài\s+(?:${ME})\s+(?:đã\s+)?(?:làm|giải)|kết\s+quả\s+của\s+(?:${ME})\s+là`,
    ),
    'iu',
  ),
  // "Giúp em sửa bài này", "hộ em chấm với": a correction asked for, then the work or the end.
  new RegExp(
    viWords(
      String.raw`(?:giúp|hộ)\s+(?:${ME})\s+(?:${FIX})(?:\s+lại)?(?:\s+(?:${WORK})|${ENDS}|\s+(?:với|nhé|nha|ạ))`,
    ),
    'iu',
  ),
  // A yes/no check of what the learner thinks: "… đúng không ạ?", "có đúng không", "đúng chưa
  // thầy", "đúng không thầy ơi?", "đúng k ạ", "đúng hk thầy", "có sai không ạ?", "Đáp án A đúng
  // không?". Only at the end of a sentence ("đúng không đổi", "sai không đáng kể" are no check),
  // and not after "còn"/"vẫn" (whether a law still holds: "… còn đúng không?").
  new RegExp(
    String.raw`(?<![\p{L}\p{M}])(?<!(?:còn|vẫn)\s+)(?:đúng|sai)\s+(?:${NOT})${CHECK_PARTICLES}${ENDS}`,
    'iu',
  ),
  // "Em làm như vầy được chưa thầy?", "Em làm vậy ổn không ạ?": the learner's way, judged.
  new RegExp(
    viWords(
      String.raw`${OWN_WAY}(?:\s+(?:thì|là))?(?:\s+có)?\s+(?:được|ổn|đúng|sai)\s+(?:${NOT})(?=${CHECK_PARTICLES}${ENDS})`,
    ),
    'iu',
  ),
  // "Em chọn đáp án C có được không ạ?", "mình chọn B đúng chưa": a choice the learner made.
  new RegExp(
    viWords(
      String.raw`(?:${ME})\s+(?:đã\s+)?chọn\s+(?:(?:đáp\s+án|câu|phương\s+án|ý)\s+)?[a-e](?![\p{L}\p{M}])[^.?!\n]*?(?<![\p{L}\p{M}])(?:được|ổn|đúng|sai)\s+(?:${NOT})(?=${CHECK_PARTICLES}${ENDS})`,
    ),
    'iu',
  ),
  // "Thầy xem có sai chỗ nào không ạ?", "kiểm tra giúp em có sai ở bước nào không".
  new RegExp(
    viWords(
      String.raw`(?:xem|kiểm\s+tra)(?:\s+(?:${BENEFIT}))?\s+(?:có\s+)?sai\s+(?:ở\s+)?(?:chỗ|bước|phần|đâu)`,
    ),
    'iu',
  ),
  // "Em sai ở đâu?", "em làm sai chỗ nào", "mình tính sai ở bước nào": where the learner went wrong.
  new RegExp(
    viWords(
      String.raw`(?:${ME})\s+(?:đã\s+)?(?:(?:làm|tính|giải|viết)\s+)?sai\s+(?:ở\s+)?(?:đâu|chỗ|bước|phần)`,
    ),
    'iu',
  ),
  /\b(?:check|fix|grade|mark|correct|review|improve)\s+(?:my|our)\b/i,
  // "Please fix this", "Can you check it for me?": at the end of the question only, and not asked
  // with "how"/"why" ("Check this: a ball falls…" is a new task, "correct this for air
  // resistance" is physics, "How do I fix this?" asks for a method).
  /(?<!\b(?:how|why)\b[^.?!:]*)\b(?:check|fix|grade|mark|correct)\s+(?:this|it|that|these)(?:\s+(?:for\s+me|please|again|now))*\s*[?.!]*\s*$/i,
  /\b(?:is|are)\s+my\s+(?:[a-z]+\s+){0,3}(?:correct|right|wrong|ok|okay)\b/i,
  // "Is it right?", "v = 20 m/s, is that right?": a sentence of its own at the end ("Why is it
  // wrong to add speeds…?" asks about physics).
  /(?:^|[.?!,;:]\s*|\b(?:so|and|but)\s+)(?:is|was)\s+(?:it|this|that)\s+(?:(?:all|really|actually|still)\s+)?(?:correct|right|wrong|ok|okay)\s*[?.!]*\s*$/i,
  /\bam\s+i\s+(?:right|correct|wrong)\b/i,
  /\b(?:did|have)\s+i\s+(?:get|got|gotten|do|done|solve|solved|answer|answered|work|worked|calculate|calculated)\b[^.?!]*\b(?:right|correct|correctly|wrong)\b/i,
  /\bdid\s+i\s+(?:make|get)\s+(?:a\s+|any\s+)?(?:mistakes?|errors?)\b/i,
  /\bwhere\s+did\s+i\s+go\s+wrong\b|\bwhat\s+did\s+i\s+(?:do|get)\s+wrong\b|\bwhere(?:['’]s|\s+is)\s+my\s+(?:mistake|error)\b/i,
  /\bis\s+(?:the\s+)?(?:answer|option|choice)\s+\(?[a-e]\)?\s+(?:correct|right|wrong)\b/i,
  // "Is 20 m/s correct?": a value the learner found, judged at the end of the sentence ("Is 90° a
  // right angle?" is geometry).
  /(?:^|[.?!]\s+)is\s+[-+−]?\d[\d.,]*(?:\s*[\p{L}/²³°·^*%-]+){0,3}\s+(?:correct|right|wrong)(?=\s*(?:[?.!,]|$))/iu,
  // "I got 20 m/s, right?"
  /\bi\s+(?:got|get|found|calculated|obtained|chose|picked|answered|wrote)\b[^.?!]*,\s*(?:right|correct)\s*\?/i,
];

/**
 * A question typed without accents ("em lam dung khong a?"), folded letter by letter to its base
 * ("đúng", "dùng" and "dừng" all give "dung"), one code unit for one so that a match maps back to
 * the question; `accented[i]` is true where the question's letter had a mark.
 */
function fold(question: string): { text: string; accented: boolean[] } {
  let text = '';
  const accented: boolean[] = [];
  for (const ch of question) {
    const base = ch === 'đ' ? 'd' : ch === 'Đ' ? 'D' : ch.normalize('NFD').replace(/\p{M}/gu, '');
    // A lone mark (decomposed typing NFC could not compose) stays, and counts as an accent.
    const kept = base.length === ch.length ? base : ch;
    text += kept;
    for (let k = 0; k < ch.length; k++) accented.push(kept !== ch || base === '');
  }
  return { text, accented };
}

/*
 * Folded spellings ("dung" is "đúng", "dùng" or "dừng"; "cham" is "chấm", "chậm" or "chạm"; "chua"
 * is "chữa", "chưa" or "chua"), so each pattern needs a context only the learner's own work gives:
 * an own-work subject ("em lam … dung khong"), a correcting verb with "giup em"/"bai", or "bai lam
 * cua em". "tớ" is left out ("to" is also "tô", "tổ", "to"), and "chấm" counts only as "cham bai"
 * or "cham diem" ("giang cham lai giup em" is "chậm lại").
 */
const F_ME = 'em|minh';
const F_FOR = 'giup|ho|dum|gium';
const F_BENEFIT = String.raw`(?:${F_FOR})(?:\s+(?:${F_ME}))?|cho\s+(?:${F_ME})`;
const F_PARTICLES = String.raw`(?:\s+(?:voi|nhe|nha|a|thay|co|anh|chi|ban|oi))*`;
const F_BENEFIT_AFTER = String.raw`(?:${F_FOR})\s+(?:${F_ME})|cho\s+(?:${F_ME})|(?:${F_FOR})(?=${F_PARTICLES}${ENDS})`;
const F_FIX = String.raw`sua|chua|kiem\s+tra|check`;
const F_JUDGE = String.raw`nhan\s+xet|gop\s+y|danh\s+gia`;
const F_OWN_WORK = String.raw`bai(?:\s+(?:lam|giai|tap))?|loi\s+giai|dap\s+an|cau\s+tra\s+loi|cach\s+(?:lam|giai)`;
const F_WORK = String.raw`${F_OWN_WORK}|ket\s+qua|loi(?:\s+sai)?|cho\s+sai`;
const F_THIS = String.raw`(?:\s+(?:nay|do|ay))?`;
const F_IN_WORK = String.raw`(?:\s+(?:trong|o)\s+(?:${F_OWN_WORK})${F_THIS})?`;
const F_NOT = 'khong|chua|ko|k|hong|hk|hok';
const F_CHECK_PARTICLES = String.raw`(?:\s+(?:a|ha|nhi|nhe|nha|vay|the|oi|thay|co|anh|chi|ban))*`;
/** Text inside one sentence; a decimal point ("9.8") does not end it. */
const F_SAME_SENTENCE = String.raw`(?:[^.?!\n]|\.(?=\d))*?`;
const F_CHECK_END = String.raw`(?=${F_CHECK_PARTICLES}${ENDS})`;

const FOLDED_REQUESTS: readonly RegExp[] = [
  // "sua giup em voi", "kiem tra lai giup em", "cham diem giup em", "sua giup em cho nay".
  String.raw`(?:(?:${F_FIX})(?:\s+lai)?|cham\s+diem)\s+(?:${F_BENEFIT})(?:(?=${F_PARTICLES}${ENDS})|\s+(?:(?:${F_WORK})${F_THIS}${F_IN_WORK}|(?:cai|cho|doan|phan|cau)\s+(?:nay|do|ay))(?=${F_PARTICLES}(?:${ENDS}|\s*:)))`,
  // "sua bai giup em voi", "thay cham bai giup em", "sua loi sai trong bai nay giup em".
  String.raw`(?:(?:${F_FIX})(?:\s+lai)?|cham|${F_JUDGE})(?:\s+(?:${F_BENEFIT}))?\s+(?:${F_WORK})${F_THIS}${F_IN_WORK}\s+(?:${F_BENEFIT_AFTER}|cua\s+(?:${F_ME})|em|(?:${F_ME})\s+(?:da\s+)?(?:lam|giai|viet|tinh))`,
  // "bai lam cua em: …", "loi giai cua minh", "bai em lam", "ket qua cua em la …".
  String.raw`(?:bai\s+(?:lam|giai)|loi\s+giai|cach\s+(?:lam|giai)|dap\s+an|cau\s+tra\s+loi)\s+cua\s+(?:${F_ME})|bai\s+(?:${F_ME})\s+(?:da\s+)?(?:lam|giai)|ket\s+qua\s+cua\s+(?:${F_ME})\s+la`,
  // "em lam dung khong a?", "em tinh ra v = 20 m/s, dung k a", "em ra 20 m/s dung hk thay".
  String.raw`(?:${F_ME})\s+(?:da\s+)?(?:lam|giai|tinh|ra|chon|viet)(?![\p{L}\p{M}])${F_SAME_SENTENCE}(?<![\p{L}\p{M}])(?:dung|sai)\s+(?:${F_NOT})${F_CHECK_END}`,
  // "em lam nhu vay duoc chua thay?", "em lam vay on khong a?".
  String.raw`(?:${F_ME})\s+(?:da\s+)?(?:lam|giai|tinh|viet)(?:\s+bai(?:\s+(?:nay|do))?)?\s+(?:nhu\s+)?(?:vay|the(?:\s+nay)?|nay|kieu\s+nay|cach\s+nay)(?:\s+(?:thi|la))?(?:\s+co)?\s+(?:duoc|on|dung|sai)\s+(?:${F_NOT})${F_CHECK_END}`,
  // "em chon dap an C co duoc khong a?".
  String.raw`(?:${F_ME})\s+(?:da\s+)?chon\s+(?:(?:dap\s+an|cau|phuong\s+an|y)\s+)?[a-e](?![\p{L}\p{M}])${F_SAME_SENTENCE}(?<![\p{L}\p{M}])(?:duoc|on|dung|sai)\s+(?:${F_NOT})${F_CHECK_END}`,
  // "Dap an A dung khong thay?".
  String.raw`dap\s+an\s+[a-e](?![\p{L}\p{M}])(?:\s+co)?\s+(?:dung|sai)\s+(?:${F_NOT})${F_CHECK_END}`,
  // "Em lam sai o dau vay thay?", "minh tinh sai buoc nao".
  String.raw`(?:${F_ME})\s+(?:da\s+)?(?:(?:lam|tinh|giai|viet)\s+)?sai\s+(?:o\s+)?(?:dau|cho|buoc|phan)`,
  // "thay xem co sai cho nao khong a?".
  String.raw`(?:xem|kiem\s+tra)(?:\s+(?:${F_BENEFIT}))?\s+(?:co\s+)?sai\s+(?:o\s+)?(?:cho|buoc|phan|dau)`,
  // "…, thay xem giup em" at the very end of the question.
  String.raw`(?:xem|${F_JUDGE})(?:\s+lai)?\s+(?:${F_BENEFIT})${F_PARTICLES}\s*[?.!…]*\s*$`,
].map((source) => new RegExp(viWords(source), 'giu'));

/** A folded pattern matches a part of the question typed without any accent. */
function asksForCorrectionUnaccented(question: string): boolean {
  const { text, accented } = fold(question);
  return FOLDED_REQUESTS.some((re) =>
    [...text.matchAll(re)].some(
      (m) => !accented.slice(m.index, m.index + m[0].length).some(Boolean),
    ),
  );
}

/**
 * The learner asked for a correction or a check of their own work (`CORRECTION_REQUESTS`): a
 * teacher's feedback may then come before a "Bản đã sửa:" of its own, and a labelled verdict
 * ("Đánh giá: Đúng.") is the answer they asked for, so neither marks the reviewer's notes.
 */
function asksForCorrection(question: string): boolean {
  const q = question.normalize('NFC');
  return CORRECTION_REQUESTS.some((re) => re.test(q)) || asksForCorrectionUnaccented(q);
}

/**
 * Words about the learner's own draft or answer (feedback they asked for, never the reviewer's
 * notes): "bản nháp của em", "bản nháp bạn gửi", "em đã viết bản nháp", "câu trả lời của em",
 * "your draft", "your answer", "the draft you…".
 */
const LEARNER_DRAFT: readonly RegExp[] = [
  /bản\s+nháp\s+(?:của\s+)?(?:các\s+)?(?:em|bạn|con|cậu)(?![\p{L}\p{M}])/giu,
  /(?<![\p{L}\p{M}])(?:em|bạn)(?:\s+[\p{L}\p{M}]+){0,3}\s+bản\s+nháp/giu,
  /(?:câu|bản)\s+trả\s+lời\s+(?:(?:ban\s+đầu|gốc|trên)\s+)?(?:của\s+)?(?:các\s+)?(?:em|bạn|con|cậu)(?![\p{L}\p{M}])/giu,
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
/**
 * Names only a reviewer gives the version it checks ("bản trả lời ban đầu", "the provided
 * response"); a teacher giving feedback on a learner's answer says "câu trả lời (của em)".
 */
const REVIEWED_VERSION = new RegExp(
  `bản\\s+trả\\s+lời\\s+${viWords('ban đầu|gốc|cần rà soát|được cung cấp|được đưa ra')}|\\bthe\\s+(?:provided|given|original|initial)\\s+response\\b`,
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
/**
 * What may follow a reviewer-only verdict for it to stay one: a few words naming the version
 * ("ban đầu", "như cũ", "as it was"), then the end of the sentence, a comma or "và/and …".
 * "ADN giữ nguyên nội dung thông tin…" and "The response is complete before the brain…" go on as
 * lesson sentences.
 */
const VERDICT_END = String.raw`(?:\s+(?:ban\s+đầu|gốc|cũ|như\s+cũ|như\s+trên|của\s+bản\s+nháp|as\s+it\s+was|as\s+is|of\s+the\s+draft))?(?:\s*(?:[.!…;,:]|$)|\s+(?:và|and)(?![\p{L}\p{M}]))`;
/**
 * Words only a reviewer writes about the answer it checked, with no label and no draft named
 * ("Câu trả lời đúng và đầy đủ, mình giữ nguyên nội dung.", "The response is accurate and
 * complete.", "No changes needed.", "I kept the explanation."). A remark only at the very start of
 * a reviewed answer, and not when the learner asked for a correction (the teacher may then say
 * "em giữ nguyên nội dung, chỉ sửa đơn vị"). "I kept the" names the text it kept ("I kept the
 * mass constant" is physics); "giữ nguyên nội dung" and "the response is correct" end their
 * clause (`VERDICT_END`).
 */
const REVIEWER_ONLY = new RegExp(
  `(?<![\\p{L}\\p{M}])giữ\\s+nguyên\\s+(?:nội\\s+dung|câu\\s+trả\\s+lời|bản\\s+nháp|lời\\s+giải|bài\\s+giảng)${VERDICT_END}|\\bno\\s+(?:changes?|edits?|corrections?)\\s+(?:are\\s+|were\\s+|is\\s+)?(?:needed|required|necessary)\\b|\\bI\\s+(?:have\\s+)?kept\\s+the\\s+(?:(?:original|same|whole)\\s+)?(?:answer|response|draft|explanation|content|wording|structure|lesson|text|solution|format|formatting)\\b|\\bthe\\s+(?:(?:provided|original|given)\\s+)?response\\s+is\\s+(?:(?:fully|largely|mostly)\\s+)?(?:accurate|correct|complete)${VERDICT_END}`,
  'iu',
);
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
  // "Bản trả lời ban đầu đã đúng", "The provided response is correct": the version under review,
  // never the learner's work, also when a correction was asked for.
  if (REVIEWED_VERSION.test(t) && hasVerdict(t)) return 'remark';
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

const REVISED = String.raw`\s+(?:đã\s+)?(?:được\s+)?(?:chỉnh sửa|hiệu chỉnh|viết lại|sửa)`;
/**
 * Only a reviewer names its revision of the ANSWER so ("Bản đã sửa", "Bản sửa", "Câu trả lời đã
 * chỉnh sửa", "Revised answer", "Corrected version"): these alone may end opening sentences.
 */
const HEADER_ANSWER = String.raw`(?:câu trả lời|bản)${REVISED}|(?:revised|corrected|improved|updated|rewritten|fixed)\s+(?:answer|version|response)`;
/**
 * A reviewer's header too, but a teacher who sets a misconception against the corrected solution
 * writes these as well ("Bài giải đã sửa:", "Lời giải đã sửa:", "Bản hoàn chỉnh").
 */
const HEADER_OTHER = String.raw`(?:lời giải|bài giảng|bài giải)${REVISED}|bản\s+(?:hoàn chỉnh|cuối cùng)|(?:revised|corrected|improved|updated|rewritten|fixed)\s+(?:lesson|explanation|solution)`;
/** A teacher may also write these ("Câu trả lời cuối cùng: v = 20 m/s"). */
const HEADER_WEAK = String.raw`câu trả lời\s+(?:hoàn chỉnh|cuối cùng)`;
/** The phrase that names the revision; group 1 is set for a weak one, group 2 for the answer's. */
const HEADER_PHRASE = new RegExp(
  String.raw`(?<![\p{L}\p{M}])(?:(${HEADER_WEAK})|(${HEADER_ANSWER})|${HEADER_OTHER})(?![\p{L}\p{M}])`,
  'giu',
);

/** Which revision headers count where a header is looked for. */
type HeaderLevel =
  /** Every header. */
  | 'any'
  /** Not the weak ones a teacher writes ("Câu trả lời cuối cùng:"). */
  | 'strong'
  /** Only the reviewer's revision of the answer (`HEADER_ANSWER`). */
  | 'answer';
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
 * `lineEnd`: the unit ends its line, so a header without ":" may stand at its end. `level`: which
 * headers count.
 */
function revisionHeaderEnd(
  unit: string,
  lineEnd: boolean,
  level: HeaderLevel,
  correction: boolean,
): number {
  let end = -1;
  for (const m of unit.matchAll(HEADER_PHRASE)) {
    if (level !== 'any' && m[1] !== undefined) continue;
    if (level === 'answer' && m[2] === undefined) continue;
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
  let headed = false;
  for (const u of units(text)) {
    const unit = text.slice(u.start, u.end);
    if (!unit.trim()) continue;
    const lineEnd = u.end === text.length || text[u.end] === '\n';
    // A weak header ("Câu trả lời cuối cùng:") counts only right after the reviewer's remarks;
    // after opening sentences that are no remark, only the reviewer's revision of the answer
    // ("Bản đã sửa:", not "Bài giải đã sửa:": a teacher sets a misconception against that).
    const level: HeaderLevel = gap?.early ? 'answer' : gap !== null || !opened ? 'strong' : 'any';
    const header = revisionHeaderEnd(unit, lineEnd, level, correction);
    if (header >= 0) {
      const after = text.slice(u.start + header, u.end).trim();
      // "Bản đã sửa: lực là vectơ." after a sentence that is no remark is a teacher's correction.
      if (gap?.early && (after || !lineEnd)) break;
      cut = u.start + header;
      held = false;
      opened = true;
      headed = true;
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
    let kind = remarkKind(unit, correction);
    // At the very start (before any header), words only a reviewer writes about the answer it
    // checked ("mình giữ nguyên nội dung", "No changes needed.") are a remark too.
    if (kind !== 'remark' && !correction && !headed && REVIEWER_ONLY.test(reviewerWords(unit))) {
      kind = 'remark';
    }
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
