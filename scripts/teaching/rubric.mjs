// Objective checks for AI Teacher answers (audit EDU-02). Used by the evaluation harness
// (scripts/teaching/eval-gemma.mjs, scripts/teaching/rescore.mjs, scripts/teaching/compare.mjs) and
// tested in tests/teaching-rubric.test.ts. These checks only cover what can be checked
// mechanically; how clear an explanation is still needs a teacher's reading
// (docs/USER_TESTING.md).

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
 * A sentence that asks the learner for data or says data is missing ("Em cho thầy biết…", "Đề bài
 * có cho…", "…là bao nhiêu?", "…trong bao lâu?", "Em đã hòa tan bao nhiêu gam?"). Known limit: a
 * restated task ("Quãng đường là bao nhiêu?") also matches; the invented-number checks below
 * catch the usual case where the model then answers it itself.
 */
const ASKS_FOR_DATA =
  /\b(cho (thay |minh |toi |co |anh |chi |chung ta )?biet|cung cap|thieu|chua (co|cho|neu)|can (biet|them|co)|(em|ban) (da )?cho|(de bai|bai toan) (co |da )?(cho|neu)|de (co|da) (cho|neu)|(la|bang) bao nhieu|(da|dung|hoa tan|lay) bao nhieu|bao lau)\b/;

// ---------------------------------------------------------------- numbers

/**
 * A number standing alone in folded text: not part of a symbol (v₀ → "v0", 2n, h2o, co2), not an
 * exponent or index (^2, _2) and not either side of a fraction written with "/" (1/2, 100/220).
 * Thousands dots and decimal commas stay in the token ("3.120", "0,45").
 */
const NUMBER = /(?<![a-z\d^_/.,])\d+(?:[.,]\d+)*(?![a-z\d^_]|[.,]\d|\/\d)/g;

/** Readings of one number token, as src/ai/numbers.ts: "3.120" → 3.12 and 3120, "0,45" → 0.45. */
export function numberReadings(token) {
  const out = new Set();
  const push = (s) => {
    const v = Number(s);
    if (Number.isFinite(v)) out.add(v);
  };
  push(token.replace(/\./g, '').replace(',', '.'));
  push(token.replace(/,/g, ''));
  push(token.replace(/[.,]/, '.').replace(/[.,]/g, ''));
  return [...out];
}

/** Every number of the question and history (any digit run counts as given), plus allowNumbers. */
function givenNumbers(item) {
  const text = [item.question ?? '', ...(item.history ?? []).map((h) => h.content)].join(' ');
  const out = [];
  for (const m of fold(text).matchAll(/\d+(?:[.,]\d+)*/g)) out.push(...numberReadings(m[0]));
  for (const a of item.allowNumbers ?? []) out.push(Number(a));
  return out;
}

const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const isKnown = (token, known) => numberReadings(token).some((r) => known.some((k) => near(r, k)));

/** The model assumes values: any number after these words in the same sentence. */
const ASSUME =
  /\b(gia su|gia dinh|chang han|vi du|assume|assuming|suppose|let's say|for example)\b/;
/** A computed or estimated value: a number within 40 characters after these words. */
const APPROX = /\b(khoang|xap xi|uoc tinh|du doan|ket qua)\b/g;
/** "= 200", "≈ −4", "= **50**". */
const EQUALS_BEFORE = /[=≈]\s*[*_]*\s*[-−]?\s*$/;

/**
 * Numbers the answer brings in that are not in the question (nor in item.allowNumbers), where they
 * act as values: after "=" or "≈", within 40 characters after "khoảng / xấp xỉ / kết quả…",
 * anywhere after "giả sử / ví dụ…" in the same sentence, or directly before item.answerUnit.
 * Returns the offending tokens (empty: nothing invented). Known limits: numbers written in words
 * and a typical value stated without "=" ("thường là 100 W") are not seen.
 */
export function inventedNumbers(item, answer) {
  const known = givenNumbers(item);
  const unit = item.answerUnit
    ? new RegExp(`(?<![a-z\\d^_/.,])(\\d+(?:[.,]\\d+)*) ?(?:${item.answerUnit})`, 'g')
    : null;
  const found = [];
  for (const s of sentences(answer).map(fold)) {
    const assumeAt = s.search(ASSUME);
    const approxEnds = [...s.matchAll(APPROX)].map((m) => m.index + m[0].length);
    for (const m of s.matchAll(NUMBER)) {
      const at = m.index;
      const asValue =
        EQUALS_BEFORE.test(s.slice(Math.max(0, at - 8), at)) ||
        approxEnds.some((e) => at >= e && at - e <= 40) ||
        (assumeAt >= 0 && at > assumeAt);
      if (asValue && !isKnown(m[0], known)) found.push(m[0]);
    }
    if (unit) for (const m of s.matchAll(unit)) if (!isKnown(m[1], known)) found.push(m[1]);
  }
  return [...new Set(found)];
}

// ---------------------------------------------------------------- missing data

/**
 * The answer asks for the missing data instead of inventing numbers: a sentence ending in "?"
 * asks for the data, and no value is assumed or result computed anywhere in the answer (numbers
 * given in item.question / item.history or allowed by item.allowNumbers do not count). Called
 * without an item, nothing counts as given.
 */
export function asksForMissingData(answer, item = { question: '' }) {
  const asks = sentences(answer).some((s) => endsWithQuestion(s) && ASKS_FOR_DATA.test(fold(s)));
  return asks && inventedNumbers(item, answer).length === 0;
}

/**
 * Every item.missing group is named in a sentence that asks for data or says it is missing
 * (no question mark needed: "Đề chưa cho gia tốc." counts). The teacher prompt asks to name what
 * is missing ("hỏi lại đúng chỗ thiếu"). null when the item has no `missing`.
 */
export function namesMissing(item, answer) {
  if (!item.missing) return null;
  const asking = sentences(answer)
    .map(fold)
    .filter((s) => ASKS_FOR_DATA.test(s));
  return item.missing.every((group) =>
    asking.some((s) => group.some((p) => new RegExp(p).test(s))),
  );
}

// ---------------------------------------------------------------- steps

/**
 * Share of item.steps stages found in order: stage k is found when every keyFacts group it lists
 * matches at or after the end of stage k − 1 (earliest match of each); counting stops at the first
 * stage not found. Facts inside one stage may come in any order. null when the item has no steps.
 */
export function stepsInOrder(item, answer) {
  if (!item.steps) return null;
  const f = fold(answer);
  let pos = 0;
  let done = 0;
  for (const stage of item.steps) {
    let end = pos;
    let ok = true;
    for (const k of stage) {
      const re = new RegExp((item.keyFacts[k] ?? []).map((p) => `(?:${p})`).join('|'), 'g');
      re.lastIndex = pos;
      const m = re.exec(f);
      if (!m) {
        ok = false;
        break;
      }
      end = Math.max(end, m.index + m[0].length);
    }
    if (!ok) break;
    done += 1;
    pos = end;
  }
  return item.steps.length ? done / item.steps.length : null;
}

// ---------------------------------------------------------------- known errors and traps

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

/** The first sentence opens by agreeing: "Đúng.", "Đúng vậy", "Vâng,", "Phải.", "Có,". */
const AGREEMENT =
  /^[\s*_#>"'“(]*(?:(?:dung|chinh xac)(?:[\s*_]*[.,!:]|\s+(?:vay|roi|the|het|a)\b)|(?:vang|co|phai|yes|right|correct)[\s*_]*[.,!:])/;

/** The answer opens by agreeing with the learner ("Đúng là …" does not count: it often goes on "…, nhưng"). */
export function opensWithAgreement(answer) {
  return AGREEMENT.test(fold(sentences(answer)[0] ?? ''));
}

/**
 * A trap question is handled: no mustNot hit, the answer does not open by agreeing with a false
 * premise (item.trap.premise) and the explicit correction (keyFacts[0]) is there. null when the
 * item has no trap.
 */
export function trapHandled(item, answer) {
  if (!item.trap) return null;
  const f = fold(answer);
  const corrected = (item.keyFacts[0] ?? []).some((p) => new RegExp(p).test(f));
  const agrees = item.trap.premise ? opensWithAgreement(answer) : false;
  return knownErrors(item, answer).length === 0 && !agrees && corrected;
}

// ---------------------------------------------------------------- decoding health

/** Share of words written in English (a Vietnamese answer should have few). */
export function englishShare(answer) {
  const words = answer.split(/\s+/).filter((w) => /^[A-Za-z]{3,}$/.test(w));
  const common = /^(the|and|with|from|that|this|for|are|was|you|your|have|has|will|not|but)$/i;
  const all = answer.split(/\s+/).filter(Boolean).length || 1;
  return words.filter((w) => common.test(w)).length / all;
}

/** Greek written as a word ("ισ", "του", "κύ"), not as math symbols (Δ, ω, ΣνΔfH, ΔΦ). */
function greekWord(run) {
  const lower = [...run].filter((c) => /\p{Script=Greek}/u.test(c) && c !== c.toUpperCase());
  return lower.length >= 2 || /[άέήίόύώΐΰ]/u.test(run);
}

/** Letters of one letter run that belong to another writing system than Latin/Vietnamese. */
function foreignLetters(run) {
  const greek = greekWord(run);
  return [...run].filter(
    (c) =>
      /\p{L}/u.test(c) && !/\p{Script=Latin}/u.test(c) && (greek || !/\p{Script=Greek}/u.test(c)),
  ).length;
}

/**
 * Share of the answer's letters written in another script than Latin/Vietnamese (Arabic,
 * Devanagari, Thai, Cyrillic, CJK, Greek words…): a sign of broken decoding. Greek math symbols
 * (a capital or a single small Greek letter in a run, such as Δx, ω, ΣνΔfH) do not count.
 */
export function foreignScript(answer) {
  let all = 0;
  let foreign = 0;
  for (const m of answer.normalize('NFC').matchAll(/\p{L}+/gu)) {
    all += [...m[0]].length;
    foreign += foreignLetters(m[0]);
  }
  return all ? foreign / all : 0;
}

/** Function words: they neither start a key term nor count as a corrupted syllable. */
const STOP_WORDS = new Set(
  (
    'là gì có của và các những một cho thì khi nào bao nhiêu vì sao như nhau được bị ở trong với ' +
    'này đó thế phải không ạ em bạn tôi thầy hay hoặc mà nên để từ đến sau trước rồi cũng đã đang ' +
    'sẽ lúc nếu vậy đúng tính tìm giải giúp bước theo nó họ ta chúng ra vào lên xuống lại rất quá ' +
    'hơn nhất mỗi mọi cả chỉ còn đều'
  ).split(' '),
);
const syllables = (text) =>
  text
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
const latinWord = (w) => /^[\p{Script=Latin}\p{M}]+$/u.test(w);
const letters = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
const marks = (s) => s.normalize('NFD').replace(/\P{M}/gu, '');
const otherScript = (w) => foreignLetters(w) >= 2 && !/\p{Script=Latin}/u.test(w);

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row.push(
        Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Key terms of the question (and history): every 2- and 3-syllable window of a run of content
 * syllables ("nhiễm sắc thể", "tế bào con", "ma sát nghỉ"); runs end at punctuation, numbers,
 * symbols and function words.
 */
export function questionTerms(item) {
  const text = [item.question ?? '', ...(item.history ?? []).map((h) => h.content)].join('\n');
  const terms = new Map();
  for (const chunk of text
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}\s]+/u)) {
    let run = [];
    const flush = () => {
      for (let k = 2; k <= 3; k += 1) {
        for (let i = 0; i + k <= run.length; i += 1) {
          const t = run.slice(i, i + k);
          terms.set(t.join(' '), t);
        }
      }
      run = [];
    };
    for (const w of chunk.split(/\s+/).filter(Boolean)) {
      if (latinWord(w) && w.length >= 2 && !STOP_WORDS.has(w)) run.push(w);
      else flush();
    }
    flush();
  }
  return [...terms.values()];
}

/**
 * One syllable of a 3-syllable term written wrongly: same letters with other tone marks
 * ("báo" for "bào"), or one letter left out or added with the same marks ("tể" for "thể"). A
 * function word is never counted ("tế bào có" is not a corrupted "tế bào con").
 */
function misspelt(got, want) {
  if (got === want || STOP_WORDS.has(got) || !latinWord(got)) return false;
  const a = letters(got);
  const b = letters(want);
  if (a === b) return true;
  return (
    b.length >= 3 &&
    marks(got) === marks(want) &&
    Math.abs(a.length - b.length) === 1 &&
    editDistance(a, b) === 1
  );
}

/**
 * Key terms of the question that come out corrupted in the answer (a sign of broken decoding:
 * the 2026-10-13 Gemma 1B run never wrote "nhiễm sắc thể" correctly). A corrupted form keeps the
 * term's first syllable and gets the rest wrong in one syllable:
 * - glued to the next syllable or to foreign letters: "lòxo", "xúcافل", "chuyểnộng";
 * - followed by a word in another script: "nhiễm ισ";
 * - in a 3-syllable term, one syllable misspelt (see misspelt): "tế báo con", "nhiễm sắc tể".
 * Phrases that occur in the question itself are never counted. Returns the corrupted forms.
 * Known limits: a wrong first syllable ("Niacn sắc thể") and bigger changes ("nhiễm sắc tố")
 * are not seen; 2-syllable terms only count glued and foreign forms, because Vietnamese has many
 * real words one tone mark apart ("rơi từ" / "rơi tự").
 */
export function mangledTerms(item, answer) {
  const question = syllables(
    [item.question ?? '', ...(item.history ?? []).map((h) => h.content)].join(' '),
  ).join(' ');
  const words = syllables(answer);
  const found = new Set();
  for (const [head, ...rest] of questionTerms(item)) {
    const next = rest[0];
    if (head === undefined || next === undefined) continue;
    for (let i = 0; i < words.length; i += 1) {
      const w = words[i] ?? '';
      if (w === head) {
        const got = words.slice(i + 1, i + 1 + rest.length);
        if (got.length < rest.length) continue;
        const differ = rest.flatMap((want, j) => (want === got[j] ? [] : [j]));
        const j = differ[0];
        if (differ.length !== 1 || j === undefined) continue;
        const g = got[j] ?? '';
        const wrong = otherScript(g) || (rest.length === 2 && misspelt(g, rest[j] ?? ''));
        const phrase = [head, ...got].join(' ');
        if (wrong && !question.includes(phrase)) found.add(phrase);
      } else if (w.startsWith(head) && w.length > head.length) {
        const tail = w.slice(head.length);
        const a = letters(tail);
        const b = letters(next);
        const glued = otherScript(tail) || a === b || (b.length >= 3 && editDistance(a, b) === 1);
        if (glued) found.add(w);
      }
    }
  }
  return [...found];
}

// ---------------------------------------------------------------- scores and summaries

/**
 * Scores one answer. keyFacts: groups of alternative patterns (each group needs one match; `facts`
 * keeps the hit of every group for paired tests); mustNot: patterns of known wrong statements (not
 * counted inside a misconception sentence). Item-specific checks are null when they do not apply.
 */
export function scoreAnswer(item, answer) {
  const f = fold(answer);
  const facts = (item.keyFacts ?? []).map((group) => group.some((p) => new RegExp(p).test(f)));
  const wrong = knownErrors(item, answer);
  const checks = {
    keyFacts: facts.length ? facts.filter(Boolean).length / facts.length : 1,
    facts,
    noKnownErrors: wrong.length === 0,
    checkQuestion:
      item.type === 'followup' || item.type === 'missing-data' ? null : endsWithQuestion(answer),
    asksClarification: item.expectsClarify ? asksForMissingData(answer, item) : null,
    namesMissing: namesMissing(item, answer),
    steps: stepsInOrder(item, answer),
    trapHandled: trapHandled(item, answer),
    englishShare: englishShare(answer),
    foreignScript: foreignScript(answer),
    mangled: mangledTerms(item, answer),
    chars: answer.length,
  };
  return {
    id: item.id,
    ...checks,
    wrong,
    invented: item.expectsClarify ? inventedNumbers(item, answer) : [],
  };
}

const meanOf = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Summary over a list of scores: mean key-fact coverage, pass rates of the boolean checks, mean
 * share of steps in order, mean foreign-script share, and the share of answers with any foreign
 * script or any corrupted key term. Checks that do not apply (null) or that an older saved score
 * lacks (undefined) are left out of their rate.
 */
export function summarize(scores) {
  const present = (key) => scores.map((s) => s[key]).filter((v) => v !== null && v !== undefined);
  const rate = (key) => {
    const xs = present(key);
    return xs.length ? xs.filter(Boolean).length / xs.length : null;
  };
  const foreign = present('foreignScript');
  const mangled = present('mangled');
  return {
    n: scores.length,
    keyFacts: meanOf(scores.map((s) => s.keyFacts)),
    noKnownErrors: rate('noKnownErrors'),
    checkQuestion: rate('checkQuestion'),
    asksClarification: rate('asksClarification'),
    namesMissing: rate('namesMissing'),
    steps: meanOf(present('steps')),
    trapHandled: rate('trapHandled'),
    foreignScript: meanOf(foreign),
    foreignScriptAnswers: foreign.length
      ? foreign.filter((x) => x > 0).length / foreign.length
      : null,
    mangledTerms: mangled.length
      ? mangled.filter((m) => m.length > 0).length / mangled.length
      : null,
    meanChars: meanOf(scores.map((s) => s.chars)),
  };
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
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
  const first = ok.map((r) => r.firstMs).filter((v) => typeof v === 'number');
  return {
    ...summarize(ok.map((r) => r.score)),
    meanChars: round(meanOf(ok.map((r) => r.answer.length))),
    runs: runs.length,
    items: new Set(runs.map((r) => r.id)).size,
    failures: runs.length - ok.length,
    noFirstPiece: ok.length - first.length,
    truncated: ok.filter((r) => r.truncated).length,
    meanFirstPieceMs: round(meanOf(first)),
    medianFirstPieceMs: round(median(first)),
    meanMs: round(meanOf(ok.map((r) => r.ms))),
    medianMs: round(median(ok.map((r) => r.ms))),
    meanPromptChars: round(meanOf(runs.map((r) => r.promptChars))),
  };
}

// ---------------------------------------------------------------- comparing runs

/**
 * The configuration a run belongs to: "variant/decoding/temperature". Runs saved before these
 * fields existed (eval files up to 2026-10-13) used the worker's fixed decoding of that time
 * ("legacy": repetition_penalty 1.2, no_repeat_ngram_size 3) and webGemmaChat's default
 * temperature 0.2, so those are the defaults.
 */
export function groupKey(run) {
  return `${run.variant ?? '?'}/${run.decoding ?? 'legacy'}/${run.temperature ?? 0.2}`;
}

/** P(X ≤ k) for X ~ Binomial(n, 1/2), summed in log space (no overflow for large n). */
function binomialLowerTail(k, n) {
  let logP = -n * Math.LN2;
  let sum = 0;
  for (let i = 0; i <= k; i += 1) {
    sum += Math.exp(logP);
    logP += Math.log((n - i) / (i + 1));
  }
  return sum;
}

/** Exact two-sided sign test: p-value of `wins` against `losses` (ties left out). */
export function signTestP(wins, losses) {
  const n = wins + losses;
  if (n === 0) return 1;
  return Math.min(1, 2 * binomialLowerTail(Math.min(wins, losses), n));
}

/**
 * Exact McNemar test on paired yes/no outcomes: `onlyA` pairs where only A was right, `onlyB`
 * where only B was. Same binomial test as the sign test on the discordant pairs.
 */
export function mcnemarP(onlyA, onlyB) {
  return signTestP(onlyA, onlyB);
}

/**
 * Paired comparison of two configurations on the same questions. Only runs that returned an
 * answer are used.
 * - Item level: per question, mean keyFacts over its repeats in A and in B; A wins, loses or
 *   ties; exact sign test on wins against losses.
 * - Key-fact group level: runs are paired by question and repeat number; every keyFacts group
 *   gives one yes/no pair (score.facts); exact McNemar test on the discordant pairs.
 */
export function pairedComparison(a, b) {
  const byItem = (runs) => {
    const m = new Map();
    for (const r of runs.filter((x) => x.ok)) {
      const list = m.get(r.id) ?? [];
      list.push(r);
      m.set(r.id, list);
    }
    return m;
  };
  const A = byItem(a);
  const B = byItem(b);
  const ids = [...A.keys()].filter((id) => B.has(id)).sort();
  let wins = 0;
  let losses = 0;
  let ties = 0;
  const diffs = [];
  const groups = { both: 0, onlyA: 0, onlyB: 0, neither: 0 };
  for (const id of ids) {
    const ra = A.get(id) ?? [];
    const rb = B.get(id) ?? [];
    const d = meanOf(ra.map((r) => r.score.keyFacts)) - meanOf(rb.map((r) => r.score.keyFacts));
    diffs.push(d);
    if (Math.abs(d) < 1e-12) ties += 1;
    else if (d > 0) wins += 1;
    else losses += 1;
    const repeatOf = (r, i) => r.repeat ?? i;
    const rbByRepeat = new Map(rb.map((r, i) => [repeatOf(r, i), r]));
    ra.forEach((x, i) => {
      const y = rbByRepeat.get(repeatOf(x, i));
      if (!y) return;
      const fa = x.score.facts ?? [];
      const fb = y.score.facts ?? [];
      for (let g = 0; g < Math.min(fa.length, fb.length); g += 1) {
        if (fa[g] && fb[g]) groups.both += 1;
        else if (fa[g]) groups.onlyA += 1;
        else if (fb[g]) groups.onlyB += 1;
        else groups.neither += 1;
      }
    });
  }
  return {
    items: ids.length,
    wins,
    losses,
    ties,
    meanDiff: meanOf(diffs),
    signP: signTestP(wins, losses),
    groups,
    mcnemarP: mcnemarP(groups.onlyA, groups.onlyB),
  };
}

// ---------------------------------------------------------------- GPU safety

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
