# (d) #76 — Điện trường của điện tích điểm (VL11 Bài 16–18)

- **Goal:** traps 2 and 3 of #37 §8.2 (number filter, charge sign), then the electric-field scene.
- **Date/time:** 2026-10-26 19:14 +0700 (stage 1)
- **Status:** IN_PROGRESS — stage 1 done, stage 2 waits for (a) #74 and (b) #75 on `main`
- **Branch / base:** `feat/76-electric-field` from `main` d6f9fec (Máy A; claimed on #76)

## Files

- `src/ai/numbers.ts` (+ new `numbers.test.ts`): relative comparison, lone powers of ten,
  superscript runs, `writtenSign()`.
- `src/ai/draft.ts` (+ `draft.test.ts`): non-blocking `signMismatch` warning for charges.
- `src/physics/field/model.ts`, `fieldLines.ts`, `field.test.ts` (new, not registered yet).

## Key decisions

- `mentions` compares relatively (1e-9 of the larger value): the absolute 1e-9 let any invented
  charge below ~10⁻⁹ C through.
- Found while testing: `normalizeText` turned "10⁻¹⁰" into "10^-^1^0", so a superscript exponent
  with more than one character was never read, even with a mantissa. A run now gets one caret.
- A lone power of ten needs the caret ("10⁻⁸", "10^-8"): "10 cm" stays 10, "210^2" is not 100.
- Charge sign: minus/plus next to the number, else "âm"/"dương" in the same sentence up to the
  neighbouring numbers (a ", " between two numbers splits the words); "độ lớn"/"trái dấu"/both words
  → open. Open or different from the AI → warning "dấu của điện tích chưa chắc khớp với đề" (kept,
  the learner confirms). Applies to every parameter whose dimension is charge.
- Field lines: RK4 (`src/core/ode` `Rk4`) with step doubling; tolerance a fixed fraction of the
  frame (same on every tier); step budget per line (no timing). The error on the card is global:
  a coarse copy of each line (one full step per two halves) gives max |drawn − coarse|. Against a
  DOPRI5 line (rtol 1e-12), three configurations: |drawn − coarse|/15 was 0,72–0,74× the true
  distance (too low), so the undivided value used is ≈ 11× above it.
- Null points: a step that reverses or stalls (chord < h/2: symmetric RK4 stages cancel and fool
  the error estimate) is retried smaller until h ≤ tolerance, then the line ends and the point is
  marked.

## Commands run (real results, summary lines only)

- `npx vitest run src/ai tests/golden src/app/ai src/teacher` → 118 files, 2671 tests passed.
- `npx vitest run src/physics/field` → 12 passed.

## Tests

- `numbers.test.ts`: "q = 10⁻⁸ C" accepts 1e-8, blocks 2e-8; "5.10⁻¹⁰" blocks 7e-10; "10 cm" is
  10; "1,6.10-19" accepted; sign readings (minus, words, open, quote picks the place).
- `draft.test.ts`: sign flipped by the AI → `signMismatch` (non-blocking), value kept.
- `field.test.ts`: Coulomb + superposition; −∇V by central differences; F = q₀E; k = 9·10⁹ vs
  1/(4πε₀) differ by 0,14 %; plates U/d inside, 0 outside, d×2 → E/2; lone ± charge lines radial
  and in the right direction; Σqᵢcosθᵢ constant on two-charge lines; two equal + charges: no NaN,
  axis lines end at the midpoint, one null point; DOPRI5 within the reported error; step budget.

## Next steps and limits

- **Stage 2 starts only when (a) #74 and (b) #75 are merged into `main`** (the coordinator says
  so): (a) brings the unit-group mechanism in `src/core/units.ts` and `tests/e2e/physics.spec.ts`,
  (b) the next topic before this one. Then `git merge origin/main` (no rebase, no force-push).
- Stage 2 work: `engine.ts` (static scene, still steps, nothing draggable), `scenes.ts` (mode
  "điện tích điểm / tụ phẳng" first, number of charges, q₁…q₃ signed in µC/nC, positions, probe
  x_P/y_P by sliders, q₀, k, U, d; Science Card `exact` with the RK4 error from `maxError`, ε = 1,
  ideal plates; ε → `unsupported_parts`), register (`physics/registry.ts`, `workers/engines.ts`),
  catalog (chapter `electricField` at the end of Physics), i18n vi/en, `TOPIC_HINTS`, units
  (V/m, kV/m, nC, kV, mN, µN, N·m²/C²), challenge (`start` plates, U → target E), POE (`start`
  plates, d ×2 keeping U → E halves), golden problems in `scripts/golden/make_physics_golden.py`
  ("lấy k = 9.10⁹" asking E, µC/nC, "10⁻⁸ C") then regenerate `tests/golden/physics.json`,
  `tests/e2e/physics.spec.ts` (E2E lock protocol), docs (`EFD-*` before `PRON-1` in DATA_REVIEW,
  k default like DATA_REVIEW item 1), this work log.
