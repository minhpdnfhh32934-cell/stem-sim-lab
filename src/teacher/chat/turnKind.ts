/**
 * What the learner's message is, for the way an on-device answer opens. Benchmark 2026-10-14
 * (docs/TEACHING_EVAL.md): "answer directly in the first sentence" made Gemma 1B open with
 * "Đúng!" on a question built on a wrong idea ("Có phải … không?") and on a learner's wrong
 * answer to the teacher's check question. Those turns get their own opening.
 */
export type TurnKind = 'question' | 'premise' | 'learnerReply';

/** A yes/no question that states an idea to confirm (which may be wrong). */
const PREMISE_QUESTION =
  /có phải|phải không|đúng không|có đúng (là|không)|chẳng phải|is it true|isn['’]t it|right\s*\?|correct\s*\?/iu;

/** Longest learner message still read as an answer to the teacher's check question. */
const LEARNER_REPLY_WORDS = 25;

/** The teacher's last message ends with a question (a check question). */
const TEACHER_ASKED = /\?[\s*_)"'”»]*$/u;

/** Where the learner's message came from. */
export interface TurnOrigin {
  /**
   * Sent by a quick button ("Giải thích lại", "Chậm hơn"…): a request to rework the last answer,
   * never an answer to the teacher's question, whatever its text says.
   */
  quickAction?: boolean;
  /**
   * A question about the part of the board the learner circled ("Khoanh để hỏi"): about that
   * part, never an answer to the teacher's question, however short it is ("g ở đây?").
   */
  boardAsk?: boolean;
}

/** Not followed by a letter, mark or digit: a whole word (`\b` only knows ASCII letters). */
const WORD_END = String.raw`(?![\p{L}\p{M}\d])`;
/** Not preceded by a letter, mark or digit. */
const WORD_START = String.raw`(?<![\p{L}\p{M}\d])`;

/** Lower case without accents (đ → d): how a message typed without Vietnamese accents looks. */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gu, 'd');

/**
 * A pattern for messages typed with accents and the same pattern without them: a message with no
 * accent at all ("thay giai thich lai giup em") is matched against the folded pattern only, so
 * "không hiệu quả" or "nổi lại" typed with accents never read as "không hiểu" or "nói lại".
 */
interface Words {
  accented: RegExp;
  folded: RegExp;
}
const words = (source: string): Words => ({
  accented: new RegExp(source, 'u'),
  folded: new RegExp(fold(source), 'u'),
});
const matches = (pattern: Words, text: string) =>
  (fold(text) === text ? pattern.folded : pattern.accented).test(text);
/** Whole-word alternatives anywhere in the text. */
const anywhere = (list: readonly string[]) =>
  words(list.map((w) => `${WORD_START}(?:${w})${WORD_END}`).join('|'));
/** Alternatives that open the text (after OPENERS). */
const atStart = (list: readonly string[]) => words(`^(?:${list.join('|')})${WORD_END}`);
/** Alternatives that are the whole message (after OPENERS), with polite endings. */
const whole = (list: readonly string[]) =>
  words(String.raw`^(?:${list.join('|')})(?:\s+(?:ạ|nhé|nha|với))?\s*[.!…]*$`);

/**
 * Polite openers and fillers skipped before looking at how a message starts ("Dạ,", "Vậy",
 * "Thầy ơi,", "Ủa", "Sorry,", "Sir,"). English "so" is not the start of Vietnamese "so sánh".
 */
const OPENERS = words(
  String.raw`^(?:(?:dạ|vâng|ừm|ừ|ờ|à|ủa|ơ|vậy|thế|nhưng|thưa thầy|thưa cô|thầy giáo ơi|cô giáo ơi|thầy ơi|cô ơi|thầy à|cô à|teacher|sir|miss|sorry|wait|yes|yeah|hi|hello|thanks|okay|ok|so(?!\s+sánh)|well|um|uh|hmm|oh)${WORD_END}[\s,.!:;…-]*)+`,
);
const withoutOpeners = (text: string) =>
  text.replace(fold(text) === text ? OPENERS.folded : OPENERS.accented, '');

