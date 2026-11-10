# 105 — Giao thoa sóng hai nguồn + phách (0.8.1 mục 2)

- **Goal:** new physics topic for VL11 Bài 12: two in-phase point sources on an ideal water
  surface, counts of maxima/minima on S₁S₂, amplitude at M, beats when f₁ ≠ f₂, draggable sources,
  water picture as an image buffer, challenge, POE, golden problems, KNTT placement (#105, plan #54).
- **Date/time:** 2026-11-02 09:20 +0700
- **Status:** PASS (local checks below; GitHub CI checked after the PR opens)
- **Branch / base:** `feat/105-interference` from `origin/main` cd6cdd6. Not to be merged before
  the 07/11 demo.

## Files

- New `src/physics/interference/` (`model.ts`, `engine.ts`, `draw.ts`, `scenes.ts` + tests).
- `src/physics/types.ts` (`BodyDef.dragTo`), `src/app/sim/StageCanvas.tsx` (parameter drag),
  `src/app/sim/runtime.ts` (`setParams(values, source, fit)`; `setParam` delegates to it).
- Registry, engines, catalog, i18n `topics.interference`, `prompts.ts`, `sources.ts`
  (`hallidayInterference`), `challenges.ts`, `poe.ts`, golden script + `tests/golden/physics.json`,
  `gen_curriculum_kntt.py` + generated files, `tests/e2e/physics.spec.ts`, docs.

## Key decisions

- Dragging a source or M changes parameters (new run from t = 0, view kept), not the engine
  state: the numbers always match the picture and the card stays `exact` (no intervention).
- A dragged source keeps |d₁ − d₂| ≤ S₁S₂ ≤ d₁ + d₂, so M never disappears mid-drag; M not given
  by the problem follows S₁S₂ (d₁ = 0,9·S₁S₂, d₂ = 1,2·S₁S₂).
- Water picture cell size per quality tier (`CELL_PX`): the overload ladder only coarsens it; no
  picture below 4 cells per wavelength (aliasing would draw fake fringes).
- Science review (agent `science-reviewer`): no formula or count wrong; wording fixed (1D DOPRI5
  check stated honestly, phases as 2πd/λ, "hệ vân ổn định" vs "không dao động", beats marked as
  an extension, AI hint for λ/2 and 2a, golden int-06).

## Commands run (real results, summary lines only)

- `npm run lint`: no errors. `npm run typecheck`: no errors (after fixing one test typing).
- `npm run format:check`: all files use Prettier code style.
- `npx vitest run`: 341 files passed, 1 skipped; 4509 tests passed, 1 skipped.
- `npx playwright test tests/e2e/physics.spec.ts tests/e2e/learner.spec.ts --project=chromium`:
  25 passed (56.7 s), under the shared `e2e.lock`.

## Tests

- PASS `src/physics/interference/*.test.ts` (37 tests): engine vs closed form (product form), scan
  vs formula counts (~400 cases incl. whole and half-whole S₁S₂/λ), beat period measured on engine
  samples (< 0,2 %), DOPRI5 ray lattice O(Δx²) and superposition at M, water picture pixels on a
  minimum / maximum, tier only changes the picture.
- PASS `src/app/sim/runtime.test.ts` (setParams keeps the view, not an intervention).
- PASS golden (52 problems), learn (challenge reachable, POE), registry (KaTeX, engines).
- PASS manual check in the browser (dev server on a private port, 1366×768): picture, 7 maxima
  dots, graph with envelope ±2a, beats envelope period 1 s, solution checks "khớp".

## Errors and fixes

- Tool-driven mouse drag in the browser pane panned / mis-scaled; the same drag with real pointer
  events (JS) moved S₁S₂ smoothly 10 → 15,11 cm as computed, view unchanged. Environment, not app.

## Evidence

- Commits 9aff391 … 451a207 on `feat/105-interference`.

## Next steps and limits

- Teacher review: INT-3 (counting convention, "bậc |k|"), INT-4 (steepness threshold; textbook
  amplitudes of a few mm make the card "approx"), INT-7 (Halliday edition/chapter).
- Not supported: sources out of phase or with different amplitudes (golden int-05 → unsupported).
- Scan limit: a peak closer than ~10⁻⁷λ to a source is not seen by the check (`shortcut:` comment).
- Plan item 3 (phase space) touches the graph files too: do it after this PR, not in parallel.

## Rework after the PR #110 review

- **Date/time:** 2026-11-02 12:23 +0700 (commit 338580e).
- **Status:** PASS (local checks below).
- Fixed: beat period measured only when 2|f₁ − f₂|/(f₁ + f₂) ≤ 0,5 (before: up to 56 % off with a
  green "khớp"); SolutionPanel shows a check off by more than 1 % as "chưa khớp" (probe: every other
  scene ≤ 10⁻¹⁰ at defaults and choices); λ/2 only with ≥ 2 maxima; a slower tier never removes the
  water picture (cells ≤ λ/4 on screen, `cellSize`); d₁, d₂ are controls of the 9-maxima challenge;
  a fast source drag reaches the pointer when M follows S₁S₂ (`dragTo` gets the sources); a pointer
  below S₁S₂ keeps M on the line.
- Tests: PASS `npx vitest run src/physics src/learn tests/golden src/app/sim src/app/i18n`
  (36 files, 371 tests; includes a sweep of f₂ over the slider for f₁ = 10; 1,5; 63 Hz). PASS lint,
  typecheck, format:check. PASS E2E physics + learner (chromium): 25 passed, under `e2e.lock`.

## Rework after the PR #110 review, round 2

- **Date/time:** 2026-11-02 12:52 +0700 (commit f82c92e).
- **Status:** PASS (local checks below).
- Fixed: a source drag keeps a learner-placed M where it is (d₁, d₂ follow; only a problem's M
  limits S₁S₂), so the 9-maxima challenge is reachable after M was dragged anywhere; beats sampled
  every T/40, so every close pair on the sliders is measured (too long → note); tests for the
  topics whose old checks disagree on reachable inputs and now read "chưa khớp" (newtonLaws,
  inclinedPlane, springPendulum, hookeSpring — not fixed here: issue #112); a drawWater
  test on a degraded tier (checked: it fails with the round-1 rule put back).
- Correction: the round-1 claim "every other scene stays below 10⁻¹⁰" holds at defaults and choices
  only; a random slider sweep and the reviewer's cases found the four topics above.
- Tests: PASS `npx vitest run src/physics src/learn src/app tests/golden` (67 files, 619 tests);
  PASS lint, typecheck, format:check; PASS E2E physics + learner (chromium) 25 passed, `e2e.lock`.

## Rework after the PR #110 review, round 3

- **Date/time:** 2026-11-02 13:38 +0700 (commit 7575ac2).
- **Status:** PASS (local checks below).
- Fixed: SolutionPanel treats a difference ≤ 10⁻¹² SI as agreeing (an exact 0 with a round-off
  check read "chưa khớp"); a source drag rebuilds a learner-placed M from exact distances, so M near
  or on S₁S₂ no longer drifts (it used to move 2,6–4,2 mm over a drag out and back). Both new tests
  fail with the old code put back. The four topics with real check disagreements are issue #112.
- Tests: PASS `npx vitest run src/physics src/app/sim tests/golden src/learn` (36 files, 373
  tests); PASS lint, typecheck, format:check; PASS E2E physics (chromium) 18 passed, `e2e.lock`.
