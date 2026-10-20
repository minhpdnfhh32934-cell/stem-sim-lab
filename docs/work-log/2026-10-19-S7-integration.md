# S7 — Integration: full checks, role walkthrough, docs

- **Goal:** run every check once on the whole Science Studio branch, fix failures at the root, walk
  through the app as a learner, a teacher and a maintainer, and record what is accepted.
- **Date/time:** 2026-10-19 14:26–14:58 SEAST (machine clock)
- **Status:** PASS (with the environment limit and open items below)
- **Branch / base:** `feat/science-studio` (released source 0.5.2 + unreleased 0.6.0 work); S1–S6
  already staged or committed; nothing committed in this step.

## Files

- `tests/e2e/ai-flow.spec.ts` — the "first run" specs now also pre-set `stemsim.whatsnew`, like
  `tests/e2e/storage-state.json`.
- `src/app/i18n/locales/vi.ts`, `en.ts` — `studio.bio.stages.help` also names the 2D picture's
  buttons ("Bước trước", "Bước tiếp theo").
- `docs/USER_GUIDE.md` (Science Studio section), `docs/ARCHITECTURE.md` (new §3f, module map of
  `src/studio/`), this record.

## Key decisions

- `ai-flow` first-run specs: the app is right. With `stemsim.tourDone` and no `stemsim.whatsnew`
  the rules (`src/app/whatsnew/rules.ts`) treat the user as an existing user and show the 0.6.0
  notes at the next calm moment, which is the launch page right after the age question closes.
  The specs test the age question, so they get the same "notes seen" record as every other spec.
  "Có gì mới" itself keeps its own tests (`src/app/whatsnew/*.test.ts*`).
- `board.spec.ts:834` and the 3D specs: not changed. Cause found (below) is the linked
  `node_modules`, not the app or the spec logic.
- Cargo checks skipped: `git diff feat/teacher-board-runtime -- src-tauri` and the working tree
  show no change under `src-tauri/`.
- No new scientific text, so no new `docs/DATA_REVIEW.md` entry (items 20–23 cover the studio).

## Commands run (real results, summary lines only)

| Command                                                             | Result                                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                              | exit 0, "All matched files use Prettier code style!"                                                  |
| `npm run lint`                                                      | exit 0                                                                                                |
| `npm run typecheck`                                                 | exit 0                                                                                                |
| `npx vitest run`                                                    | 208 files, 3423/3423 tests passed (70,6 s)                                                            |
| `npm run build`                                                     | exit 0; known warning: `index` chunk 809,81 kB > 700 kB (same size as in release-prep)                |
| `npx playwright test` (all 3 CI projects)                           | 84 passed, 1 failed (`board.spec.ts:834`), 6 did not run (3D projects depend on `chromium`) — 3,4 min |
| same spec alone, then with font files served (see Errors)           | failed alone; passed (1/1) with fonts served                                                          |
| `--project chromium-3d --project chromium-3d-perf --no-deps`        | 6/6 passed (fonts served)                                                                             |
| `npx playwright test` again, fonts served, after the spec fix       | **91/91 passed** (4,2 min)                                                                            |
| after the i18n/docs edits: `npx vitest run src/studio src/app/i18n` | 22 files, 140/140 passed                                                                              |
| after the edits: studio + studio-biology + ai-flow E2E              | 25/25 passed                                                                                          |
| `npx eslint` (changed files), `npx prettier --check .`              | clean                                                                                                 |
| cargo fmt / clippy / test                                           | SKIPPED (no Rust change)                                                                              |

## Tests

No test was skipped or weakened. The only spec change adds a storage entry the shared storage state
already has.

## Errors and fixes

1. `board.spec.ts:834` ("Bút của em" stroke): `elementFromPoint` at the pen's start point was
   `null` — the element's box began at x = −118 px. The dev server answered every
   `@fontsource` (Pangolin, Patrick Hand) and KaTeX font request with 403 "outside of Vite serving
   allow list" because `node_modules` here is a junction to `D:\Projects\stem-sim-lab-ai-v2`. With
   the fallback font the board line is wider than the zoomed view, so the spec's point (60 px into
   the line) is off screen. Served the fonts with a temporary dev-server config in the git-ignored
   `.agent-logs/debug/` (`server.fs.allow` + the junction target, repo files untouched): the spec
   and all 3D specs pass. One round.
