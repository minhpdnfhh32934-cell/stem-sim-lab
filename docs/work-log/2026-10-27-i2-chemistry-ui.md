# (i2) #70 group C — chemistry UI fixes

- **Goal:** fix the group C items of the UI audit (`.agent-logs/ui-audit/confirmed.md`): UI-25, 26,
  29, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 44.
- **Date/time:** 2026-10-27 17:05 +0700 (resumed after a usage limit the same evening)
- **Status:** DONE except the items under "Left" (written in the PR)
- **Branch / base:** `fix/70-chemistry-ui` from `main` 32a9378, `origin/main` f5f0a35 merged in;
  worktree `D:\Projects\stem-sim-lab\.claude\worktrees\70-chem-ui`.

## Done

- UI-25 element data source in the learner's language (full citation stays as the tooltip).
- UI-26 (chemistry part) no English/code words: line-of-centres, null space, BigInt, "HAI".
- UI-29 chemistry icon buttons no longer `size="sm"`; chips, orbital picker and segmented tabs
  `min-height: var(--target)`; periodic tiles grow to `--target` on touch screens only (118 tiles
  do not fit at 40 px on a 1366×768 mouse screen; same rule as the app's icon buttons).
- UI-32 Cân bằng phương trình: new inspector `BalancePanel` (how to write an equation + samples),
  the "Thanh trượt thông số…" placeholder is gone; the stage keeps the input and the result.
- UI-33 Bohr picture laid out below the chip row (`bohrLayout`, tested).
- UI-34 table headers aligned with their numbers; bond names no longer in the number column; Bohr
  series header "Vạch k (nm)", cells numbers only.
- UI-35 formula/label values in the sans font with tabular figures (no dotted subscripts, O ≠ 0).
- UI-36 Eₙ, Rₙₗ·Yₗₘ, e<sup>−Eₐ/RT</sup>; sample chips via `formatEquationText` (tested).
- UI-37 radial equation on two lines (N_nl named), chip ψ(2p_z) instead of a nested subscript.
- UI-38 3D atom labels: a farther label that would touch a nearer one is hidden
  (`visibleLabels`, tested).
- UI-39 `textbookFormula` (NH₃ not H₃N; Hill order for carbon compounds), tested.
- UI-40 `kindNote` (no "Chất đầu (Chất đầu)"), tested.
- UI-41 reaction search placeholder starts next to its icon.
- UI-44 ΔH = Eₐ(thuận) − Eₐ(nghịch) with a true minus.
- DATA_REVIEW CHEMUI-1 … 6 (pending), PROGRESS line.

## Left (in the PR)

- UI-32 Cấu hình electron: the lower half of the stage stays empty. Filling it needs new teaching
  content (e.g. an n + l filling diagram) that a teacher should choose; not invented here.
- UI-34 Bohr series table: rows below Lyman are reached by scrolling the bottom panel (it is a
  scroll area) or by making the panel taller; no layout change made.
- UI-29 reaction player icons are the app's standard `md` icon buttons, which already grow on
  touch screens (`src/ui`, group S).

## Tests run

- (filled in after the runs)
