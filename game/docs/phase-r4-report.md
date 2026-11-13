# Phase R4 report — the Experiment Catalog

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase r4.
Audit: `docs/phase-r4-audit.md` (approved with its recommended answers).

## 1. Verdict

**PASS WITH LIMITATIONS** — the Home's "Experiments by topic" is replaced by an Experiment
Catalog that keeps all of its information and adds the procedure steps and model notes; check and
build pass; every e2e test passes, but not in one full run: the full run failed 8 Physics Lab
specs under load, as in the baseline, and they passed re-run with one worker (§9). The catalog was
not looked at live on the GPU (only headless screenshots).

## 2. Baseline and HEAD

HEAD `ea9f006` (phase r3.1), clean tree. Baseline: check PASS 415/415; build PASS (JS 920.63 kB,
CSS 15.42 kB); full e2e 24 passed, 8 failed, 4 did not run — all 8 Physics Lab station waits at
FPS 10–11, none in the menu, topics or settings specs (audit §1). HEAD is unchanged.

## 3. Files changed

| File                                   | Change                                                              |
| -------------------------------------- | ------------------------------------------------------------------- |
| `src/game/catalog.ts`                  | `subjectCatalog()`: the topics grouped by subject (laboratory)      |
| `src/game/catalog.test.ts`             | two tests for it                                                    |
| `src/platform/ui/ExperimentCatalog.ts` | new: the catalog page                                               |
| `src/platform/ui/MainMenu.ts`          | the topic section removed; a Catalog button; open/close, Esc, focus |
| `src/platform/ui/styles.css`           | the catalog's styles; the topic section's removed                   |
| `src/content/strings.json`             | 19 catalog keys in Vietnamese; the 8 topic-section keys removed     |
| `e2e/topics.spec.ts`                   | the same five scenarios, on the catalog (§9)                        |
| `e2e/hooke.spec.ts`                    | steps 1 and 11 read the catalog                                     |
| `docs/data-model.md`, `README.md`      | where players find the experiments now                              |
| `docs/phase-r4-audit.md`, this report  | audit and report                                                    |

## 4. UX

- **Home:** emblem, SIMLAB, character choice, New game, Continue, **Experiment catalog** (a
  secondary button like Continue), Settings. The topic section is gone.