2. `ai-flow.spec.ts:377/402`: passed in this full run, but S6 saw them fail; cause and fix above.
3. Walkthrough script mistakes (mine, not the app's): a wrong hint-button pattern, a second "Tiếp"
   after the physics run already moved to Quan sát, a "Câu hỏi dự đoán" field that physics lessons
   do not have. Fixed in the script.

## Evidence

- Logs in the session scratchpad: `int-vitest.log`, `int-build.log`, `int-e2e-full.log` (first
  run), `int-e2e-3d.log`, `int-e2e-full2.log` (91/91), `walk*.log`; walkthrough screenshots in
  `walk/`. The walkthrough spec is `.agent-logs/walkthrough/walkthrough.spec.ts` (git-ignored, not
  part of the suite).

### Role walkthrough (Playwright, `npm run dev`, Gemini mocked, 1366×768)

- **Learner, Hóa học:** predict → bench (empty tube refused, NaCl + AgNO₃ mixed) → observe →
  explain (blocker "Viết giải thích ít nhất 20 ký tự." until long enough; "Xem gợi ý 1") →
  conclude → report. "Lưu báo cáo (.md)" downloaded `nhan-biet-ion-cl-bang-dung-dich-agno.md`
  with toast "Đã lưu: …"; "Sao chép báo cáo" without clipboard permission showed the fallback
  toast "Chưa sao chép được. Em chọn chữ…". 0 page errors, no horizontal scroll.
- **Learner, Sinh học (2D, quality Low):** "Kì giữa" recorded (4 NST kép, 4 on the plate), parts
  picked from "Bộ phận tế bào", first check "Đúng 4/5" with the wrong one marked, then 5/5 →
  observe → explain → conclude → report (report lists the model's counts and "chưa được kiểm
  duyệt").
- **Learner, Vật lí:** predict → run (A = 20 m, B = 40 m) → the app moves to Quan sát → explain →
  conclude → report → "Hỏi thầy" sends the prefilled question and the mocked answer carries the
  "Nội dung do AI hỗ trợ" label.
- **Teacher:** empty "Soạn bài" says what to do; an empty lesson is refused with three reasons;
  a physics lesson saved ("Đã lưu bài …"), previewed in Vật lí and run; a broken JSON import is
  refused with "Không nhập được tệp này: Tệp không phải JSON hợp lệ."; delete asks first (read in
  `AuthoringPane.tsx`, not clicked here).
- **Maintainer:** the newest record + `README.md` here say how to resume; `src/studio/` was easy
  to find by file names, but no doc mapped it → added `docs/ARCHITECTURE.md` §3f.

### Acceptance criteria (brief PHẦN XV §24) vs evidence

| Criterion                                          | Evidence                                                                                                                                    | Status        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Entry point to Science Studio                      | launch-page card; `studio.spec.ts` test 1; walkthrough                                                                                      | PASS          |
| Chemistry, Biology and Physics studios             | `studio.spec.ts`, `studio-biology.spec.ts`; walkthrough to the report in all three                                                          | PASS          |
| Each flow runs on a real engine or verified data   | physics: scene engine vs closed form (held-out h = 20 m); chemistry: `data/reactions.json` records; biology: model counts (2n = 4 held-out) | PASS          |
| Authoring MVP: create, edit, preview               | `studio.spec.ts` authoring; unit tests in `src/studio/authoring`; walkthrough (physics lesson)                                              | PASS          |
| Predict, interact, observe, explain / finish       | blockers and steps seen in the walkthrough for all three subjects                                                                           | PASS          |
| Data, model, phenomenon and explanation consistent | E2E checks of record text/equation and closed-form numbers                                                                                  | PASS          |
| Sources and scientific limits shown                | report sources, "chưa được kiểm duyệt", "chưa có trong cơ sở dữ liệu đã kiểm chứng"                                                         | PASS          |
| AI Teacher does not invent results                 | mocked Gemini only: numbers sent only when shared, AI label; no real model tried                                                            | PASS (mocked) |
| Older SimLab features not broken                   | all older E2E specs pass (91/91 with fonts served); 3423 unit tests                                                                         | PASS          |
| Architecture fits the source; related tests; docs  | §3f map; tests next to code; USER_GUIDE section                                                                                             | PASS          |
| Build, lint, typecheck, tests run                  | table above                                                                                                                                 | PASS          |
| Skills/agents checked                              | done in S6 (CLI init event); not re-checked here                                                                                            | SKIPPED       |
| Playwright marked working only after real runs     | runs above                                                                                                                                  | PASS          |
| No token-saving claim without a baseline           | none made                                                                                                                                   | PASS          |

## Next steps and limits

By priority:

1. Before a release, run `npm run test:e2e` where `node_modules` is a real folder (CI or a fresh
   `npm ci`): here the fonts only load with the temporary config.
2. `board.spec.ts:834` depends on font metrics: its start point can leave the zoomed view when a
   board line is wider than the view. Consider starting the stroke inside the visible part of the
   element (G8 area, owner's call).
3. Physics moves to Quan sát by itself after "Chạy thí nghiệm"; Chemistry and Biology stay on the
   experiment step. Decide one behaviour (or announce the move).
4. The biology lesson title and lead say "3D" also when the 2D picture is shown; that text is
   lesson content under review (DATA_REVIEW 22), so it was left for the teacher review.
5. "Hỏi thầy" on the free-fall lesson listed "Sinh học · Đột biến NST" among its knowledge
   sources (existing knowledge-library matching, outside `src/studio/`).
6. `CLAUDE.md` has no line for `src/studio/`; add one when the owner agrees.
7. Not covered: real AI models, touch input, the packaged desktop app in this step (release-prep
   checked it), clipboard copy with permission granted.