/**
 * Asking for help anywhere in the message: lost ("Chưa hiểu ạ", "em không theo kịp", "I'm
 * lost"), asking to redo, read again or slow down ("giải thích lại", "đọc chậm lại"), for a hint
 * or another example, or about the last answer. Kept narrow, because a real answer read as a
 * request loses the "do not praise at once" rule (learnerReply): "Vật nhẹ rơi chậm hơn thầy ạ",
 * "Vật tiếp tục đi thẳng đều ạ", "Em cần biết khối lượng ạ", "Em lấy ví dụ cái tủ ạ", "Ví dụ khác
 * là xe đỗ trên dốc ạ" and "Enzyme không hiệu quả nữa ạ" stay answers.
 */
const HELP_ANYWHERE = anywhere([
  String.raw`(?:chưa|không|ko|k|hok|khum|khôg|chẳng|chả)\s+(?:hiểu|hỉu)(?!\s+(?:quả|lực|suất|số|điện)${WORD_END})`,
  String.raw`(?:chưa|không|ko|k)\s+(?:theo kịp|nắm được|nắm)|theo không kịp`,
  String.raw`khó\s+hiểu|hiểu\s+chưa\s+(?:rõ|kỹ|kĩ)|chưa\s+rõ\s+lắm|bí\s+(?:rồi|quá)`,
  String.raw`(?:giải thích|giảng|nói|đọc)\s+(?:lại|chậm|kỹ|kĩ|rõ hơn|dễ hiểu|đơn giản|thêm|giúp|hộ)`,
  String.raw`(?:làm|giải|tính)\s+(?:lại\s+)?(?:giúp|hộ)|(?:làm|giải)\s+lại\s+(?:đi|nhé|cho)`,
  String.raw`(?:em|mình|tôi|con)\s+(?:muốn|cần|xin)\s+(?:thầy|cô|ví dụ|gợi ý|giúp|hỏi|nghe lại|xem\s+(?:lời giải|đáp án|cách)|cách\s+(?:làm|giải)|thêm\s+(?:ví dụ|gợi ý)|một\s+(?:ví dụ|gợi ý))`,
  String.raw`(?:xin|cho em|cho mình)\s+(?:một\s+)?gợi ý|gợi ý\s+(?:đi|cho em|giúp|với)`,
  String.raw`thêm\s+(?:một\s+)?ví dụ(?!\s*(?:là|:|như|thì|nữa là)${WORD_END})`,
  String.raw`một\s+ví dụ\s+nữa(?!\s*(?:là|:|như|thì)${WORD_END})`,
  String.raw`ví dụ\s+(?:khác|nữa|thêm)(?:\s+nữa)?(?=\s*(?:đi|nhé|nha|giúp|được không)${WORD_END}|\s*(?:(?:thầy|cô)(?:\s+(?:ơi|ạ))?)?\s*[.!…]*$)`,
  String.raw`(?:câu trả lời|nội dung|phần|bài)\s+vừa\s+(?:rồi|giảng|nói|giải thích|giải)`,
  String.raw`viết tiếp|nói tiếp`,
  String.raw`i\s+(?:really\s+|still\s+)?(?:do not|don't|dont|did not|didn't|didnt|can't|cant|cannot)\s+(?:really\s+)?(?:understand|get|follow)`,
  String.raw`i(?:'m|m|\s+am)\s+(?:lost|confused|stuck|not following)|not\s+(?:sure\s+i\s+)?follow(?:ing)?`,
  String.raw`(?:your|the)\s+(?:last|previous)\s+answer|what you just\s+(?:said|explained|wrote|taught)`,
  String.raw`(?:do not|don't|dont)\s+(?:solve|give|tell)\s+(?:me|it|the)|just\s+(?:tell|give)\s+me\s+the\s+answer`,
  String.raw`(?:slower|simpler|more slowly|more simply|slow down|hint|example|examples|explain|repeat)(?:\s+(?:it|that))?(?:\s+again)?,?\s+(?:please|pls|plz)`,
  String.raw`(?:can|could)\s+(?:i|u|you)\s+(?:get|have|explain|repeat|go|give|show|say)`,
  String.raw`i\s+need\s+(?:another|an?|more|some)\s+(?:example|hint|help)`,
  String.raw`(?:explain|say)\s+(?:it\s+|that\s+)?again|one more time`,
]);

