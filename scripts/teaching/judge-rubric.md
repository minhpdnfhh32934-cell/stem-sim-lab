# AI Teacher answers: judging rubric (fixed before judging, 2026-10-14)

Used by AI judges (language models) to score answers of the on-device Gemma evaluation
(`tests/teaching/teaching-eval.json`). The judge sees the question, the reference answer
(`expected`, plus `derivation` for calculations) and several anonymous answers in a shuffled order.
It never sees which prompt or decoding produced an answer. **This is an AI judgement, not a
teacher's**: it can be biased (for example towards longer or more fluent answers) even with the
labels hidden. Teacher review of the reference answers is pending (docs/DATA_REVIEW.md item 16).

Score every answer on its own against the reference; do not rank answers against each other.

## 1. Correctness (0, 1 or 2)

- **2 — correct:** the core answer matches the reference; no statement that a teacher would mark
  as a scientific error; any number is right (or the answer correctly asks for missing data).
- **1 — partly correct:** the core idea is there but with a real error, an important omission, or
  a wrong number in a supporting step.
- **0 — wrong:** the core answer is wrong, off-topic, gibberish, or it agrees with a learner's wrong
  claim; for a missing-data question, it invents values and gives a numeric result.

## 2. Clarity for a learner (1–5)

- **5:** a first-year student understands it in one reading: plain Vietnamese, logical order,
  terms explained, no garbled words.
- **4:** clear with minor awkwardness.
- **3:** understandable with effort (some confusing sentences, a few garbled or foreign words).
- **2:** hard to follow (many garbled words, language switches, jumps in logic).
- **1:** not understandable.

Judge clarity even when the content is wrong (a clear wrong answer can score 0 and 4).

## 3. Completeness (1–5)

Relative to what the question needs (the reference's key points):

- **5:** every key point of the reference, including a reason or an example when the question asks
  for one; for a missing-data question: names the missing quantity and asks for it.
- **4:** one minor point missing.
- **3:** about half the key points.
- **2:** one key point only.
- **1:** none.

## 4. Flags (true/false)

- `invented_numbers`: a number that is not in the question, not a standard constant, and not a
  correct result derived from the question.
- `endorses_error`: agrees with or praises a wrong statement in the question or the learner's turn.
- `asks_for_missing_data`: explicitly asks the learner for a missing quantity.
- `language_problem`: garbled Vietnamese words, other scripts or a switch to English.

## Output

One JSON object per answer: `{ "code", "correctness", "clarity", "completeness", "flags": {…},
"note" }`, where `note` is one short sentence naming the main error (or "ok").
