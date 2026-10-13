// Objective checks for AI Teacher answers (audit EDU-02). Used by the evaluation harness
// (scripts/teaching/eval-gemma.mjs, scripts/teaching/rescore.mjs) and tested in
// tests/teaching-rubric.test.ts. These checks only cover what can be checked mechanically; how
// clear an explanation is still needs a teacher's reading (docs/USER_TESTING.md).

/** Answer folded for matching: no accents, đ → d, lower case, single spaces. */
export function fold(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
    .replace(/\s+/g, ' ');
}

/**
 * Sentences of an answer: split after . ! ? … followed by white space, and at blank lines. A
 * single line break does not split, so a "Lỗi hay gặp:" heading stays with its line.
 */
export function sentences(text) {
  return text
    .split(/(?<=[.!?…])\s+|\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** White space, Markdown marks, closing brackets/quotes, emoticons and emoji after the text. */
const TRAILING =
  /(?:[\s*_`~#>|"'”’»)\]}]|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Variation_Selector}|\p{Join_Control}|[:;]-?[)D])+$/u;

/** The last sentence (Markdown, emoji and white space aside) is a question to the learner. */
export function endsWithQuestion(answer) {
  return /[?？]$/.test(answer.replace(TRAILING, ''));
}

/**
 * A question sentence that asks the learner for data ("Em cho thầy biết…", "Đề bài có cho…",
 * "…là bao nhiêu?", "…trong bao lâu?"). Known limit: a restated task ("Quãng đường là bao
 * nhiêu?") also matches; the invented-number checks below catch the usual case where the model
 * then answers it itself.
 */
const ASKS_FOR_DATA =
  /\b(cho (thay |minh |toi |co |anh |chi |chung ta )?biet|cung cap|thieu|chua (co|cho|neu)|can (biet|them|co)|(em|ban) (da )?cho|(de bai|bai toan) (co |da )?(cho|neu)|de (co|da) (cho|neu)|(la|bang) bao nhieu|bao lau)\b/;
// In the patterns below a number stands alone: not a symbol such as v₀ (folded "v0"), 2n or H₂O.
/** A value the model assumes in the same sentence: "giả sử v = 20", "ví dụ t = 5 s". */
const ASSUMES_VALUE =
  /\b(gia su|gia dinh|chang han|vi du|assume|assuming|suppose|let's say|for example)\b.*(?<![a-z\d])\d+(?:[.,]\d+)?(?![a-z\d])/;
/** A computed or estimated number: "= 200", "khoảng 50 km", "kết quả là 4". */
const STATES_RESULT =
  /=\s*[*_]*\s*-?\d|\b(khoang|xap xi|uoc tinh|du doan|ket qua)\b.{0,40}(?<![a-z\d])\d+(?:[.,]\d+)?(?![a-z\d])/;

/**
 * The answer asks for the missing data instead of inventing numbers: a sentence ending in "?"
 * asks for the data, and no value is assumed or result computed anywhere in the answer.
 */
export function asksForMissingData(answer) {
  const parts = sentences(answer);
  const asks = parts.some((s) => endsWithQuestion(s) && ASKS_FOR_DATA.test(fold(s)));
  const invents = parts.some((s) => {
    const f = fold(s);
    return ASSUMES_VALUE.test(f) || STATES_RESULT.test(f);
  });
  return asks && !invents;
}

/** Share of words written in English (a Vietnamese answer should have few). */
export function englishShare(answer) {
  const words = answer.split(/\s+/).filter((w) => /^[A-Za-z]{3,}$/.test(w));
  const common = /^(the|and|with|from|that|this|for|are|was|you|your|have|has|will|not|but)$/i;
  const all = answer.split(/\s+/).filter(Boolean).length || 1;
  return words.filter((w) => common.test(w)).length / all;
}

/**
 * A sentence that names a misconception (the teaching method asks for one), e.g. "Lỗi hay gặp:
 * nghĩ vật nặng rơi nhanh hơn". A known wrong statement inside it is not the model's claim.
 */
const MISCONCEPTION =
  /\b(loi (hay|thuong) gap|nhieu (ban|nguoi) (hay |thuong |van )?(nghi|tuong|cho rang)|sai lam|hieu nham|hieu sai|nham lan|quan niem sai|misconception|common mistake)\b/;

/** The mustNot patterns that match outside a misconception sentence. */
function knownErrors(item, answer) {
  // Fold sentence by sentence and remember where each one sits: a pattern can still span two
  // sentences, and a hit is ignored only when it starts and ends in misconception sentences.
  let text = '';
  const spans = [];
  for (const s of sentences(answer).map(fold)) {
    if (text) text += ' ';
    spans.push({ start: text.length, end: text.length + s.length, marked: MISCONCEPTION.test(s) });
    text += s;
  }
  const marked = (i) => spans.some((s) => s.marked && i >= s.start && i < s.end);
  return (item.mustNot ?? []).filter((p) =>
    [...text.matchAll(new RegExp(p, 'g'))].some(
      (m) => !(marked(m.index) && marked(m.index + Math.max(0, m[0].length - 1))),
    ),
  );
}

/**
 * Scores one answer. keyFacts: groups of alternative patterns (each group needs one match);
 * mustNot: patterns of known wrong statements (not counted inside a misconception sentence).
 */
export function scoreAnswer(item, answer) {
  const f = fold(answer);
  const facts = (item.keyFacts ?? []).map((group) => group.some((p) => new RegExp(p).test(f)));
  const wrong = knownErrors(item, answer);
  const checks = {
    keyFacts: facts.length ? facts.filter(Boolean).length / facts.length : 1,
    noKnownErrors: wrong.length === 0,
    checkQuestion:
      item.type === 'followup' || item.type === 'missing-data' ? null : endsWithQuestion(answer),
    asksClarification: item.expectsClarify ? asksForMissingData(answer) : null,
    englishShare: englishShare(answer),
    chars: answer.length,
  };
  return { id: item.id, ...checks, wrong };
}

/** Summary over a list of scores: mean key-fact coverage and pass rates of the boolean checks. */
export function summarize(scores) {
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const rate = (key) => {
    const xs = scores.map((s) => s[key]).filter((v) => v !== null && v !== undefined);
    return xs.length ? xs.filter(Boolean).length / xs.length : null;
  };
  return {
    n: scores.length,
    keyFacts: mean(scores.map((s) => s.keyFacts)),
    noKnownErrors: rate('noKnownErrors'),
    checkQuestion: rate('checkQuestion'),
    asksClarification: rate('asksClarification'),
    meanChars: mean(scores.map((s) => s.chars)),
  };
}

/**
 * Summary of evaluation runs (one model answer each). Scores, times and lengths cover only the
 * runs that returned an answer (a failed run has nothing to score, and its 0 ms / 0 characters
 * would pull the means down); `failures` counts the others and `noFirstPiece` the answers whose
 * first piece was never seen.
 */
export function summarizeRuns(runs) {
  const ok = runs.filter((r) => r.ok);
  const round = (x) => (x === null ? null : Math.round(x));
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const first = ok.map((r) => r.firstMs).filter((v) => typeof v === 'number');
  return {
    ...summarize(ok.map((r) => r.score)),
    meanChars: round(mean(ok.map((r) => r.answer.length))),
    runs: runs.length,
    failures: runs.length - ok.length,
    noFirstPiece: ok.length - first.length,
    truncated: ok.filter((r) => r.truncated).length,
    meanFirstPieceMs: round(mean(first)),
    medianFirstPieceMs: round(median(first)),
    meanMs: round(mean(ok.map((r) => r.ms))),
    meanPromptChars: round(mean(runs.map((r) => r.promptChars))),
  };
}

/**
 * Evaluation safety (audit GPU-01): Gemma is only benchmarked on a discrete NVIDIA card. Every
 * adapter seen ("<vendor> <architecture>") must be NVIDIA: the page's default adapter (the one the
 * Gemma worker asks for), the high-performance one and the one the worker reports after loading
 * the model. Returns why to refuse, or null.
 */
export function gpuRefusal(adapters) {
  const entries = Object.entries(adapters);
  if (!entries.length) return 'no GPU adapter information';
  const bad = entries.filter(([, v]) => typeof v !== 'string' || !/^nvidia\b/i.test(v.trim()));
  if (!bad.length) return null;
  return `not a discrete NVIDIA adapter: ${bad.map(([k, v]) => `${k} = "${v ?? 'none'}"`).join(', ')}`;
}
