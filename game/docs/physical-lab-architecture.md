# Physical laboratory: interaction architecture (design)

Written 2026-11-01 by the Interaction-architecture agent. This is a design document; no code was
changed. Every "current state" statement comes from reading the files at the cited lines. Nothing
was run: `npm run check`, unit tests, e2e, build and bench are all **NOT RUN** for this document.

**Revision 2 (2026-11-01).** Revised after the adversarial review
(`...\scratchpad\labs\physical\review-interaction-architecture.md`). Each finding was re-checked in
the code before it was applied. All six HIGH findings, all 17 MED and all 10 LOW findings hold
and are applied; §7 records the responses, including two corrections to the review itself.

Sources:

- the code;
- the master spec (`...\scratchpad\labs\labs-master-spec.txt`, chemistry §10–17, biology §18–26);
- the spec map (`...\scratchpad\labs\physical\spec-map.md`). Its findings that this design relies
  on were re-checked in the code;
- the dilution draft (`...\scratchpad\labs\drafts\dilution\{definition.json,NOTES.md,items.json,placement.md}`);
- `docs/experiment-workspace-design.md` §D5.

Scope:

- **In scope:** interaction, containers, liquids, rules, models and saving for the physical
  chemistry and biology lab.
- **Out of scope:** visual quality (DPR, AA, tiers). That is a separate track
  (`docs/render-quality-audit.md`). This design only states what the renderer must read (§2.13).

Evidence tags used below:

- **SPEC:** the spec says it.
- **DEF:** a shipped or drafted definition says it.
- **AFFORDANCE:** an interaction with no scientific consequence.
- **SPEC GAP:** something is missing and is not inferred.

---

## 1. Audit: what exists

### 1.1 Holding: pickup, carry, place, rotate, release

| Capability                                             | State                           | Where (file:line)                                                                                                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target under crosshair                                 | **Works**                       | `src/gameplay/interaction/InteractionSystem.ts:479-514`                                                                                                          | Ray against oriented boxes, linear scan of all interactables (a `shortcut:` comment, line 486). One physics ray checks occlusion (`:507-512`). Reach 2.2 m (`src/core/config.ts`, `player.reach`).                                                                                                                                                                                  |
| Pick up (E, the `grab` behaviour)                      | **Works**                       | `interaction/behaviors.ts:310-328`; `InteractionSystem.ts:219-236`                                                                                               | Only `physical.body: "dynamic"` items with `massKg <= maxCarryMassKg` (15 kg) and one object at a time. Content check: `grab` needs a dynamic body (`behaviors.ts:314-315`).                                                                                                                                                                                                        |
| Carry                                                  | **Works**                       | `src/physics/PhysicsSystem.ts:472-480` (`grab`), `:928-979` (`driveHeld`); `hold.ts:11-17` (`holdPoint`)                                                         | The held body stays dynamic. Gravity is off and CCD is on. A velocity drive (time constant 0.08 s, at most 8 m/s, `:52-54`) pulls it towards a point 1 m along the aim. A shape sweep stops the hold point at static surfaces (`:944-962`). The held body is in the `HELD` group, so it and the player capsule ignore each other (`:40-49`).                                        |
| Stuck-release                                          | **Works**                       | `InteractionSystem.ts:331-341`                                                                                                                                   | An object that stays more than 1 m from the hold point for 0.5 s is let go (`out-of-reach`).                                                                                                                                                                                                                                                                                        |
| Rotate while held                                      | **Missing**                     | `PhysicsSystem.ts:978`                                                                                                                                           | `setAngvel(zero)` every step keeps the world orientation the object had when grabbed. It neither follows the view's yaw nor tilts. A bottle grabbed lying on its side stays on its side. The drawn rotation of a held body is copied unblended from the last step ("held steady: not turned", `PhysicsSystem.ts:357`); only its position is blended in the view frame (`:338-356`). |
| Release (drop)                                         | **Works**                       | `InteractionSystem.ts:239-241, 344-356`; `PhysicsSystem.ts:483-496`                                                                                              | E with no `withHeld` target drops the object where it is. It falls under gravity and its velocity is zeroed.                                                                                                                                                                                                                                                                        |
| Throw (LMB)                                            | **Works**                       | `InteractionSystem.ts:250-261`                                                                                                                                   | Only items with `physical.throwable`.                                                                                                                                                                                                                                                                                                                                               |
| Place onto a surface (chosen spot, upright)            | **Missing**                     | none                                                                                                                                                             | "Drop" lets the object fall from the hold point. There is no aimed set-down point, no upright pose, no free-space check and no refusal ("invalid placement rejected").                                                                                                                                                                                                              |
| Hand over into an apparatus                            | **Works for the launcher only** | `InteractionSystem.ts:243-247` (`place`), `experiment/behaviors.ts:77-107` (`load`, `withHeld`), `StationSystem.ts:828-835` (`mount` through `PoseDriver.drive`) | This is the existing "use held object on target" pattern: a `withHeld` action, decided by `StationSystem`, with the body taken out of Rapier by `PoseDriver` (`hold.ts:36-41`, `PhysicsSystem.ts:504-533`).                                                                                                                                                                         |
| Inventory (Q)                                          | **Works**                       | `src/gameplay/inventory/InventorySystem.ts:144-200`                                                                                                              | Takes the held entity out of the world. Items opt in with `item.inventory` (`item.ts:82-87`), with a radius cap of 0.3 m (`InventorySystem.ts:35`).                                                                                                                                                                                                                                 |
| Guards (refusal with a reason)                         | **Works**                       | `InteractionSystem.ts:57-61, 163-181, 288-307`                                                                                                                   | `ActionGuard(entity, actionId, pressed)`. A refused action publishes `ActionBlocked` and does nothing. `StationSystem` (`StationSystem.ts:839-878`) and `ProcedureSystem` (`ProcedureSystem.ts:92, 207`) plug in.                                                                                                                                                                   |
| Hinged cabinets (doors that swing, contents reachable) | **Works**                       | `item.ts:110-127` (`hinged`), `:199` (`openBox`); `core-items.json:56-97` (the wardrobe)                                                                         | Leaves are kinematic bodies that rays hit, so a closed cabinet hides its contents. `carcass` boxes are its colliders, so shelves can be carcass boxes. The three chemistry and biology cabinets (`items.json:628, 643`, `bio-specimen-cabinet`) are `decor` props with no `hinged` and no contents.                                                                                 |
| Running stream visual                                  | **Works for taps**              | `item.ts:205-211` (`visual.stream`); `src/platform/render/water.ts`                                                                                              | Drawn while the entity state `running` is true, with a fixed length. It is not tied to any volume.                                                                                                                                                                                                                                                                                  |
| E2E of the hold                                        | **Exists**                      | `e2e/grab.spec.ts:93-193`                                                                                                                                        | Aim with exact mouse deltas, E grab, carry, drop onto the bench, throw at a wall. It reads the dev debug panel. This is the template for the physical-lab e2e.                                                                                                                                                                                                                      |
| Unit and integration tests of the hold                 | **Exist**                       | `src/gameplay/interaction/hold.test.ts:59-332` (15 cases, real Rapier); `PhysicsSystem.test.ts:305, 413` (pose driver)                                           |                                                                                                                                                                                                                                                                                                                                                                                     |

**Summary.** The base for pick up, carry, drop and throw is solid and tested: dynamic bodies,
velocity drive, sweep against statics, CCD and occlusion. Three things are missing:

- held orientation control (follow yaw, tilt);
- an aimed and validated set-down;
- keeping a set-down object upright.

### 1.2 Pour, stir, heat, measure

| Capability                                      | State                               | Evidence                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container state (volume, contents, temperature) | **None in gameplay**                | `item.ts` has no container field. Liquids exist only as **drawings of model variables** inside bench rigs (`src/platform/labVisuals/chemistry.ts:120` `levelIn`, `:314` `flaskLevel`, `:348` `FLASKS`; `render/bench/dilution-station.ts`, `titration-stand.ts:93`). These pure level mappings (profile to height) are reusable. |
| Pour (source tilt, receiver, transfer)          | **None**                            | No tilt (above). `LineOfSight.castRay` (`hold.ts:50-52`, `PhysicsSystem.ts:624-647`) already skips the player and the held body, and returns the entity hit. It is the right query for "what is under the spout", but it returns no surface normal.                                                                              |
| Discrete transfer (pipette, dropper)            | **2D only**                         | The workspace setup steps `place X onto Y` (`src/simulation/experiment.ts:284-300`) are marked done by UI clicks through `ExperimentCommand {command:'setup'}` (`GameEvents.ts:101-108`, `StationSystem.ts:686-688, 798-802`).                                                                                                   |
| Stir / mix                                      | **None**                            | No model uses mixing (spec map §7.2, §8.3, re-checked: `dilution.ts` says it is "taken as mixed at every moment").                                                                                                                                                                                                               |
| Heat                                            | **Model only**                      | `heating.ts` takes net `power` as an input. No placement or thermal coupling. No cooling (spec map D2).                                                                                                                                                                                                                          |
| Measure                                         | **Works, from completed runs**      | `src/simulation/measurement.ts` (reading = nearest multiple of d, u = d/√12); after-run setup steps reveal readings (`experiment.ts:284-300`, `phase: 'after-run'`).                                                                                                                                                             |
| Model inputs from the apparatus                 | **Hook exists, unused for benches** | `ExperimentSession.inputs(apparatus)` merges apparatus numbers over parameters (`ExperimentSession.ts:194-196`); `start(apparatus)` (`:230-246`); `StationSystem.apparatus()` returns `{}` for benches (`StationSystem.ts:1105-1111`).                                                                                           |
| Materials setting parameters                    | **Exists as data**                  | `MaterialSchema.sets: {parameter, value}` (`experiment.ts:269-282`). Choosing a material sets a parameter to one of its presets. `setBlock` accepts only presets or grid values (`StationSystem.ts:932-956`); `locks` freeze a parameter after a step (`:958-964`).                                                              |
| Setup ordering and refusal text                 | **Exists, pure**                    | `setupGate.ts:18` `pendingBeforeRun`, `:26` `setupRefusal`, `:52` `stepApplies`. Refusal text comes from data (`SetupStep.refusal`, localized).                                                                                                                                                                                  |

### 1.3 Save

- **What is saved:** `SaveData` v3 (`src/persistence/saveData.ts:10-53`) holds the player, the
  inventory, `world.entityStates` (a flat `Record<entityId, Record<key, boolean|number|string>>`)
  and progression. `capture` and `applySave` are in `SaveSystem.ts:56-81, 136-147`.
- **Poses of moved objects are not saved.** No pose field exists. On Continue, and on every scene
  re-attach, a dynamic item spawns at its placement (`World.ts:29-41` `entityFromPlacement`). A
  physical lab needs poses saved (§2.15).
- **Configuration that is saved:** a station's `param.<id>` and `setup.<step>`, mirrored into
  entity states (`StationSystem.ts:399-411`). Runs and history are never in the save. They go to
  IndexedDB (`persistence/runHistory.ts`).

### 1.4 Rule authority and workspaces

- `StationSystem` is the only authority for an apparatus (`StationSystem.ts:262-272`).
- Every control only asks, through `ExperimentCommand` (`experiment/behaviors.ts:10-14`).
- The refusal is `refusalAt` (`StationSystem.ts:589-631`). `WorkspaceSystem` asks
  `stations.refusal(id, 'open-workspace')` before opening (`WorkspaceSystem.ts:52-64`).
- `open-workspace` is refused for `physical-3d` (`StationSystem.ts:628-629`).
- `PRESENTATIONS` = `physical-3d | bench-embedded | 2d-workspace | microscopy | observation`
  (`experiment.ts:232-238`). `workspace` is required unless the presentation is `physical-3d`.
- **Shipped chem and bio presentations** (`src/content/experiments/*.json`):

  | Experiment                                                           | Presentation     |
  | -------------------------------------------------------------------- | ---------------- |
  | `acid-base-titration`, `reaction-rate`, `osmosis`, `enzyme-activity` | `2d-workspace`   |
  | `heating-curve`                                                      | `bench-embedded` |
  | `microscope`                                                         | `microscopy`     |
  | `photosynthesis`                                                     | `observation`    |

- **Not shipped:** `dilution`, `ph-measurement`, `solubility`, `precipitation`, `separation`,
  `transpiration` and `genetics` are drafted only. Their models exist in `src/simulation/models/`
  but are not in `BUILT_IN_MODELS` (`models/index.ts`). The `dilution-station` bench rig exists
  (`render/bench/dilution-station.ts`) but is not registered in `BENCH_MODELS`
  (`registry.ts:69-...`).
- **Periodic table piece:** a contextual periodic table exists only as a 2D piece
  (`src/platform/ui/workspace/pieces/chem-elements.ts`). It is a lens, "no action that adds or
  combines an element". There are no element samples anywhere (spec map G1).

### 1.5 Constraints this design keeps

- One `Game`, one Rapier world, one renderer.
- The page owns the canvas, and the renderer is lazy (C2).
- A fixed step (`config.physics.fixedStep` 1/60 s, `maxSubSteps` 6: real time down to 10 fps).
- The menu JS guard of 500,000 B stays.
- `PhysicsSystem` is the only mover of bodies. Gameplay never moves meshes.
- No per-frame allocation in hot paths.
- Content is data, and code never branches on ids.
- All player text goes through `Texts` (EN+VI).
- System update order (`Game.ts:309-322`): `scenes, player, physics, interaction, doors, hinges,
inventory, procedures, experiments, stations, workspace, progression`.