/**
 * Asking for help at the start (after OPENERS): the teacher asked to do something ("Thầy, giải
 * thích lại", "Thầy cho em…", "Thầy chậm lại chút") or an imperative ("Cho em…", "Chỉ em…",
 * "Gợi ý…", "Give me…", "Can you…"). "Thầy ơi, gia tốc giảm một nửa ạ." and "Cho em trả lời: …"
 * stay replies.
 */
const HELP_START = atStart([
  String.raw`(?:thầy|cô)(?:\s+giáo)?[\s,]+(?:hãy\s+|làm ơn\s+|có thể\s+)?(?:giải thích|giảng|dạy|nói|đọc|làm|cho|chậm|ví dụ|đơn giản|tóm tắt|nhắc|chỉ|hướng dẫn|gợi ý|vẽ|viết|tính|giải|đừng|minh họa|minh hoạ|trình bày|phân tích|so sánh|lấy|đưa|kể|giúp)`,
  String.raw`hãy|làm ơn|giúp\s+(?:em|mình|tôi)|cho\s+(?:em|mình|tôi|xin)(?!\s+(?:xin\s+)?trả lời)|hướng dẫn|chỉ\s+(?:em|mình|giúp|cho em)|giảng\s+(?:lại|giúp|hộ|cho)|nhắc lại|tóm tắt\s+(?:giúp|hộ|lại|cho)|minh họa|minh hoạ|đọc\s+(?:chậm|lại|to)`,
  String.raw`(?:dễ hiểu|đơn giản|chậm|kỹ|kĩ|ngắn gọn)\s+hơn\s+(?:đi|giúp|được không)`,
  String.raw`please|pls|plz|can you|could you|would you|will you|can u|could u|(?:re-?)?explain(?!\s*:)|repeat|go\s+(?:slower|over|through)|walk me|teach me|tell me|show me|give me|give\s+(?:a|an|another|one more)\s+(?:hint|example)|help me|hint|one more\s+(?:example|time)|more\s+examples?|in simpler words|(?:simpler|slower)\s+(?:words|explanation)|say (?:it|that) again|(?:didn't|didnt|did not)\s+get|confused`,
]);

/** A whole short message that asks for something ("Chậm thôi thầy", "Đáp án đi thầy", "Simpler"). */
const HELP_WHOLE = whole([
  String.raw`(?:chậm|đơn giản)\s+(?:lại\s+)?(?:đi|thôi)(?:\s+(?:thầy|cô))?`,
  String.raw`(?:tiếp tục|tiếp)\s+đi(?:\s+(?:thầy|cô))?`,
  String.raw`(?:đáp án|lời giải)(?:\s+(?:đi|nhé))?(?:\s+(?:thầy|cô))?`,
  String.raw`(?:giải|làm|gợi ý|ví dụ(?:\s+cụ thể)?)\s+(?:đi|giúp em)(?:\s+(?:thầy|cô))?`,
  String.raw`khó\s+quá(?:\s+(?:thầy|cô))?(?:\s+ơi)?`,
  String.raw`(?:again[,\s]+)?more slowly(?:,?\s+please)?|another\s+(?:example|way)(?:,?\s+please)?|simpler|slower`,
]);

/**
 * A question of its own even without "?": "Tại sao lại giảm một nửa ạ", "Gia tốc bằng bao
 * nhiêu", "Ý thầy là sao", "What do you mean", "How do I find a".
 */
const QUESTION_WORDS = anywhere([
  String.raw`là gì|vì sao|tại sao|thế nào|ra sao|bao nhiêu|là sao|thì sao|làm sao|sao lại|khi nào|nghĩa là gì|gì vậy`,
  String.raw`(?:what|how|why|which|where|when)\s+(?:is|are|was|does|do|did|would|will|should|can|much|many)`,
]);
/** A reason opens the sentence: "Vì sao? Vì a tỉ lệ nghịch với m." */
const REASON_START = atStart([String.raw`vì|do|bởi vì|bởi|tại vì|because|since`]);
const QUESTION_START = atStart([
  String.raw`why|what|how|when|where|which|who|whose|is it|does it|do you|can i|should i`,
]);

