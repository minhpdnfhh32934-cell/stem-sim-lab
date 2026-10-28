# (i2) #70 — nhóm S, PR-B: bố cục khung giao diện dùng chung

- **Goal:** the layout findings of group S in the 1366×768 UI audit
  (`.agent-logs/ui-audit/confirmed.md`): UI-01, 02, 07, 09, 10, 24, 30, 31, 42, 43, 53.
- **Date/time:** 2026-10-27 22:49 +07:00
- **Status:** PASS (results below); PR-A (numbers and text) is #98, PR-C (UI-22) next.
- **Branch / base:** `fix/70-shell-layout` from `main` 32a9378, `main` merged (b05f0e4).

## Changes

- UI-01: `AppShell` sets `data-bubble` while the AI Teacher button shows. With an Inspector, its
  scroll area stops above the button (`margin-bottom`, not a padding the content scrolled under);
  without one (Science Studio, lab home), the centre keeps a strip free at its bottom.
- UI-02: the stage tool palette sits right of the y-axis numbers (`--axis-gutter`, 52 px).
- UI-09, UI-10: `src/ui/useScrollCue.ts` sets `data-more-below` on the bottom panel's scroll area;
  `.scroll-cue` draws a sticky fade at its bottom edge while more is below.
- UI-07, UI-09: `.solution` is a container: answers and steps stack when the panel is narrower
  than 60rem (labels and the check chip stay on one line, chip `nowrap`); grid items get
  `min-width: 0`, so a long formula scrolls inside its box instead of widening the column.
- UI-24: the bottom panel's minimum is 210 px (tab bar, graph picker and a 120 px chart).
- UI-30: suggestion cards fill their grid cell (`height: 100%`): a row is even.
- UI-31: the first-run dialog focuses the chosen grade after `showModal()`.
- UI-42: the selected library item changes colour only (bold made it wrap).
- UI-43: `src/ui/ui.css`: a label that wraps a checkbox keeps box and text together (beats a
  form's `space-between`), 18 px box, 40 px row target — fixes the chemistry and biology panels.
- UI-53: a checkbox parameter is one row: box, label, source chip; same font as other labels.

## Tests

- E2E `tests/e2e/layout.spec.ts`: 8 new checks (UI-01, 02, 07+09, 10, 24, 30, 42+43, 53);
  `project.spec.ts` first run: the chosen grade is focused (UI-31). All 9 **fail on the old
  source** (checked by restoring it, new tests kept: 8 + 1 failed) and pass now.
- Unit: `src/ui/useScrollCue.test.ts` (`moreBelow`).

## Results (real, after merging `main` b05f0e4)

| Check                                                                                | Result                                             |
| ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Prettier on every file that differs from `main`, `npm run lint`, `npm run typecheck` | PASS                                               |
| `npx vitest run --maxWorkers=2`                                                      | PASS — 328 files, 4415 tests (1 skipped, existing) |
| `npx playwright test` (all three projects, under the shared lock)                    | PASS — 141/141 (8,9 min)                           |

## Review round (#101, 2026-10-28)

- 1, 2: moving the palette right of the y numbers covered the captions scenes write at x = 60 px
  and, with the compare legend at x ≈ 60, the Pin button. The palette is back at its old place
  (12 px); `drawGrid` (`src/physics/render/draw.ts`) takes `labelLeft`, measured by `StageCanvas`
  from the palette's right edge, and then skips the top caption rows (`CAPTION_ROWS` 80 px).
  Moving the palette to the right edge was rejected: at 1366×768 the stage (~343 px) is barely
  taller than the palette (~314 px), so it would cover the HUD title.
- 3: the bottom panel's height is also capped so the stage keeps its 12rem minimum (600 px window,
  140 % font); a saved height under 210 px is raised on load (unit test).
- 4: the checkbox rule now applies to `.param__toggle` and `.chem-form` labels only; hidden switch
  inputs (`.chat-toggle`) stay 1 px (E2E, fails with the old rule).
- 5: `.param__toggle` is inline-flex, centred, with a gap; the E2E measures the input itself.
- Results: `npm run lint`, `npm run typecheck` PASS; vitest `src/app/layout src/app/sim src/ui
src/physics/render` PASS — 163 tests; E2E layout, project, physics, learner PASS — 34 passed +
  the Settings test after fixing its locator (`tab`) 1/1.