---

## 2. Design: capability composition

### 2.1 Placement in the layers

```
core (math, events, registry)
  ├─ simulation/liquid.ts         PURE: Contents, transfer(), split(), totals, and levelIn() /
  │                               heldBelow() moved here from platform/labVisuals/chemistry.ts
  │                               (gameplay and persistence need them; platform re-imports them)
  ├─ simulation/models/*          PURE models; + optional driven mode (§2.9)
  ├─ gameplay/item.ts             capability schemas (data) on ItemDefinition
  ├─ gameplay/lab/LiquidSystem.ts pour/stir GEOMETRY only: tilt, spout, receiver, rate, carry,
  │                               stir and inversion detection. It writes nothing; it asks.
  ├─ gameplay/interaction/*       hold extensions: orientation, set-down, seats (ports in hold.ts)
  ├─ gameplay/experiment/StationSystem.ts   THE rule authority AND the only writer of container
  │                               state: stations.transfer() checks the rule, moves the µL, marks
  │                               the step and sets the parameter in one call (§2.8)
  ├─ physics/PhysicsSystem.ts     implements the extended ports (only mover)
  └─ persistence/saveData.ts      v4: world.objects (container poses), world.containers (contents)
game/Game.ts  composition; GameState.world.containers lives here
platform/render  ContainerView (liquid level/colour/stream), drawn ONLY from state
```

`levelIn` and `heldBelow` live today in `src/platform/labVisuals/chemistry.ts:107-140`. The
content check (§2.2), the stir test (§2.10) and the save sanitize step (§2.15) cannot import
`platform`, so moving them into the pure `liquid.ts` is part of the slice. The platform keeps
its drawing code and imports the two functions from there.

Capabilities are **optional blocks in item data**. A block is a property of the item, not of a
class, so composition is "which blocks the item has":

| Capability                                                        | Item data block                                                            | Who acts on it                                                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Interactable                                                      | `interactions: [...]` (exists)                                             | InteractionSystem                                                                                   |
| Grabbable                                                         | `grab` behaviour + `physical.body: "dynamic"` (exists)                     | InteractionSystem / PhysicsSystem                                                                   |
| PhysicalContainer                                                 | `container`                                                                | StationSystem (bookkeeping, through `transfer`), renderer (level)                                   |
| PourSource                                                        | `container.pour`                                                           | LiquidSystem (detects), StationSystem (commits)                                                     |
| LiquidReceiver                                                    | `container.mouth` (+ `fillLimitMl`, optional `captureRadius`)              | LiquidSystem (detects), StationSystem (commits). May sit on a **static** item (receiver-only, §2.2) |
| MeasuredTransfer (volumetric pipette, dropper)                    | `container.measured`                                                       | `withHeld` actions, committed by StationSystem                                                      |
| Closable (stopper)                                                | `container.closable`                                                       | `container` behaviour (entity state `closed`)                                                       |
| StirTool                                                          | `stirTool`                                                                 | LiquidSystem                                                                                        |
| Seat (tile, hot-plate top, cuvette slot, microscope stage, clamp) | `seats: [...]` on a static item, standing on that item's `colliders` boxes | Interaction (set-down target) + StationSystem (rule)                                                |
| Heatable / HeatSource                                             | `container` + a `seats[].heats` flag on the source                         | StationSystem feeds the model                                                                       |
| Measurable                                                        | already: station results + `measurement.ts`                                | StationSystem / views                                                                               |
| MicroscopePart                                                    | slide = `container`-less dynamic item + `stage` seat on the microscope     | StationSystem                                                                                       |

The behaviour registry (`interaction/behaviors.ts:63-72`) stays the way actions attach. One new
behaviour, `container`, offers the actions of the container blocks (fill, deliver, close/open,
set down). Each behaviour's `check(item)` validates its block at content load, as `grab` does
(`behaviors.ts:314-315`).

### 2.2 Item data (schema sketch, `src/gameplay/item.ts`)

```jsonc
"container": {
  "capacityMl": 60,                 // brim volume (geometry)
  "fillLimitMl": 50,                // optional: the mark of volumetric glassware; default capacityMl
  "profile": [[0.0, -0.07], [0.025, -0.07], [0.025, 0.0], [0.006, 0.03], [0.006, 0.07]],
                                    // inner lathe profile (m, item frame): level mapping AND drawing
  "mouth": { "center": [0, 0.07, 0], "radius": 0.006,       // receiver opening, item frame
             "captureRadius": 0.015 },  // optional AFFORDANCE aim help (Decision 16); default radius
  "pour": {                          // PourSource (absent: cannot pour)
    "spout": [0, 0.07, 0.006],       // item frame (for a wash bottle: the nozzle tip)
    "trigger": "tilt",               // "tilt" (bottle, beaker) | "squeeze" (wash bottle)
    "minTiltDeg": 70, "fullTiltDeg": 115,
    "rateMlPerS": 8                  // pacing, never a model input (AFFORDANCE)
  },
  "measured": { "volumeMl": 5 },     // MeasuredTransfer: fills/delivers exactly this (volumetric pipette)
  "closable": true                   // has a stopper/cap: entity state "closed"
},
"stirTool": { "tip": [0, -0.14, 0] },                         // item frame
"seats": [ { "id": "tile", "center": [-0.08, 0.13, 0], "radius": 0.05,
             "accepts": ["volumetric-flask"], "heats": false } ],  // accepts = item tags
"colliders": [ { "center": [...], "size": [...] } ]   // static items only: the carcass pattern, generalised
```

**Static colliders.** Today a static item gets one box collider of its visual size; only `hinged`
items get several (`carcass`, `PhysicsSystem.ts:771-781`). A tile seat beside a taller
colorimeter would lie inside that one box, so every set-down there would fail `no-room` or rest
on the box top. The slice therefore generalises `carcass` to an optional `colliders` list on any
static item (the hinged path keeps reading `carcass`). Seats sit on real surfaces.

Content checks:

- a `container` with `pour` or `measured` needs `physical.body: "dynamic"` and the `grab`
  behaviour. A **receiver-only** container (`mouth`, no `pour`, no `measured`, no `grab`) may be
  on a static item, for example the colorimeter's cuvette;
- `fillLimitMl <= capacityMl`;
- the `profile`'s inner volume at the top is at least `capacityMl` (computed with `heldBelow`, now
  in `liquid.ts`);
- `spout` and `mouth` lie inside the item's box; `captureRadius >= radius`;
- `seats[].accepts` tags exist on some item;
- every `seats[].center` lies on the top face of one of the item's `colliders` (± 1 mm).

**Contents are not item data.** They are placement data (initial contents) plus game state
(current contents), because two bottles of the same item hold different solutions.

### 2.3 Placement data: binding objects to a station

The pattern already exists: dials name their station by `params.station` (`experiment/behaviors.ts:109-117`).
Physical lab items do the same:

```jsonc
{ "id": "stock-20", "item": "reagent-bottle", "position": [...],
  "params": { "station": "dilution", "piece": "stock-bottle", "material": "stock-20", "fill": 125 } }
{ "id": "flask-50", "item": "volumetric-flask-50", "position": [...],
  "params": { "station": "dilution", "piece": "flask", "material": "flask-50" } }
```

- `piece` names a `WorkspacePieceSchema` entry of that station's experiment. **Pieces are the step
  vocabulary** (§2.8): a setup step's `place` and `onto` name pieces (or, for `place`, a
  material), exactly as the shipped schema requires (`experiment.ts:386-405`).
- `material` names a `MaterialSchema` entry. A glassware choice is a material too, with a `sets`
  (exactly as the 2D design D5 binds "flask size to the `finalVolume` preset").
- A content check rejects a `piece` or `material` the experiment does not list, so the cabinet can
  hold only what the definition lists (spec map §5, G1).
- **One source for a model input.** A content check requires `fillLimitMl` and
  `measured.volumeMl` to equal the bound material's `sets.value` (in mL). They are used for
  drawing and bookkeeping only; the model gets the value only through the validated `set` command
  (§2.8, §2.9).
- **Hidden values at content time.** The `secret()` check (`experiment.ts:318-331`) runs today on
  piece bindings only. The same check runs on physical bindings: a placement's params, a
  material's `label` and `formula`, and an item's `inspect` text must not name an answer result or
  a hidden input.
- `fill` (mL) is the initial contents, made of that material. **It is a bookkeeping value, not
  DEF** (no draft gives a bottle fill, a wash-bottle volume or a cuvette capacity). No model reads
  it. It is labelled "AFFORDANCE: bookkeeping volume" in the data, and it is chosen so every preset
  combination can be run several times (stock ≥ 10 mL × planned repeats). Decision 15.
- The **substance identity is the material id**. A container never stores a concentration (§2.16).

### 2.4 Container state and exact bookkeeping (`src/simulation/liquid.ts`)

```ts
/** Volume by material id, in integer microlitres (exact sums: no float drift). */
type Contents = Map<string, number>; // e.g. { "stock-20": 5000, "water": 45000 }
interface ContainerState {
  contents: Contents; // integer µL per material
  temperatureC: number; // 20 unless a model sets it (heating); never invented
  closed: boolean; // stopper/cap (closable only)
  mixed: boolean; // see §2.10: a fact the procedure may require, never a reaction
}
```

- **Integer µL.** Totals stay exact for every sequence of transfers, so
  `source_after = source_before − t` and `receiver_after = receiver_before + t` hold with `===`.
  The largest container in the definitions (250 mL = 250,000 µL) is far below 2^53.
