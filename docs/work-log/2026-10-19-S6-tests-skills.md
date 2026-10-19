# S6-tests-skills — Studio E2E, Claude Code skills and agents

- **Goal:** Playwright coverage of the brief's flows 1–12 for Science Studio (PHẦN XIII §21), the
  two project skills `simlab-token-guard` and `simlab-quality-workflow` (PHẦN X §18), and only the
  agents with a clear recurring benefit (PHẦN XI §19).
- **Date/time:** 2026-10-19, 14:04–14:20 (+07:00, machine clock).
- **Status:** PASS for this step's deliverables (new spec 6/6, skills load, lint, typecheck, Vitest); the existing E2E suite has FAIL results that this step did not cause (see Tests)
- **Branch / base:** `feat/science-studio` in `D:\Projects\simlab-studio` (HEAD `42bc7d3`; nothing
  staged or modified when the step started).

## Acceptance criteria (written before the spec)

Oracles are the repository data (`data/reactions.json`), textbook physics/biology computed in
the test itself, or a second code path of the app (the lab) — never the Studio code under test.

| #   | Flow (brief §21)                 | Accepted when                                                                                                                                                                         |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Start, open Studio               | The launch page's Science Studio card opens the Studio heading and four tabs; no AI request is made.                                                                                  |
| 2   | Switch subjects                  | Hóa học / Sinh học / Vật lí / Soạn bài each select their tab and show their own lesson (or the authoring list).                                                                       |
| 3   | Chemistry practical              | An impossible bench action is refused with a message and changes nothing; the question's pair gives exactly the `agcl` observation text and equation of `data/reactions.json`.        |
| 4   | State = phenomenon = explanation | Tube state ("Thư viện ghi có kết tủa"), the observation, the conclusion line and the report all show the same library record; the report cites the record's own sources.              |
| 5   | POE with saved evidence          | The prediction is required, recorded, locked after the first mix, and the verdict uses the library outcome.                                                                           |
| 6   | Biology interaction              | Recording a stage gives counts from the model; held-out: metaphase of 2n = 4 → 4 centromeres on the plate, anaphase → 8 single chromosomes, 0 on the plate (textbook mitosis).        |
| 7   | Physics variable → data          | Held-out: h₀ = 20 m (not the default) → table A/B = 20 m / 40 m; fall time √(2h/g) and impact speed √(2gh) computed in the test with g = 9,81 match within 0,5 %; ratio 1,414.        |
| 8   | Author → preview                 | A new chemistry lesson for the BaSO₄ record is refused while empty, saved when filled, previewed in the Chemistry tab with the teacher-content label, and its bench gives the record. |
| 9   | Save / reload                    | After a reload the chemistry session (step, mixes, locked prediction) and the authored lesson are still there.                                                                        |
| 10  | Pending (unreviewed) data        | Lesson note "chưa được kiểm duyệt", record note "Bản ghi thư viện chưa được kiểm duyệt.", unknown pair → "chưa có trong cơ sở dữ liệu đã kiểm chứng" and no invented observation.     |
| 11  | Existing SimLab flows            | "Chạy A trong Phòng thí nghiệm" opens the lab scene whose own solution shows the same fall time; the existing E2E suite still passes.                                                 |
| 12  | UI / JS errors, abnormal states  | No `pageerror` and no console error; no horizontal scroll at 1366×768; no AI host is called unless the learner sends a question.                                                      |

