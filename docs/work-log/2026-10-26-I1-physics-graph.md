# I1 — Physics graphs fit the bottom panel (0.8.0, issue #58)

- **Goal:** fix the physics graph at 1366×768 with the default bottom panel (220 px): the
  "Nhấn Chạy…" note sat on the x-axis numbers, the plot area was 35 px tall and the legend hung
  below the panel. Plan: issue #58 (from #37 §9b, part i1).
- **Date/time:** 2026-10-26, 13:30–14:10 +0700 (machine clock)
- **Status:** PASS (3 E2E tests BLOCKED locally by the test port, see Tests)
- **Branch / base:** `feat/58-physics-graph`, on `origin/main` d6f9fec

## Files

- `src/app/sim/GraphPanel.tsx`: compact axes from `src/ui/charts/axes.ts` (`X_AXIS_SIZE`,
  `yTickSpace`, y `labelSize` 20) as in XYChart; uPlot top padding 8 px (was automatic, 17 px);
  the live legend mounted (`legend.mount`) in a fixed-width column right of the plot; the
  "Nhấn Chạy…" note placed over `u.over` (plot area) in a `setSize` hook and after a reset;
  `data-scene` on `.graph-panel`; the picker stays outside the keyed `Chart`.
- `src/app/sim/sim.css`: `.graph-panel` padding/gap 4 px, `.graph-panel__body`,
  `.graph-panel__legend` (13rem, one series per line), legend text rules shared with `.chart`.
- Tests: `tests/e2e/layout.spec.ts` (new, light `chromium` project), `tests/e2e/README.md`.
- Docs: `docs/USER_GUIDE.md` (Bảng dưới), `docs/PROGRESS.md`.

## Key decisions

- **Deviation from the plan, with measurements.** The plan said "subtract the legend height as
  XYChart does". Measured at 1366×768: subtracting the legend and compacting the axes gave a
  46–63 px plot, and a legend in the picker row wrapped on long series names (Con lắc đơn: 51 px).
  The legend therefore moved to a column beside the plot: the plot no longer depends on the
  series names. Result: ≥ 80 px on every physics topic. Chemistry/biology charts (XYChart) are
  unchanged.
- The legend column has a fixed width: a content-sized column grew when the live values replaced
  "—" and resized the plot under the mouse (review finding).
- No number changes: only layout.

## Commands run (real results, summary lines only)

- `npm run lint && npm run typecheck && npm run test` → 307 files passed, 1 skipped;
  4207 tests passed, 1 skipped (pre-existing).
- Prettier on the changed files → clean.
- `layout.spec.ts` on `main`'s GraphPanel → FAIL as expected ("Received: 35", ≥ 80 wanted).
- `layout.spec.ts` after the fix → 2 passed.
- Whole `chromium` project (port 1430, see Errors) → 73 passed, 3 failed (port-bound, below).

## Tests

- PASS: `layout.spec.ts` — all 13 physics topics × every graph, before and after Run: plot area
  ≥ 80 px, legend inside the panel, note inside the plot area, no overflow, no horizontal scroll;
  keyboard focus kept when switching graphs; plot width unchanged when hovering.
- BLOCKED locally: `ai-flow.spec.ts` first-run (2) and `learner.spec.ts` touch targets — they set
  `localhost:1420` storage themselves, and the local run used port 1430. They do not touch the
  graph panel; CI runs them on 1420.
- SKIPPED: `chromium-3d` project locally (no 3D code changed; CI runs it).

## Errors and fixes

- Environment: a dev server left on port 1420 by an earlier local E2E run kept serving old files
  (its file watcher had stopped) and Playwright reuses an existing server. Local runs used a
  temporary config outside the repo (same settings, port 1430, fresh server); the repo config is
  unchanged.
- Test bug: the first version read the graph list before the topic had loaded (0 graphs in a
  parallel run) → waits for `data-scene` to change.
- Review workflow (19 agents): 2 confirmed problems, both fixed — picker remounted on each graph
  switch (keyboard focus lost), plot resized while hovering (content-sized legend).
- A mistaken `git stash push` of two files during the work was restored at once
  (`git stash apply <sha>`, entry dropped); nothing lost.

## Next steps and limits

- (i2) #59 on 01/11 widens `layout.spec.ts` to every subject and screen.
- Next Máy A task: (g1) #60.
