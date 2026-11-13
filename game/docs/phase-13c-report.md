# Phase 13C report — runs completed, in the experiment catalog

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

## 1. Starting state

HEAD `1f003a6` (phase 13b), clean working tree, no remote. The Phase 13C audit (terminal report)
found two things:

- Completion is recorded reliably. `ProgressionSystem` adds an experiment once, when one of its
  runs ends by itself (`endReason` `model`), and the save keeps it.
- No player ever sees it: only the developer debug panel shows it.

## 2. Change

- **`Game.savedCompletedExperiments()`** (`src/game/Game.ts`) returns the experiments that the save
  Continue would load has run to a natural end at least once. It reads that save through the same
  private `readSave()` that Continue uses: the backup is taken if the save is damaged, and the
  character and a world scene must exist. It returns that save's `progression.completedExperiments`,
  kept to the experiments the content has, as a set, so repeats count once. The set is empty when
  there is no save or when Continue would refuse it. It only reads: no state, event, save write or
  scene load, and a save is never rewritten.
- **Catalog** (`src/platform/ui/MainMenu.ts`):
  - That set is read in `refresh()`, together with the saved scene, each time the menu shows.
  - Each experiment's item gets a `<span class="menu-run">` after its line. The span reads "Run
    completed" / "Đã chạy hoàn tất" when the set has the experiment, and is empty (hidden)
    otherwise.
  - Like every menu text, it is drawn again when the language changes.
- **Style** (`src/platform/ui/styles.css`): 12 px in the accent colour, 8 px after the line, so it
  stays below the experiment's line and the objective in weight. It wraps with the line.
- **Text:** one key, `menu.runCompleted`, added in `src/content/strings.json`.
- **Meaning unchanged:** `completedExperiments` still means that a run of the experiment ended by
  itself at least once, and the label says only that. There is no new state, save format,
  migration, checklist or history saving.

## 3. Tests

- **Unit, 8 new** (`src/game/Game.test.ts`):
  - `savedCompletedExperiments`:
    - no save;
    - a damaged save;
    - a save Continue refuses (its scene is gone);
    - a save with no runs;
    - runs with one id repeated and one the content no longer has, giving `pendulum, free-fall`.

    Each case also checks that the stored saves are left untouched.

  - `Game progression`:
    - an experiment is recorded once, however many of its runs end by themselves;
    - a run the time limit cut short is not recorded;
    - a new game starts with none.
  - The Phase 12B block is renamed "Game saved game", and its save helper now takes the completed
    list (default empty). Its own tests are otherwise unchanged.
- **E2E, 1 new** (`e2e/topics.spec.ts`):
  - With no save, no mark shows.
  - With a save that lists one experiment of the content twice, plus a retired id, exactly that
    experiment is marked: "Run completed", then "Đã chạy hoàn tất" after switching language in
    Settings.
  - At 360 × 640 the mark is still visible and nothing overflows sideways.
- No existing assertion changed.

## 4. Verification

| Check              | Result                                           | Duration |
| ------------------ | ------------------------------------------------ | -------- |
| `npm run check`    | **PASS**: 361/361 unit tests (353 + 8), 31 files | 18 s     |
| `npm run build`    | **PASS**                                         | 4 s      |
| `npm run test:e2e` | **PASS**: 30/30 (29 + 1), first run, no retry    | 358 s    |
| `git diff --check` | clean                                            | —        |
| `npm run bench`    | **NOT RUN**: the menu only, nothing in rendering | —        |

Each command ran on its own, after the previous one finished. `npm run check` ran again after this
report was written.

## 5. Limitations

- "Run completed" is not learning or mastery. A projectile launched at 0° from the floor ends at
  once and still counts, as the Phase 13C audit noted.
- The mark comes from the save as it was when the menu showed. A run completed during play
  appears the next time the menu shows, after a reload; the game saves on leaving the page.
- If the save is damaged and its backup is good, the backup warning is now logged twice each time
  the menu shows, because the scene and the runs each read the save.
- Checklist progress and run history are still not saved, by design.

## 6. Next step

From the Phase 13A backlog: mark the Chemistry and Biology labs as planned.
