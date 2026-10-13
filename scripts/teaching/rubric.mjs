// Objective checks for AI Teacher answers (audit EDU-02). Used by the evaluation harness
// (scripts/teaching/eval-gemma.mjs) and tested in tests/teaching-rubric.test.ts.
// These checks only cover what can be checked mechanically; how clear an explanation is still
// needs a teacher's reading (docs/USER_TESTING.md).

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

/** The last ~2 sentences contain a question to the learner. */
export function endsWithQuestion(answer) {
  const tail = answer.trim().slice(-320);
  return /\?/.test(tail);
}

/** The answer asks for the missing data instead of inventing numbers. */
export function asksForMissingData(answer) {
  const f = fold(answer);
  return (
    /\?/.test(answer) &&
    /(cho biet|thieu|chua co|can biet|bao nhieu|la bao nhieu|em cho|neu .* thi)/.test(f)
  );
}

/** Share of words written in English (a Vietnamese answer should have few). */
export function englishShare(answer) {
  const words = answer.split(/\s+/).filter((w) => /^[A-Za-z]{3,}$/.test(w));
  const common = /^(the|and|with|from|that|this|for|are|was|you|your|have|has|will|not|but)$/i;
  const all = answer.split(/\s+/).filter(Boolean).length || 1;
  return words.filter((w) => common.test(w)).length / all;
}

/**
 * Scores one answer. keyFacts: groups of alternative patterns (each group needs one match);
 * mustNot: patterns of known wrong statements.
 */
export function scoreAnswer(item, answer) {
  const f = fold(answer);
  const facts = (item.keyFacts ?? []).map((group) => group.some((p) => new RegExp(p).test(f)));
  const wrong = (item.mustNot ?? []).filter((p) => new RegExp(p).test(f));
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
