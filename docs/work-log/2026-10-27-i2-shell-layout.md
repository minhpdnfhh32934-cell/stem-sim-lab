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
