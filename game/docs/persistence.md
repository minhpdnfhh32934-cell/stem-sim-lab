# Persistence

## What is saved — `src/persistence/saveData.ts`

```
SaveData (version 5)
├── version       5
├── savedAt       ISO timestamp
├── player        characterId, sceneId, position [x,y,z] m, yaw, pitch,
│                 equipment[]  (worn item ids, v2),
│                 inventory { stacks [{ slot 0–26, item, placements[] }], selected 0–8 }  (v3)
├── world         entityStates { "<room>/<placement>": { open: true, running: false, taken: true, … } },
│                 containers { "<room>/<placement>": { contents { materialId: µL (int) },
│                              temperatureC, closed, mixed } }  (v4),
│                 objects { "<room>/<placement>": { position [x,y,z], rotation [x,y,z,w] } }  (v4)
└── progression   completedExperiments[],
                  procedures { "<id>": { completed: stepId[], entered } }  (v2),
                  tasks { active: { id, step } | null, done: taskId[] }  (v5)
```

Entity states cover everything a procedure leaves in the world (wardrobe `open`, faucet
`running`, a garment `taken` from its spot), so Continue restores a half-done cleanroom entry
exactly: worn equipment, completed steps and the objects' states. A running timed step is not
saved (it restarts).

**Phase WX: version 3.** `player.inventory` holds the carried items:

- one stack per slot (0–8 are the hotbar, 9–26 the bag);
- each stack names its item and the entity ids (`<room>/<placement>`) of the instances it holds;
- `selected` is the hotbar slot.

The migration from version 2 adds an empty inventory; a version 1 save goes through version 2 first.
Tests cover v2 → v3, v1 → v3 and the round trip.

**Physical lab: version 4** (`docs/physical-lab-architecture.md` §2.15). Two typed maps, keyed by
entity id:

- `world.containers`: what each physical-lab container holds, as **whole µL per material id**
  (`simulation/liquid.ts`), its temperature, its stopper (`closed`) and `mixed`. Never a
  concentration or any model value: a material's meaning is its experiment's, read only where a
  run's inputs are built. `StationSystem` is the only writer; a container's state is made from its
  placement (`material`, `fill`: an AFFORDANCE bookkeeping volume) the first time its station
  attaches.
- `world.objects`: where moved containers stand, **containers only** (items with `container` and a
  dynamic body; physics-lab balls and every other object still spawn at their placements). A pose
  is in its own scene's coordinates, captured from `entity.pose` when a save is made (the held
  object excepted: holding never crosses saves) and when its scene goes, and applied whenever the
  entity spawns (a Continue, a scene attached again) — `persistence/containerSave.ts`, the first
  system, so physics makes the body where it was left.

**Phase A: version 5.** `progression.tasks` is the guided task followed and its step index, and the
tasks finished (`gameplay/task/TaskSystem.ts`). The step index is checked against the content only
once the lab pack is in: a task or step it does not know is dropped then, with a warning. The
migration from version 4 adds `{ active: null, done: [] }`. Tests: v4 → v5, every older version
through it, malformed task progress rejected (`persistence.test.ts`); a task saved mid-way
(`game/dilutionSlice.test.ts`).

The migration from version 3 adds empty `containers` and `objects`: every container starts from
its placement. Tests: v3 → v4, v1 → v4 through every step, the round trip, and contents that are
not whole µL or poses that are not a vector and a quaternion rejected (`persistence.test.ts`); a
mid-fill and a completed save continued, a scene re-attached, a tampered save sanitized
(`gameplay/lab/physicalLab.test.ts`).

Not saved: the run (runs are never saved; a half-filled flask after Continue refuses more water
with "What is in it was not added in a run: clear the bench to start again.", and "Clear the bench"
— the `clear` command — restocks the station's containers and returns them to their placements;
RESET keeps its meaning), the held object and its tilt, the active pour and its carry.

