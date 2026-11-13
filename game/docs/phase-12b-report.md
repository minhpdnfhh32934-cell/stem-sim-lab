# Phase 12B report — the way from the saved game

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

## 1. Starting state

HEAD `32bb456`, one worktree, no remote, nothing staged, no stash. 11 tracked files modified and 8
untracked: the Nhặt / Thả labels and Phases 8–11 (Phase 10 is a report). The tracked diff was
byte-identical to the Phase 12A audit. Everything was kept as it was, except the lines listed in
section 4.

## 2. Baseline (before any change)

| Check              | Result                                 | Duration |
| ------------------ | -------------------------------------- | -------- |
| `npm run check`    | **PASS**: 344/344 unit tests, 31 files | 20 s     |
| `npm run build`    | **PASS**                               | 5 s      |
| `npm run test:e2e` | **PASS**: 27/27, first run             | 373 s    |

The checks ran one after another, with nothing else of ours running. Chrome, ChatGPT, Claude,
Armoury Crate, Zalo and VS Code were open; CPU load was 31 % before the e2e run. The three e2e
failures seen once during Phase 12A did not occur.

## 3. Change

- **`Game.savedScene()`** (`src/game/Game.ts`) returns the world scene Continue would load, or
  null.
  - `continueGame()` and `savedScene()` share one private `readSave()`. It reads the save slot
    with `SaveSystem.load`, which falls back to the backup when the save is damaged, as before.
    It then applies the existing check: the character exists and the scene is a world scene.
  - So `savedScene()` names a scene exactly when Continue would accept the save, and that scene
    is where Continue puts the player.
  - It only reads: no state, events, saves or scene loads. It never looks at the scene being
    played.
  - Continue behaves as before: same order, same reasons, same `GameLoaded`.
- **Main menu** (`src/platform/ui/MainMenu.ts`): each "Getting to …" line stays as it was. Under
  it, a second line starts from the saved game:
  - With a route: "From your saved game: SIMLAB Hub → Physics Laboratory" / "Từ bản lưu: Sảnh
    SIMLAB → Phòng thí nghiệm Vật lý", from `routeBetween(content, savedScene, scene)`.
  - When the save is already in that scene: "From your saved game: you are already in Physics
    Laboratory" / "Từ bản lưu: bạn đang ở Phòng thí nghiệm Vật lý".
  - When no door leads there: the existing `menu.noRoute` text takes the place of the steps.
  - When Continue would not accept the save: no line.

  The line is read again each time the menu shows (`refresh`), together with the Continue button.
  Names come from the content; two keys were added (`menu.savedRoute`, `menu.savedHere`). The
  lines wrap in a narrow window (checked at 360 px).

- **Not done, on purpose:**
  - in-game directions, waypoints, a minimap, teleporting, new key bindings;
  - any change to the route graph (`routeBetween`), the save format and `SAVE_VERSION`,
    `StationSystem`, or rendering.

## 4. Files

| File                          | Phase 12B change                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/game/Game.ts`            | `savedScene()`, and `readSave()` shared with `continueGame()` (no earlier phase changed this file)         |
| `src/game/Game.test.ts`       | 9 tests (`Game saved scene`)                                                                               |
| `src/platform/ui/MainMenu.ts` | 2 fields, the saved line in `topics()`, 3 lines in `refresh()`, and one Phase 11 doc-comment line extended |
| `src/content/strings.json`    | `menu.savedRoute`, `menu.savedHere`, after `menu.noRoute`                                                  |
| `src/platform/ui/styles.css`  | `.menu-saved-route` joins the Phase 11 `.menu-route` rule                                                  |
| `e2e/topics.spec.ts`          | one test, appended                                                                                         |
| `docs/data-model.md`          | one paragraph                                                                                              |
| `README.md`                   | status line, one sentence, report link                                                                     |
| `docs/phase-12b-report.md`    | this report                                                                                                |

The other files in the working tree are byte-identical to the start of this phase (checked with
SHA-256). That includes `"action.grab": "Nhặt"` and `"hud.drop": "Thả"`.

## 5. Tests

- **Unit (9 new, `src/game/Game.test.ts`).** The cases:
  - no save;
  - a save in the hub;
  - a save in the Physics Lab;
  - a damaged save with a good backup (the backup's scene is expected);
  - a damaged save and a damaged backup;
  - a save naming a character or a scene that no longer exists;
  - a save naming a menu scene.

  For each case, `savedScene()` gives the scene or null and leaves state, saves and events
  untouched. `continueGame()` then succeeds exactly when `savedScene()` gave a scene, and puts the
  player in that scene. One more test checks that during play the result follows the save, not the
  scene being played.

- **E2E (1 new, `e2e/topics.spec.ts`).**
  - No save: only the new-game route.
  - A save in the hub: both routes. The saved one has no cleanroom entry. Checked in English and
    Vietnamese, and wrapping at 360 px.
  - A save in the lab: "already in", in both languages.
  - A save whose scene is gone: Continue is offered, and no saved route is shown.
- No existing assertion was changed.

## 6. Verification

| Check                     | Result                                                      | Duration |
| ------------------------- | ----------------------------------------------------------- | -------- |
| `npm run check`           | **PASS**: 353/353 unit tests (344 + 9), 31 files            | 17 s     |
| `npm run build`           | **PASS**                                                    | 4 s      |
| `npm run test:e2e`        | **PASS**: 28/28 (27 + 1), first run, no retry               | 361 s    |
| `npm run bench`           | **NOT RUN**: nothing in rendering or the frame loop changed | —        |
| bench `gpu`, `gpu-native` | **NOT RUN**: visible windows                                | —        |

## 7. Limitations

- The menu shows only before play (and after the developer scene jump). No route is shown during
  play.
- A route names scenes and the gate on the way, not what is left to do. From a save in the
  Preparation Room it names Cleanroom entry even if every step is done (see the Phase 12A audit).
- Turning route steps into names is written twice in `topics()`: once for the new-game line and
  once for the saved line, three lines each. This leaves the Phase 11 code untouched; merge the two
  when these phases are committed.
- If the save is damaged and the backup is good, the usual backup warning is logged each time the
  menu shows, not only on Continue.

## 8. Next step

Commit Phases 8–12B in logical commits when asked. In-game directions need a way to choose a
destination during play first (see the Phase 12A audit).