/** Task verbs: a sentence that opens with one sets a task, unless it reports a result. */
const TASK_VERBS = String.raw`(?:hãy\s+)?(?:tính|tìm|xác định|cho biết|nêu|trình bày|mô tả|liệt kê|kể tên|định nghĩa|phát biểu|chứng minh|so sánh|phân tích|vẽ|giải thích|giải\s+(?:bài|phương trình|hệ)|viết\s+(?:phương trình|pthh|công thức)|cân bằng\s+(?:phương trình|phản ứng)|hãy|find|calculate|compute|determine|work out|solve|evaluate|derive|describe|define|prove|compare|state\s+(?:the|why|what|how))`;
/** After a task verb, a result or a name, not a task: "Tính ra", "Tìm được", "Tính chất", "Giải thích là". */
const REPORTED = String.raw`(?!\s*(?:ra|được|là|thì|xong|theo|bằng|nhẩm|toán|chất|năng|cách|từ|rằng|lại\s+(?:ra|được))${WORD_END})`;
const TASK_START = words(`^${TASK_VERBS}${WORD_END}${REPORTED}`);
/** A clause break before a task verb ("…10 N, tính gia tốc", "…10 N, find a"). */
const CLAUSES = words(String.raw`(?<=[.!;…])\s+|\n+|,\s*(?=${TASK_VERBS}${WORD_END})`);
/** A task verb in the middle of a problem with no comma ("Vật 2 kg chịu lực 10 N tính gia tốc"). */
const TASK_INSIDE = words(
  String.raw`(?<!(?:em|mình|tôi|con|để|có thể|i|we|to)\s)${WORD_START}(?:tính|tìm|xác định|find|calculate|determine|compute|solve)${WORD_END}${REPORTED}`,
);
/** "Kể tên: ti thể…", "Explain: friction balances the pull": a task verb, a colon, the answer. */
const TASK_COLON = words(
  String.raw`^(?:kể tên|liệt kê|nêu|giải thích|so sánh|phân tích|trình bày|mô tả|explain|compare|describe|list|name)\s*:`,
);
/** Data of a problem: a value with a unit, or an assignment "m = 4 kg". */
const DATA = words(
  String.raw`\d\s*(?:kg|g|mg|n|kn|m|cm|mm|km|s|h|j|kj|w|kw|v|a|ω|°c|k|mol|l|ml|pa|m/s²?|km/h|%)${WORD_END}|\p{L}\s*=\s*[-−]?\d`,
);
/** Words that introduce given data, not a result: "khi m = 4 kg", "if m = 4 kg", "biết F bằng 10 N". */
const CONDITION = words(
  String.raw`${WORD_START}(?:khi|nếu|biết|với|cho|lấy|for|if|when|given|with)${WORD_END}`,
);

/**
 * A sentence that already carries the learner's work, so it is an answer even when it starts like
 * a task (the hint button asks the learner to try the next step): an equation written out, a chain
 * "a = F/m = 2,5", a computation "10 - 4 = 6", a result "Tính a = 2,5", "… được 2,5", "Kể tên: ti
 * thể…", a plan "Tính gia tốc trước ạ" / "Calculate the net force first", a "thì" clause without
 * new data, or a polite "ạ" at the end. Data such as "khi m = 4 kg, F = 10 N" is not work.
 */
function isWorkedStep(clause: string): boolean {
  const asked = (text: string) => !matches(CONDITION, text) && !/\d/u.test(text);
  const firstEquals = clause.indexOf('=');
  const resultWord = /\s(?:ra|được|bằng)\s+[-−]?\d/u.exec(clause);
  const chain = /=\s*([^=]*?)\s*=/u.exec(clause);
  return (
    (chain !== null &&
      !/,\s|;|\s(?:and|và)\s/u.test(chain[1] ?? '') &&
      !/\d\s*[\p{L}µ°%/²³]+[\s,]+\p{L}/u.test(chain[1] ?? '')) ||
    /\d\s*(?:[-+−×*·÷/:x])\s*\d[^=]{0,12}=\s*[-−]?\d/u.test(clause) ||
    /\p{L}\s*[/×*·]\s*\p{L}\s*=\s*[-−]?\d/u.test(clause) ||
    (firstEquals > 0 &&
      /^\s*[-−]?\d/u.test(clause.slice(firstEquals + 1)) &&
      asked(clause.slice(0, firstEquals))) ||
    (resultWord !== null && asked(clause.slice(0, resultWord.index))) ||
    matches(TASK_COLON, clause) ||
    // "Solve for a: 2.5": a value after a colon ends the sentence.
    /:\s*[-−]?\d[\d.,]*\s*[\p{L}/²³]{0,6}\s*[.!…]*$/u.test(clause) ||
    // A plan without new data ("Tính gia tốc trước ạ", "Calculate the net force first").
    (/(?:trước(?:\s+(?:ạ|đã))?|first(?:,?\s+then(?![\p{L}\p{M}\d]).*)?)\s*[.!…]*$/u.test(clause) &&
      !matches(DATA, clause)) ||
    (/\sthì\s/u.test(clause) && !matches(DATA, clause)) ||
    (/(?<![\p{L}\p{M}])ạ\s*[.!…]*$/u.test(clause) && !/giúp|hộ|cho em|với/u.test(clause))
  );
}

