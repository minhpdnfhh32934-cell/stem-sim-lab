# S1-core-physics — Science Studio core and Physics slice

- **Goal:** shared Science Studio core (scenario schema, session/evidence store, POE flow,
  report builder), a third launch-page entry with a Studio screen (Hóa học / Sinh học / Vật lí /
  Soạn bài), and one complete Physics scenario on an existing scene and engine.
- **Date/time:** 2026-10-19, finished about 11:15 (+07:00, machine clock).
- **Status:** PASS
- **Branch / base:** `feat/science-studio` in `D:\Projects\simlab-studio` (HEAD `abc9e0c`,
  unreleased 0.6.0 on top of 0.5.2). Nothing was staged before this step. No commit, no push.

## Feature map

| Learner task               | Screen / entry                                                         | Engine / data                                                                            | Expected result and error cases                                                                                                                                                 | Change                                                                                    | Evidence                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Open the Studio            | Launch page → card "Science Studio" → `StudioScreen` (screen `studio`) | —                                                                                        | Tabs Hóa học / Sinh học / Vật lí / Soạn bài; top bar hides subject switch and problem box                                                                                       | `LandingScreen`, `navigationStore`, `topics.openStudio/useIsStudio`, `AppShell`, `TopBar` | `PoeFlow.test.tsx` (entry test)                                                                                          |
| Predict                    | Vật lí → step "Dự đoán"                                                | POE `freeFall.h0` (`src/learn/poe.ts`)                                                   | Choice required to continue; locked after the first engine run (also after inputs change)                                                                                       | `physics/PhysicsSteps.tsx`, `session.withPrediction`                                      | `session.test.ts`, `PoeFlow.test.tsx`                                                                                    |
| Change a variable, run A/B | step "Thí nghiệm"                                                      | Scene `freeFall`, engine `phys.projectile` run headless with its own dt and `finished()` | A = learner's h₀ (slider keeps B = 2·A inside the scene range 0–200 m); errors `invalid` / `unfinished` / `binding` shown, never a made-up result; new inputs drop old evidence | `physics/engineRun.ts`, `physics/comparison.ts`                                           | `comparison.test.ts` (9 cases g ∈ {9,8; 9,81; 10}, h₀ ∈ {12,5; 45; 100}: engine = `solve()` and t = √(2h/g) within 1e-9) |
| Observe table + graph      | step "Quan sát"                                                        | Engine evidence; graph `position.y` of both runs; scene Science Card                     | Table A/B (inputs, time of flight, impact speed, ratio B/A ≈ 1,414); y(t) for A and B from engine states only; Advanced shows the cross-check gap                               | `PhysicsSteps.Observe`, `XYChart` opt-in `spanGaps`                                       | `PoeFlow.test.tsx` (cells equal `fmtQty(solve())`), `comparison.test.ts` (graph points)                                  |
| Run in the real lab        | "Chạy A/B trong Phòng thí nghiệm"                                      | `openTopic(scene, { params, sources })` → `sim.open`                                     | Lab opens the running scene with that condition                                                                                                                                 | `physics/openInLab.ts`, `openTopic` optional `OpenOptions`                                | Not tested in UI (see limits)                                                                                            |
| Explain / Conclude         | shared steps                                                           | Learner text (local only, ≤ 2000 chars); verdict from `observe()`                        | Explanation ≥ 20 chars; conclusion required; reference conclusion shown after writing, marked "chưa được kiểm duyệt"                                                            | `flow/SharedSteps.tsx`, `ReviewNote.tsx`                                                  | `PoeFlow.test.tsx`                                                                                                       |
| Save / Report              | step "Báo cáo"                                                         | Session evidence + Science Card sources                                                  | Markdown with separate sections for engine numbers, learner words and AI text; save `.md` via `fileio.saveFile`                                                                 | `report.ts`, `ReportStep`                                                                 | `report.test.ts`, `PoeFlow.test.tsx`                                                                                     |
| Progress                   | first run with a prediction                                            | `progressStore.recordPrediction(poe.id, match)`                                          | Counts once for topic `freeFall`                                                                                                                                                | `PhysicsSteps.Interact`                                                                   | `PoeFlow.test.tsx`                                                                                                       |
| Chemistry Studio           | tab Hóa học                                                            | Candidates: `data/reactions.json`, `src/chemistry/balance.ts`, particles                 | Now: "Đang chuẩn bị" only (no fake content)                                                                                                                                     | S2: add `kind: 'chemistry'` to `ScenarioBindingSchema` + a `SubjectPlugin`                | `PoeFlow.test.tsx` (preparing state)                                                                                     |
| Biology Studio             | tab Sinh học                                                           | Candidates: pure models in `src/biology/*`                                               | Now: "Đang chuẩn bị"                                                                                                                                                            | S3                                                                                        | same                                                                                                                     |
| Authoring                  | tab Soạn bài                                                           | `validateScenario()` (zod) for create/edit/preview                                       | Now: "Đang chuẩn bị"                                                                                                                                                            | S4                                                                                        | same                                                                                                                     |

