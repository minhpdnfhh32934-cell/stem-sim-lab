# Architecture

SIMLAB is a first-person 3D laboratory simulation built with **TypeScript + Three.js**, bundled
by **Vite**, validated with **Zod**, tested with **Vitest** (unit/integration) and **Playwright**
(end-to-end in a real browser). It runs in the browser today; a desktop shell (Electron) is a
later phase and only needs a new `src/platform` adapter.

## 1. Assessment at the start of Phase 1

| Question                    | Answer                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. What existed?            | Nothing: `Desktop\SimLab 3D` did not exist. The only inputs were the roadmap (`Desktop\SimLab3D.txt`) and the Phase 1 brief. No game engine (Unity/Unreal/Godot) is installed on the machine; Node 24, Git and Rust are.                                     |
| B. What could be reused?    | The owner's other projects (CircuitMind, stem-sim-lab) use the same stack (TS, three.js, Zod, Vitest, Playwright, ESLint/Prettier settings), so their tool versions and conventions were reused. No code was copied.                                         |
| C. Technical-debt risks     | Choosing an engine nobody can build or test locally; gameplay code tangled with rendering/DOM (untestable); experiments built as one-off scenes; hard-coded ids (`if item == ball`); saves that serialise runtime objects; global singletons.                |
| D. What Phase 1 adds        | Engine choice, layered source tree with enforced boundaries, boot pipeline, game state, events, config, logging, player/character/interaction/item/room/lab/experiment/simulation foundations, versioned saves, scene loading, dev debug panel, tests, docs. |
| E. Decisions to keep stable | See [§6](#6-decisions-to-keep-stable).                                                                                                                                                                                                                       |

**Engine decision.** The owner chose TypeScript + Three.js (asked explicitly, because it is the
one decision that would force a rewrite later). It is the only option that can be built, tested
and run on this machine today, and it matches the owner's other projects. Trade-off: high-end
graphics (Phase 14) need more manual work than in Unity/Unreal; three.js `WebGPURenderer` is the
upgrade path.

**Physics engine decision.** Phase 2 added **Rapier** (`@dimforge/rapier3d-compat` 0.21, WASM)
behind `src/physics`, the only module allowed to import it — see [physics.md](physics.md).
Scientific experiments do **not** use the game physics engine: they run deterministic models in
`src/simulation` (see [data-model.md](data-model.md#experiments-and-simulation)), so results are
exact and testable.

## 2. Layers and dependency rules

```
src/
├── core/         generic infrastructure: EventBus, SystemRunner, Logger, config, Registry, math, schema, i18n
├── gameplay/     character, item, player (input, movement, equipment), interaction (+ behaviours), procedure, experiment (stations), progression
├── world/        room / laboratory / scene definitions, room geometry (walls, doorways), World (entities), EntityStates, SceneManager
├── physics/      Rapier world: room/item colliders, dynamic bodies, player character controller
├── simulation/   experiment definitions, SimulationModel, ExperimentRuntime, ExperimentSession, ExperimentSystem, models/
├── persistence/  save schema + migrations, SaveSystem, storage interface, language setting
├── multiplayer/  LAN rooms (Phase M): protocol (Zod), RoomHub (the room server's state), its Vite plugin, Peers (the other players)
├── game/         composition root (Game), GameState, GameEvents, content database, test helpers
├── content/      JSON data: characters, items, rooms, laboratories, scenes, experiments, procedures, topics, strings
├── platform/     browser only: three.js renderer (+ experiment view), DOM input, HUD, results panel, main menu, debug panel, localStorage
└── main.ts       browser entry: boots the Game with the platform systems and runs the frame loop
```

Rules (enforced by ESLint in `eslint.config.js`, not just by convention):

- **Only `src/platform` and `src/main.ts` may import `three` or use DOM globals** (`window`,
  `document`, `localStorage`, …). Everything else is headless and runs in Node tests.
- **Only `src/physics` may import Rapier** (`@dimforge/*`). Other modules see plain data: poses
  on entities, `player.position`/`grounded` in GameState, and `PhysicsSystem`'s small query API.
- **`src/core` imports nothing from the game modules.** It is reusable infrastructure.
- Game modules depend on each other through **types** and **events**, not through concrete
  wiring. Only `src/game/Game.ts` constructs systems and passes dependencies.

```
          main.ts ──► platform ──► game (composition root)
                                     │
        ┌──────────┬──────────┬─────┼──────┬─────────────┬─────────────┐
        ▼          ▼          ▼            ▼             ▼             ▼
     gameplay    world    physics     simulation    persistence    content (JSON)
        └──────────┴──────────┴────────────┴─────────────┴──► core     (physics ─► Rapier)
```

## 3. Systems and responsibilities

| System (id)                       | Module                                    | Owns                                                                                                                                                                             |
| --------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scenes`                          | `world/SceneManager.ts`                   | Loading/unloading scenes from data, spawning placements, player spawn, `session.phase`; neighbour scenes resident beside the current one (attach, release, enter at a threshold) |
| `player`                          | `gameplay/player/PlayerSystem.ts`         | Look + movement intent (m/s) from `InputState`, `PlayerEnteredRoom`                                                                                                              |
| `physics`                         | `physics/PhysicsSystem.ts`                | Rapier world (loaded lazily), fixed-step stepping, colliders, dynamic bodies, capsule                                                                                            |
| `interaction`                     | `gameplay/interaction/…`                  | Interactable registry, look-at focus, performing actions, action guards                                                                                                          |
| `doors`                           | `gameplay/door/DoorSystem.ts`             | Walk-through door pairs: state machine, preparing the far scene, never closing on the player                                                                                     |
| `hinges`                          | `gameplay/door/HingeSystem.ts`            | Hinged leaves (PPE cabinet, washroom door): how far each is swung, never into the player (UX3.1)                                                                                 |
| `inventory`                       | `gameplay/inventory/InventorySystem.ts`   | Carried items (`player.inventory`): put away, take out, hotbar selection, sanitising a save                                                                                      |
| `procedures`                      | `gameplay/procedure/…`                    | Data-defined step sequences (cleanroom entry), entrance gate, timed steps                                                                                                        |
| `experiments`                     | `simulation/ExperimentSystem.ts`          | Experiment sessions (parameters, states, runs), ticking runs, reporting results                                                                                                  |
| `stations`                        | `gameplay/experiment/…`                   | Apparatus in the world (launcher, pendulum): commands, rules (guard), checklist                                                                                                  |
| `progression`                     | `gameplay/ProgressionSystem.ts`           | Recording completed experiments (XP/achievements later)                                                                                                                          |
| `peers`                           | `multiplayer/Peers.ts`                    | The LAN room this game is in, the other players (eased poses), who works which station; never saved                                                                              |
| `lan-rooms`                       | `platform/net/LanRooms.ts`                | The room client over the Vite dev server's WebSocket (`import.meta.hot`): poses at 15 Hz, station commands, claims                                                               |
| `browser-input`                   | `platform/BrowserInput.ts`                | Keyboard/mouse → `InputState`, pointer lock                                                                                                                                      |
| `renderer`                        | `platform/render/RendererHost.ts`         | three.js scene mirroring the world (`WorldRenderer`, loaded for the first world scene)                                                                                           |
| `hud`, `main-menu`, `debug-panel` | `platform/ui/…`                           | DOM overlays                                                                                                                                                                     |
| `inventory-view`                  | `platform/ui/InventoryView.ts`            | The hotbar and the inventory panel (I); changes only through `InventorySystem`                                                                                                   |
| `settings`, `pause-menu`          | `platform/ui/settings.ts`, `PauseMenu.ts` | The one settings element (shown by the main and pause menus); pause, Resume, back to the menu                                                                                    |

Services that are not per-frame systems: `World` (entities and rooms), `EntityStates` (persistent
per-entity state), `Equipment` (what the player wears, saved), `SaveSystem`, `Content` (validated definitions), `InputState`, `Logger`,
`EventBus`.

## 4. Lifecycle

**Boot** (`Game.boot`, each stage named in a `BootError` if it fails):

```
configuration → core-services → content → game-state → systems → initial-scene → ready
 resolveConfig   Logger,        buildCore-    createGame  construct, add      load main-menu
                 EventBus       Content       State       platform systems,
                                (validate +               initAll in order
                                cross-check)
```

The boot loads neither the physics engine nor the 3D renderer: the menu ran on a 384 kB entry
chunk at Phase C2 (777 kB with three.js in Phase 6B; 430,597 B after INF-1, below). It only checks that the browser has
WebGL 2 (on a canvas outside the page), so a browser without it still stops at the systems stage.
The first world scene (New game, Continue, or a world `initialScene`) makes `SceneManager` await
its preparation: `physics.load()`, which fetches the Rapier chunk once — see
[physics.md](physics.md#loading-lazy-since-phase-21) — and, at the same time, each step registered
with `Game.addWorldPreparation`: the renderer's (`RendererHost`), which fetches three.js and
`WorldRenderer` (a chunk of their own) once and starts it on the page's one canvas before
anything spawns. A failed load keeps the menu and says why; the next world entry tries again.
Details and measurements: [phase-c2-report.md](phase-c2-report.md).

Two more chunks follow the same rule (Phase INF-1). The **lab pack** (`game/labPack.ts`: every
experiment definition, the topics and the simulation models) is loaded by `Game.loadLab()` — with
the first world scene (`prepareWorld`), or earlier when the main menu's catalog opens — then
validated and cross-checked against the core content (`addLabContent`) and added to the registries
the systems already hold; only then is the run history read. The boot validates the core content
alone (`buildCoreContent`); tests still check all bundled content at once (`buildContent`). The
**results panel** (`ResultsPanel`, its plots and CSV) is a world preparation of the HUD; a failed
download leaves the world playable and says why when results are asked for. The menu's JavaScript
went from 499,990 B to 430,597 B (Vite build; the lab pack chunk is 33,423 B, the results panel
36,562 B).

**Frame** (`main.ts` → `Game.update(dt)`, `dt` capped at 0.1 s so a stall slows the game instead
of making it jump):

```
scenes → player (intent) → physics (fixed steps: move capsule and door leaves, step world, write
poses back) → interaction → doors → inventory → procedures → experiments (runs) → stations
(projectile poses) → progression → browser-input → renderer → hud → inventory-view → settings
→ main-menu → pause-menu
→ debug-panel → InputState.endFrame()
```

**Shutdown**: `Game.dispose()` disposes systems in reverse order (each releases its event
subscriptions and DOM listeners), then clears the event bus.

## 5. Data flow examples

Walking through a door (phase WX; no system references another):

```
E on a closed walk-through door ─ travel behaviour ─publish DoorRequested─► DoorSystem
  ├─ far scene resident? else preparing: NeighbourScenes.attach(far) ─► SceneManager.attach
  │     ├─ await prepareWorld(); rooms translated by the campus offset (campus.ts), World.addRooms
  │     ├─ placements spawned ─EntitySpawned×n─► Interaction, Physics, Renderer
  │     ├─ publish SceneAttached ─► Physics (room slabs), Renderer (rooms; lights refitted over
  │     │  every resident scene), Stations
  │     │  (failed or stale: rolled back, SceneDetached; the door stays closed and says why)
  │     └─ await settleAttach (UX3: Game.addAttachSettle): the renderer compiles the new shaders off
  │        the frame and draws the new objects once, a batch a frame, out of sight, before they are
  │        shown — the prompt says "Opening…" meanwhile; the leaves move only after
  ├─ opening → open: DoorDriver.setDoorOpening(f) ─► PhysicsSystem moves the kinematic leaves
  │     inside its fixed step; Renderer draws each leaf slid by its fraction
  ├─ the player walks on: PlayerEnteredRoom (a room of the far scene) ─► SceneManager.enter
  │     └─ makeCurrent, session.sceneId, origin; publish SceneEntered ─► Renderer (the same lighting:
  │        joined scenes share it), Procedures ("entered"), Game (autosave); no SceneUnloaded, no teardown
  └─ closing (player > 2 m away for 1.5 s, path clear) → closed: publish DoorChanged ─► Game
        (autosave); release(the scene left behind) ─ entities despawned, SceneDetached ─► Physics,
        Renderer, Stations; rooms removed
```

A door whose item has no `door` (test fixtures) and the developer scene jump still load the
other scene at once (a teleport, below); no shipped door does.

Opening a teleport door (before phase WX; no system references another):

```
BrowserInput ─press('interact')─► InputState
InteractionSystem.update ─ focused door, primary action 'travel'
  └─ travel behaviour ─publish SceneChangeRequested { arrival }─► SceneManager.load('simlab-hub')
        ├─ await prepareWorld() ─► physics.load() + renderer load  (both done after the first world scene)
        ├─ World.clear()  ─EntityDespawned×n─► Interaction (unregister), Physics (remove body), Renderer (remove mesh)
        ├─ publish SceneUnloaded ─► Physics (remove room slabs + player capsule), Renderer (remove room)
        ├─ World.spawn()  ─EntitySpawned×n───► Interaction (register), Physics (create body), Renderer (add mesh)
        ├─ player placed at the arrival door's point (arrivalPose) or, without one, the scene spawn
        └─ publish SceneLoaded ─► Physics (room slabs + capsule), Game (autosave), HUD, MainMenu
```

Grabbing and throwing (Phase 3):

```
E on "Grab" ─ grab behaviour ─ hands.grab ─► InteractionSystem (holds) ─ holder.grab ─► PhysicsSystem
each step: PhysicsSystem drives the held body to the hold point (sweep-clamped at walls/bench)
LMB ─► InteractionSystem.throw ─ holder.release(aim × impulse / mass) ─► normal dynamic body
     └─ publish ObjectReleased ─► HUD (prompt)
```

Running an experiment (Phase 6B, projectile station — details in [experiments.md](experiments.md)):

```
E on RUN ─ experiment-control behaviour ─ExperimentCommand { run }─► StationSystem
  ├─ guard already checked: ball loaded, state, lane and ceiling limits (else ActionBlocked + reason)
  └─ ExperimentSystem.start(session, { height }) ─ExperimentStarted, ExperimentStateChanged─► HUD
each frame: ExperimentSystem advances the run (fixed 1 ms model steps, samples)
            StationSystem places the driven ball at the model state (toWorld) ─► Renderer
            ExperimentView extends the trail from the samples; HUD/monitor repaint ≤ 10 Hz
on landing: ─ExperimentCompleted─► ProgressionSystem, HUD; ball handed back to physics at rest
```

The pendulum station (Phase 6C.2) runs the same way with no body at all: RUN is guarded by the
release angle and the stand's limits, the apparatus supplies the bob's mass, and each frame the
renderer turns the drawn rod and bob to the run's θ (`swingAngle`) — Rapier never sees it.

When a run ends (completed, stopped, cut short by RESET or leaving, failed), its session
freezes it into a `RunRecord` in its history (Phase 6C.3): copies of the inputs, theory,
results and samples, so the results panel's run list, comparisons and CSV export read data no
later dial change or run can alter. The history is never in the save; since Phase P2b ended runs
are kept in their own IndexedDB store (`docs/persistence.md`, Run history), whose failures never
reach the progression save.

An instrument reading (Phase 6C.4, `simulation/measurement.ts`) is derived, not stored: from a
completed run's own result and the resolution d in its own inputs, the reading (nearest multiple
of d), u = d/√12 and d/2. The resolution is a station parameter the model never reads, so it is
recorded, saved and compared like any setting without changing the physics.

Every experiment runs at a station: since Phase 6F free fall has its tower, and the Phase 1
console with its one-shot `ExperimentRequested` is gone.

## 6. Decisions to keep stable

1. **Headless game logic.** No `three`/DOM outside `src/platform`. Keeps every rule testable.
2. **Composition root, no singletons.** New systems are constructed in `Game.ts` with explicit
   dependencies and added to the `SystemRunner` in a deliberate order.
3. **Events for cross-system reactions**, all declared in `src/game/GameEvents.ts`. Subscriptions
   are always released through `Disposables` in `dispose()`.
4. **Data-driven content** validated before use with precise error paths (the core at boot, the
   lab pack when it loads); code never branches on content ids. Behaviour comes from registered
   behaviours/models referenced by id.
5. **Stable entity ids** `<room id>/<placement id>` — save data keys on them.
6. **SI units** everywhere in data and code (m, kg, s, m/s, rad), with one documented exception:
   chemistry experiments use mL and mol/L (pH has no unit; time stays in seconds). Units are
   display labels only.
7. **Experiment ≠ simulation.** Definitions are data; models are pure deterministic code; the
   runtime never fabricates values (non-finite state ⇒ run fails with the reason).
8. **Versioned saves of plain data**, upgraded by explicit migrations, never runtime objects.
9. **Physics is authoritative for motion.** Player input becomes an intent; only the physics
   system moves the capsule and dynamic bodies, on a fixed step; everyone else reads the results.
   The one exception is explicit: while an experiment runs, `StationSystem` asks physics to take
   the projectile out of the simulation (`PoseDriver.drive`) and sets its pose from the model;
   at the end it hands the body back at rest (`stopDriving`). No gameplay code calls Rapier.
10. **One source of truth per experiment run.** The ball's pose, the trail, the monitor, the
    graphs and the measured results all read the same run (state and sample buffers) through
    the same mapping; nothing is recomputed or smoothed for display. The pendulum's bob has no
    physics body: its drawn angle is the run's θ.

## 7. Adding things

- New system: [development-guide.md](development-guide.md#add-a-system)
- New item: [data-model.md](data-model.md#add-an-item)
- New interaction behaviour: [interaction.md](interaction.md#add-a-behaviour)
- New experiment / simulation model: [experiments.md](experiments.md#adding-an-experiment),
  [data-model.md](data-model.md#add-an-experiment)
- New scene/room: [data-model.md](data-model.md#add-a-room-and-scene)
- Save format change: [persistence.md](persistence.md#changing-the-save-format)