Continue runs `ContainerSave.sanitize()` beside the inventory's, before the scene spawns, warning
once per problem: a pose of no carried container, outside its room or without a unit quaternion is
dropped (it spawns at its placement); contents of no station's container, holding a material its
experiment does not list, or more than its brim are dropped (its station fills it again from its
placement). A pose inside a solid is **not** checked yet (only the room's box is).

Continue runs `InventorySystem.sanitize()` after the save is applied and before the scene spawns.
It warns once per problem and never fails the load:

- a stack of an unknown or non-carriable item is dropped;
- an instance that is not a placement of its item, already carried, or beyond the stack size is
  dropped;
- a stack on a slot outside 0–26 or already taken moves to the lowest free slot.

A carried instance is not spawned by its scene, so nothing exists twice.

Door states (open, closing) and which scenes are resident are never saved. The save after a door
closes, or after walking into another scene, records only the scene the player is in. Continue
also checks the saved pose (`continuePose`, phase WX): a position that now lies in a solid, a wall,
a closed leaf or a doorway, or outside every room, moves to the nearest door's arrival point, else
to the scene spawn, with a warning. The yaw is kept only when the pose is kept.

Phase 6A changes no format (still version 2). A door's arrival point is not stored — the saved
position is simply where the player stands, and Continue restores it. Leaving the preparation area
through an exit stores the procedure as `{ completed: [], entered: false }`. Loaded progress is
used as a strict prefix of the procedure's steps, so step ids saved out of order or unknown to the
current content can neither skip a step nor open the entrance (tested with an edited save).

Phase 6B changes no format either. A station's configuration lives in its apparatus's entity
states — `param.velocity`, `param.angle`, `param.gravity` (numbers) and `loaded` (the entity id
of the loaded ball, or "") — so Continue restores the dials and puts a loaded ball back into the
launcher. `state` (idle, configured, …) is mirrored for display only and recomputed on load.
Phase 6C.2 adds no format either: the pendulum stand keeps `param.length`, `param.angle` and
`param.gravity` the same way (a save from 6C.1 simply has none, and the dials start at their
defaults).
Experiment runs (samples, results), the run history (Phase 6C.3) and the checklist are **not**
in the save: a run is deterministic, so the same configuration reproduces it exactly, and the history
of up to 20 runs per station would bloat every autosave. Measured in Phase P2 (JSON of a
recorded run): free fall ~4 KiB, projectile ~13 KiB, pendulum ~106 KiB (467 KiB for 3 m on the
Moon), Hooke's law ~111 KiB (288 KiB for a slow spring) — 2 to 9 MiB for one station's 20 runs,
written twice (primary and backup) into a localStorage of about 5 M characters per origin: a save
holding them would fail on quota, and with it the progression it carries. Since Phase P2b the
ended runs are kept in their own store, the run history (IndexedDB, below), never in the save.
Phase 6C.3 changes no format (a test checks that no run data reaches the save). Values outside a parameter's range in a save
are ignored (the default is used). Phase 6C.4 adds no format either: each station's instrument
resolution is one more setting, `param.resolution`; a save without it (from before 6C.4) gets
the default 0.01, and 0, negative, too large or non-number values are ignored the same way
(tested in `StationHistory.test.ts`).

Only plain, validated data — never runtime objects — so refactoring code does not break saves.
Session data (phase, loading state) and derived values (room id, eye height) are not saved.
Settings are deliberately **not** part of a save slot: they are per installation, not per
playthrough, and will get their own store with the settings screen. NPC/time/health sections are
added when those systems exist.

## When it saves — `src/game/Game.ts`

- Automatically after every world scene load (new game, continue, the developer jump), after
  walking into another scene (`SceneEntered`) and after a door closes behind the player
  (`DoorChanged` closed; phase WX).
- When an experiment is completed for the first time in the playthrough — a run of it ended by
  itself (`endReason` 'model'): `ProgressionSystem` publishes `ProgressionRecorded` and the game
  saves (Phase P2). A stopped run, a run cut off by the time limit, or one left running never
  counts, so never triggers it.
- On Back to the main menu (`Game.backToMenu`, Phase P1), before leaving.
- When the page is hidden/closed (`pagehide` in `main.ts`).
- Never outside of play (`Game.save()` returns `null` in the menu).

A save that cannot be written (storage full or blocked) publishes `SaveFailed` with the reason;
the HUD shows it as an error. Nothing is lost from memory: the next save point writes it. The
failure is never reported as a success.

Slot: `config.game.saveSlot` (`slot-1`). Continue restores the character, scene, exact position
and view, worn equipment, entity states and progression (experiments and procedures).

## Run history — `src/persistence/runHistory.ts`, `src/platform/runHistoryDb.ts` (Phase P2b)

```
Progression save   localStorage  simlab.save.slot-1 (+ .backup)   SAVE_VERSION 3
Run history        IndexedDB     simlab.history → store "runs"    RUN_HISTORY_VERSION 1
                                 key runId ("<station>#<n>"), no index
```

- **Separate and independent.** The two versions are unrelated; neither store reads the other. A
  run history failure (no IndexedDB, storage blocked, quota, an upgrade blocked by another tab, a
  failed transaction) never reaches the progression save — tested with a store that rejects, one
  that throws, and one that cannot be read (`src/game/runHistory.test.ts`, `e2e/run-history.spec.ts`).
- **What is stored**: every run that ends and enters a station's history (completed, stopped,
  failed — the RunRecord semantics are unchanged), as plain data (`StoredRun`): ids, station and
  number, the experiment id, status and end reason or error, simulated time, inputs, results, the
  theory value kept at the end, and the valid samples as `Float64Array`s (IndexedDB keeps them as
  they are). No closure, definition object, session or game object.