- **`transfer(src, dst, wantUl, limitUl)` (pure).** It moves
  `t = min(wantUl, total(src), limitUl − total(dst))`, where `limitUl` is the receiver's
  `fillLimitMl·1000`. If `src` holds one material, `t` comes from that material. If it holds
  several, `t` is split in proportion with largest-remainder rounding (ties broken by material id
  order), so each material's total is exact too. The split is bookkeeping only. `liquid.ts` holds
  **no rule** about when a pour is allowed (an earlier draft required `mixed` here; that
  duplicated the definition's own steps with a second refusal text). Whether a pour out of a
  container may happen is decided by the definition's steps through `StationSystem` (§2.8).
- **No overflow or spill.** The spec defines none, and no model defines one (spec map §8.3).
  A receiver takes liquid only up to `fillLimitMl`. A pour onto anything that is not an accepting
  receiver moves nothing (§2.6). If the Lead wants overflow, it needs a spec line (Decision 10).
- **Where it lives at run time:** `GameState.world.containers: Record<entityId, ContainerState>`
  (game layer). It is created from placement `fill` on first spawn and saved (§2.15).
  **`StationSystem` is the only writer**: transfers (`stations.transfer`, §2.8), the restock of the
  `clear` command (§3.3 step 14), the `closed` and `mixed` flags, and `temperatureC` from a run
  (§2.11). `LiquidSystem` only detects and asks. Views read `liquids.view(entityId)`, a read-only
  port that `StationSystem` implements, with a `version` number that increases on every write
  (§2.13).

### 2.5 Holding extensions (ports in `hold.ts`, implemented in `PhysicsSystem`)

1. **Held orientation.** Add an
   `ObjectHolder.setHoldTilt(rad)` port. It mirrors the `holdPoint` pattern: gameplay states
   intent and physics moves.
   - **Target orientation** = `yaw(player.yaw + yawOffsetAtGrab)` × `rotX(−tilt)`, where the tilt
     axis is the view's right axis, so the object tips away from the player.
   - **Upright when grabbed.** A container is grabbed and held upright: `yawOffset` keeps its
     heading and its roll and pitch are driven to 0.
   - **Drive.** `driveHeld` (`PhysicsSystem.ts:928-979`) replaces `setAngvel(zero)` with an
     angular velocity towards the target: axis·angle/τ, capped at 4 rad/s (one 1/60 s step is
     ≤ 0.067 rad).
   - **Tilt input, on the fixed step.** The tilt target ramps towards `fullTiltDeg` (or the
     inversion target, §2.10) while the new `pour` binding is held, and back to 0 when it is
     released. The ramp advances once per **physics step** (the frame's `stepsLastFrame`,
     `PhysicsSystem.ts:194`), not per frame, so the same number of held steps gives the same
     tilt at any frame rate. `isHeld('pour')` is still sampled per frame; that one-frame
     sampling granularity is the only frame-rate dependence (§4.2).
   - **Tilt timing.** With the 4 rad/s cap, 115° (2.0 rad) needs at least 0.5 s plus the
     exponential tail of the drive: about 0.65 s. Tests assert the time from the cap, not 0.5 s.
   - **Drawn rotation must be blended (fixes judder).** Today a held body's rotation is drawn
     unblended from the last 60 Hz step (`PhysicsSystem.ts:357`), which is invisible only because
     it never turns. With this drive it would jump every fifth frame on the 300 Hz display, and
     disagree with the position, which is blended in the view frame. `renderPose` therefore keeps
     the held body's previous and current rotation **relative to that step's view yaw** (as it
     does for the position), nlerps them by `alpha`, then turns the result by the current view.
     Preallocated quaternions; no allocation. This is a visual/pacing change: per the user's
     standing rule it stays **uncommitted until the user has checked it on the 300 Hz display**.
   - Non-container items keep today's behaviour (no orientation drive) unless they opt in.
2. **Aimed set-down (place).** Add an
   `ObjectHolder.setDown(): SetDownResult` port, with
   `SetDownResult = {ok: true, seat?: string} | {ok: false, reason: 'no-surface' | 'not-level' | 'no-room' | 'too-far'}`.
   Physics does the following:
   - a ray along the aim, within reach, using `castRayAndGetNormal`. `RayHit` gains `normal`, so
     `castRay` callers are unaffected;
   - the hit must be a **fixed or kinematic** body (the ray runs with `EXCLUDE_DYNAMIC`). The flat
     top cap of another container's cylinder collider (`shapeOf`, `PhysicsSystem.ts:856-864`)
     faces up too, and stacked dynamic glass is unstable and means nothing in the lab;
   - it requires a surface that faces up (`normal.y ≥ cos 10°`);
   - it shape-casts the held collider down from 5 cm above the hit point to find the resting
     height;
   - it tests overlap at that pose, with `intersectionWithShape` as in `dynamicBodyIn`
     (`PhysicsSystem.ts:553-575`), **including the player capsule**: on release the body leaves
     the `HELD` group for the default group (`PhysicsSystem.ts:490`), so a set-down near the feet
     would otherwise overlap the capsule;
   - if the hit entity has a `seat` within `radius` whose `accepts` matches the held item's tags,
     the pose is the seat's pose;
   - if accepted, it drives the body there over a few steps (the same velocity drive, target = the
     rest pose), then releases at rest. It never teleports.
   - **Gameplay rule.** E while holding does the `withHeld` target action if there is one (exists,
     `InteractionSystem.ts:322-328`), else `setDown`. A refusal keeps the object in hand and
     shows the reason (EN: "Nothing to set it down on here." / "That surface is not level." /
     "No room to set it down there." / "Too far: move closer.").
   - **The prompt is not validated every frame.** The HUD shows "Set down" whenever a container
     is held and the aim hits something within reach; the ray, shape cast and overlap test run
     only on the key press, which then sets down or refuses. No per-frame shape cast.
   - Items **without** `container` keep the old drop, for compatibility with physics experiments
     and `grab.spec.ts`.
3. **Upright lock.** A `container` body that is not held gets
   `setEnabledRotations(false, true, false)`, so it can turn about y but not topple. It is
   unlocked while held. Effects:
   - a full flask hit by a thrown ball slides; it does not tip and does not spill (no spill
     science exists);
   - this is a physics decision from item data, with no id branching.
   - **Releases that are not a set-down** (`out-of-reach`, `InteractionSystem.ts:340`;
     `scene-change`, `:141-142`; `despawned`, `:135`) can happen mid-pour at 115°. Locking then
     would freeze that tilt for ever. The lock is therefore applied only when the body's tilt is
     under 2°. Otherwise the rotation stays free until the body sleeps, and then `PhysicsSystem`
     runs a short upright drive (the same capped angular drive) before locking. No liquid moves
     during it: only a held source pours (§2.6).
4. **Seats.** A seated object stays a dynamic body with its upright lock. The seat is recorded as
   entity state `seat = "<station entity>/<seat id>"`, written by the station when it accepts the
   set-down. Grabbing it again clears the state. That is guarded: a seated object whose step is
   locked is refused, for example the flask while the run is open. Reason: "Finish or clear the
   dilution first."
   - **Stale seats.** A seated flask can be knocked off its seat (a thrown ball makes it slide).
     When a seated body falls asleep, `StationSystem` checks that it is still within the seat's
     radius; if not, it clears `seat`, which re-gates the steps that need it.
   - **The pose driver is only for seats that never receive liquid** (the microscope stage, a
     clamp). Driven bodies are disabled and skipped by `castRay` (`PhysicsSystem.ts:500-503`), so
     a driven flask could not be poured into.
5. **Containers are not stowable.** They have no `inventory` block. Inventory has no liquid
   semantics.
6. **Containers are not throwable.** `physical.throwable` is false. LMB is therefore free while
   holding one, but it stays the throw binding.
7. **Station-bound containers stay in their lab.** Holding is released at every scene change
   (`InteractionSystem.ts:139-142`), and a re-attached scene respawns its entities at their
   placements (`World.ts:29-41`). A flask carried through a door would drop in the corridor yet
   still belong to the lab. Recommended: a door guard refuses passing a scene door while holding
   a container whose placement has `params.station` ("Leave the glassware in the lab."). Holding
   is also released when the player walks into a neighbour scene (`SceneEntered`), which no
   action guard sees; whether the chemistry and biology labs have such walk-through exits was
   **not checked**. Where they do, the container is returned to its placement pose on that
   release (contents kept). Decision 5.

**Input bindings.** Add one binding, `pour: ['Mouse2', 'KeyR']`, in `config.ts` with the other
`bindings`. `InputState.isHeld` exists (`InputState.ts:28`).

| Key             | Free hands            | Holding a container                                                                                              | Holding a stir tool                      |
| --------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| E               | grab / use target     | `withHeld` target action (fill pipette, deliver, …) **or** set down at the aim                                   | stir-target action none; set down / drop |
| F               | inspect / secondary   | the held item's own action: close / open stopper                                                                 | —                                        |
| RMB or R (hold) | —                     | tilt to pour (`trigger: tilt`), squeeze (`trigger: squeeze`); with a closed stopper: invert (target 165°, §2.10) | —                                        |
| Q               | take out of inventory | refused (not stowable)                                                                                           | stow if it has `inventory`               |
| LMB             | —                     | — (not throwable)                                                                                                | throw only if throwable                  |

"The held item's own action" (F while holding) is new. While holding, `InteractionSystem.availableAction` (`:362-370`) looks only at
`withHeld` actions on targets. Add `selfHeld: true` actions on the held entity, offered by F.
That is about 15 lines.

### 2.6 Pour detection and transfer per fixed step

`LiquidSystem` (gameplay) runs after `interaction` and before `experiments`, so a fed volume
reaches the run in the same frame. Its deps are `state`, `input`, `events`, `world`, `entityStates`,
`lineOfSight`, `stations` (refusal and notify) and `interaction` (held entity and guards).

Each frame it runs exactly as many sub-steps as **physics ran this frame** (`stepsLastFrame`,
`PhysicsSystem.ts:194`), each of `config.physics.fixedStep`. It keeps no accumulator of its own:
a separate one would diverge from physics whenever `maxSubSteps` (6) caps the step count below
10 fps, and the tilt it reads would then belong to a different step. For each sub-step:

1. **Source.** The held entity, if it has `container.pour` and `total > 0` and is not `closed`.
2. **Tilt.** Measured from the **held pose as physics wrote it back** (`entity.pose.rotation`):
   the angle between the item's +y and world +y. It is not the input value, so a bottle blocked
   by a wall does not pour. `trigger: "squeeze"` ignores tilt and uses `isHeld('pour')`.
3. **Spout.** `spoutWorld = pose.position + rotate(pose.rotation, pour.spout)`, written into a
   preallocated `Vec3`.
4. **Receiver query.** `lineOfSight.castRay(spoutWorld, down, maxDrop=0.5 m)`. It excludes the
   held body (`PhysicsSystem.ts:634-643`).
   - A hit `entityId` with a `container.mouth` is a candidate.
   - It is accepted only if the spout's horizontal distance to the receiver's world mouth centre
     is ≤ `mouth.captureRadius` (default `mouth.radius`). Position still matters inside it.
   - `squeeze` uses the **same downward ray from the spout** (the nozzle tip). The draft's wash
     bottle has "a bent nozzle over the flask's neck" (NOTES:129), so the tip is held over the
     receiver like any spout. One code path; the earlier "0.3 m along the nozzle" geometry was
     invented and is dropped.
   - **Aiming tolerance is unmeasured.** Flask necks are 4.5–7 mm in radius (`FLASKS`,
     `chemistry.ts:348-353`). Mouse sensitivity is 0.0025 rad per pixel (`config.ts:56`), about
     2.5 mm per pixel at the 1 m hold distance, and the hold drive lags by its 0.08 s time
     constant. That arithmetic suggests a 1–3 px target; it is not a measurement. The
     `captureRadius` value (AFFORDANCE) is fixed only after a manual player session measures
     time-to-hit (Decision 16). Thin items (pipettes) get a minimum pick-box padding for the
     same reason.
5. **Rules (asked once per source-receiver pair, not every step).** When the pair first forms,
   the system asks the guards with action `pour` on the receiver entity. This adds a
   `guardReason(entity, actionId)` on `InteractionSystem`, which already exists in effect as
   `blockedReason`, `:172-181`. `StationSystem`'s guard answers it (§2.8). A pour onto the run's
   vessel that **is** the run (dilution's water) is answered by `runBlock`
   (`StationSystem.ts:887-916`), not by a setup step (§2.9).
   - A refusal publishes `ActionBlocked` once for this pair and transfers nothing until the pair
     changes.
   - No pair (over the bench or floor) transfers nothing and gives no event. The HUD prompt reads
     "Hold it over a vessel to pour."
6. **Rate.** `rate = pour.rateMlPerS × clamp((tilt − minTilt)/(fullTilt − minTilt), 0, 1)`. The
   wanted volume per step is `rate·h·1000 + carry`, sent as `floor(...)` µL, with `carry`
   keeping the remainder (a float per active pour). The total over time T is `rate·T` to ±1 µL
   at any frame rate.
7. **Transfer: StationSystem commits.** LiquidSystem calls
   `stations.transfer(sourceId, receiverId, wantUl): number`, a direct call like the one
   `WorkspaceSystem` makes. In that one call `StationSystem` re-checks the rule, calls the pure
   `liquid.transfer(src, dst, want, dstLimit)`, marks the step and sets the material's parameter
   (§2.8), feeds a driven run (§2.9), and returns the µL moved. There is no two-phase "move, then
   publish `setup`" that the station could refuse after the liquid already moved. If the return
   is > 0, the pour is active (stream drawn). If it is 0 because the receiver is at its limit,
   the station publishes once `ActionBlocked {reason: "It is full to the mark."}` (EN). For a
   receiver without a mark the reason is "It is full.".
8. **End of pour.** When the pair breaks (tilt below minimum, moved away, released), the station
   publishes `LiquidPoured {from, to, volumeUl}` with that pour's total, for the HUD and the
   checklist. Steps do not depend on it: they were marked in the commit.

No allocation: the vectors, the active pair and the carry are fields, and no event is published
per step while pouring. Cost: one ray per sub-step, and only while holding a pouring container
above `minTilt`. "No allocation" is a design rule; unless the project gains a heap-sampling
harness it is checked by code review only and reported as **NOT TESTED**.

### 2.7 Discrete transfers (pipette, dropper): `withHeld` actions

These are the existing launcher pattern (`experiment/behaviors.ts:89-96`). The `container`
behaviour offers them on a target while a `measured` container is held:

- **"Fill the pipette to the mark ({v} mL)"** on a container holding liquid. It moves exactly
  `measured.volumeMl·1000` µL from the target to the held pipette. Refused if the pipette is not
  empty ("Empty the pipette first."), the target holds less ("There is not enough left in it."),
  or the guard refuses (§2.8).
- **"Deliver into the {name}"** on a receiver. It moves the pipette's whole contents. Refused if
  the receiver is `closed` ("Take the stopper out first.") or would pass its limit.
- Both go through the same `stations.transfer` commit as a pour (§2.6 item 7), so the rule check,
  the µL moved, the step and the parameter change in one call.

Pipette technique (filler, meniscus, tip drop) is spec map **SPEC GAP G10**. A delivery is exact
and leaves nothing behind. This matches the model's "glassware exact" limit (draft NOTES, Limits).

### 2.8 StationSystem stays the single rule authority

The valid-receiver rules are the **existing setup steps**: a transfer is valid only if it is the
next applicable step. The step vocabulary is the shipped one; one optional field is added (`by`,
below), which is a schema change and is stated as one.

- A `SetupStep` is `{place, onto, after, phase, when, locks, refusal}` (`experiment.ts:284-300`).
  `place` names a piece or a material; `onto` must name a **piece** (`experiment.ts:398-405`).
  Every parameter must be owned by exactly one piece (`:387`), and `pieces` is `.min(1)`
  (`:303`). The physical lab keeps all of that: **pieces are the step vocabulary**, and every
  physical item names its piece (and material) in its placement params (§2.3).
- **Mapping an action to a step.** `(source piece, source material, receiver piece)` selects the
  applicable step (`stepApplies`, `setupGate.ts:52`) whose `place` is the source's piece or its
  material and whose `onto` is the receiver's piece. A seat is a piece too (`tile`, `cuvette`).
  Where a step differs per material (different refusal or instruction text), the definition
  writes one step per material with `when`, exactly as shipped titration does (`fill-005`,
  `fill-01`, `fill-02`, `acid-base-titration.json:165-197`). Otherwise one piece-level step
  covers every material of that piece, and the material's `sets` gives the parameter.
- **New optional field `by`** (`'set-down' | 'transfer' | 'invert'`) says which physical action
  marks the step. It is needed only for actions with no receiver: an inversion has no `onto`
  object, so a `mix` step is written `{place: "flask", onto: "flask", by: "invert"}`. Content
  check: `by: "invert"` requires `place === onto` and a closable item bound to that piece.
  Without `by`, a step onto a seat piece is a set-down and a step onto a container piece is a
  transfer. This is the one schema change of the slice; the alternative is a new match-by-kind
  schema (Decision 1).
- `StationSystem.guard` (`:839-878`) gains these cases, all run through the pure `setupGate`:
  - `pour`, `fill`, `deliver`, `set-down` (on a seat) and `invert`;
  - the answer is `setupBlock` (`:966-…`), so the reason is the step's own localized `refusal`
    text from the definition (DEF);
  - a transfer that matches no applicable step is refused with
    `texts.ui('station.notThisStep', 'That is not part of this experiment.')`. This is spec §16:
    "Do not simulate arbitrary chemical combinations".
- **One commit.** `stations.transfer` and `stations.setDown` (called by the physical action, never
  by UI) re-check the guard, apply the material's `sets` through the same validation as the
  `set` command (`setBlock`, presets only), move the µL, and mark the step, in one call. Nothing
  is published for another system to re-validate.
- **The bus is closed for physical stations.** `ExperimentCommand {command: 'setup'}` and
  `{command: 'set'}` are accepted today from any publisher (the workspace controller publishes
  them, `platform/ui/workspace/controller.ts:94-95`). For a `physical-lab` station
  `StationSystem` refuses both from the bus, in addition to refusing `open-workspace` (§2.17). A
  UI path therefore cannot mark a step or set a material parameter. Dials that are physical
  controls (`adjust`, for example the colorimeter's resolution knob) are unchanged.
- **Unchanged:** `apparatus()` keeps returning `{}` for benches (`:1105-1111`), so model inputs
  have one path (§2.9).

### 2.9 Feeding the model: driven runs, so measured values come only from the model

**Problem.**

- Models take fixed inputs at `init` and advance by time (`SimulationModel.ts:12-18`).
- Dilution adds water at a fixed `fillTime` (draft NOTES).
- Titration stops itself at the endpoint (spec map D1).
- A physical pour sets the volume from the player instead.

**Proposed contract (additive).**

```ts
interface SimulationModel {
  …existing…
  /** Optional externally driven mode: the model's state at drive value `x` (e.g. volume, mL).
   *  Pure, no allocation; returns true when the model has reached its own end (e.g. V = V₂). */
  readonly driven?: { variable: string; set(state: Float64Array, inputs: Inputs, x: number): boolean };
}
```

- **Dilution** already has `derive(state, inputs, volume)` (`dilution.ts`). `set` calls it and
  returns `volume >= finalVolume`. That end condition is the model's own: "the step that reaches
  the mark lands on V₂ exactly".
- **Titration** exports `titrationPH(inputs, volume)` for any volume. Its `set` never ends by
  itself: the player finishes it (end reason `player`, §2.9). Overshoot is a mistake the spec
  lists under "# 21. ERROR / VALIDATION SYSTEM" (heading at spec line 1086, "overshooting
  titration" at line 1100; not "## 21 Onion epidermis") (D1, Decision 4).
- **Precipitation** is closed-form in volume (spec map §8.1).
- **How a driven run starts.** It is not a setup step. A setup step defaults to `before-run`
  (`experiment.ts:292`), and `pendingBeforeRun` (`setupGate.ts:18`) makes RUN wait for every
  before-run step, so a "water" step would make the run wait for itself. Instead, the first pour
  onto the run's vessel is guarded by `runBlock` (`StationSystem.ts:887-916`): it is refused with
  the pending before-run step's refusal text, the model's limits, or "Press RESET before the next
  run." exactly as RUN is. The first accepted µL starts the driven run inside the same
  `stations.transfer` commit.
- **The driven contract (`ExperimentRuntime`).** The runtime today ends a run in ways a
  player-paced run cannot survive: `maxDuration` ends it as `time-limit`
  (`ExperimentRuntime.ts:211-222`; the dilution draft has `maxDuration: 12` s, while filling a
  250 mL flask by hand takes longer); a step that advances 0 while the model is not done fails it
  ("made no progress", `:213-216`), which is every pause in pouring; and STOP leaves the session
  `'stopped'` (`ExperimentSession.ts:75-76`), while after-run steps need `'completed'`
  (`setupGate.ts`, `needs-run`). So, while driven:
  - no `step()` runs, there is **no time limit and no no-progress check**. Lab time only stamps
    samples;
  - `feed(x)` is called by `StationSystem` inside `transfer`. It records a sample at
    `sampleInterval` of lab time with the last fed value;
  - the run **completes** when `set` returns true (end reason `'model'`, dilution at V₂), or when
    the player finishes it with a physical action (close the burette tap and press "Record the
    reading", titration): a new end reason **`'player'`**, status `'completed'`, results read at
    the last fed value. STOP keeps its current meaning (`'stopped'`, no readings);
  - `'player'` is added to `ExperimentEndReason` (`ExperimentRuntime.ts:7`), to the run-history
    store's validation (`persistence/runHistory.ts:31`, `z.enum(['model', 'time-limit'])`, which
    would otherwise reject the record) and to the texts that name end reasons (`Hud.ts`,
    `ResultsPanel.ts`, `analysis.ts` mention `time-limit`). `RunRecord` gets the reason as it
    does today;
  - unit tests: a pause longer than `maxDuration` does not end the run; no feed for N steps does
    not fail it; finish gives `'completed'` and the readings appear; a run-history record with
    `'player'` round-trips.
  - Dilution needs only the first two points (no time limit, no no-progress check), because it
    completes by the model at V₂. Titration needs all of them.
- **`fillTime` means nothing in driven mode.** The draft's `fillTime` (10 s) paces the 2D replay.
  In the physical version it is not shown on any surface (instruction board, HUD, procedure,
  notebook) and is not presented as a measured or chosen value.
- **Model inputs have one path.** Parameters come only through the validated `set` (applied
  inside the commit, §2.8): validated against presets, saved as `param.*`, mirrored to dials and
  the HUD. `apparatus()` keeps returning `{}` for benches, because `inputs()` lets apparatus values
  silently override parameters (`ExperimentSession.ts:194-196`), and two paths could disagree
  (for example a saved `param.finalVolume` from an earlier choice while another flask is seated).
  The content check of §2.3 keeps the item's `fillLimitMl` and `measured.volumeMl` equal to the
  material's `sets.value`, so the drawing matches the parameter.
- **The flask's colour** during the fill is the run's sample (`concentration`), never computed
  in the view from contents. Before the run (stock only), the view uses the stock material's
  `sets` value with the same mapping the draft rig uses ("tint from `parameters.stockConcentration`").

### 2.10 Stirring and mixing

- **StirTool.**
  - **Tip-in-liquid test (pure geometry, no physics contact).** Each step while the tool is held:
    `tipWorld` must be inside a container's inner profile **and** below its liquid level. The
    level comes from `levelIn` over the item's `profile` and current volume.
  - **Speed.** The speed comes from successive `tipWorld` (preallocated).
  - **Mixed.** While inside with speed > `v_min`, `stirSeconds` accumulates. At `t_mix` it sets
    `mixed = true`.
  - **Collision.** A held stir tool is in a `STIR` collision group that excludes container
    bodies. A solid cylinder collider would otherwise stop the rod at the rim.
  - **Values.** `v_min` and `t_mix` are **AFFORDANCE** values (pacing). No model reads them.
    Decision 12.
- **Inversion (stoppered glassware).** Holding `pour` on a `closed` container tilts it towards
  165°, not 180°: at π the axis-angle drive's axis is singular and flips. The tilt passes 150°
  and returns below 30°, which counts one inversion and sets `mixed = true` (written by
  `StationSystem` through `stations.invert(entityId)`, which also marks a `by: "invert"` step).
  DEF backs this for dilution: "stoppered and inverted". The number of inversions is a **SPEC
  GAP**, so one inversion counts.
- **What `mixed` does.** Only what a definition says.
  - No current model reads it (spec map §8.3), so it is never a model input and never starts a
    reaction.
  - It can gate a step (`after: ['mix']`), through the `mix` step, never through a rule in code.
  - Random stirring of anything else changes only `mixed` on that container.
  - **No visual consequence under the dilution model.** The model takes the solution as mixed at
    every moment (`dilution.ts:96-101`), so mixing changes no colour and no number. What the
    player sees is the stopper, the inversion motion, and the next step (the cuvette) unlocking.
  - Pouring a new material into a mixed container sets `mixed = false`.

### 2.11 Heating

- **Seat.** A hot plate is a static item with a seat `{heats: true}`.
- **Run inputs.** Setting a container down on it is a guarded set-down. Once the step is done,
  `StationSystem` builds `heating.ts` inputs from the seated container:
  - `mass`: the contents mass. This needs a density or mass in the material data; heating's ice
    is weighed, which is **SPEC GAP G18**, so no density is invented;
  - `startTemperature`: the container's `temperatureC`;
  - `power`: the plate's setting (a preset dial, as now).
- **Temperature.** The container's `temperatureC` is written **only** by `StationSystem`, from the
  run's `temperature` variable while the run exists. On RESET it returns to its placement value.
  There is no thermal coupling between objects, because no model has one.
- **No cooling is a SPEC DEVIATION.** The spec's "## 15. Temperature effects" (spec line 608)
  says "Allow controlled heating/cooling". The shipped heating model has no cooling (spec map
  D2). The physical lab does not invent cooling; it inherits the model's deviation, which stays
  labelled as such until a cooling model exists.

### 2.12 Measuring

Readings stay what they are:

- an instrument reading of a completed run's result (`measurement.ts`), revealed by an after-run
  step;
- the colorimeter reads after the cuvette step;
- glassware levels are drawn from state.

The HUD never prints a container's exact µL. A graduated vessel's reading, if a definition asks
for one, is an instrument with a resolution d (the nearest multiple of d, u = d/√12). The debug
panel (dev only) prints µL, without hidden concentrations (§2.16).

### 2.13 Rendering from state (platform)

- **`ContainerView`** (new, `src/platform/render/ContainerView.ts`) is attached to each entity
  view whose item has `container`.
  - **Geometry built once and shared.** One glass lathe and one inner (liquid) lathe per
    `profile`, built on first use and shared by every item with that profile. No geometry is
    created or rebuilt while pouring.
  - **Level as a world-space plane.** The liquid is the inner lathe clipped by a horizontal plane
    in world space: a uniform at height `levelIn(profile, held, ml)` (now in `liquid.ts`, with a
    preallocated `out`), transformed to world each frame. The surface stays horizontal while the
    glass tilts, instead of looking glued to the bottle. The profile is item data, so the drawn
    mark matches `fillLimitMl` exactly.
  - **Limit, stated honestly.** `levelIn` maps volume to height for an **upright** vessel. While
    a container is tilted, the drawn level is an approximation (the upright height, measured
    along the vessel axis); it is a drawing only, it never feeds a number, and the unit test
    asserts exactness only for the upright case.
  - **Colour.** From a registered appearance per model (`appearances[modelId](sample, material)`).
    This is the same idea as `BENCH_MODELS`, a lookup by key, never by entity id.
  - **Updates by polling a version.** The view keeps the last `version` it drew from
    `liquids.view(entityId)` and updates uniforms only when it changes. No events per frame.
  - **Cost.** About two transparent draws per container (glass, liquid): about 26 in the slice.
    The render track receives a Low-tier glass and liquid variant to build, and a draw-call
    budget per lab to hold to (`docs/render-quality-audit.md`).
- **Stream.** One shared stream mesh for the active pour, from `spoutWorld` to the ray hit
  distance. It reuses `water.ts`'s shader. It is drawn only while the last commit moved liquid.
- **Held pose.** The held body's position is blended in the view frame today; its rotation is
  **not** (`PhysicsSystem.ts:357`). §2.5 item 1 adds rotation blending in the same frame; until
  that lands, tilting would visibly step on the 300 Hz display.
- **One mapping.** Level and colour use the same pure functions as the tests (as `toWorld` is
  shared for projectiles). A unit test asserts that the drawn level for V equals the analytic
  inner volume, and that no geometry is created after the first frame.

### 2.14 Events (`src/game/GameEvents.ts`)

Add the following. Subscriptions are released in `dispose()` through `Disposables`.

- `LiquidPoured {from, to, volumeUl}`, once per pour (at its end), never per step;
- no `ContainerChanged` event: views poll the `version` of `liquids.view` (§2.13), so a pour
  publishes nothing per frame;
- `ObjectSetDown {entityId, seat?}`;
- `ObjectReleased.reason` gains `'set-down'`.

### 2.15 Save format: v4

The contents need **typed** validation and a sanitize step, exactly like the inventory in v3
(`docs/persistence.md`). The recommendation is therefore a version bump, not stuffing JSON into
entity states.

```
SaveData (version 4)
world.objects:    Record<entityId, { position: Vec3, rotation: Quat }>   // containers only, the entity's own scene frame
world.containers: Record<entityId, { contents: Record<materialId, intUl>, temperatureC, closed, mixed }>
```

- **Scope: containers only.** Poses are saved only for items with `container` (or a future
  explicit `persistPose` flag). Saving every moved dynamic item would restore physics-lab balls
  away from their placements, a behaviour change for shipped experiments that could also
  conflict with a launcher's `loaded` restore.
- **Captured at save time** from `entity.pose`, a one-off per save. An earlier draft wrote poses
  when a body fell asleep, which misses bodies that never sleep and saves taken during the
  settle window.
- **Applied at spawn, not only on Continue.** A re-attached scene respawns its entities at their
  placements (`World.ts:29-41`). `world.objects` is read whenever an entity spawns, so a flask
  moved on the bench is still there on the next visit, matching its contents (which are keyed by
  id and persist). Coordinates are in the entity's own scene frame.

- **Migration v3 to v4.** Add `objects: {}` and `containers: {}`. Test: a v3 fixture goes to v4,
  v1 goes to v4 through v2 and v3, and a v4 save round-trips.
- **Sanitize on Continue** (as `InventorySystem.sanitize`), warning once per problem:
  - a pose outside its room or inside a solid returns to its placement (reuse the `continuePose`
    checks);
  - a container entry whose material is not in its station's definition, or whose total exceeds
    `capacityMl`, resets to the placement `fill`;
  - integers are enforced.
- **Not saved:**
  - held state and tilt (holding never crosses saves: `hold.test.ts:321`);
  - the active pour, stream and carry;
  - stir seconds;
  - runs and history (IndexedDB, unchanged).
- **Run lost on Continue.** A run that was open, for example a half-filled dilution, is lost.
  The station then refuses further filling with "The unfinished dilution was not saved: clear
  the bench to start again." It never resumes a run it cannot reproduce.
- **Recovery is `clear`, not RESET.** RESET is refused when there is no run ("There is no run to
  reset.", `StationSystem.ts:612`), and after Continue there is never a run, so "press RESET"
  would be a dead end. The existing `clear` command (`StationSystem.ts:621-624`, `clearSetup` at
  `:805-812`) is allowed whenever nothing runs; it empties the setup. For a `physical-lab`
  station it also restocks the station's containers to their placement `fill` and returns them
  to their placement poses through `PoseDriver`. It is offered by a physical "Clear the bench"
  control (`experiment-control`, `command: "clear"`; the behaviour's enum is today
  `['run', 'stop', 'reset']`, `experiment/behaviors.ts:152`, so `clear` is added there). The
  refusal text names that control. RESET keeps its current meaning for every
  presentation (discard the run, keep the setup), so no shipped wave-2 workspace or its e2e
  changes.

### 2.16 Hidden values (titration c_a = 0.085 mol/L)

- **Contents store material ids and volumes only.** The HCl container holds `{ "hcl": 25000 }`,
  keeping the shipped material id `hcl`. Its concentration is the experiment's **hidden initial
  condition** (`acid-base-titration.json:423`), read only where the session builds the run's
  inputs when a run starts. It never enters item data, placement params, container state, save
  JSON, view snapshots or debug output.
- **Labels come from the material's `label`.** DEF: "HCl solution" (`acid-base-titration.json:82`).
- **Content-time check.** The `secret()` check extended to physical bindings (§2.3).
- **Test: structured fields, not raw text.** A raw-text scan for "0.085" would match float poses
  in the save (`10.0853`), and the shipped `acid-concentration` result is an **answer** the
  student works out, close to c_a when titrated well, so a scan of the results after the run
  fails for a legitimate reason. The test therefore:
  - collects structured string fields: material and item labels, `inspect` text, HUD prompts,
    toasts, inventory entries, `liquids.view` keys and values, placement params, debug-panel
    lines, and every displayed run input;
  - runs **before** any answer is revealed (before the run completes);
  - asserts that the key `acidConcentration` and its value appear in none of them and in no
    key or string value of the save JSON (numbers in poses are not scanned).
- **Known limit.** The number is in the definition JSON, which ships in a lazy chunk, so a
  student reading the bundle can find it. "Hidden" means not on any surface, not secret.

### 2.17 Coexistence with the wave-2 workspaces

- **New presentation value: `physical-lab`.**
  - `workspace` stays **required and used** for its `pieces`, `materials` and `setup` data.
  - `pieces` stay required (`.min(1)`), and every parameter stays owned by one piece. In the
    physical lab a piece is a kind of physical object (flask, pipette, tile, colorimeter); its
    `slot` and `kind` are not drawn by anything. Keeping pieces keeps the step vocabulary and the
    static `secret()` check (§2.3, §2.8).
  - `open-workspace` is refused for it, as for `physical-3d`, and bus `setup` and `set`
    commands are refused too (§2.8), so there is never a second input path into the same
    session.
- **Migration per experiment** is a data change:
  - `presentation: "2d-workspace"` → `"physical-lab"`;
  - the physical placements are added;
  - the `open-workspace` behaviour is removed from its apparatus.

  It is reversible by reverting that data.

- **Workspace code stays.** `WorkspaceSystem`, `src/platform/ui/workspace/*` and the 2D pieces
  stay untouched and keep serving every experiment not migrated yet.
- **Physics experiments** (`physical-3d`) are untouched. The new holding behaviours apply only to
  items with `container`, `stirTool` or `seats`.

### 2.18 Stability and performance

- **Determinism.** The pour, stir and drive run in fixed steps, so behaviour at 10 fps matches
  behaviour at 300 fps. Physics catch-up is capped as now.
- **Thin glass.** Pipettes are 6–15 mm wide and slides about 1 mm thick, so `physical.ccd: true`
  is set on such items.
- **Rotation is not swept.** Only the hold point is swept (`PhysicsSystem.ts:940-962`), so
  rotation could push glass into the bench edge. Mitigations:
  - the angular speed cap (§2.5);
  - the contact solver;
  - a test that tilts against the bench edge (§4).
- **Interaction scan.** The targeting scan is linear (`InteractionSystem.ts:486`). Twenty to
  forty extra small items in the chemistry lab are fine. A spatial index waits until there are
  thousands.
- **Cabinet doors versus glass.** `HingeSystem` holds a leaf only for the player
  (`HingeSystem.ts`, class comment). A kinematic leaf closing on a bottle that sticks out would
  shove thin glass. A close request is therefore refused while `dynamicBodyIn` the leaf's swing
  (`PhysicsSystem.ts:553`) finds a body, with a reason ("Something is in the way of the door.").
- **Spawn at rest.** Thirteen dynamic items on carcass shelves must be shown to spawn at rest:
  a test asserts each lab dynamic item is asleep within N steps of spawning and has moved less
  than 1 mm, and that every cabinet item can be grabbed out from the standing spot without an
  `out-of-reach` release.
- **Pipettes need a rack or stand upright.** Placements are yaw-only (`World.ts:40`), and
  shapes are box, cylinder or sphere. The draft's "pipette lying on a small rack" (NOTES:126)
  needs a static rack with seats (the seat pose sets the lying orientation); otherwise pipettes
  stand upright in a static stand. Either is a static item with seats, no new pose format.
- **Menu JS guard.** The latest measured menu chunk is 413,511 B
  (`...\scratchpad\labs\w2-build.txt`) against the 500,000 B guard
  (`e2e/renderer.production.spec.ts:29`). `LiquidSystem`, the pour helpers, `liquid.ts`, the
  set-down code and the new schemas live in `gameplay`/`game`/`simulation` and would land in the
  menu chunk. The slice measures the menu bytes after the change and records them in the phase
  report. If the chunk nears the guard, `LiquidSystem` is built from the lab pack through
  `import()`, as the models are. The guard is never removed or raised.

---

## 3. Vertical slice: dilution (spec §12)

The spec map's recommendation holds after checking:

- §12 is SPEC: "choose stock solution; choose volume; add solvent; C1V1 = C2V2; show resulting
  concentration";
- the model (`src/simulation/models/dilution.ts`) has a conserved `amount` to test against;
- there is no hidden value and no heating.

The slice ships `dilution` as `physical-lab`, its first presentation. It is not shipped today, so
nothing is migrated away.

### 3.1 Prerequisites (data, from the drafts; the Lead or Chemistry agent owns these)

- Register `dilutionModel` in `BUILT_IN_MODELS`.
- Copy the draft definition to `src/content/experiments/dilution.json`, with
  `presentation: "physical-lab"`.
- Add a `workspace` block made **only** of D5's pieces, materials and steps (DEF), in the shipped
  schema plus the one `by` field (§2.8):

  | Kind                | Ids                                                 | Owns / sets                      |
  | ------------------- | --------------------------------------------------- | -------------------------------- |
  | Piece               | `stock-bottle`                                      | owns `stockConcentration`        |
  | Piece               | `pipette`                                           | owns `stockVolume`               |
  | Piece               | `flask`                                             | owns `finalVolume`               |
  | Piece               | `wash-bottle`                                       | —                                |
  | Piece               | `tile` (a seat)                                     | —                                |
  | Piece               | `colorimeter` (with the `cuvette` receiver)         | owns `concentrationResolution`   |
  | Piece               | `cuvette` (a receiver on the colorimeter)           | —                                |
  | Materials: stock    | `stock-5`, `stock-10`, `stock-20`, `stock-40`       | set `stockConcentration` presets |
  | Materials: pipettes | `pipette-1`, `pipette-2`, `pipette-5`, `pipette-10` | set `stockVolume`                |
  | Materials: flasks   | `flask-25`, `flask-50`, `flask-100`, `flask-250`    | set `finalVolume`                |
  | Material: solvent   | `water`                                             | —                                |

  The four parameters are those of the draft (`definition.json`: `stockConcentration`,
  `stockVolume`, `finalVolume`, `concentrationResolution`), each owned by exactly one piece.

  Steps (all piece-level: one step covers every material of that piece, and the material's
  `sets` gives the value):

  | #   | Step       | place → onto               | By                 | Phase      | Locks                               | After               |
  | --- | ---------- | -------------------------- | ------------------ | ---------- | ----------------------------------- | ------------------- |
  | 1   | `flask`    | `flask` → `tile`           | set-down           | before-run | `finalVolume`                       | —                   |
  | 2   | `aspirate` | `stock-bottle` → `pipette` | transfer (fill)    | before-run | `stockConcentration`, `stockVolume` | —                   |
  | 3   | `dispense` | `pipette` → `flask`        | transfer (deliver) | before-run | —                                   | `flask`, `aspirate` |
  | 4   | `mix`      | `flask` → `flask`          | invert             | after-run  | —                                   | —                   |
  | 5   | `cuvette`  | `flask` → `cuvette`        | transfer (pour)    | after-run  | —                                   | `mix`               |
  - **The water is not a step.** Adding water is the driven run itself. The first accepted µL from
    the wash bottle onto the flask starts the run, guarded by `runBlock` (§2.9). A before-run
    "water" step would deadlock, because RUN waits for every before-run step.
  - This splits D5's single after-run step "Stopper, invert, fill cuvette" into `mix` and
    `cuvette`. Both halves are DEF.
  - Each step's `refusal` text, EN and VI, is written in the definition.
  - **Draft parts rewritten for the physical flow (EN and VI).** The draft's guided `procedure`
    ("with its dial", "Press RUN", `done: adjusted`) and the instruction board describe the 2D
    flow; both are rewritten for the physical actions. `fillTime` appears on no surface (§2.9).

- **A "Clear the bench" control** (`experiment-control`, `command: "clear"`) on the bench (§2.15).
- The topic `solutions` comes from the draft NOTES.

### 3.2 Items (only DEF apparatus; masses are physics-only)

| Item (new unless noted)                                                               | Count                       | Body                                                              | Capabilities                                                                                     | Source                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chem-reagent-cabinet` (hinged, shelves as `carcass` boxes, new prop)                 | 1                           | static; leaves kinematic (HingeSystem)                            | `openable`, `inspect`                                                                            | **User direction**, not spec (G1). Built on the wardrobe pattern (`core-items.json:56-97`). Holds only the items below.                                                                                                                                                                                                                                              |
| Crystal violet stock bottle                                                           | 4 (5 / 10 / 20 / 40 µmol/L) | dynamic, upright-locked                                           | `container` (pour **not** given: the DEF never pours stock; a pipette draws from it), `closable` | DEF "stock bottle whose label shows C₁" (0.07 Ø × 0.14 m, NOTES:124); the label text is the material label. The fill volume is **not DEF**: an AFFORDANCE bookkeeping volume (§2.3, Decision 15)                                                                                                                                                                     |
| Volumetric flask with ring mark and ground-glass stopper                              | 4 (25 / 50 / 100 / 250 mL)  | dynamic, upright-locked, CCD                                      | `container` (`fillLimitMl` = nominal, `profile` from `FLASKS`, `mouth`, `pour` tilt), `closable` | DEF; sizes from draft NOTES                                                                                                                                                                                                                                                                                                                                          |
| Volumetric pipette (with filler, one tool)                                            | 4 (1 / 2 / 5 / 10 mL)       | dynamic, CCD                                                      | `container.measured`                                                                             | DEF; filler technique is G10                                                                                                                                                                                                                                                                                                                                         |
| Pipette rack                                                                          | 1                           | static, `colliders`, 4 seats                                      | `seats` (each seat's pose lays a pipette on the rack)                                            | DEF "lying on a small rack" (NOTES:126); placements are yaw-only, so the lying pose comes from the seat                                                                                                                                                                                                                                                              |
| Wash bottle, distilled water                                                          | 1                           | dynamic, upright-locked                                           | `container.pour {trigger: "squeeze"}` (spout = nozzle tip)                                       | DEF "wash bottle of distilled water", "a bent nozzle over the flask's neck" (NOTES:129). Its volume is **not DEF**: AFFORDANCE bookkeeping (Decision 15)                                                                                                                                                                                                             |
| Dilution bench apparatus: white tile seat + colorimeter (590 nm, cuvette in the slot) | 1                           | static (`bench`), `colliders` boxes so the tile is a real surface | `seats: tile`; a **receiver-only** `container` for the cuvette (no `pour`, no `grab`, §2.2)      | DEF (cuvette 12.5 mm square, NOTES:135). The cuvette's capacity is **not DEF**: AFFORDANCE bookkeeping (Decision 15). The frame reuses the `colorimeter.ts` builder (draft NOTES says "export a builder … do not copy"). A new bench key `dilution-colorimeter`, because `dilution-station`'s rig draws the glassware itself from dials and must not be drawn twice. |
| Colorimeter resolution knob (`parameter-dial`, `concentrationResolution`)             | 1                           | static                                                            | existing behaviour                                                                               | DEF dial                                                                                                                                                                                                                                                                                                                                                             |
| RESET control (`experiment-control`, `command: "reset"`)                              | 1                           | static                                                            | existing; unchanged meaning (discard the run, keep the setup)                                    | spec §6 J "Reset"                                                                                                                                                                                                                                                                                                                                                    |
| "Clear the bench" control (`experiment-control`, `command: "clear"`)                  | 1                           | static                                                            | existing `clear` command; the behaviour's enum gains `clear`                                     | restock and return poses are an AFFORDANCE (§2.15)                                                                                                                                                                                                                                                                                                                   |
| Results monitor, instruction board                                                    | 1 each                      | static                                                            | existing `results-display`; draft `dilution-instructions` (text rewritten for the physical flow) | DEF                                                                                                                                                                                                                                                                                                                                                                  |

Masses are a physics value only; no model reads them. Use glass masses written in the item with
the comment "physics only". **SPEC GAP:** no definition gives them.

### 3.3 Player flow

| #   | Player does (input)                                                                              | Physics                                                                                                                                                      | Player sees                                                                                                                                                                                                                                                                     | Refused with (EN; VI in `strings.json` or the definition)                                                                                                                                                                                                                                     | Backing                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Walk to the chemistry lab through its door (WASD, E at doors)                                    | —                                                                                                                                                            | Lab                                                                                                                                                                                                                                                                             | —                                                                                                                                                                                                                                                                                             | existing                                                                                                                 |
| 2   | Aim at the cabinet, **E** "Open"                                                                 | leaves kinematic, swing 0.5 s                                                                                                                                | Doors swing; bottles, flasks, pipettes and wash bottle on shelves                                                                                                                                                                                                               | "Step back to open it." (existing, `behaviors.ts:113-115`)                                                                                                                                                                                                                                    | AFFORDANCE (G1)                                                                                                          |
| 3   | Aim at "Crystal violet 20.0 µmol/L", **E** "Grab"                                                | grab: gravity off, HELD group, upright drive                                                                                                                 | Bottle in hand, upright                                                                                                                                                                                                                                                         | (closed cabinet: not targetable, hidden by the leaf ray)                                                                                                                                                                                                                                      | SPEC "choose stock solution"                                                                                             |
| 4   | Aim at the bench top beside the colorimeter, **E** "Set down"                                    | `setDown`: aim ray, level check, shape cast, overlap test, drive, release at rest, upright lock                                                              | Bottle stands where aimed                                                                                                                                                                                                                                                       | "Nothing to set it down on here." / "That surface is not level." / "No room to set it down there."                                                                                                                                                                                            | AFFORDANCE                                                                                                               |
| 5   | Grab the 50 mL flask, aim at the white tile, **E** "Put on the tile"                             | set-down into seat `tile`                                                                                                                                    | Flask on the tile; `finalVolume` = 50 (locked)                                                                                                                                                                                                                                  | Not the next step: step refusal text. Wrong item on the seat: "That does not go on the tile."                                                                                                                                                                                                 | DEF (step 1, `flask`)                                                                                                    |
| 6   | Grab the 5 mL pipette, aim at the stock bottle, **E** "Fill the pipette to the mark (5 mL)"      | none (a discrete transfer)                                                                                                                                   | Pipette liquid to its mark; bottle level drops 5 mL; `stockConcentration` = 20 µmol/L, `stockVolume` = 5 (locked)                                                                                                                                                               | Bottle closed: "Take the cap off first." Pipette not empty: "Empty the pipette first." Not enough left: "There is not enough left in it."                                                                                                                                                     | SPEC "choose volume"; DEF `aspirate`                                                                                     |
| 7   | Aim at the flask, **E** "Deliver into the volumetric flask"                                      | —                                                                                                                                                            | Flask holds 5 mL of violet (tint from the material's C₁)                                                                                                                                                                                                                        | Flask stoppered: "Take the stopper out first." Before the `flask` step (flow step 5): that step's refusal text                                                                                                                                                                                | DEF `dispense`                                                                                                           |
| 8   | Set the pipette down (**E** on the bench)                                                        | set-down                                                                                                                                                     | —                                                                                                                                                                                                                                                                               | as step 4                                                                                                                                                                                                                                                                                     | AFFORDANCE                                                                                                               |
| 9   | Grab the wash bottle; hold the nozzle tip over the flask neck; **hold RMB or R** (squeeze)       | downward ray from the nozzle tip hits the flask, capture-radius check                                                                                        | Thin stream; the flask level rises; violet fades **from the run's `concentration`**. The driven run starts at the first accepted µL (guarded by `runBlock`), inputs C₁ 20 µmol/L, V₁ 5, V₂ 50 from the saved parameters. Pausing the squeeze pauses the run; it never times out | Over the bench: nothing flows, prompt "Hold it over a vessel to pour." A before-run step missing: that step's refusal. Wrong receiver (stock bottle): "That is not part of this experiment." At the mark: the stream stops, the run completes (end reason `model`), "It is full to the mark." | SPEC "add solvent"; DEF (D5's RUN "Add water to the mark"), not a setup step                                             |
| 10  | Set the wash bottle down. Aim at the flask; **F** "Stopper the flask"                            | — (entity state `closed`)                                                                                                                                    | Stopper on                                                                                                                                                                                                                                                                      | —                                                                                                                                                                                                                                                                                             | DEF "stoppered"                                                                                                          |
| 11  | Grab the flask; **hold RMB** (inverts, because it is closed); release                            | orientation drive to 165° and back; no flow (closed)                                                                                                         | Flask turns over and back; `mixed` = true, step `mix` (`by: invert`) done. **No colour change**: the model is mixed at every moment                                                                                                                                             | Inversion before the run completed: the `mix` step's refusal ("Fill to the mark first.", written in the definition)                                                                                                                                                                           | DEF "inverted"; procedure gate only. **The model's numbers do not change.** This is the slice's mixing step (Decision 6) |
| 12  | **F** "Remove the stopper"; aim at the colorimeter's cuvette; **hold RMB** to tilt-pour a sample | tilt pour: spout ray hits the cuvette receiver                                                                                                               | Cuvette fills (to its limit); the colorimeter shows A and C₂ (reading at d)                                                                                                                                                                                                     | Before `mix`: the `cuvette` step's refusal text (one refusal, from the definition)                                                                                                                                                                                                            | DEF "a sample is read". The **pour method is a SPEC GAP** (Decision 7). The volume moved has no effect on the reading.   |
| 13  | Set the flask back on the tile; read the results monitor (**E**)                                 | —                                                                                                                                                            | C₂ against C₁V₁/V₂, A class, dilution factor, n constant                                                                                                                                                                                                                        | —                                                                                                                                                                                                                                                                                             | existing results                                                                                                         |
| 14  | **E** "Clear the bench" (the existing `clear` command)                                           | `PoseDriver` returns the station's containers to their placements at rest; containers back to placement `fill`; the run (if any) is discarded, setup cleared | Clean bench, full bottles                                                                                                                                                                                                                                                       | Running: "Stop the run before clearing the bench." (existing, `StationSystem.ts:621-624`)                                                                                                                                                                                                     | spec §6 J; the restock is an AFFORDANCE. RESET keeps its meaning (discard the run, keep the setup)                       |

**Spec-backed steps:** 3, 6, 9 and 13 (C₁V₁ = C₂V₂, "show resulting concentration").

**DEF-backed steps:** 5, 7, 10, 11 and 12 (reading).

**Affordances with no scientific consequence:**

- the cabinet (2);
- free set-downs (4, 8);
- the inversion (11), which only gates the reading;
- the sample's volume in the cuvette (12);
- the restock on clear (14).

**Stir with a rod** does not appear: dilution has none (spec map: "Stir with a rod: NONE"). The
user's slice asks for "stir → state/visual response". No experiment in spec §10–17 has a
spec-backed stir with a consequence the slice could show, so the slice uses the DEF inversion as
its mixing step: the stopper and the inversion motion are visible, `mixed` changes, and the
cuvette step unlocks; under the model, mixing changes no colour and no number (Decision 6). The
`stirTool` capability is used by no slice item; whether it is built in the slice is Decision 6.

### 3.4 Save contents after step 9 (mid-fill), then Continue

- **Saved:**
  - `world.objects` holds the poses of the bottle, pipette, wash bottle and flask (containers
    only; captured at save time);
  - `world.containers` holds `stock-20` at its bookkeeping fill minus 5,000 µL (for an
    illustrative 125 mL fill: 120,000 µL; the fill is not DEF, Decision 15), the pipette at 0, the
    flask at `{stock-20: 5000, water: 21000}`, and the wash bottle reduced by 21,000;
  - entity states hold `param.*`, `setup.flask/aspirate/dispense = true`, the cabinet's
    `open = true` and the flask's `seat`.
- **Not saved:** the run (by rule).
- **On Continue:** the flask shows 26 mL. The station refuses more water ("The unfinished
  dilution was not saved: clear the bench to start again."). RESET is refused as today ("There
  is no run to reset."). "Clear the bench" restocks and returns the containers, and a new run is
  then possible.

---

## 4. Test plan

### 4.1 Unit (pure, `vitest`)

- **`simulation/liquid.test.ts`**
  - `transfer` with a single material: `src' + dst' === src + dst` and `src' === src − t`,
    `dst' === dst + t` (exact `===`, integers).
  - Limit clamp; empty source moves 0; NaN, negative or fractional µL is refused (throws).
  - Multi-material split: each material is conserved exactly. Largest-remainder determinism:
    same input, same output.
  - A seeded 10,000-transfer random walk across 5 containers keeps the grand total and every
    material's total constant.
  - `transfer` has no `mixed` rule: a multi-material source splits by largest remainder whatever
    its flags (rules are the steps').
  - `levelIn` / `heldBelow` give the same numbers after the move from `platform` (the existing
    `chemistry.ts` tests keep passing against the re-import).
- **Pour geometry (pure helpers in `gameplay/lab/pour.ts`)**
  - Tilt from a quaternion.
  - The spout's world position.
  - The capture-radius test.
  - Rate in [0, max] and monotonic in tilt.
  - **Exact conservation** (`===`, integers) for every step sequence, tested separately from the
    **rate**: for a whole number of physics steps the carry gives `round(rate·T·1000)` ± 1 µL.
    Across frame rates the total for the same wall-clock hold differs by at most one frame of
    `isHeld` sampling (about 0.27 mL at 8 mL/s and 30 fps); the test asserts that bound, not
    equality.
- **Driven runtime**
  - A pause longer than `maxDuration` does not end a driven run; no feed for N steps does not
    fail it.
  - A player finish gives `'completed'` with end reason `'player'`, and after-run steps then
    apply.
  - A run-history record with `'player'` round-trips through `runHistory.ts`.
- **Driven models**
  - `dilution.driven.set` at V₂ gives a state bit-equal to `predict` and returns true; at
    V₁ < V < V₂ it returns false; `amount` is constant.
  - `titration.driven.set` past the endpoint keeps returning pH from `titrationPH` and never ends
    by itself (Decision 4); it completes only by the player's finish.
- **Content checks**
  - The `container` block rules (§2.2), including receiver-only containers on static items and
    seats on `colliders` tops.
  - A `piece` or `material` not in the station's definition is rejected.
  - `fillLimitMl` and `measured.volumeMl` differ from the material's `sets.value`: rejected.
  - A `by: "invert"` step whose `place` differs from `onto`: rejected.
  - The extended `secret()` check rejects a physical binding that names a hidden input or answer.
  - Every new text has VI.
- **Level mapping**
  - The drawn level for V equals the inner volume of the `profile` (as `chemistry.ts` already
    does), for an upright vessel.
  - The mark ring is at `fillLimitMl`.
  - No geometry is created after the first frame (the shared lathes; the level is a uniform).
- **Held render pose**
  - `renderPose` with 1/300 s frame dts while the drive turns the held body: the drawn rotation
    changes monotonically every frame and never stands still for several frames then jumps.

### 4.2 Game-level integration (real Rapier, the `hold.test.ts` style)

Each case below is its own test. The first column gives a test name.

| Test                                   | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pickup and release                     | Grab a container: it is upright and follows yaw. Tilt input: the body's measured tilt reaches `fullTiltDeg` within the time the 4 rad/s cap allows (about 0.65 s for 115°; the bound is computed from the cap in the test) and returns to < 2° after release.                                                                                                                                                                                                                              |
| Placement                              | Set-down on a level bench: rests within 5 mm of the aim point, upright, asleep. Set-down at a wall: refused (`no-surface` or `no-room`), still held. Onto each seat of the slice (tile, rack): snapped to the seat centre ± 2 mm. Wrong item on a seat: `ActionBlocked` with the reason. Onto another flask (a dynamic body): refused. At the player's feet: refused (`no-room`, the capsule is in the overlap test).                                                                      |
| Upright lock                           | Throw the steel ball at a full flask: the flask may slide, its tilt stays < 1°, its contents are unchanged.                                                                                                                                                                                                                                                                                                                                                                                |
| Release mid-pour                       | Force an `out-of-reach` release at full tilt: the container ends upright within N steps, then locks. No liquid moves after the release.                                                                                                                                                                                                                                                                                                                                                    |
| Stale seat                             | Throw the ball at the seated flask until it leaves the tile: `seat` is cleared when it sleeps, and the next step that needs it is refused.                                                                                                                                                                                                                                                                                                                                                 |
| Pour transfer                          | Tilt a bottle over a beaker for 2 s: `receiver_after − receiver_before === source_before − source_after > 0`. Over the bench: both unchanged. Without a mouth hit (offset > capture radius): unchanged.                                                                                                                                                                                                                                                                                    |
| Single commit                          | A pour the station refuses moves nothing and marks nothing. A pour it accepts moves µL **and** marks the step in the same call. Bus `ExperimentCommand {setup}` and `{set}` for the physical station are refused.                                                                                                                                                                                                                                                                          |
| Volume conservation across frame rates | Run the same scripted pour at 30, 60 and 300 Hz frame dts: integer conservation is exact (`===`) at every rate; the totals agree within one frame of flow at the slowest rate (the `isHeld` sampling bound), not ± 1 µL. A frame below 10 fps (physics capped at 6 steps) pours exactly as many steps as physics ran.                                                                                                                                                                      |
| Container compatibility                | Pour water into a stock bottle (no step): `ActionBlocked` "That is not part of this experiment.", published **once** per pair, no transfer.                                                                                                                                                                                                                                                                                                                                                |
| Invalid transfer                       | Deliver into a stoppered flask: refused. Fill a non-empty pipette: refused. Receiver at the mark: transfer stops at exactly `fillLimitMl·1000`.                                                                                                                                                                                                                                                                                                                                            |
| Mixing state                           | Inversion of a closed flask sets `mixed`. A pour into it clears `mixed`. Only if `stirTool` is built (Decision 6): stirring a test item sets `mixed` after `t_mix`, and no model input or result changes (snapshot of the run inputs before and after).                                                                                                                                                                                                                                    |
| Model feed                             | Full dilution flow through `Game`: run inputs {C₁ 2e-5, V₁ 5, V₂ 50} from the saved parameters (not from `apparatus()`), end reason `model`, results equal theory (1e-12 relative), the reading at d equals `quantize`. A fill paused for longer than the draft's `maxDuration` (12 s) still completes at V₂.                                                                                                                                                                              |
| Run start guard                        | Squeeze water into the flask before `dispense`: refused with the `dispense` step's refusal, nothing moves, no run starts.                                                                                                                                                                                                                                                                                                                                                                  |
| Hidden value                           | Titration flow (once migrated): the structured-field scan of §2.16, run before any answer is revealed, plus the save JSON's keys and string values.                                                                                                                                                                                                                                                                                                                                        |
| Save/load                              | Capture mid-slice. `applySave` into a fresh `Game`: container poses within 1 mm, contents exact, setup states equal, no run, the further-water refusal text; RESET refused; "Clear the bench" restocks; a new run is then possible. A scene detach and re-attach restores the container poses (applied at spawn). Physics-lab balls still spawn at their placements. v3 fixture to v4. A tampered v4 (unknown material, over-capacity, pose in a wall) is sanitized with one warning each. |
| Cabinet                                | Closing a cabinet leaf with a bottle sticking out into its swing is refused with the reason. Every lab dynamic item is asleep within N steps of spawning and has moved < 1 mm; every cabinet item can be grabbed out from the standing spot without an `out-of-reach` release.                                                                                                                                                                                                             |
| No allocation                          | The `LiquidSystem.update` and `ContainerView` hot paths: a code review rule. Reported as **NOT TESTED** unless the project gains a heap-sampling harness.                                                                                                                                                                                                                                                                                                                                  |
| Physics experiments unchanged          | Existing `hold.test.ts`, `PhysicsSystem.test.ts` and the station tests pass unchanged (the drop path for non-containers; RESET unchanged).                                                                                                                                                                                                                                                                                                                                                 |

### 4.3 E2E, player-like (`e2e/physical-lab.spec.ts`, one at a time per `docs/agents/README.md`)

- **Setup.** Start from the main menu and walk through the doors to the chemistry lab. Do not use
  the debug scene jump; CLAUDE.md says it is never evidence for transitions. Reuse `grab.spec.ts`'s
  exact-delta aim helper.
- **Steps.** Perform §3.3 steps 2–13 with real keys (E, F, held RMB/R) and mouse aiming. After
  each step, read the dev debug panel lines (`Holding`, `Focus`, a new `Containers` line with µL
  per entity) and assert:
  - the bottle −5000 and the pipette +5000, then the pipette −5000 and the flask +5000;
  - the flask reaches exactly 50000 at the mark and the wash bottle drops by 45000;
  - the HUD prompt texts and the refusal toasts for one wrong pour (water into the stock bottle)
    and one set-down onto a wall.
- **Screenshots** at: cabinet open, the pour stream, the flask at the mark, the colorimeter
  reading.
- **Save/Continue.** Save mid-fill, reload, Continue: container poses and contents are as
  captured; more water is refused with the clear-the-bench text; press "Clear the bench"; the
  containers are full and back in place; a new fill runs.
- **Rendering caveat.** E2E runs on SwiftShader. Any timing seen there is never a GPU number.
  Exact-delta aiming in e2e says nothing about how hard a 5 mm mouth is for a player (§2.6).

### 4.4 Measurements the slice's phase report must contain

- Menu JS bytes after the slice (guard 500,000 B, `e2e/renderer.production.spec.ts:29`).
- Physics step ms in the chemistry lab with the slice's 13 dynamic items, awake and asleep, with
  `npm run bench`-style timing on the real GPU, the WebGL renderer named.
- Draw calls, triangles and transparent draws added by `ContainerView`, on Low and High.
- First-open cost of the lab: chunk load and first-frame shader compile for the glass and liquid
  materials.
- Pour-aim success in a manual player session: time to hit a 5 mm mouth (sets `captureRadius`).
- The held-rotation blending checked by the user on the 300 Hz display before it is committed.

---

## 5. Migration order for the rest, with risks

| Order | Experiment                                                                                              | Why here                                                                                                            | Main risks / blockers                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `dilution` (slice, spec "## 12. Dilution", line 559)                                                    | §3                                                                                                                  | Model registration and the definition block are data work. The driven-mode contract (no time limit, no no-progress check while driven) and the `by` step field are the first framework changes.                                                                                                                                                                                                                                                                            |
| 2     | `ph-measurement` (drafted)                                                                              | Uses the slice's output kind (a known C at a known V); beaker + electrode dip + wash bottle + spotting tile are DEF | Calibration is NONE as an action. Samples are a registry (G6). The indicator colour chart has no values (G7), so the spotting-tile path is blocked or limited to the meter. Mixing two different samples must be refused (no rule exists).                                                                                                                                                                                                                                 |
| 3     | `solubility` (drafted)                                                                                  | Seats (hot plate) + a solid transfer + a balance                                                                    | **A solid is not a liquid.** It needs a `SolidContents` (g) sibling of `Contents`. The magnetic stirrer is automatic and manual stirring has no effect (model). The filter and dry steps are G13. Mass versus volume for the water (keep mass).                                                                                                                                                                                                                            |
| 4     | `acid-base-titration` (shipped 2D)                                                                      | The most valuable, the most mechanics                                                                               | Burette fill (pour into a funnel or burette mouth), tap (flow is fixed at 0.25 mL/s: G3), pipette, indicator drops (drop volume: **SPEC GAP**; the model ignores it), overshoot (D1, needs the driven mode **with the `'player'` finish**, §2.9, or its readings never appear), and the hidden c_a discipline (§2.16; material id stays `hcl`). The rig `titration-stand.ts` currently draws glassware from the session; split it like dilution.                           |
| 5     | `heating-curve` (shipped bench-embedded)                                                                | Seat + heat source                                                                                                  | Contents mass (G18), no cooling (**SPEC DEVIATION**: spec "## 15" line 608 asks for heating/cooling; spec map D2), no thermal coupling. A risk of looking physical while the input is a dial: keep the power dial honest.                                                                                                                                                                                                                                                  |
| 6     | `precipitation` (drafted)                                                                               | Registry-backed mixing                                                                                              | `PAIRS` registry as the only allowed mixes. A 10 mL burette reuses titration's tap. Concentrations are illustrative (G20).                                                                                                                                                                                                                                                                                                                                                 |
| 7     | `reaction-rate` (shipped 2D)                                                                            | —                                                                                                                   | **Blocked by G15.** Pre-mix concentrations and volumes are undefined, so a physical mixing step cannot be derived. Stays 2D until the definition says what is mixed.                                                                                                                                                                                                                                                                                                       |
| 8     | `separation` (drafted)                                                                                  | —                                                                                                                   | **Decision D3.** Filter and rinse must become physical (spec "interactive procedures") or be labelled partial. Decantation and distillation are G23.                                                                                                                                                                                                                                                                                                                       |
| B1    | `microscope` + onion preparation (spec "## 18. Microscope" line 656, "## 21. Onion epidermis" line 701) | The spec requires "the user should actually perform the steps"                                                      | Slide (thin, CCD), tile seat, specimen/stain/coverslip as `withHeld` actions on the slide mapped to the existing steps `new-slide, specimen, stain, coverslip, stage`. Stage seat. The objective selector and fine focus as existing dial behaviours on the microscope. **Lamp indicator only** (G24, no fake illumination control). Cheek and Elodea slides stay SPEC GAPs. D6 ("no stain" accepted) is a Lead decision. The peel/water/blot technique is G27: not added. |
| B2    | `osmosis` (shipped 2D)                                                                                  | Tubes + balance                                                                                                     | "Membrane" is a drawing (G28). The potato cylinder is a solid sample with a mass, so it needs the same mass capability as solubility.                                                                                                                                                                                                                                                                                                                                      |
| B3    | `enzyme-activity` (shipped 2D)                                                                          | Water-bath seat + syringe delivery                                                                                  | Buffer preparation (G33). The 5 mL mixture is a container volume.                                                                                                                                                                                                                                                                                                                                                                                                          |
| B4    | `photosynthesis` (shipped observation)                                                                  | Lamp position on a rule (a physical slide)                                                                          | A physics-like slider: risk of a fake control unless the lamp distance is a set-down position on the rule. The positions must snap to the parameter's presets or grid (`setBlock` accepts nothing else), for example one seat per preset.                                                                                                                                                                                                                                  |
| B5    | `transpiration`, `genetics` (drafted)                                                                   | Last                                                                                                                | Genetics has no vessel: keep it non-physical (a decision, not a gap). Transpiration's chamber and fan are DEF additions (G31).                                                                                                                                                                                                                                                                                                                                             |

**Cross-cutting risks.**

- **Two presentations of one rig.** Bench rigs that draw glassware from parameters (`dilution-station`,
  `titration-stand`) must not also be physical entities. Each migration splits the rig.
- **Prompt load.** More small grabbable items in the chemistry lab make aiming harder. Keep reach
  2.2 m and rely on the ray-box picking of the nearest item.
- **RMB under pointer lock.** `Mouse2` maps through `BrowserInput.ts:78-86` (NOT RUN); KeyR is
  the fallback.
- **Rotation sweeps** (§2.18).
- **Old saves.** v3 saves get empty `objects` and `containers`, so items spawn at placements as
  before.

---

## 6. Decisions the Lead must take

1. **Step vocabulary (§2.8).** **Recommend** the shipped schema: pieces as the step vocabulary,
   piece-level steps, `when` per material only where a step's text differs by material (as
   titration ships), plus **one** optional field `by: 'set-down' | 'transfer' | 'invert'` for
   actions with no receiver. Pieces stay required, so parameter ownership and the static
   `secret()` check keep working. The alternative is a new match-by-kind schema, with its own
   content checks and tests.
   **Lead amendment (2026-11-01, implementation review MED-3):** a second optional field,
   `workspace.drive {place, onto}`, names the transfer that feeds a driven run. It is accepted:
   the content check requires it exactly when the model has a driven mode and only on a
   `physical-lab` experiment, so no code branches on an experiment id. These are the slice's two
   schema changes, `by` and `drive`.
2. **Slice host.** **Recommend dilution**, as `physical-lab` from first ship. It is unshipped, so
   nothing is migrated away.
3. **Driven-run contract (§2.9).** **Recommend accepting it** as specified: the optional
   `driven` model mode; while driven, no `step()`, no time limit and no no-progress check; the run
   completes by the model (`'model'`) or by an explicit physical finish (new end reason
   `'player'`, status `'completed'`); `'player'` added to `ExperimentEndReason`, the run-history
   store's validation and the end-reason texts. Dilution needs only the first part; titration
   needs all of it. The alternative, a `fillTime` replay after the player already filled the flask,
   would show a time series the player never made.
4. **Titration overshoot and finish (spec map D1).** **Recommend** the driven mode
   (`titrationPH(inputs, V)` fed from the burette volume), **no** auto-stop, and a physical finish
   action (close the tap, record the end volume) that completes the run with `'player'`. Overshoot
   is a mistake the spec lists (spec line 1100). STOP keeps its meaning (no readings).
5. **Pose persistence scope and containers leaving the lab (§2.15, §2.5 item 7).** **Recommend**
   saving poses for `container` items only, captured at save time and applied at every spawn, and
   a door guard that keeps station-bound containers in their lab; for any walk-through exit (not
   checked), return the container to its placement on that release.
6. **Mixing in the slice (§3.3).** **Recommend** accepting the DEF inversion as the slice's
   mixing step: stopper and inversion motion, `mixed` flag, the cuvette step unlocks. Under the
   model it changes no colour and no number. No spec-backed stir with a consequence exists in
   §10–17. Whether the `stirTool` capability is built in the slice (tested with a test item only)
   or deferred to the first experiment that uses it is part of this decision; **recommend
   deferring** it.
7. **Sample into the cuvette (slice step 12).** The method is a SPEC GAP (DEF says only "a sample
   is read"). **Recommend** a tilt-pour from the mixed flask into the colorimeter's receiver-only
   cuvette, labelled AFFORDANCE (it changes no number). The alternative is a station action on the
   colorimeter, which is less physical.
8. **Commit authority (§2.6 item 7, §2.8).** **Recommend** that `StationSystem` commits every
   transfer, set-down and inversion in one call (`stations.transfer` and siblings), is the only
   writer of container state, and refuses bus `setup` and `set` commands for physical stations.
   `LiquidSystem` only detects.
9. **Recovery after Continue (§2.15).** **Recommend** the existing `clear` command on a physical
   "Clear the bench" control, extended for `physical-lab` stations to restock and return
   containers; RESET keeps its current meaning for every presentation.
10. **Overflow and spill.** **Recommend none.** Receivers take liquid up to their mark or brim,
    and pouring over a non-receiver moves nothing. No spec or model defines spillage. Add it only
    with a spec line.
11. **Save format.** **Recommend v4** with typed `world.objects` (containers only) and
    `world.containers`, a migration, a sanitize step and tests (§2.15). The alternative of encoding
    into entity states avoids the bump but loses validation.
12. **Stir affordance values** (`v_min`, `t_mix`) and the inversion count (1). **Recommend**
    labelling them as pacing in the item and the docs, with no model reading them (only relevant
    once `stirTool` is built, Decision 6).
13. **Cabinet contents (G1).** **Recommend** that the cabinet holds only placements whose `piece`
    and `material` are in a migrated experiment's definition, enforced by a content check. No
    element samples. The 2D periodic-table lens stays 2D-only.
14. **Set-down versus drop.** **Recommend** that `container` items only set down, while every
    other item keeps the free drop. `grab.spec.ts` and the physics experiments are then unchanged.
15. **Bookkeeping volumes (§2.3).** The stock-bottle fill, the wash-bottle volume and the cuvette
    capacity are in no draft. **Recommend** labelling them "AFFORDANCE: bookkeeping volume" in the
    data (no model reads them), chosen so every preset combination can be run several times. The
    alternative is to record them as SPEC GAPs and block the slice until the Chemistry agent
    supplies them.
16. **Aim assistance (§2.6).** **Recommend** an optional per-receiver `captureRadius`
    (AFFORDANCE) and a minimum pick-box padding for thin items, with values fixed only after a
    manual player session measures time-to-hit. The alternative is no assistance (mouth radius
    only), which the 2.5 mm-per-pixel arithmetic suggests will be hard to play.
17. **Dilution apparatus.** **Recommend** a new static bench key `dilution-colorimeter` (tile
    seat on real `colliders` + colorimeter with a receiver-only cuvette, built from
    `colorimeter.ts`), with the glassware as separate dynamic entities. `dilution-station`'s
    desk-and-dials rig is not registered for the physical version. Keep it or delete it as the
    Lead prefers.
18. **Spec map D4, D5 and D6** (plant and animal structures, onion "no stain") must be decided
    before microscope migration B1. They do not block the chemistry slice.
19. **reaction-rate (G15) and separation (D3)** stay 2D until their definitions are settled.

---

## Appendix: files a slice implementation touches

| Layer       | File                                                                                                                                                                                                   | Change                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| simulation  | `src/simulation/liquid.ts` (+ test)                                                                                                                                                                    | new, pure; receives `levelIn` and `heldBelow` from `platform/labVisuals/chemistry.ts`                                                                                                                                                                    |
| simulation  | `src/simulation/SimulationModel.ts`, `ExperimentRuntime.ts`, `models/dilution.ts`, `models/index.ts`                                                                                                   | `driven` mode (no time limit, no no-progress check while driven; `'player'` end reason); register dilution                                                                                                                                               |
| simulation  | `src/simulation/experiment.ts`                                                                                                                                                                         | `physical-lab` presentation (workspace and pieces still required); optional `by` on `SetupStep`; `secret()` extended to physical bindings                                                                                                                |
| gameplay    | `src/gameplay/item.ts`                                                                                                                                                                                 | `container`, `seats`, static `colliders` schemas (`stirTool` per Decision 6)                                                                                                                                                                             |
| gameplay    | `src/gameplay/interaction/hold.ts`, `InteractionSystem.ts`, `behaviors.ts`                                                                                                                             | ports `setHoldTilt`, `setDown`; `RayHit.normal`; `selfHeld` actions; `container` behaviour                                                                                                                                                               |
| gameplay    | `src/gameplay/experiment/behaviors.ts`                                                                                                                                                                 | `experiment-control` command enum gains `clear`                                                                                                                                                                                                          |
| gameplay    | `src/gameplay/lab/LiquidSystem.ts`, `pour.ts` (+ tests)                                                                                                                                                | new; geometry only                                                                                                                                                                                                                                       |
| gameplay    | `src/gameplay/experiment/StationSystem.ts`                                                                                                                                                             | guard cases; `transfer`/`setDown`/`invert` commits; only writer of container state; refuses bus `setup`/`set` for physical stations; driven feed and run start via `runBlock`; `clear` restocks for physical stations; stale-seat check; RESET unchanged |
| gameplay    | door / hinge systems                                                                                                                                                                                   | door guard for station-bound containers; refuse closing a leaf onto a dynamic body                                                                                                                                                                       |
| physics     | `src/physics/PhysicsSystem.ts`                                                                                                                                                                         | orientation drive; held-rotation blending in `renderPose`; set-down (exclude dynamic, capsule in overlap); upright lock with post-release upright drive; static `colliders`; `STIR` group (Decision 6)                                                   |
| game        | `src/game/Game.ts`, `GameState.ts`, `GameEvents.ts`, `src/core/config.ts`                                                                                                                              | system order, `world.containers` and `objects`, events, `pour` binding                                                                                                                                                                                   |
| persistence | `src/persistence/saveData.ts`, `SaveSystem.ts`, `runHistory.ts` (+ tests)                                                                                                                              | v4 + migration + sanitize; poses applied at spawn; `'player'` in the run-history enum                                                                                                                                                                    |
| platform    | `src/platform/render/ContainerView.ts`, `WorldRenderer.ts`, `render/bench/` (new `dilution-colorimeter`), `labVisuals/chemistry.ts` (re-import), `ui/DebugPanel.ts`, `ui/Hud.ts`, `ui/ResultsPanel.ts` | drawing from state (shared lathes, world-space level plane, version polling); debug `Containers` line; prompts; end-reason text                                                                                                                          |
| content     | `src/content/items.json`, `lab-placements.json`, `experiments/dilution.json`, `topics.json`, `laboratories.json`, `strings.json`                                                                       | items, placements, definition (pieces, materials, steps, rewritten procedure and instructions), texts EN+VI                                                                                                                                              |
| e2e         | `e2e/physical-lab.spec.ts`                                                                                                                                                                             | new                                                                                                                                                                                                                                                      |
| docs        | this file, `docs/persistence.md` (v4), phase report (with the §4.4 measurements)                                                                                                                       | —                                                                                                                                                                                                                                                        |

---

## 7. Review responses

Responses to the adversarial review of revision 1
(`...\scratchpad\labs\physical\review-interaction-architecture.md`). Every finding was re-checked
in the code or the spec before it was applied. Nothing was run for this revision.

**Applied (all findings hold).**

| Finding                                   | Where applied                                           |
| ----------------------------------------- | ------------------------------------------------------- |
| Audit: held rotation not blended          | §1.1, §2.5 item 1, §2.13                                |
| Audit: HCl label "HCl solution", id `hcl` | §2.16                                                   |
| Audit: 15 cases in `hold.test.ts`         | §1.1                                                    |
| H1 step mapping                           | §2.3, §2.8, §2.17, §3.1, Decision 1                     |
| H2 RUN deadlock                           | §2.6 item 5, §2.9, §3.1, §3.3 step 9                    |
| H3 driven runs                            | §2.9, §4.1, §4.2, §5 row 4, Decisions 3–4               |
| H4 recovery dead end                      | §2.15, §3.2, §3.3 step 14, §3.4, §4.2, §4.3, Decision 9 |
| H5 judder                                 | §2.5 item 1, §2.13, §4.1, §4.4                          |
| H6 per-frame allocation                   | §2.13, §2.14, §2.6                                      |
| M1 two writers, two-phase commit          | §2.1, §2.4, §2.6 item 7, §2.7, §2.8, Decision 8         |
| M2 two input paths                        | §2.3, §2.8, §2.9                                        |
| M3 static receivers, one-box colliders    | §2.1, §2.2, §3.2                                        |
| M4 stacking on dynamic bodies             | §2.5 item 2, §4.2                                       |
| M5 stale seat                             | §2.5 item 4, §4.2                                       |
| M6 frozen tilt after unplanned release    | §2.5 item 3, §4.2                                       |
| M7 incomplete pose persistence            | §2.5 item 7, §2.15, §4.2, Decision 5                    |
| M8 invented squeeze geometry              | §2.6 item 4, §3.3 step 9                                |
| M9 unmeasured aiming                      | §2.2, §2.6 item 4, §4.4, Decision 16                    |
| M10 volumes not in the DEF                | §2.3, §3.2, §3.4, Decision 15                           |
| M11 hidden-value scan false hits          | §2.3, §2.16, §4.2                                       |
| M12 menu JS guard                         | §2.18, §4.4                                             |
| M13 planned layer violation               | §2.1, §2.13, §4.1                                       |
| M14 cabinet doors, spawn stability        | §2.18, §4.2                                             |
| M15 the slice's stir step                 | §2.10, §3.3, Decision 6                                 |
| M16 second rule in `liquid.ts`            | §2.4, §2.10, §3.3 step 12, §4.1                         |
| M17 frame-rate claims                     | §2.5 item 1, §2.6, §4.1, §4.2                           |
| L1 singular 180° target                   | §2.5 bindings, §2.10, §3.3 step 11                      |
| L2 ambiguous spec numbering               | §2.9, §5, Decision 4 (spec line numbers cited)          |
| L3 no cooling is a SPEC DEVIATION         | §2.11, §5 row 5                                         |
| L4 draft procedure and `fillTime`         | §2.9, §3.1                                              |
| L5 set-down overlapping the capsule       | §2.5 item 2, §4.2                                       |
| L6 per-frame set-down validation          | §2.5 item 2                                             |
| L7 lying pipettes need a rack             | §2.18, §3.2                                             |
| L8 "no allocation" is not a test          | §2.6, §4.2                                              |
| L9 transparent draws, Low tier            | §2.13                                                   |
| L10 lamp positions snap to presets        | §5 row B4                                               |

**Rejected.** None.

**Applied differently from the review's suggested fix.**

- **H1.** The review recommends "pieces plus `when` per material". The shipped schema already
  lets `place` name a piece (`experiment.ts:400`), so most slice steps are piece-level and
  need no `when` at all; `when` is kept for steps whose text differs per material. One thing
  the shipped schema cannot express is an action with no receiver (the inversion), so this
  revision adds one optional `by` field and states it as a schema change (Decision 1) instead of
  claiming no schema change is needed.
- **H4 / M1.** `clear` is extended, for `physical-lab` stations only, to restock and return the
  containers. The shipped `clear` only empties the setup (`StationSystem.ts:805-812`); the
  2D workspaces keep that behaviour.

**Corrections to the review.**

- M1 cites the workspace controller's publish at `controller.ts:155`; it is at
  `src/platform/ui/workspace/controller.ts:94-95` (`send` publishes `ExperimentCommand`). The
  finding holds.
- H4 cites the RESET refusal at `StationSystem.ts:609-610` and `clearSetup` at `:803-810`; they
  are at `:612` and `:805-812` in the current tree. The finding holds.
- L2: the "overshooting titration" example is at spec line 1100, under the "# 21" heading at
  line 1086.
- H1 / H2 cite `pieces … .min(1)` at `experiment.ts:257` and the `phase` default at `:291`; in
  the current (uncommitted) tree they are at `:303` and `:292`. The findings hold.

**Not checked here** (as in the review): the `WorkspaceSystem` and `SaveSystem` line references
in §1, the spec-map gap numbers, and whether the chemistry and biology labs have walk-through
(non-E) exits (§2.5 item 7).
