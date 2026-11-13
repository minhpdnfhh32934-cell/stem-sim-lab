# Phase 1 report — Game Core & Foundation

Date: 2026-10-20 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D`

## 1. Repository audit

`Desktop\SimLab 3D` did not exist; the project was created from scratch. Inputs: the roadmap
`Desktop\SimLab3D.txt` and the Phase 1 brief. Machine: Windows 11, Node 24.21, npm 11.19, Git,
Rust 1.99 (no MSVC build tools), Microsoft Edge, Playwright browsers; **no game engine
installed**. The engine was chosen with the owner: TypeScript + Three.js.

## 2. Architecture before

None (greenfield).

## 3. Architecture after

Layered, headless-testable game core with a browser platform layer — see
[architecture.md](architecture.md). Boundaries are enforced by ESLint; systems are built in one
composition root with explicit dependencies and communicate through a typed event catalogue.

## 4. Systems implemented

| Area           | Implemented                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bootstrap      | Staged boot pipeline with `BootError(stage)`, error screen, ordered init / reverse dispose                                                         |
| Game state     | `session`, `player`, `world`, `progression` sections; phases booting/loading/menu/playing                                                          |
| Events         | Typed `EventBus` (copy-on-write, dispatch-safe unsubscribe, error isolation), `Disposables`, 19 events                                             |
| Config/logging | Zod config with defaults (game, player, graphics, input bindings, debug); leveled channel logger                                                   |
| Player         | Identity (character), transform, look, walk/run, wall sliding, room tracking, device-independent input                                             |
| Character      | Data model (id, gender, appearance, outfit, metadata), 2 characters, eye height from body height                                                   |
| Interaction    | Look-at targeting (ray vs rotated boxes), actions, behaviour registry: inspect, toggle, openable, travel, experiment-station                       |
| Items          | Data model with physical properties and behaviours; 10 test items                                                                                  |
| World          | Rooms, laboratories, scenes as data; `World` entities with spawn/despawn events; `EntityStates`; `SceneManager`                                    |
| Experiments    | Definition schema, `SimulationModel` interface, `ExperimentRuntime` (fixed step, samples, results, lifecycle), `ExperimentSystem`, free-fall model |
| Persistence    | Versioned save schema, migration runner, backup slot, localStorage/memory storage, autosave, Continue                                              |
| Platform       | three.js renderer (grey-box rooms, primitives, state visuals, focus highlight), browser input, HUD, main menu                                      |
| Dev tools      | Debug panel (F3, dev only) with state, FPS, counts, systems, experiment, scene jump                                                                |

## 5. Files added

Everything in the repository (76 tracked files, incl. `package-lock.json`): tooling (`package.json`, `tsconfig.json`,
`vite.config.ts`, `eslint.config.js`, `playwright.config.ts`, Prettier, `.gitattributes`),
`src/core/*`, `src/gameplay/**`, `src/world/*`, `src/simulation/**`, `src/persistence/*`,
`src/game/*`, `src/content/*`, `src/platform/**`, `src/main.ts`, `index.html`, `e2e/game.spec.ts`,
`README.md`, `CLAUDE.md`, `docs/*.md`.

## 6. Files modified

None outside the new project. (`Desktop\CircuitMind` and other projects were not touched.)

## 7. Tests

| Command            | Result                                                              |
| ------------------ | ------------------------------------------------------------------- |
| `npm run check`    | **PASS** — typecheck, ESLint, Prettier, Vitest **72/72** in 8 files |
| `npm run test:e2e` | **PASS** — 2/2 in headless Microsoft Edge (SwiftShader WebGL)       |

Coverage by area: core (event bus incl. dangling-listener and re-entrancy cases, system runner
order/failure isolation, logger, config, registry, ray–box), content (shipped content valid,
schema paths, all cross-reference errors), boot (stages, failures, platform order, dispose
releases listeners), player (speed, direction, walls, look clamp, room events), interaction
(focus/reach, small-on-large targeting, perform/next action, unavailable/unknown actions,
despawn while focused, non-entity targets, throwing action), experiments (analytic free fall to
1e-12, frame-stepped = instant, sampling, max between samples, time limit, lifecycle, bad
parameters, model mismatch, NaN/throw/stall ⇒ failed), persistence (round trip, copy not
reference, backup fallback, damaged save never replaces good backup, storage errors, migration
chain/gaps/newer versions, schema errors).

Mutation check: deliberately breaking the event-bus dangling-listener guard and the free-fall
contact solver made 5 tests fail; restored code passes.

## 8. Build verification

`npm run build` — **PASS** (`tsc --noEmit` + Vite). Output `dist/` ≈ 676 kB JS (176 kB gzip),
one chunk; Vite warns that the chunk exceeds 500 kB (three.js). `npm install`: 0 vulnerabilities.

## 9. Runtime verification

Real app in Edge via Playwright (`e2e/game.spec.ts`), with screenshots reviewed:

- boots to the main menu with no console errors; all 10 systems active;
- New game (female) → Preparation Room, HUD room toast, 6 entities/interactables;
- walking with W focuses the door; prompt "E Go to SIMLAB Hub"; E travels to the hub (4 doors);
- debug scene jump to the Physics Laboratory; live listener count stays 21 across scene changes;
- reload → Continue restores scene and character from localStorage;
- walk + mouse look to the experiment console, E runs free fall: HUD shows
  "Fall time: 0.553 s · Impact velocity: −5.425 m/s" (analytic √(2·1.5/9.81) = 0.5530 s),
  progression records `free-fall`.

The in-app browser pane was also used for a manual boot check (menu, new game, state in the
debug panel); with the pane hidden the browser throttles frames, so gameplay checks used
Playwright.

## 10. Git status

Commits on `main` (not pushed; no remote configured):

```
Scaffold SimLab 3D: Vite, strict TypeScript, ESLint layer boundaries, Vitest, Playwright
Core: typed event bus, system runner, logger, config, registry, math
Game foundation: data-driven content, scenes, player, interaction, experiments, saves
Browser platform: three.js renderer, input, HUD, main menu, debug panel, E2E
Docs, CLAUDE.md, Phase 1 report; enforce LF line endings
```

## 11. Known limitations

| Not implemented                                | Reason                                          | Impact                                                 | Follow-up                              |
| ---------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Rigid-body physics / collisions with furniture | Phase 3 scope                                   | Player walks through furniture; only room bounds block | Rapier integration (next task)         |
| Pick up / drop / throw / configure             | Phase 3 scope                                   | Items can be inspected/toggled/opened only             | New behaviours + hand/inventory system |
| Visible character body, animation, outfits     | Phase 2/14 scope                                | Character data affects eye height only                 | Character models + animation           |
| Audio system and audio settings                | Phase 15 scope                                  | Silent game                                            | Add with `AudioSystem`                 |
| Settings screen / persisted settings           | Not needed yet                                  | Config changeable in code only                         | Settings UI + settings store           |
| Localisation (Vietnamese UI)                   | Not in brief                                    | UI strings are English                                 | i18n keys in content and UI            |
| Desktop packaging                              | Not in brief; Tauri cannot build here (no MSVC) | Browser only                                           | Electron shell + file `SaveStorage`    |
| Chemistry/biology experiments, NPCs, time, AI  | Out of Phase 1 scope by the brief               | —                                                      | Later phases                           |

## 12. Technical debt (marked `shortcut:` in code where applicable)

- Interaction focus scans all interactables linearly — fine for hundreds; add a per-room spatial
  index at thousands.
- Walkability is "inside the union of room rectangles"; replace with the physics character
  controller.
- One JSON file per content type; switch to a folder per type (`import.meta.glob`) when large.
- Renderer draws each room as a closed box (no doorways); placeholder primitives and flat light.
- Single 676 kB bundle; code-split three.js / lazy-load labs later.
- E2E assertions read the dev-only debug panel; a production smoke test would need another probe.

## 13. Recommended Phase 2

Follow the roadmap's build order (Foundation → Game core → **Interaction & physics** → World →
Preparation/Cleanroom → …): integrate physics and real object handling so the vertical slice
("take equipment, place it, assemble, run") becomes possible.

## 14. Exact next task

Integrate **Rapier 3D** behind a headless physics module: static colliders for room bounds and
non-movable items (from room/item data), a kinematic character controller replacing
`World.isWalkable`, and dynamic bodies for `physical.movable` items using `massKg`, `friction`
and `restitution`. Done when: the player is blocked by the lab bench, a steel ball placed above
the bench falls and comes to rest on it, physics runs on a fixed step independent of frame rate,
and unit + E2E tests cover both.
