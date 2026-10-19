---
name: simlab-quality-workflow
description: Verification workflow for STEM Sim Lab that ties the repository work log (docs/work-log/) to real test runs (Vitest and Playwright E2E). Use before claiming a feature, fix or step is done or tested, when choosing which tests to run, when an E2E test fails, and when writing a work-log entry with PASS/FAIL/BLOCKED/SKIPPED results.
---

# SimLab quality workflow

The repository work log is `docs/work-log/` (format and statuses in its `README.md`). The
Google Doc session log is a different thing, written by the `/sl-log` command.

## 1. Know where you are

1. Read the newest relevant record in `docs/work-log/` (its "Next steps and limits").
2. Check the real state: `git status --short`, `git diff --cached --stat`. The log is a guide,
   not the source of truth.

## 2. Accept before testing

Write the acceptance criteria from the user's request first (in the work-log record). Each
criterion needs an oracle that is not the code under test: repository data (`data/*.json`), a
closed form computed in the test, or another code path of the app. Add at least one held-out /
black-box case for every risky slice.

## 3. Pick the tests by scope and risk

| Change                               | Run                                                        |
| ------------------------------------ | ---------------------------------------------------------- |
| pure logic (`*.ts`)                  | its `*.test.ts` with `npx vitest run <files>`              |
| a React panel or flow                | its component test, then the matching E2E spec             |
| a user flow, navigation, persistence | `npx playwright test tests/e2e/<spec> --project=chromium`  |
| 3D views (mitosis)                   | project `chromium-3d` (software WebGL, slow)               |
| end of step / release                | `npm run lint`, `npm run typecheck`, `npx vitest run`, E2E |

E2E rules: the Vite dev server starts from `playwright.config.ts`; enter the lab with
`tests/e2e/nav.ts`; route every AI host to a stub (`tests/e2e/fakeAi.ts`) and assert which calls
happened. Never call real APIs, Gemma/WebGPU, local runtimes or installers.

## 4. Run and keep evidence

- Run the tests for real; keep the summary lines and the errors that matter.
- Traces are kept on failure (`trace: 'retain-on-failure'`); write an HTML report only when
  needed (`--reporter=line,html` with `PLAYWRIGHT_HTML_OPEN=never`) and keep it only on failure.

## 5. Classify failures with evidence

App bug, test bug, environment (ports, linked `node_modules`, missing browser) or flaky (fails
then passes with nothing changed — say so, do not hide it). Never skip, weaken or delete a
failing test to get green; fix the cause or report it. At most three fix/test rounds per problem.

## 6. Record

For every test or flow in the work-log record: `PASS` (ran and passed), `FAIL` (ran and failed,
with the error), `BLOCKED` (could not run, and why) or `SKIPPED` (deliberately not run, and why).
Never mark PASS without a run, and never claim a flow was tested if it was not run.
