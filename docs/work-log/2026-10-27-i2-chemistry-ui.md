# (i2) #70 group C — chemistry UI fixes

- **Goal:** fix the group C items of the UI audit (`.agent-logs/ui-audit/confirmed.md`): UI-25, 26,
  29, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 44.
- **Date/time:** 2026-10-27 17:05 +0700
- **Status:** IN_PROGRESS (stopped at a usage limit)
- **Branch / base:** `fix/70-chemistry-ui` from `main` 32a9378, worktree
  `D:\Projects\stem-sim-lab\.claude\worktrees\70-chem-ui`.

## Done (committed)

- UI-25 element data source in the learner's language (citation as tooltip).
- UI-26 (chemistry part) no English/code words: line-of-centres, null space, BigInt, "HAI".
- UI-36 Eₙ, Rₙₗ·Yₗₘ, e<sup>−Eₐ/RT</sup>; sample chips via `formatEquationText` (tested).
- UI-39 `textbookFormula` (NH₃ not H₃N; C₂H₆O for ethanol), tested.
- UI-40 `kindNote` (no "Chất đầu (Chất đầu)"), tested.
- UI-44 ΔH = Eₐ(thuận) − Eₐ(nghịch) with a true minus.
- UI-29 (part): chemistry icon buttons no longer `size="sm"`; chips, orbital picker and segmented
  tabs min-height `var(--target)`.
- UI-34 (part): `.chem-table th.num` right-aligned, inspector values right-aligned.
- UI-35: chemistry formula/label values use the sans font with tabular figures.

## Left

- UI-34: bond-name column `td.num` → plain `td` (BondTable); Bohr series table "Vạch k", units in
  the header, rows cut at the panel edge.
- UI-29: element tiles 40×32, reaction-chip icons; check the eye icon no longer wraps alone.
- UI-32 empty screens (Cấu hình electron lower half; Cân bằng phương trình inspector placeholder,
  needs a `Panel`).
- UI-33 Bohr shell label "4" under the chip row; UI-37 orbital chip `ψ_{2p_z}` and radial equation
  too small; UI-38 3D atom labels overlap; UI-41 search placeholder offset.
- DATA_REVIEW rows (prefix CHEMUI-, pending) for the changed science text (UI-25, 26, 36, 44),
  PROGRESS line, screenshots, `npm run check`, E2E chemistry + full run under the lock, PR
  (base main, needs-review, "Refs #70").

## Tests run

- `npx vitest run src/chemistry` → 83 passed; `npx tsc -b --noEmit` → clean.