- **Catalog:** a page in place of the Home panel, the R1–R3.1 sky and trail behind it.
  - Header: "Back to the main menu" (Esc too), the title (focused on opening), and one line from
    the saved game: "Your saved game: 1 of 4 experiments run to the end", or "No saved game yet: an
    experiment run to its end is marked here."
  - By **subject** (named by its laboratory) → **topic** → **experiment**: Physics Laboratory with
    Kinematics, Dynamics, Oscillations and waves; Chemistry and Biology Laboratory: "No experiments
    yet".
  - One compact row per experiment: name, a quiet mark ("Run completed" in the accent, or "Not yet
    run to the end", dim), "Played in Physics Laboratory · Projectile range", and the learning
    objective.
  - Opened ("How to run it and how to get there"): the numbered steps, the way from a new game, the
    way from the saved game (when Continue would load one), and, folded, "About the model".
  - No Play button: browsing moves and starts nothing; New game and Continue start the game. An
    experiment without a station would say "No station yet: it cannot be played" (none today).
  - Closing returns the focus to the Catalog button.

## 5. Data sources (nothing copied)

Subjects: `laboratories.json` (each type once, its first laboratory's name) with `topic.subject`;
topics: `topics.json`; experiments, objectives (`description`), steps (`procedure[].instruction`),
notes (`note`): `experiments.json`; places: `topicCatalog`; ways: `routeBetween`; completion:
`Game.savedCompletedExperiments()`. All texts through `texts.of` / `texts.ui`, EN and VI. A missing
objective or procedure would say so ("No learning objective written yet", "No steps written yet");
a missing note is left out — none is missing today.

## 6. Completion semantics

Unchanged and not reimplemented: `ProgressionSystem` alone records an experiment, on
`ExperimentCompleted` with `endReason === 'model'`; STOP publishes nothing, a time-limit run is
ignored, opening or leaving a station records nothing. The catalog only reads
`Game.savedCompletedExperiments()` (the save Continue would load, repeated ids once, gone ids
dropped), as the topic section did. No completion code was touched; the unit tests that pin the
rule passed unchanged (`Game.test.ts`: recorded once, time limit not recorded, New game clears;
`HookeStation.test.ts`: a stopped run is not completed; the station tests: a natural end is).
End to end, `hooke.spec` shows the mark "Not yet run to the end" before and "Run completed" after a
run to rest, read from the save after a reload.

## 7. Save compatibility

No change: `SAVE_VERSION` 2, no migration, nothing about the catalog saved. New game and Continue
are untouched (`MainMenu.run`); the catalog's ways and marks read the save without loading it.

## 8. Responsive and accessibility

- A `section` labelled by its `h2`; the title takes the focus on opening, the Catalog button on
  closing; Esc closes it (Esc is not a game key; the mouse is never captured on the menu). Native
  `<details>` rows: Tab and Enter/Space; visible focus rings in the accent.
- 760 px wide at most, the menu's 400 px column below it: no horizontal overflow at 1280, 430 and
  360 px (tested; headless screenshots at 1280 and 360 looked at); at 1280×520 its top is on screen.
- No animation added; R1–R3.1 unchanged (menu spec passes: reduced motion, trail, one canvas).

## 9. Tests

- Unit: `subjectCatalog` — subjects in laboratory order with their topics, planned ones empty;
  every topic once, its experiments unchanged.
- `e2e/topics.spec.ts` (5): (1) the Home has no topic section; the catalog opens in place of the
  panel, focus on its title, one canvas, the sky behind; subjects, topics, the planned "No
  experiments yet", the experiments in content order with their places and ways; only one button
  (Back), no "Play"; Esc and Back return with the focus on the Catalog button; Vietnamese; a
  1280×520 window; New game still starts the game. (2) the hub door the way names (unchanged).
  (3) ways from the saved game: none without a save; from the hub; already there; none for a save
  Continue would refuse; folded until opened; EN/VI; wrapping at 360 px. (4) every objective,
  procedure step and model note equals the content's, EN and VI, objective under the name, steps
  and notes folded until opened, at 360 px. (5) marks: all "Not yet run to the end" without a
  save; with `[run, run, retired]` only that experiment "Run completed", the summary "1 of 4";
  `data-done` matching; Vietnamese; 360 px.
- `e2e/hooke.spec.ts`: as in §6.
- Before removing the old section, a probe compared it with the catalog in the app, EN and VI:
  identical objectives, places, ways (new game and saved game) and marks.

| Command                                                                                                                   | Result                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `npm run check`                                                                                                           | **PASS**: 417/417, 36 files                            |
| `npm run build`                                                                                                           | **PASS**                                               |
| `npx playwright test topics.spec menu.spec settings.spec --project=dev`                                                   | **PASS** 9/9                                           |
| `npm run test:e2e`                                                                                                        | **FAIL**: 24 passed, 8 failed, 4 did not run (6.5 min) |
| `npx playwright test hooke.spec experiment.spec measurement.spec history.spec oscillation.spec --project=dev --workers=1` | **PASS** 11/11 (8.0 min)                               |
| `npx playwright test --project=dev-timed --no-deps`                                                                       | **PASS** 4/4                                           |
| `git diff --check`                                                                                                        | clean                                                  |

The full run's 8 failures: experiment, measurement ×2, history ×3, hooke, oscillation — each a
wait for the debug panel's `Station:` line after dial or run steps, the panel at FPS 10–11 (179 of
188 readings), the baseline's pattern. `hooke.spec` is the one R4 changed; it passed its catalog
step and failed at line 118, a dial step — the assertion that also failed in the R3.1 and R4
baselines. With one worker all of them, `hooke.spec`'s catalog steps included, pass. All 36 tests
pass across these runs; no single full run passed.

Static: `requestAnimationFrame` only at `src/main.ts:46, 48`; no canvas added (the diff's only
"canvas" is the new assertion); no completion logic in the UI code.

## 10. Bundle size

| Asset    | Baseline  | R4        | Delta    |
| -------- | --------- | --------- | -------- |
| JS entry | 920.63 kB | 924.31 kB | +3.68 kB |
| CSS      | 15.42 kB  | 16.85 kB  | +1.43 kB |

`production.spec`'s 1,000,000-byte menu budget passes (in the full run).

## 11. Limitations

- No single full e2e run passed: the Physics Lab specs fail under parallel load (FPS 10–11), as in
  every full run since R2; a separate task was proposed for it.
- The catalog was not seen live on the GPU (the browser pane was hidden); headless screenshots only.
- The menu shows only at boot (no path back to it in the game), so the catalog reflects the save,
  not progress made since; that is how the topic section worked too.
- Experiments with no station, objective or steps are handled honestly in code but none exist
  today, so those texts are not exercised by e2e.

## 12. Git status

Not committed, not pushed; see the end of this phase's summary.
