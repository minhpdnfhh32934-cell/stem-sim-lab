# Phase P1 report — pause, Settings from anywhere, back to the main menu

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase p1.

## 1. Baseline and Git

HEAD `5270a5d` (the e2e harness fix after R4), clean tree. `npm run check` PASS 417/417;
`npm run build` PASS (JS 924.31 kB, CSS 16.85 kB); targeted e2e PASS — menu, settings, topics,
history, world 16/16, timed 4/4, production 1/1. The last two full runs on this commit passed
36/36 each (`docs/phase-e2e-load-investigation-report.md`).

## 2. Audit findings that shaped the design

- One frame loop (`main.ts`, rAF) → `Game.update(dt)` → `SystemRunner` over all systems. The
  world systems gate on `phase === 'playing'`; `ExperimentSystem.update` is not gated, so runs
  advanced in any phase.
- The main menu scene loads once at boot; nothing returned to it. Loading it from a world goes
  through the same `SceneManager.load` as everything else: it unloads the world (physics, renderer,
  stations and experiment views all react to `SceneUnloaded` / `SceneLoading`), sets phase `menu`
  and publishes `SceneLoaded` — which shows the menu and re-reads the save.
- Saving: `Game.save()` writes only while playing — automatically on every world `SceneLoaded` and
  on `pagehide`; nothing saves when an experiment completes. A save keeps the scene, the player's
  pose, worn equipment, entity states (station dials), completed experiments and procedure
  progress. Runs and their history are never saved (documented: "The last 20 runs of this station
  are kept while you play; they are not saved"). `SAVE_VERSION` 2.
- Settings: only the interface language, a `<details>` in the main menu; the preference is the
  browser's (`simlab.settings.language`), not the save's.
- Input: Esc was no game key; the browser releases the pointer on Esc (headless Edge does not, for
  automated keys); the e2e helper `Aim.to` frees the mouse and clicks the view before every turn.

## 3. UX and state model

No new phase and no navigation framework: `session.paused` (runtime only) on top of the existing
phase, and one view per overlay.

| State            | How you get there                                                            | Esc                       |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------- |
| Home             | boot; Back to the main menu                                                  | — (or closes the catalog) |
| Home Settings    | the Settings disclosure in the Home (unchanged)                              | —                         |
| Catalog          | its button on the Home (R4)                                                  | back to the Home          |
| Playing          | New game, Continue; Resume; a click on the scene                             | pause                     |
| Paused           | Esc, or the mouse freed from the scene while playing (not with results open) | resume                    |
| Paused Settings  | Settings in the pause menu                                                   | back to the pause menu    |
| Leave? (confirm) | Back to the main menu when runs would be lost, or when the save failed       | back to the pause menu    |

- **Pause menu** (`PauseMenu.ts`): a panel at the side over the dimmed scene — Paused, a line
  saying the simulation stands still, **Resume**, **Settings**, **Back to the main menu**. The dim
  takes no clicks: a click on the scene resumes and captures the mouse, as clicking the view always
  did. The developer panel stays above it.
- **Triggers:** Esc while playing; or the pointer released while playing — the browser spends the
  Esc on releasing a captured pointer, so this is what a player's Esc looks like; also another
  window taking it. Not while the results panel is open: freeing the mouse there is for its run
  list (unchanged).
- **Settings everywhere, one implementation:** `SettingsPanel` (`settings.ts`) is one element; the
  Home mounts it in its disclosure, the pause menu moves it into its Settings view, and the Home
  takes it back whenever it shows. One radio group, one state — two copies would have shared the
  radio name and fought. Closing Settings from the pause menu (Back, Esc) returns to the pause menu
  and never resumes; from the Home it is the Home's disclosure, as before.
- **Focus:** opening the pause menu focuses Resume; Settings focuses its first option; back on the
  menu the focus returns to the button that left it (Settings, or Back to the main menu after
  Cancel); resuming blurs the panel. Native buttons and radios: Tab, Enter, Space.

## 4. Pause semantics

- `Game.pause()` (only while playing, once) sets `session.paused`, drops held keys and publishes
  `PauseChanged`. `Game.update` then passes **dt 0** to every system: physics takes no step (its
  accumulator gets nothing), experiment runs take no step and emit nothing, procedure timers and
  movement stand still. While paused `BrowserInput` passes no game key or mouse button (F3 still
  toggles the developer panel), and `lockPointer` refuses.
- `Game.resume()` clears it; the next frame runs with its own dt (≤ 0.1 s, the existing cap): no
  catch-up, no jump. Any scene load (a door, back to the menu, the developer jump) resumes.
- Rendering goes on (the scene stays drawn behind the menu); no second loop, no new
  `requestAnimationFrame` (only `src/main.ts:59, 61`), no canvas added.
- Completion semantics unchanged: `ProgressionSystem` and `ExperimentSystem.report` are untouched;
  a paused run cannot end, so nothing completes while paused; after Resume it can still end by
  itself and is recorded only with `endReason 'model'` (unit-tested).
- The developer panel now refreshes on real time instead of game time, so it keeps reporting while
  paused. Side finding: its FPS was computed from capped dt, so below 10 real FPS it showed **10**;
  the "FPS 10–11" in earlier failure logs (load investigation) were partly this floor — the
  2-minute probe there measured ~7 real FPS. It now shows the real rate.

## 5. Save safety

- **Back to the main menu** (`Game.backToMenu`): saves first (`Game.save()`, still playing), then
  forgets the runs (`experiments.clear()`, `stations.clear()` — the same as New game and Continue
  do) and loads the menu. Continue afterwards restores exactly that save.
- **Asks first** when something would be lost: if the session has runs (`ExperimentSystem.runCount`:
  running plus recorded), the confirmation says that the place, station settings and completed
  experiments are saved and that its N run(s) are not — "Save and go to the main menu" or Cancel.
  With no runs it leaves at once (nothing is lost).
- **If saving fails** (storage blocked or full), nothing is left: the confirmation shows the error
  and offers "Leave without saving" explicitly; Cancel stays in the game.
- No save change: `SAVE_VERSION` 2, no migration; `paused` is runtime state and never written.
  Not claimed: an autosave on completion — there is none; a completion is saved by the next scene
  change, Back to the main menu, or leaving the page, as before.

## 6. Files changed

| File                                                                                            | Change                                                                 |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/game/GameState.ts`, `GameEvents.ts`                                                        | `session.paused`; `PauseChanged`                                       |
| `src/game/Game.ts`                                                                              | `pause`, `resume`, `backToMenu`; dt 0 while paused; scene loads resume |
| `src/simulation/ExperimentSystem.ts`                                                            | `runCount` (runs no save keeps)                                        |
| `src/platform/ui/PauseMenu.ts` (new)                                                            | the pause menu, its triggers, views and focus                          |
| `src/platform/ui/settings.ts` (new)                                                             | `SettingsPanel` (shared), `radio` (moved from `MainMenu`)              |
| `src/platform/ui/MainMenu.ts`                                                                   | mounts the shared settings; its own language block removed             |
| `src/platform/BrowserInput.ts`                                                                  | no game input while paused; a click on the scene resumes               |
| `src/platform/ui/Hud.ts`                                                                        | `resultsShown`; hint "Esc pause"                                       |
| `src/platform/ui/DebugPanel.ts`                                                                 | `· paused` on the phase line; refresh and FPS on real time             |
| `src/main.ts`                                                                                   | the settings and pause menu systems                                    |
| `src/platform/ui/styles.css`, `src/content/strings.json`                                        | pause styles; 11 Vietnamese strings, the hint                          |
| `src/game/pause.test.ts` (new); `Game.test.ts`, `physicsLoading.test.ts`, `persistence.test.ts` | pause tests; `paused: false` in session fixtures                       |
| `e2e/pause.spec.ts` (new); `history.spec.ts`, `world.spec.ts`                                   | §7                                                                     |
| `docs/interaction.md`, `architecture.md`, `development-guide.md`, `README.md`, this report      | documentation                                                          |

## 7. Tests

- **Unit** (`src/game/pause.test.ts`, 6): physics frozen — the falling steel ball stays put, 0 steps
  — and falls after Resume; a running Hooke's law run frozen for 60 s of frames (clock and state
  unchanged, no `ExperimentCompleted`, nothing in `completedExperiments`), then one frame advances it
  by one frame (within one 1 ms model step), and it ends by itself recorded as `'model'`; held keys
  dropped and no movement while paused; pause only while playing, once, and a scene load resumes;
  Back to the main menu saves, forgets the runs, and Continue restores place and progress; a failed
  save keeps the player in the game unless forced.
- **E2E** (`e2e/pause.spec.ts`, new): Continue at the spring desk, RUN; Esc → paused (developer
  panel `playing · paused`), the pause menu, focus on Resume, mouse free, one canvas; the run's clock
  identical across 60 frames; Settings → the shared settings (one element), focus in them, Vietnamese
  applies at once; Esc → back to the pause menu (not the game), focus on Settings; Back by button;
  Esc → resumed, the run goes on from where it stood (< 5 s later, no catch-up); Back to the main
  menu → the confirmation naming 1 run, Cancel (focus back), then leave; the Home with the settings
  back in its disclosure, the catalog working, one canvas; Continue → the saved place, the station
  configured, no run, not paused; no console error. Frames are counted (`afterFrame`), not waited for.
- **Updated:** `history.spec` — Esc now opens the pause menu (state asserted), a click on the view
  resumes and recaptures; `world.spec` — it freed the mouse before walking, which now pauses; it
  now walks captured and frees the mouse only for the developer panel's scene jumps (a scene load
  resumes). No timeout or retry changed.

| Command                                                                | Result                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------- |
| `npm run check`                                                        | **PASS**: 423/423, 37 files                    |
| `npm run build`                                                        | **PASS**                                       |
| `npx playwright test pause.spec world.spec history.spec --project=dev` | **PASS** 8/8                                   |
| `npm run test:e2e`                                                     | **PASS**: 37/37, first run, no retry (7.7 min) |
| `git diff --check`                                                     | clean                                          |

During development, `world.spec` failed twice for reasons the change caused and the test then
reflected (walking while the mouse was free, now a pause; clicking the developer panel with the
pointer captured), and `pause.spec` once because the developer panel froze on game time (fixed in
the panel, §4).

## 8. Bundle size

| Asset    | Before    | After     | Delta    |
| -------- | --------- | --------- | -------- |
| JS entry | 924.31 kB | 930.86 kB | +6.55 kB |
| CSS      | 16.85 kB  | 17.45 kB  | +0.60 kB |

`production.spec`'s 1,000,000-byte menu budget passes.

## 9. Limitations

- Headless Edge with SwiftShader only; not seen live, no hardware GPU.
- A real browser's Esc with the pointer captured was not exercised (headless Edge keeps the pointer
  for automated keys); it is covered by the pointer-release trigger, which the tests do exercise
  (`document.exitPointerLock()`), but the real key path is unverified.
- Pointer lock after Resume needs a user gesture: the Resume button and a click on the scene give
  one; Esc does not, so Esc resumes with the mouse free and the HUD's "click to look around".
- Toasts and the results panel's live refresh also stand still while paused (all systems get dt 0).
- Settings hold only the language; nothing else was added.
- The menu can now be reached again in a session; the R1–R3.1 effects and the catalog are shown
  again by the existing `SceneLoaded` handling (e2e: the catalog opens after Back to the main menu).

## 10. Git

Committed as phase p1; not pushed.