- **Curriculum row (script on `main` since PR #82):** append to `PLACEMENTS` in
  `scripts/data/gen_curriculum_kntt.py`:
  `("electricField", "VL11", [16, 17, 18], "Tên Bài 16–18: lực tương tác giữa các điện tích, khái niệm điện trường, điện trường đều.")`,
  rerun the script and commit the generated files (else `src/app/curriculum.test.ts` fails).
- `scenes.ts` `validate()` must refuse a probe on a charge, two charges at the same place, and two
  charges closer than the seed circle (2 % of the frame), or seeds start inside the other charge's
  disc. Graphs must keep a plot area ≥ 80 px (`tests/e2e/layout.spec.ts` from PR #81).
- Known flaky under heavy CPU load (not this change): `tests/app.test.tsx` "Science Studio shows
  inside the lab" timed out once in the full run (5,7 s); alone 15/15 passed.
- The project moves to `D:\Projects\stem-sim-lab` (user decision 2026-10-26); continue there from
  the pushed branch `feat/76-electric-field`.

## 2026-10-27 — stage 2 (scene)

- **Date/time:** 2026-10-27 01:29 +0700 (start of the record)
- **Status:** PASS (see the end of this section)
- **Branch / base:** `feat/76-electric-field` in `D:\Projects\stem-sim-lab\.claude\worktrees\76-phase2`;
  merged `origin/main` (41fbaee) and `origin/feat/74-uniform-circular-motion` (PR #87, not merged
  yet: this branch contains it until #87 merges). Conflict in `src/ai/draft.ts` imports only; both
  sides kept (`signMismatch` and #87's `notUsed`/`fromWords`).

### Files

- `src/physics/field/engine.ts` (static: field at M, clock only), `scenes.ts` (mode point charges
  / capacitor, 1–3 signed charges, positions and M by sliders, q₀, k, U, d; validate; solution;
  Science Card), `draw.ts` (view, line frame = 2× view, field lines cached per parameter set).
- Shared, append only: `src/core/units.ts` (nC, kV, V/m = N/C, kV/m, mN, µN, N·m²/C²),
  `physics/registry.ts`, `workers/engines.ts`, `app/catalog.ts` (chapter `electricField`), i18n,
  `ai/prompts.ts` (`TOPIC_HINTS`), `physics/common/sources.ts`, `learn/challenges.ts`,
  `learn/poe.ts`, `scripts/data/gen_curriculum_kntt.py` (VL11 Bài 16–18),
  `scripts/golden/make_physics_golden.py` (efd-01…04), `tests/e2e/physics.spec.ts`, docs.

### Key decisions

- Coordinates: q₁ at the origin, q₂ on the x-axis (no loss of generality for two charges), y_M = 0
  by default (M on the line q₁q₂); x₂, x_M, q₃ and its position are required when used, so the
  confirmation table asks instead of guessing. `autoDefaults` sets the mode and the number of
  charges only when the problem gave something (a slider moved by hand never hides a charge).
- No new colour tokens: + uses the vermillion and − the blue of the existing chart palette, with
  "+"/"−" drawn on each charge (not colour alone).
- The graph is the field at M over time (constant: electrostatics) so the bottom panel works like
  every scene and `layout.spec.ts` covers it.
- Found by `explain.test.ts`: "0,000719" was read as "0,000" + "719"; a thousands group is now
  exactly three digits (`numbers.ts`), with a test.
- Solution formulas substitute SI numbers without units (as SGK writes them) so a step fits the
  panel at 1366×768 (seen on a screenshot).

### Independent review (2026-10-27)

Two agents (science-reviewer; a code reviewer on this branch's own diff). Every finding was checked
against the code before fixing; all confirmed ones fixed with a test:

- `writtenSign` counted "âm"/"dương" of other nouns ("bản âm", "chiều âm", the next charge's
  "điện tích âm"): sign words now only next to "điện tích"/"điện"/"dấu", and the window stops at
  the next charge named.
- "2⋅10⁻⁸" (U+22C5) let 10⁻⁸ through: "⋅"/"∙" added to the multiplication signs.
- Where the fields cancel, E kept a rounding residue (2·10⁻¹⁰ V/m) and the −∇V check showed a huge
  relative deviation: |E| ≤ 10⁻⁹·Σ|Eᵢ| is reported as 0 (`fieldAtPoint`), no check there.
- A seed inside another charge's disc could mark "E = 0" on that charge: it now ends at the charge;
  `validate` refuses separations ≤ the disc radius.
- q = 0 / q₀ = 0 were worded and drawn as positive; plates card had the point-charge title and
  note; "lines ∝ |q|" is "about ∝ |q| (rounded, at least one)"; k written 8,988·10⁹; DATA_REVIEW
  EFD rows lacked six columns (status `pending` now in each row); docs say "upper estimate".
- Kept on purpose: x_M stays required for point charges (a problem without M asks the learner,
  rather than computing E at a default point silently).

### Commands run (real results)

- `npx tsc -b --noEmit` → no error. `npx eslint .` → exit 0 (one `??=` finding fixed first).
- `npx prettier --check --ignore-unknown <files changed vs main>` → all formatted.
- `npx vitest run` (full) → 4295 passed, 1 failed: `tests/app.test.tsx` "Science Studio shows
  inside the lab" (5,3 s timeout under load); alone: 15/15 passed (same as on 2026-10-26).
- Targeted after the review fixes: `src/physics/field src/ai tests/golden src/learn` → 419 passed.
- Generators rerun: `make_physics_golden.py` (39 problems), `gen_curriculum_kntt.py` → no diff.
- E2E under the shared lock: `physics.spec.ts` + `layout.spec.ts` → 17 passed. Full
  `npx playwright test` → 92 passed, 2 failed (`chemistry.spec.ts` 60 s timeout, `lesson-flow.spec.ts`
  Science Card not visible in 20 s), 35 did not run (3D projects depend on the first). The two specs
  alone → 8 passed.
- After merging `origin/main` (3c728d1, #87 merged; tree unchanged): full `npx playwright test`
  again → **129 passed** (all three projects), 0 failed.

**Status: PASS** (stage 2). SGK lessons added: VL11 Bài 16, 17, 18 → 39/189 theory lessons have a
SimLab topic (`docs/CURRICULUM_KNTT.md`, pending teacher review).

## 2026-10-27 — PR #89 review (4 red, yellow 1–2)

- **Status:** PASS. Review: `.agent-logs/review-pr89-2026-10-27.md` (PR comment 6425438907).
- Red 1: the number filter was laxer than `main` ("2´10⁻⁸", "2 • 10⁻⁸", "2 10^-8", "2 X 10^3" let 10ⁿ
  through). Now those signs (and `\cdot`, `\times`) are multiplication signs, and a lone power of
  ten right after a number (not a name such as "q2") is not read. Red 2: "10⁰" after a digit is a
  degree sign (also fixes "30⁰" giving a 0). Both tests failed before the fix.
- Red 3: `validate` refuses only charges at one place; disc radius per charge (≤ 0,4 × distance to
  the nearest charge, `discRadii`), so no seed starts inside another disc. Red 4: lines end only
  on a charge of the other sign. Tests failed before the fix; the strengthened "lone − charge" test
  fails when − charges are seeded along E (mutation tried, code restored).
- Yellow 1: y_M required with two or three charges (one charge: M on the x-axis); `IMPLIED`
  y_M = 0 for "trên đoạn/đường thẳng AB", "trung điểm của AB"; prompt; golden efd-05 (M outside
  AB on A's side, x_M < 0) and efd-06 (M off the line: x_M, y_M asked) → 41 problems.
  Yellow 2: the sign warning marks the charge's row and disappears once the learner sets it
  (E2E in `ai-flow.spec.ts`); "Hai điện tích âm …" covers every charge of the sentence.
- Also: k only with point charges; plates card method; wording on lines and E = 0 markers.
- Results: `npx vitest run src/ai tests/golden src/app/ai src/physics src/learn …` → 651 passed;
  `npx tsc -b --noEmit` → no error; `npx eslint .` → exit 0; Prettier (files vs main) → clean;
  `npx vitest run` → 4318 passed, 1 skipped; E2E `physics.spec` + `layout.spec` + `ai-flow.spec`
  (chromium, shared lock) → 38 passed.
- Not done (yellow 3, 5–8): a computed E = 0 point for any configuration, golden force tolerance,
  cache/line-count mutation tests, CELL3D-5/KNTT-3 counts (not this PR's lines), `n` in Basic.

## 2026-10-27 — PR #89 re-review (3 red)

- Re-review: `.agent-logs/rereview-pr89-2026-10-27.md` (PR comment 6426261551).
- A: `MANTISSA_BEFORE` allowed exactly one sign between mantissa and power, so "2.(10^-8)",
  "(2,5)·10⁻⁸", "2{\cdot}10^{-8}", "2 ×\, 10⁻⁸" still read 10ⁿ. Now anything like a mantissa
  (a number that is not a name or an earlier exponent, then only signs, brackets, spaces, "x",
  "lần" or LaTeX commands) blocks the lone power; Cyrillic "х" and zero-width spaces normalised.
  Grid test (20 joins × 4 mantissas × 5 forms × 2 exponents) and "10⁻⁸, 10⁻⁹ và 10⁻¹⁰" still read.
- B: 10^0 in any form is never read as 1. C: `IMPLIED` y_M = 0 only with M as the subject; the
  perpendicular-bisector problem and "O là trung điểm của AB" are refused. All four new tests
  failed before the fix.
- Yellow: E = 0 markers drawn after the discs; step ≤ half the distance to the nearest charge
  (charges 0,1 mm apart: no line out of steps; test); the sign warning stays until the learner's
  sign matches the problem (E2E types a wrong sign first).
- Results: `npx vitest run src/ai tests/golden src/app/ai` → 488 passed (no golden problem
  refused); `src/physics/field` → 24 passed; eslint, tsc, Prettier → clean; full `npx vitest run`
  → 4320 passed, 2 failed on timing under load (`tests/app.test.tsx` Science Studio,
  `dogma3d/scene.perf.test.ts` 150 ms budget); both files alone → 17/17 passed.
- E2E `physics.spec` + `layout.spec` + `ai-flow.spec` (chromium, shared lock, after waiting for
  the coordinator's run) → 38 passed. **Status: PASS.**

## 2026-10-27 — PR #89 third review (2 red, number filter)

- Review: PR comment 6427966314. Changed approach after three rounds: allow-list instead of a
  list of bad joins. A lone power of ten is read only after the start, "=", "≈", ":" or an
  ordinary word (NFKC, lower case; not lần/nhân/với/times/by/of/của, not a LaTeX command; one
  sign allowed), and only before the end, a unit or a word; exponents are whole numbers.
  Infinite or underflowed readings are dropped; `same` never matches Infinity.
- Test against a frozen copy of main's reader (`src/ai/numbersMain.fixture.ts`): grid of
  5 prefixes × 8 mantissas × 22 joins × 5 power forms × 3 exponents × 4 suffixes; nothing main
  refuses is accepted except a power standing alone. Before the fix it listed 32 526 sentences.
- Results: `src/ai tests/golden src/app/ai` → 492 passed (no golden problem refused); `npx tsc`
  → clean; full `npx vitest run` → 4334 passed, 1 skipped; eslint → one `no-misused-spread` in
  the new test, fixed, `npx eslint src/ai` clean; E2E physics + layout + ai-flow (lock) → 38 passed.

## 2026-10-27 — merge of `main` with (b) #90 (standing waves)

- 21 files in conflict; every hunk was "both sides appended", resolved as (b) first, then (d).
  The hunk boundaries cut through code blocks, so four seams needed the shared closing lines
  back by hand (`challenges.ts`, `poe.ts`, `sources.ts`, `engines.ts`) plus `)` in the golden
  script; one blank line between two SCIENCE_ACCURACY paragraphs; USER_GUIDE now says 16 topics
  and lists both. Generated files rebuilt by their scripts, each run twice (second run identical):
  `tests/golden/physics.json` (45 problems), `data/curriculum_kntt.json` and
  `docs/CURRICULUM_KNTT.md` (27 placements, 42/189).
- Results: tsc clean; `npx eslint .` exit 0; Prettier clean; `npx vitest run src/physics src/learn
src/core src/ai src/app tests/golden` → 903 passed; full `npx vitest run` → 4390 passed,
  1 skipped; E2E physics + layout + ai-flow + learner (lock) → 46 passed.

## 2026-10-27 — PR #89 final review (3 red)

- Review: PR comment 6428942355. Fourth round on the number filter, so the rule was narrowed
  instead of extended: a lone power of ten is read only after the start, "=", "≈" or ":" and only
  when the rest of its clause has no number (unit powers allowed). New multiplication signs need a
  caret. Main-comparison grid extended (unaccented/capital words, "nhân cho", "chia", entities
  without ";", words after the power): 7 620 laxer sentences before, 0 after.
- Digits glued to a name (q0, q_0, q1, cm2) are no numbers; y_M = 0 only from the words rule
  (`IMPLIED` `only`). A phrase right after a number ("0,2 m nằm trên…") or after "của" does not
  count. "khác dấu"/"ngược dấu" leave the sign open. All red tests failed before the fix.
- Consequence (on purpose): a power written after a word ("Điện tích 10⁻⁸ C", "có độ lớn 10⁻⁸ C")
  is refused; the learner enters it. No golden problem is affected.
- Results: `src/ai tests/golden src/app/ai src/physics/field` → 522 passed; eslint, tsc, Prettier
  clean; full `npx vitest run` → 4392 passed, 1 skipped; E2E physics + layout + ai-flow (lock) →
  39 passed.

## 2026-10-27 — PR #89 round 5: both convenience readers removed (coordinator decision)

- Review: PR comment 6429336427. The bugs of five rounds all sat in two conveniences, so both are
  gone and those parts read as `main`: a bare power of ten ("10⁻⁸") is never read (the learner
  enters it), and y_M = 0 is never taken from words ("M nằm trên đoạn AB"); `statedPlainly` and the
  `IMPLIED` list are main's again. Kept: superscript exponents after a mantissa, relative
  comparison, no infinite readings, integer exponents, new multiplication signs only with a caret,
  "10⁰" as degrees, the charge sign warning. Digits of names are dropped only in
  `numbersIn`/`mentions`; `numberTokens` (explain.ts) reads as main.
- Tests against the frozen main reader: (a) `mentions` accepts nothing main refuses (only
  exception: a mantissa with a superscript exponent main could not read); (b) every golden value
  main accepts is accepted; explanations main flags stay flagged (one listed exception, "2X10^3"
  = 2000). Words-rule cases that round 4 wrongly refused ("quả cầu 2 đứng yên", "g = 10 m/s² bỏ
  qua ma sát", …) pass.
- Golden: efd-02 and efd-05 now list y_M as missing; efd-03 ("Q = 10⁻⁸ C") lists q1 as missing,
  with n = 1 from "Một điện tích điểm"; 45 problems, second run identical. Prompt: y_M only when
  the problem writes a number.
- Results: `src/ai tests/golden src/app/ai src/physics/field` → 518 passed; eslint, tsc, Prettier
  clean; full `npx vitest run` → 4388 passed, 1 skipped; E2E physics + layout + ai-flow (lock) →
  39 passed.

## 2026-10-27 — PR #89 round 6: `numbers.ts` = main + four changes (final scope)

- Review: PR comment 6431868935 (five red points, all from the rewritten reader: overflow hidden
  from the explanation check, explain.ts absolute floor ~1e-11, "0,0025" → 25, name digits dropped
  too widely, integer-exponent lookahead breaking "2.10^-8,3.10^-8").
- `git checkout origin/main -- src/ai/numbers.ts`, then only: (1) a superscript run is one caret,
  "⁰" after a digit is "°"; (2) `same` and explain.ts `known` relative, finite only (no absolute
  floor), `numbersIn`/`allowedNumbers` drop non-finite readings, `numberTokens` as main; (3) digits
  of a 1–2-letter symbol at a word start dropped in `numbersIn`/`mentions` only; (4) `writtenSign`
  kept (with a small positioned tokenizer of main's regexes for it).
- Side effect handled in the scene: forces are shown in µN / mN / N by magnitude, so the default
  answers ("0,000719 N", "0,3595 mN") never have the 4+ decimals main's reader splits.
- Tests: the five round-6 cases and the earlier rounds' cases; comparisons with the frozen main
  reader both ways (mentions, golden values, explanation flags). The new tests fail on the round-5
  file (checked by swapping it in and back).
- Results: `src/ai tests/golden src/app src/physics src/learn src/teacher/board` → 1501 passed;
  tsc clean.