- **When**: once per ended run, on `RunRecorded` (published by `ExperimentSystem` when a run is
  frozen into a history) — never per frame or sample. `put` replaces by `runId`, so writing the
  same run twice keeps one entry. When a station's 21st run pushes out its oldest, that one is
  deleted from the store too (`RUN_HISTORY_LIMIT`).
- **Not stored**: a run still running when the player goes back to the main menu, starts a new
  game or closes the page — it ends unrecorded, as before.
- **Loading**: once at boot (`Game.loadRunHistory`, before the menu shows). Each value is
  validated (Zod: buffers of `sampleCount` length, results only on completed runs); an invalid
  one, or one whose experiment no longer exists, is skipped and logged. The records go back to
  their stations when the stations are first used; run numbers go on after the highest kept one,
  so an id is never reused. Loading writes nothing back.
- **Lifetime**: the run history belongs to the browser, like the language setting, not to a
  playthrough: New game, Continue and Back to the main menu keep it.
- **On failure** the game publishes `RunHistoryFailed` and the HUD says the run history could not
  be kept: runs stay listed until the page is closed, progress is saved as usual. After a reload
  those runs are gone and nothing pretends otherwise.
- **Upgrades**: a new `RUN_HISTORY_VERSION` upgrades the records in `onupgradeneeded`; the
  database is never deleted to make it fit.

## Storage — `src/persistence/SaveSystem.ts`

`SaveStorage` (`read/write/remove` of text by key) is the only platform dependency:
`localStorage` in the browser (`src/platform/storage.ts`, keys `simlab.save.<slot>`), memory in
tests, files in a future desktop shell. If the browser blocks storage the game falls back to
memory and the main menu says progress will not be saved.

The interface language is stored in the same storage under its own key,
`simlab.settings.language` (`src/persistence/settings.ts`): a preference of the browser, never
part of `SaveData`, so it has no version and no migration (`docs/game-core.md`, Languages). The
frame-rate cap (Phase P3.3) is stored the same way under `simlab.settings.frameCap`: `30`,
`60`, `90`, `120` or `0` (no cap, the default); any other value gives no cap and a warning,
and if the browser cannot store it the choice lasts until the tab closes. The graphics quality
(Phase P3.5) likewise: `simlab.settings.graphicsQuality`, `low`, `medium` (the default) or
`high`; any other value gives medium and a warning.

Safety:

- Before overwriting a slot, the previous save — only if it still parses — is copied to
  `<key>.backup`, so a damaged primary never replaces a good backup.
- Loading a damaged primary falls back to the backup (logged as a warning).
- Storage that throws, bad JSON, a newer version, a missing migration or schema errors all
  return a `Result` error with a clear message; nothing throws into the game.
- `Game.continueGame` also refuses saves whose character or scene no longer exists in content.

## Changing the save format

1. Change `SaveDataSchema` and increment `SAVE_VERSION`.
2. Add a migration from the previous version to `SAVE_MIGRATIONS`:

   ```ts
   { from: 1, migrate: (data) => ({ ...data, time: { day: 1, minutes: 480 } }) }
   ```

   `migrateSave` applies migrations one version at a time and sets `version` itself.

3. Add a test that parses a fixture of the old version and checks the upgraded data.
4. Update `capture()` / `applySave()` for the new fields.

The migration runner is tested with a v1 → v2 → v3 chain, gap detection and newer-version
rejection (`src/persistence/persistence.test.ts`).

Shipped migrations:

| From | To  | Phase | Change                                                                    |
| ---- | --- | ----- | ------------------------------------------------------------------------- |
| 1    | 2   | 5     | adds `player.equipment: []` and `progression.procedures: {}` (a v1 player |
|      |     |       | wore nothing and had started no procedure); everything else is kept       |

Tests: a v1 fixture (Phases 1–4 shape) upgrades to the exact v2 data; malformed v2 equipment or
procedure progress is rejected; the round trip includes both new sections.
