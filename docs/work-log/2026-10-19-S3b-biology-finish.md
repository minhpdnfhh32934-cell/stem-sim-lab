# S3b-biology-finish — Biology Studio review fixes + Playwright spec

- **Goal:** fix the three low issues from the review of the "Nguyên phân 3D" Studio lesson (cell
  type could change mid-lesson; on-plane count read from illustrative positions; lab settings not
  given back) with tests, and add `tests/e2e/studio-biology.spec.ts`.
- **Date/time:** 2026-10-19 13:27 +0700 (machine clock, at the end of the step)
- **Status:** PASS
- **Branch / base:** `feat/science-studio` (uncommitted; checkpoint = staging)

## Files

- `src/biology/division/mitosis3d/timeline.ts`: `heldOnPlate(stage, u)` (exported) and the shared
  `metaphasePull(u)` that the metaphase pose also uses.
- `src/biology/division/mitosis3d/store.ts`: `cellLocked` in the 3D view's transient store.
- `src/biology/division/mitosis3d/Mitosis3DView.tsx`, `src/biology/ui.tsx` (`Segmented`
  `disabled`), `src/ui/ui.css` (disabled segmented style).
- `src/studio/biology/`: `model.ts`, `useModel.ts`, `StageRecorder.tsx`, `bioSession.ts`,
  `biology.css`; tests `model.test.ts`, `match.test.ts`, `BiologyFlow.test.tsx`.
- `src/biology/division/mitosis3d/Mitosis3DView.test.tsx` (lock test).
- `src/app/i18n/locales/vi.ts` + `en.ts`: `studio.bio.stages.lockedCell`, `.otherCell`, new
  wording of `studio.bio.observe.illustrative`.
- `tests/e2e/studio-biology.spec.ts` (new); `playwright.config.ts` (`HEAVY_3D` also matches it).
- `docs/DATA_REVIEW.md` #22 (how the plate count is obtained; lesson cell lock).

## Key decisions

- Issue 1: both a lock and a guard. While the model step is shown, the lesson holds 2n and cell
  type and sets `cellLocked`; the 3D view's "Loại tế bào" control is disabled, and a note next to
  the recorder says so. `withStageObservation` now takes the cell from the binding (no
  `tl`/`cellType` arguments), so a record always describes the lesson's cell; the record button
  is disabled with an alert if the shown cell ever differs.
- Issue 2: the on-plane count no longer reads positions (`PLANE_EPS` removed). It is
  `heldOnPlate(stage, u) ? double : 0`, where `heldOnPlate` is the pose program's own meaning
  (metaphase, pull complete). Chromosome and double counts stay bookkeeping counts. A test
  cross-checks that the drawn centromeres sit on x = 0 exactly when the model holds them there.
  The Observe note now states exactly what is exact and where the plate count comes from.
- Issue 3: `useLessonModel` (layout effect) snapshots pairs, cell type, view3d, 2D stage index
  (with its division), speed, and the 3D time/selection/camera, and restores them on cleanup
  (next step or lesson closed).
- The new spec runs in the `chromium-3d` project (software WebGL, after the other specs) like
  `mitosis3d.spec.ts`. AI hosts are routed to a stub that records calls; the test expects none.

## Commands run (real results, summary lines only)

- `npx vitest run src/studio/biology src/biology/division/mitosis3d/{Mitosis3DView.test.tsx,timeline.test.ts,scene.test.ts}` → 6 files, 88 passed (before the new flow test cases)
- `npx vitest run src/studio/biology/BiologyFlow.test.tsx` → 3 passed
- `npm run typecheck` → clean; `npm run lint` → clean (after removing a temporary file, below)
- `npx prettier --check` on changed files → clean
- `npx vitest run` (full) → 208 files, 3423 tests passed
- `npx playwright test tests/e2e/studio-biology.spec.ts` (with dependencies) → the whole
  `chromium` project ran first: 78 passed, 1 failed (`board.spec.ts:834`, stroke count), so the
  new spec did not run. Rerun alone: `board.spec.ts:834` → 1 passed (load-related flake, not
  this step).
- `npx playwright test tests/e2e/studio-biology.spec.ts --project=chromium-3d --no-deps` → first
  run: timeout (topic button name had a progress suffix) → fixed locator; second run: all
  checks passed except 6 console errors "403 Forbidden" (see Errors) → after the dev-server
  fix: 1 passed.
- `npx playwright test tests/e2e/biology.spec.ts tests/e2e/mitosis3d.spec.ts tests/e2e/studio-biology.spec.ts --project=chromium --project=chromium-3d --no-deps` → 9 passed (the `@perf` test was not run).

## Errors and fixes

- KaTeX font 403s in e2e: this worktree's `node_modules` is a junction to
  `D:\Projects\stem-sim-lab-ai-v2\node_modules`, outside Vite's `server.fs.allow`, so the dev
  server refuses the fonts (environment only; a normal checkout is not affected). For the local
  run a dev server was started with a temporary git-ignored config
  (`.agent-logs/vite.e2e.config.ts`: the project config + `fs.allow` of the real `node_modules`
  path); Playwright reused it. The file was deleted afterwards (ESLint picks up `.agent-logs`).
  The project's `vite.config.ts` is unchanged.

## Next steps and limits

- The dev server started for the e2e run (port 1420) could not be stopped from the agent
  session (permission denied); stop it by hand if it is still running.
- 2n has no control inside the lesson (the 2n selector lives in the lab's Inspector panel), so
  only the cell type control needed the lock.