Held-out / black-box case per studio (not mirroring the unit tests or the code): chemistry —
BaCl₂ + H₂SO₄ in the chloride lesson (a real record that is not the question's pair) and
NaCl + H₂SO₄ (no record); biology — anaphase counts; physics — non-default height against the
closed form.

## Files

- `tests/e2e/studio.spec.ts` (new, 6 tests) and a paragraph in `tests/e2e/README.md`.
- `.claude/skills/simlab-token-guard/SKILL.md`, `.claude/skills/simlab-quality-workflow/SKILL.md`.
- `.claude/agents/science-reviewer.md`.
- This file. No source (`src/`), config or dependency change.

## Key decisions

- **Oracles outside the code under test:** chemistry texts, equations and sources are read from
  `data/reactions.json` in the spec; physics times/speeds are √(2h/g) and √(2gh) computed in the
  test; biology counts are textbook mitosis; the lab's own solution checks the Studio's time.
- **Held-out cases:** chemistry NaCl + H₂SO₄ (no record) and BaCl₂ + H₂SO₄ (another record, not
  the question's pair) in the chloride lesson; biology anaphase (8 single chromosomes, 0 on the
  plate) through the 2D picture; physics h₀ = 20 m. The authoring test uses chemistry (the unit
  tests author biology and physics).
- **Biology in the light project:** quality "low" draws the 2D picture, so the test stays out of
  the slow 3D project; `studio-biology.spec.ts` keeps the 3D path.
- **Mocked AI:** every AI host is routed to a recording stub that must stay empty; one test uses
  `fulfillGemini` to check that "Hỏi thầy" sends the measured time only while "Lấy thông tin từ
  màn hình" is on, and that the answer carries "Nội dung do AI hỗ trợ".
- **Environment tolerance (narrow):** `node_modules` here is a junction to
  `D:\Projects\stem-sim-lab-ai-v2\node_modules`, so Vite answers 403 for font files outside the
  project root. The spec tolerates only 403 responses for KaTeX fonts under `/@fs/` and their
  console lines; any other failed response or console error still fails.
- **Skills:** no `.claude/skills/` existed; `.claude/commands` (`sl-plan`, `sl-implement`,
  `sl-review`, `sl-log`) cover the GitHub / Google Doc workflow, not token discipline or test
  evidence, so two skills were created. The quality skill points to `docs/work-log/README.md` for
  the format and names `/sl-log` as the separate Google Doc log instead of duplicating either.
- **Agents (`.claude/agents/` did not exist):**
  - created `science-reviewer`: read-only (`Read, Grep, Glob`), `model: inherit`. Recurring use:
    every scenario, data generator or Science Card change needs a data / sources / equations /
    labels check against `data/` and `docs/DATA_REVIEW.md`, independent of the main work.
  - skipped Main/orchestrator: that is the main session itself.
  - skipped Security/Code review: `/sl-review` and the built-in `code-review` and
    `security-review` skills already cover it; a copy would drift.
  - skipped QA: `simlab-quality-workflow` runs in the main session; a QA subagent would start a
    second dev server and add coordination cost for no new evidence.

## Commands run (real results, summary lines only)

- `npx playwright test tests/e2e/studio.spec.ts --project=chromium` (first run): 3 passed,
  2 failed (biology: the 2D view has no "Các kì" group; physics: 6 × 403 font console errors).
- Same, `-g "biology|physics"` after the fixes: 2 passed. Same, `-g "Hỏi thầy"` (twice, the
  second with the stricter "not shared" check): 1 passed each time.
- Full suite `npx playwright test --reporter=line,html` (HTML report in the scratchpad):
  82 passed, 3 failed, 6 did not run (the 3D projects depend on `chromium`), 3.7 min.
- The 3 failures rerun alone: `ai-flow:377` passed; `ai-flow:402` and `board:834` failed again.
- `npx playwright test --project=chromium-3d --project=chromium-3d-perf --no-deps`: 4 passed,
  2 failed (`studio-biology`, `mitosis3d`: only the 403 font console errors).
- `claude -p --max-turns 1 "Liệt kê tên các skill có trong dự án bắt đầu bằng simlab-. Chỉ trả
lời tên."` from `D:\Projects\simlab-studio`: real output `Error: Reached max turns (1)` — the
  model's first turn was a `Glob` call, so there was no text answer. The CLI also printed
  "Ignoring 30 permissions.allow entries … this workspace has not been trusted" (trust is recorded
  for `D:/Projects/stem-sim-lab-ai-v2`); nothing was changed about it.
- Same prompt once more with `--output-format stream-json --verbose`, reading the `init` event:
  `skills` = `simlab-quality-workflow`, `simlab-token-guard`; `agents` includes
  `science-reviewer`; the answer again stopped at max turns (a `Glob` call).
- `npm run lint`: exit 0. `npm run typecheck`: exit 0.
- `npx vitest run` (full, once): Test Files 208 passed (208), Tests 3423 passed (3423). This
  step has no Vitest file of its own.

## Tests

`tests/e2e/studio.spec.ts` (run in the full suite and alone):

| Test                                                                       | Flows              | Result |
| -------------------------------------------------------------------------- | ------------------ | ------ |
| opens from the launch page; each subject tab shows its own lesson          | 1, 2, 10, 12       | PASS   |
| chemistry practical: bench, library phenomenon, POE, report; reload        | 3, 4, 5, 9, 10, 12 | PASS   |
| biology: stages in the 2D picture match textbook mitosis (2n = 4)          | 6, 12              | PASS   |
| physics: non-default height gives the closed-form times; the lab agrees    | 7, 11, 12          | PASS   |
| authoring: chemistry lesson on the BaSO₄ record, previewed, kept on reload | 8, 9, 10, 12       | PASS   |
| Hỏi thầy (mocked Gemini): engine numbers sent only when shared             | AI context         | PASS   |

Existing suite (this step changed no file under `src/` and no existing spec):

| Test                                                          | Result                       | Classification                                                                                                                                                     |
| ------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 76 other `chromium` tests                                     | PASS                         |                                                                                                                                                                    |
| `ai-flow.spec.ts:402` first run, "18+" turns AI on            | FAIL (twice)                 | Existing: the first-run storage state has no `stemsim.whatsnew`; since the 0.6.0 notes are marked ready (`42bc7d3`) the "Có gì mới" dialog covers the launch page. |
| `ai-flow.spec.ts:377` first run, "under 18"                   | FAIL in full run, PASS alone | Same first-run setup; order/timing dependent (flaky).                                                                                                              |
| `board.spec.ts:834` learner strokes on the board              | FAIL (twice)                 | Not classified: no `.board__student polyline` after the drag; reproduced alone.                                                                                    |
| `studio-biology.spec.ts`, `mitosis3d.spec.ts` (`chromium-3d`) | FAIL                         | Environment: only the 403 font console errors of the linked `node_modules`.                                                                                        |
| other 3D / perf tests (4)                                     | PASS                         |                                                                                                                                                                    |

## Errors and fixes

- The biology test looked for the 3D stage buttons; at low quality the lesson shows the 2D
  picture with "Bước tiếp theo", so the test steps through it (one round).
- Physics test: KaTeX font 403s from the linked `node_modules` → the narrow tolerance above (one
  round). No app change was needed for any studio test.

## Evidence

- Full-run log and HTML report (kept because the run had failures), in the session scratchpad:
  `e2e-full-s6.log`, `pw-html-s6/index.html`; failure traces in `test-results/` (git-ignored).
- CLI init event: scratchpad `skills-init.jsonl`.

## Next steps and limits

- Owner decision: should "Có gì mới" open on a fresh install? Either the app skips it on the very
  first run, or the first-run specs add `stemsim.whatsnew` to their storage state.
- `board.spec.ts:834` needs its own investigation (board stroke capture).
- The 3D specs fail here only because `node_modules` is a junction; a real `npm ci` (CI, the
  user's machine) has no 403s. Re-run them there before the release.
- Not covered by E2E: touch input, the packaged Tauri app (WebView2), clipboard copy.
- Skill loading was verified through the CLI `init` event; no token saving was measured.
