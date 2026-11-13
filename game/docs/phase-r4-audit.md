# Phase R4 audit — moving "Experiments by topic" into an Experiment Catalog

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Read-only audit:
no source file changed; this report is the only new file. Committed with phase r4.

## 1. Git baseline and working tree

HEAD `ea9f006` (phase r3.1), in history; clean working tree, no untracked file, nothing of the
user's pending.

| Baseline           | Result                                                 |
| ------------------ | ------------------------------------------------------ |
| `npm run check`    | **PASS**: 415/415, 36 files                            |
| `npm run build`    | **PASS**; JS entry 920.63 kB, CSS 15.42 kB             |
| `npm run test:e2e` | **FAIL**: 24 passed, 8 failed, 4 did not run (6.4 min) |

All 8 failures are Physics Lab specs (free-fall, experiment, history ×2, hooke, measurement ×2,
oscillation) waiting on the debug panel's `Station:` line after dial or run steps, with the panel
at **FPS 10–11** (160 of 174 readings): the load pattern of every full run since R2. The four timed
specs did not run because they depend on the failed project. Every spec R4 concerns passed: menu
(3), topics (5), settings (1). None of these failures is R4's.

## 2. How the Home is built today

- `src/main.ts` registers `MainMenu` (`src/platform/ui/MainMenu.ts`) as a platform `GameSystem`.
  `init` builds the DOM once: the R1 sky (stars, R2 glyphs), the R3 trail, then one `.menu-panel`
  with the brand (R2 emblem, `h1` SIMLAB, subtitle) and `.menu-controls`: character choice, New
  game, Continue, **`this.topics()` — the `<details class="menu-topics">` "Experiments by topic"**,
  Settings (`<details>` with the language radios) and a message line.
- Shown and hidden only by `SceneLoaded`: `kind === 'menu'` shows it and calls `refresh()` (Continue
  enabled, the saved scene and completed experiments re-read), a world scene hides it. The main menu
  scene is loaded once, at boot (`Game.boot`, `config.game.initialScene`); **no path returns to the
  menu** after New game or Continue.
- Text: every visible string through `texts.ui` / `texts.of`, re-rendered on `LanguageChanged`
  (`show()` / `render()`). No navigation stack or state machine: the sections are native
  `<details>` elements in one panel.
- While the menu shows, the world systems do nothing (they gate on `phase === 'playing'`); the
  renderer draws the empty menu scene. Opening anything in the menu changes no game or world state.

## 3. Where the catalog's data comes from