## Verified architecture (read in source this step)

- Navigation: `useNavigationStore.screen`; `AppShell` picks the centre per screen; AI Teacher is
  a lazy chunk. Studio follows the same pattern (`lazy(() => import('@/studio/StudioScreen'))`).
- Physics: `PhysicsScene` (SI params, `defaults`, `engineParams`, `solve`, `graphs`,
  `scienceCard`), lazy `loadScene`; engines registered in `src/workers/engines.ts`;
  `SimulationEngine` (`reset/step/time/readState/finished`) runs fine on the main thread.
  `ProjectileEngine` uses exact constant-acceleration steps and an exact landing time.
- POE: `POES`, `observe()`, `changedValue()`, `answerValue()`; `progressStore.recordPrediction`
  keeps the first answer.
- `XYChart` (uPlot) treats `null` as a gap; `fileio.saveFile` is generic (Rust `save_file` has
  no extension allow-list; browser falls back to a download).
- i18n: `vi.ts` source, `en.ts` identical keys (type-checked); settings `defaultGravity`,
  `uiMode`, `locale`.

## Key decisions

- New `src/studio/`: `scenario.ts` (zod schema, `binding` is a discriminated union — today only
  `physics`), `session.ts` (pure reducers, evidence kinds `engine` / `learner` / `ai`, migration),
  `studioStore.ts` (zustand persist `stemsim.studio` v1; `merge` re-validates same-version data),
  `report.ts` (pure blocks → Markdown or text), `flow/` (shared POE flow + plugin type),
  `physics/` (adapter, headless engine run, steps, plugin), `scenarios/` (built-ins, validated).
- Condition B = A with the POE parameter × factor, so the verdict uses the lab's own `observe()`.
- Engine numbers are evidence; `solve()` is only the cross-check. Changing inputs deletes the
  engine evidence and the verdict, so table, graph, conclusion and report always match.
- `predictionLocked` keeps the POE order after the first run.
- `choiceLabel` moved from `ChallengePanel.tsx` to `src/learn/poeLabels.ts` (shared, no copy).
- No new dependency (zod, zustand, uPlot already present).
- Learner notes are stored locally (`stemsim.studio`), never sent; "Học lại từ đầu" clears them.

## Commands run (summary)

- `npm run typecheck` → pass.
- `npx eslint <changed files>` → first round 11 errors / 8 warnings (single-member union checks,
  deprecated `z.number().finite()`, fast-refresh export mix) → fixed → 0.
- `npx prettier --write` on changed files; `npx prettier --check src/studio src/app src/learn
src/ui/charts docs/DATA_REVIEW.md` → clean.
- `npm run lint` → pass (0 problems).
- `npx vitest run src/studio src/app/i18n src/learn src/app/learner tests/app.test.tsx` → 13 files,
  89 tests passed.
- `npx vitest run` (full) → **192 files, 3328 tests passed** (57 s).

## Tests

New: `src/studio/scenario.test.ts`, `session.test.ts` (reducers, v0 migration, rehydrate of damaged
data), `report.test.ts`, `physics/comparison.test.ts`, `flow/PoeFlow.test.tsx` (XYChart mocked:
uPlot needs a canvas; the chart data is checked in `comparison.test.ts`).

## Errors and fixes

- Graph test looked up landing times with `indexOf` on rounded times → nearest-time lookup.
- Component test: several `role="status"` (Skeleton) and an ambiguous row name → precise queries.

## Evidence

- Science text added: `docs/DATA_REVIEW.md` item 20 (`review_status: "pending"`).
- Test files listed above; full-suite summary line above.

## Next steps and limits

- Not verified in a browser this step: layout at 1366×768 / touch, uPlot `spanGaps` drawing,
  the chat bubble's position over the Studio, Tauri save of `.md`, "Chạy A/B trong Phòng thí
  nghiệm" end to end. E2E specs were not run (launch page now has three cards; the
  `.launch-card--teacher` selector is unchanged).
- The Studio runs the engine headless; play/pause animation stays in the lab (button opens it).
- S2/S3: add a binding kind + `SubjectPlugin` per subject; TypeScript will then point at the
  physics-only code paths that need narrowing. S4: authoring on top of `validateScenario`.