/** A request to the teacher (help, or a new task) rather than an answer to its question. */
function isRequest(message: string): boolean {
  const text = message.normalize('NFC').toLowerCase().replace(/[‘’]/gu, "'").trim();
  const start = withoutOpeners(text);
  if (matches(HELP_ANYWHERE, text) || matches(HELP_START, start) || matches(HELP_WHOLE, start))
    return true;
  const clauses = text
    .split(fold(text) === text ? CLAUSES.folded : CLAUSES.accented)
    .map((s) => withoutOpeners(s.trim()));
  if (clauses.some((s) => matches(TASK_START, s) && !isWorkedStep(s))) return true;
  // "Vật 2 kg chịu lực kéo 10 N tính gia tốc": a task verb inside a problem with its data.
  return matches(TASK_INSIDE, text) && matches(DATA, text) && !isWorkedStep(text);
}

/**
 * The learner asks something of their own (not a reply): a sentence ending in "?" or using a
 * question word. A sentence that repeats the teacher's question ("Gia tốc thế nào? Gia tốc giảm
 * một nửa ạ.") or a short "Vì sao?" before the reason is part of an answer.
 */
function asksSomething(message: string, teacher: string): boolean {
  const tokens = (s: string) => s.toLowerCase().match(/[\p{L}\p{M}\d]+/gu) ?? [];
  const teacherWords = new Set(tokens(teacher));
  const sentences = message
    .normalize('NFC')
    .trim()
    .split(/(?<=[.!?;…])\s+/u)
    .filter(Boolean);
  return sentences.some((sentence, i) => {
    const lower = sentence.toLowerCase();
    const asks =
      /\?/u.test(sentence) ||
      matches(QUESTION_WORDS, lower) ||
      matches(QUESTION_START, withoutOpeners(lower));
    if (!asks) return false;
    const own = tokens(sentence);
    const next = sentences[i + 1]?.toLowerCase();
    // Only before an answer: "Vậy nếu lực tăng gấp đôi thì sao" reuses the teacher's words but
    // asks something new.
    if (next === undefined) return true;
    const repeated = own.filter((w) => teacherWords.has(w)).length;
    if (own.length > 0 && repeated / own.length >= 0.6) return false;
    return !(own.length <= 2 && matches(REASON_START, next));
  });
}

export function turnKind(
  question: string,
  history: readonly { role: string; content: string; prompt?: string }[],
  origin: TurnOrigin = {},
): TurnKind {
  const last = history[history.length - 1];
  const count = (question.match(/[\p{L}\p{M}\d]+/gu) ?? []).length;
  // An answer to the teacher's check question: a statement (not a question or a request of its
  // own), not a long new message ("Gia tốc tăng gấp đôi ạ.", "Tính a = F/m = 2,5 ạ."). A quick
  // button, a help request ("Thầy giải thích lại…") or a new problem ("…10 N. Tính gia tốc.")
  // must not be judged as an answer. When unsure the message stays a reply: a wrong answer read as
  // a request would lose "do not praise at once" (ANSWER_OPENING.learnerReply).
  if (
    origin.quickAction !== true &&
    origin.boardAsk !== true &&
    last?.role === 'assistant' &&
    TEACHER_ASKED.test(last.content) &&
    count <= LEARNER_REPLY_WORDS &&
    !asksSomething(question, last.content) &&
    !isRequest(question)
  ) {
    return 'learnerReply';
  }
  return PREMISE_QUESTION.test(question) ? 'premise' : 'question';
}