| Data               | Source (canonical)                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Subjects           | `topic.subject` (`TopicDefinitionSchema`, the `LAB_TYPES` enum) and `laboratories.json` (`type`, `displayName`, `experiments`)                |
| Topics             | `src/content/topics.json`: kinematics (free fall, projectile motion), dynamics (Hooke's law), oscillations and waves (pendulum) — all physics |
| Experiments        | `src/content/experiments.json` (`name`, `category`, `description`, `note`, `procedure`, localized in `vi`)                                    |
| Learning objective | `experiment.description` — "what the experiment teaches" since Phase 13B (EN/VI for all four)                                                 |
| Instructions       | `experiment.procedure[].instruction` — the 5–6 checklist steps the HUD shows at the station (EN/VI). The model's notes: `experiment.note`     |
| Where it is played | `topicCatalog()` in `src/game/catalog.ts`: a placement whose `params.experimentId` is the experiment, in a room of a world scene              |
| How to get there   | `routeBetween()` in `src/game/catalog.ts`: doors (and the procedures that gate them) from the new-game scene or the saved scene               |
| Completion         | `Game.savedCompletedExperiments()` — the save Continue would load, `progression.completedExperiments`, ids still in the content               |

Also in the world, not linked to an experiment by id: the instruction boards
(`*-instructions` items, `description` and printed `label`), placed beside each station. Using
them would need a link the data does not have; the procedure steps say the same in a structured,
translated form.

Chemistry and biology: laboratories without `experiments` and without topics; the world labels
them "planned · no experiments yet" (Phase 14). The data has no topic or experiment for them.

All of this is already computed from the content alone (`topicCatalog`, `routeBetween`); the menu
only presents it. Nothing needs to be copied.

## 4. Completion semantics (to keep exactly)

- Only `ProgressionSystem` writes it: on `ExperimentCompleted` with `endReason === 'model'`, the
  experiment id is added once to `state.progression.completedExperiments`.
- `ExperimentSystem.report` publishes `ExperimentCompleted` only for a run whose status is
  `completed`; a time-limit run is `completed` with `endReason 'time-limit'` and is ignored; STOP
  gives `stopped` and publishes nothing; opening or leaving a station records nothing.
- Saved in `progression.completedExperiments`, restored by Continue, cleared by New game.
- Already tested: `Game.test.ts` (recorded once; a time-limit run not recorded; New game clears;
  `savedCompletedExperiments` filters gone and repeated ids, reads only), `HookeStation.test.ts:185`
  (a stopped run is not completed), the station tests (a run to its natural end is), e2e
  `topics.spec.ts:240` (the marks follow the save).
- The menu shows it as "Run completed" — deliberately "a run reached its natural end", not "learned".
  The catalog must read the same `Game.savedCompletedExperiments()`; no second completion logic.

## 5. Save and navigation

- `SAVE_VERSION` 2, one migration (1 → 2). The save holds the scene, the player's pose, worn
  equipment, entity states (station dials), `completedExperiments` and procedure progress.
- The catalog needs nothing saved: whether it is open is UI state. **No save change, no version
  bump.**
- Navigation: a catalog can open and close inside the menu without touching the game. Esc is not a
  game key (`BrowserInput` ignores it) and the pointer is never captured on the menu, so Esc can close
  the catalog. No navigation framework is needed.
- New game / Continue: unchanged as long as their buttons and `MainMenu.run` stay as they are.

## 6. Files that would change

| File                                                      | Change                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/game/catalog.ts`                                     | possibly a small pure helper grouping topics by subject (laboratory), unit-tested   |
| `src/platform/ui/ExperimentCatalog.ts` (new)              | the catalog view, built from `topicCatalog`/`routeBetween`/the saved progress       |
| `src/platform/ui/MainMenu.ts`                             | remove `topics()`; a Catalog button; open/close the view                            |
| `src/platform/ui/styles.css`                              | the catalog's styles; the `.menu-topics` rules removed                              |
| `src/content/strings.json`                                | catalog keys in Vietnamese; the menu topic keys renamed or removed (`strings.test`) |
| `e2e/topics.spec.ts`                                      | rewritten for the catalog (its five tests' content kept)                            |
| `e2e/hooke.spec.ts` (steps 1 and 11)                      | the completion mark read from the catalog                                           |
| `e2e/menu.spec.ts`                                        | the Home's new entry, layout checks                                                 |
| `docs/data-model.md` (§ subjects and topics), `README.md` | where the catalog now is                                                            |

Not touched: physics, stations, experiments, content data, save, progression, New game/Continue,
the R1–R3.1 motion.

## 7. Regression risks

1. **Losing information in the move**: objectives, places, routes from a new game and from the save,
   completion marks. Mitigation: build the catalog first, prove parity in e2e, then remove the old
   section (plan step 4).
2. **Completion meaning drifts**: the catalog must read `savedCompletedExperiments()` only, and say
   "run completed", not "mastered".
3. **Strings**: `strings.test` fails on Vietnamese keys no longer used and on missing ones.
4. **E2E**: `topics.spec` (5 tests) and `hooke.spec` select `.menu-topics`, `.menu-run`,
   `.menu-experiment`, `.menu-objective`, `.menu-route`, `.menu-saved-route`.
5. **Layout**: a long catalog in the 400 px column at 360 px; the menu scrolls (`overflow-y: auto`),
   checks at 1280, 430, 360 and the 1280×520 short window.
6. **Focus and keys**: focus must move into the catalog and back to the button that opened it; Esc
   must not reach anything else; Tab order stays logical.
7. **R1–R3.1**: the sky and the trail are fixed layers behind the panel; a catalog view in the same
   panel area keeps them as they are; nothing animates in it (reduced motion unaffected).
8. **Budget**: the menu JS is at 920.63 kB of the 1,000,000-byte budget; the view should add a few
   kB at most.
9. **Unrelated, recurring**: the Physics Lab e2e specs fail under load (FPS 10–11) in every full
   run since R2; R4 cannot get a clean full run while that holds (§1). Out of scope here.

## 8. Proposed UX

**Home**: brand and emblem, character choice, New game, Continue, **Experiment catalog** (a
secondary button, the same style as Continue), Settings. The "Experiments by topic" section goes.

**Catalog**: a page in the menu's place of the panel (not a dialog), with the R1–R3.1 sky behind it:

- Header: "Experiment catalog", a "Back" button (also Esc), and the saved game's state in one line
  ("From your saved game: 1 of 4 experiments run to the end" — or "No saved game: nothing run yet").
- Grouped **Subject → Topic → Experiment** as the data has it: subject heading from its laboratory
  (Physics Laboratory), topic headings (Kinematics, Dynamics, Oscillations and waves). Chemistry and
  biology appear only as "Chemistry Laboratory — no experiments yet" if wanted (question 1), never
  with invented topics.
- One compact row per experiment, easy to scan: name; a quiet mark — "Run completed" (accent) or
  "Not yet run to the end" (dim); where it is played (Physics Laboratory · Projectile range); the
  learning objective (one paragraph).
- Each row opens (native `<details>`) to show: **How to run** (the procedure steps, numbered),
  **Getting there** (route from a new game; from the saved game when there is one), and optionally
  **About the model** (`note`, long — question 3).
- No Play button: the game cannot start at an experiment; the row says where it is and how to get
  there, and New game / Continue start the game. An experiment without a station says "no station
  yet" (none today).
- Keyboard: Tab through Back and the rows, Enter/Space opens a row, Esc returns to the Home, focus
  returns to the Catalog button. Responsive in the existing 400 px column; no overflow at 360 px.

## 9. Implementation plan (small steps, each checked)

1. **Model**: a pure `subjectCatalog(content)` in `catalog.ts` grouping `topicCatalog` by subject
   (with its laboratory), plus unit tests. No UI change.
2. **View**: `ExperimentCatalog` and the Home's Catalog button, open/close, Back and Esc, focus;
   rows with name, mark, place, objective; strings EN/VI. The old section still there — the two can
   be compared.
3. **Details**: procedure steps, routes (new game and saved game), optional model note; parity
   e2e against the old section.
4. **Remove** the old section, its CSS and strings; move `topics.spec` and `hooke.spec` to the
   catalog; docs.
5. **Validate**: check, build, menu/catalog/settings e2e, full e2e (with the load failures
   classified), 1280/430/360 px, reduced motion, one canvas, no new rAF.

## 10. Tests to add or update

- Unit: `subjectCatalog` (every experiment of every topic once, under its subject; laboratories
  without experiments; nothing invented).
- E2E (new or rewritten `topics.spec` → catalog): the Home has no "Experiments by topic" and has the
  Catalog button; the catalog opens and closes (Back, Esc), focus returns; topics and experiments
  in content order, EN and VI; objectives and procedure steps match the content; places and routes
  as today (new game; saved game; already there); completion marks follow the save
  (`completedExperiments` with repeats and a gone id, as today); no Play button; no overflow at
  1280/430/360 and 1280×520; reduced motion; one canvas; no console error.
- `hooke.spec`: its completion mark read in the catalog after a run to rest.
- Unchanged and still required: `Game.test` (time limit, New game, saved progress), `HookeStation`
  (STOP), station tests (natural end), `settings.spec`, `menu.spec`, `persistence` tests.

## 11. Open questions

1. Show the planned laboratories (chemistry, biology) in the catalog as "no experiments yet", or
   leave them out? (Recommended: show them — the data and the world already say so.)
2. Catalog as a page replacing the Home panel (recommended), or a modal dialog over it?
3. Include each experiment's model note ("About the model", up to ~1200 characters for Hooke's
   law), collapsed? (Recommended: yes, collapsed.)
