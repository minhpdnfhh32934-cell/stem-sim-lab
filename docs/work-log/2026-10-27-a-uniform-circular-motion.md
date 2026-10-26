# 0.8.0 (a) — Chuyển động tròn đều (#74)

- **Goal:** VL10 Bài 31–32 as a physics topic, plus the two shared pieces the next physics
  lessons reuse: unit groups (rad/s vs Hz, vòng/s, vòng/phút) and `tests/e2e/physics.spec.ts`.
- **Date/time:** 2026-10-26, 18:40–20:15 +07:00 (machine A)
- **Status:** PASS (one timing-budget unit test fails only under machine load, see below)
- **Branch / base:** `feat/74-uniform-circular-motion`, merged `origin/main` 70b5b7c (PR #82)

## Files

- `src/core/units.ts` (+ test): `UnitDef.group`, rev/s, rev/min; `convert()` throws across groups;
  `unitsFor(dim, group?)`. `src/ai/spec.ts` (+ new `spec.test.ts`): `allowedUnits()` keeps the
  field's group.
- `src/physics/circular/`: `model.ts`, `engine.ts`, `check.ts` (DOPRI5), `scenes.ts`,
  `circular.test.ts`. `src/physics/common/sources.ts`: `sgk10kntt`, `hallidayCircular` (appended).
- Registration: `physics/registry.ts`, `workers/engines.ts`, `app/catalog.ts` (chapter
  `circularMotion` last, titled like the textbook chapter), i18n vi/en, `ai/prompts.ts` hint,
  `learn/challenges.ts`, `learn/poe.ts`, curriculum row VL10 Bài 31–32
  (`scripts/data/gen_curriculum_kntt.py` → JSON + `docs/CURRICULUM_KNTT.md`).
- AI flow (review fixes): `src/ai/draft.ts` (kind `notUsed` for a stated value the chosen setup
  hides; registered unit aliases count as their canonical symbol), `src/app/ai/ProblemDialog.tsx`
  (missing values recomputed from the scene's `required` and the current choices).
- Tests: `src/physics/registry.test.ts` (every scene's engine is registered),
  `tests/e2e/physics.spec.ts`, a new test at the end of `tests/e2e/ai-flow.spec.ts`, golden
  `ucm-01…04`.
- Docs: DATA_REVIEW UCM-1…5 + note, SCIENCE_ACCURACY, USER_GUIDE, CLAUDE.md, PROGRESS.

## Key decisions

- Unit group label instead of a new dimension (a radian has none). The pendulum damping `c` and
  the spring γ stay labelled Hz (they are rates in s⁻¹; DATA_REVIEW UCM-3 asks a teacher).
- Engine time = step count × Δt, phase straight from t: radius and speed constant to 1e-12.
- The first of v, ω, T, f the problem states selects the mode (`autoDefaults`); any other stated
  one is flagged "không dùng tới".
- Independent review: two subagents (science-reviewer, general code review) instead of a
  Workflow run (Workflow needs the user's own opt-in); every finding checked and fixed, see PR.

## Commands run (real results, summary lines only)

- `npx vitest run src/ai tests/golden src/physics/circular src/app/ai` — 44 files, 484 passed.
- `npm test` (whole suite, machine busy with other sessions) — 4220 passed, 13 failed: timeouts
  in AI Teacher / Studio / app shell tests and the mutation-3D build-time budget. Re-run of those
  8 files alone: 143 passed, 1 failed (`mutation3d/scene.perf.test.ts`, build time 259 ms vs the
  150 ms budget; 152 ms in the first run — timing under load, file untouched by this branch).
- `python scripts/golden/make_physics_golden.py` (twice) — "wrote 35 golden problems"; second run
  leaves `tests/golden/physics.json` unchanged.
- `python -I scripts/data/gen_curriculum_kntt.py` (twice) — 24 placements; second run unchanged.
- `npx playwright test tests/e2e/physics.spec.ts --project=chromium` — 15 passed (1.9 min).
- `npm run lint`, `npm run typecheck`, `npx prettier --check` on every changed file — clean.

## Tests

- Full `npx playwright test` (19:45–19:55, under the E2E lock): 125 passed (9.2 min), all three
  projects.

## Next steps and limits

- Project moves to `D:\Projects\stem-sim-lab` (user decision 2026-10-26). Continue there:
  `git fetch && git switch feat/74-uniform-circular-motion && npm ci`.
- After PR #81 merges: `git merge origin/main`, then
  `npx playwright test tests/e2e/layout.spec.ts` (graph plot area ≥ 80 px for the new topic).
- Re-run `npx vitest run src/biology/central/mutation3d/scene.perf.test.ts` on a quiet machine.
- Known limits: `rev/min` is shown as "rev/min" (unit labels are not localized, like "min");
  Gemma "Phân tích đề" with the new problems not tried by hand yet (#37 §16, NVIDIA GPU only).
