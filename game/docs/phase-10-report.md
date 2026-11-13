# Phase 10 report — experiment discovery and navigation: audit

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Audit only: no
code changed. Not committed.

## 1. Repository state

HEAD `32bb456` (Phase 6G), one worktree, no stash, nothing staged. The working tree is
byte-identical to the end of Phase 9 (its diff compared with a snapshot taken then):

- **Before Phase 8:** `src/content/strings.json` — `action.grab` Nhặt, `hud.drop` Thả.
- **Phase 8:** `src/content/topics.json`, `src/simulation/experiment.ts`, `src/game/content.ts`,
  `src/content/index.ts`, `src/game/content.test.ts`, `docs/phase-8-report.md`, `CLAUDE.md`,
  `docs/architecture.md`, and parts of `README.md` and `docs/data-model.md`.
- **Phase 9:** `src/game/catalog.ts`, `src/game/catalog.test.ts`, `e2e/topics.spec.ts`,
  `src/platform/ui/MainMenu.ts`, `src/platform/ui/styles.css`, three `menu.*` keys in
  `strings.json`, `docs/phase-9-report.md`, and the rest of `README.md` and `docs/data-model.md`.

## 2. Baseline

`npm run check` PASS 340/340 in 31 files (20 s); `npm run build` PASS (4 s);
`npm run test:e2e` PASS 26/26 (357 s), first run.

## 3. Findings

**Experiment → placement.** Topics list experiments (`TopicDefinitionSchema`, checked in
`checkReferences`, `src/game/content.ts`). A station is an apparatus placement whose behaviour —
`launcher`, `pendulum` or `drop-tower` (`src/gameplay/experiment/behaviors.ts`) — takes
`experimentId` and declares it in `references` (kind `experiment`); content validation resolves
every such reference (`content.ts`, the `behavior.references` loop) and each behaviour's `check`
requires the matching geometry on the item. At run time `StationSystem.attach` builds one station
per entity with apparatus geometry and an `experimentId`, keyed by the entity id
`<room>/<placement>` (`entityFromPlacement`, `src/world/World.ts`), one session each — several
stations per experiment are supported. `topicCatalog` (`src/game/catalog.ts`) finds the same
placements by `params.experimentId`; an experiment without one gets no place ("no station yet").

**Placement → room → location.** A placement is nested in exactly one room (`rooms.json`);
its `position` is world coordinates, validated inside the room's bounds and clear of walls and
furniture (`content.ts`). Rooms have stable ids and translated `displayName`s. Each room is in
exactly one world scene today (`scenes.json`), but **nothing enforces it**: `topicCatalog` takes
the first scene that lists the room.

**Moving around.** Inside a scene, rooms join through openings (`leadsInto`,
`src/world/roomGeometry.ts`) that the player walks through. Between scenes, `travel` doors name a
`targetScene` and an `arrival` door (`SceneManager`, `arrivalPose` in `src/world/arrival.ts`). The
door graph, derivable from `rooms.json`:

| From scene         | Door (entity)                   | To                                        |
| ------------------ | ------------------------------- | ----------------------------------------- |
| `preparation-room` | `cleanroom-corridor/door-hub`   | `simlab-hub` — gated by `cleanroom-entry` |
| `preparation-room` | `preparation-room/door-teacher` | `teacher-room` (an exit of the procedure) |
| `simlab-hub`       | `simlab-hub/door-<lab>` (three) | `physics-lab`, `chemistry-lab`, …         |
| `simlab-hub`       | `simlab-hub/door-preparation`   | `preparation-room`                        |
| each lab           | `<lab>/door-hub`                | `simlab-hub`                              |

The gate is `ProcedureSystem.entryBlock` and its interaction guard (`procedures.json`
`entrance`, `exits`). There is no map, minimap, waypoint, marker or compass. The only teleports
are the arrival placement (`PhysicsSystem.applyTeleport`) and the development scene jump
(`DebugPanel`), which bypasses doors and gates and is never evidence of a transition.

**Activation.** `InteractionSystem` focuses the target under the crosshair within
`config.player.reach` (2.2 m) and in physics line of sight; prompts come from its primary and
secondary actions; procedures and stations refuse through guards; controls send
`ExperimentCommand`; the HUD objective shows the procedure, else the room's station checklist
(`StationSystem.activeStation`, by `world.roomAt`). Free fall is reachable in normal play: new
game → cleanroom entry → hub → "Enter Physics Lab" → the tower in the main room.

**Tests.** `preparation.spec` walks the preparation into the hub; the lab specs start through
Continue from a save in the lab; content tests check every door's arrival point; `Game.test`
covers travelling through a door. **No test walks the hub → Physics Lab door.**

**UI.** Phase 9's `<details class="menu-topics">` (`MainMenu.topics`) shows static lines; its
summary is keyboard-focusable; texts re-render on `LanguageChanged`; the menu scrolls in a short
window. From the menu the player is not in the world yet.

## 4. Answers

1. **Experiment → placements:** yes, reliably — validated references, the same `experimentId`
   at run time, several placements allowed.
2. **Placement → room → location:** yes for room and position (validated); room → scene is unique
   today but not enforced.
3. **Smallest useful feature the data supports:** directions — the scene path through `travel`
   doors from the new-game (or current) scene to the station's scene, the gate it passes, then the
   room inside that scene. All from content: door labels and room names are already translated.
4. **Next step:** extend the room/station directory with those directions, still informational.
   Not a "Locate station" action in the menu (the only way it could act there is a teleport, which
   would skip the cleanroom gate and the arrival rules); not a waypoint yet (needs an in-world
   target, a renderer marker and HUD state); not a larger system.
5. **Gaps first:** enforce one world scene per room; one shared definition of "station" (today
   validation uses behaviour `references`, `StationSystem` geometry + `experimentId`, the catalog
   `experimentId`); a test that walks hub → Physics Lab.
6. **Walking and interaction preserved:** directions only tell; doors, guards, reach, bindings and
   the save stay as they are; no teleport.
7. **No placement:** listed as "no station yet", no directions, never presented as playable.
8. **Tests without coordinates:** route unit tests on ids (`preparation-room` → `simlab-hub` via
   `cleanroom-corridor/door-hub`, gated by `cleanroom-entry` → `physics-lab` via
   `simlab-hub/door-physics`; from `teacher-room` through `preparation-room`; same scene → empty;
   a removed door → unreachable); a content invariant that every station's scene is reachable from
   the new-game scene; e2e of the directions in English and Vietnamese; an e2e that walks
   hub → Physics Lab by door labels, asserting the scene and room from the debug panel.

## 5. Recommended next phase and acceptance

**Directions in the catalog.** A pure route function over the content's door graph (BFS,
scene ids), the procedure gates on the way, and the room inside the target scene, shown under
each experiment in the menu. Acceptance: built from content only (no lists in UI code); gated
steps named; unreachable or stationless experiments shown as such; English and Vietnamese;
no change to walking, doors, guards, bindings, save or rendering; check, build and e2e pass.

## 6. Files changed

`docs/phase-10-report.md` only.
