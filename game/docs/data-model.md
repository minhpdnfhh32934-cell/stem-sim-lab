# Data model

All content is JSON in `src/content/`, validated before use by Zod schemas that live next to the
code that uses them: the core content (`content/core.ts`) at boot (`buildCoreContent`), the lab
pack's — experiments, topics, the simulation models, the items only the labs place and the labs'
placements (`content/lab.ts`, `game/labPack.ts`), a chunk the menu never downloads — when it loads
(`addLabContent`: every check runs again on the core with the pack added), before any station,
lab scene, Continue, catalog entry, completion or run history uses it. `buildContent`
(`src/game/content.ts`, all of it at once, as the tests do) checks every schema **and** every
cross-reference, and reports all problems at once with a path, e.g.

```
rooms.preparation-room.placements.door-hub.params: unknown scene "atlantis"
experiments.free-fall.model: unknown simulation model "kinematics.warp-drive"
```

`src/game/content.test.ts` asserts that the shipped content is valid, so a broken edit fails
`npm test` before it can fail at runtime.

Conventions: ids are lowercase words joined by `-` or `.`; all numbers are SI (m, kg, s, rad);
colours are `#rrggbb`. Two deliberate exceptions: chemistry and biology wet-lab experiments use mL
and mol/L, as such a lab does (pH has no unit; time stays in seconds; the biology ones also give
masses in g and water potential in kPa), and microscopy states lengths in µm and mm; and an
experiment parameter the learner sets may use the customary unit its definition names (the launch
angle θ is in degrees, as on the dial); the model converts (`projectile.ts`).

## Files

| File                  | Schema                       | Module                     | Loaded with |
| --------------------- | ---------------------------- | -------------------------- | ----------- |
| `characters.json`     | `CharacterDefinitionSchema`  | `gameplay/character.ts`    | the menu    |
| `core-items.json`     | `ItemDefinitionSchema`       | `gameplay/item.ts`         | the menu    |
| `rooms.json`          | `RoomDefinitionSchema`       | `world/definitions.ts`     | the menu    |
| `laboratories.json`   | `LaboratoryDefinitionSchema` | `world/definitions.ts`     | the menu    |
| `scenes.json`         | `SceneDefinitionSchema`      | `world/definitions.ts`     | the menu    |
| `procedures.json`     | `ProcedureDefinitionSchema`  | `gameplay/procedure/…`     | the menu    |
| `strings.json`        | `StringsSchema`              | `game/content.ts`          | the menu    |
| `items.json`          | `ItemDefinitionSchema`       | `gameplay/item.ts`         | lab pack    |
| `lab-placements.json` | `{ room, placements[] }[]`   | `game/content.ts`          | lab pack    |
| `experiments/*.json`  | `ExperimentDefinitionSchema` | `simulation/experiment.ts` | lab pack    |
| `topics.json`         | `TopicDefinitionSchema`      | `simulation/experiment.ts` | lab pack    |
| `tasks.json`          | `TaskDefinitionSchema`       | `gameplay/task/task.ts`    | lab pack    |

**Core and lab pack.** The menu downloads only what it, Continue's save check and the
rooms' structure need; everything an experiment adds travels in the lab pack, loaded with the first
world scene, by Continue or when the catalog opens (`Game.loadLab`, once; a failure adds nothing
and the next call tries again):

- `core-items.json`: every item a room outside the laboratories places (their rooms: as
  `laboratories.json` lists them) — so also the fittings the labs share with those rooms: doors,
  door rails, ceiling lights, diffusers, returns, the desk lamp — and items placed nowhere (test
  fixtures use them).
- `items.json`: every other item — apparatus, station controls, instruction boards, lab furniture
  and signs. A new experiment's items go here.
- `rooms.json`: every room — its bounds, walls, openings and lights — with every placement of a
  core item (a lab keeps its doors and ceiling fittings here: the door pairs, the campus, the room
  lights and the routes are known at boot).
- `lab-placements.json`: `[{ "room": "<room id>", "placements": [ … ] }]`, the labs' other
  placements, the same shape as a room's: stations, their controls, benches, shelves, signs. A new
  station goes here. When the pack is added each list follows its room's own placements; entity ids
  stay `<room>/<placement>`, so saves and run history are unchanged.

`content/index.ts`'s `bundledContent` is all of it at once, each item and room whole, for tests.
Two tests keep the split honest (`game/labPack.test.ts`): the core plus the pack is exactly the
bundled content, and no core item is placed only in the labs (it would cost the menu for nothing).
A placement left in `rooms.json` that places an item of `items.json` fails the boot check
(`unknown item`), and an item a core room needs left in `items.json` fails it the same way.

`strings.json` holds the interface's translations by key (`vi`); its English is in the code that
shows it. Content text is translated in the content files, beside its English: every object with
text fields may carry `"vi": { "<field>": "…" }` for the fields its schema names (a placement:
its `label` parameter). New content needs its Vietnamese too — a test checks it. See
`docs/game-core.md`, Languages.

## Guided tasks — `tasks.json` (Phase A)

```
id, room (a lab room), title, description, vi { title, description },
steps [ { id, instruction, vi { instruction },
          objects: placementId[]   (in the task's room: the path leads to the nearest, all outlined),
          done: grabbed | set-down | inspected            (one of its objects)
              | state { key, value }                      (one of its objects' entity state)
              | setup { station, step, or? }              (that station's setup step done, or one of `or`)
              | completed { station } | viewed { station } } ]
```

A task shows the way and notices what the world does; it decides nothing (`TaskSystem` reads
events only). Cross-checked when the lab pack loads: the room, every object placed in it, a
`station` an experiment's apparatus there and a `setup` step one of that experiment's. Steps whose
state already holds when they are reached are passed at once. Progress is saved (save v5).

Phase B adds to the physical lab (`docs/phase-b-chemistry-contract.md`): an item's `clamps`
(`{ id, center, accepts }`: a vessel held off any surface, by the pose driver), a container's
`drops` (`{ volumeMl, count }`: a dropper bottle; SPEC GAP volume) and `tap` (`{ tip }`: a
burette's stopcock), a setup step's `by: "clamp"`, and a workspace drive's `feed`
(`volume` | `added`) and `rate` (the model input a tap runs at).

## Character

```
id, displayName, gender: male | female | unspecified,
appearance { heightM, skinTone, hairColor }, outfit { default }, metadata { … }
```

Gender is presentation only; no rule may branch on it. Eye height comes from `heightM`
(× 0.93). Custom characters are additional entries (a character creator later writes the same
shape).

## Item

```
id, displayName, description,
category: furniture | structure | equipment | tool | material | sample | ppe,
tags[],
physical { massKg > 0, body: static | dynamic | kinematic | none, friction 0–2, restitution 0–1,
           linearDamping 0–10, angularDamping 0–10, ccd, throwable },
interactions[]  (behaviour ids),
wornOn?: body | hands | eyes | face   (PPE: where it is worn; required by "wear")
container? { capacityMl, fillLimitMl?, profile?, mouth?, pour?, measured?, closable,
             vessel?: pipette | volumetric-flask | reagent-bottle | wash-bottle | cuvette }
           (the physical lab: docs/physical-lab-architecture.md §2.2; `vessel` only says how it is
           drawn — its print, cap or stopper, label, tube — and no rule reads it)
inventory? { stack 1–64 (default 1), decorative (default false) }   (carriable, phase WX)
door? { travel m, openS s, closeS s }  (a walk-through door leaf: only with body "kinematic",
        and a kinematic body only with it; phase WX)
hinged? { angleDeg ≤ 180, swingS s, leaves [1–2] { center, size, hinge [x, z], opens 1 | -1 },
          carcass [] { center, size } }   (UX3.1: hinged leaves swung while "open" — the PPE
          cabinet's doors, the washroom door; boxes in the item's frame from its centre, closed;
          the carcass is the item's own colliders, each leaf a kinematic body; body "static";
          the prop's leaf parts must hinge alike, checked in props/content.test.ts)
visual { shape: box | sphere | cylinder, size [w,h,d] m (> 0), color,
         material: matte | satin | metal | glass | light | painted | plastic | rubber
                   (default matte; how each answers light: `platform/render/looks.ts`),
         label? { text, color, background }   (a painted sign on the front face; "\n" = new line)
         screen?: status | graph              (an experiment screen on the front face)
         model?: desk | push-button | knob | display  (a station control drawn as a model inside the
                   box, `platform/render/consoleModel.ts`; the box stays the collider and the aim box)
         prop?: one of `PROPS` (`gameplay/props.ts`: furniture or architecture drawn as a model
                   inside the box, `platform/render/props`; never with `model`; phase WX)
         openBox? { center, size } (m, object frame: its interaction box while "open" — the PPE
                   cabinet's back, so the PPE in front of it is aimed at; UX3.1: no longer a collider),
         stream? { length m, color, from? [x,y,z] m }  (while "running": water falling `length`
                   from `from`, the spout's mouth from the item's centre in its own frame, default
                   the bottom centre, to what is below — the faucet's ends 2 mm above the basin's
                   bowl floor, `props/preparation.test.ts`; drawn by `platform/render/water.ts`) }
launcher? { muzzle [x,y,z] (m, from the base centre; +x is the launch direction),
            barrelLength, barrelDiameter }   (projectile apparatus, Phase 6B)
pendulum? { pivot [x,y,z] (m, from the base centre), bobRadius (m), bobMass (kg) }
            (pendulum stand, Phase 6C.2: swings in the item's x–y plane, positive angles to +x;
             the frame, rod and bob are drawn from this — the bob has no physics body)
bench? { model (render key, kebab-case: a builder in `platform/render/bench/registry.ts`),
         top [x,y,z] (m, from the base centre: where its rig stands; inside the room, P3c) }
         (any other body-less apparatus — a circuit board, a burette, a lamp and pondweed: drawn
          by its bench model, its moving parts posed from the experiment; the box stays the
          collider; the station kind and recipe: experiments.md#adding-a-bench-experiment)
```

Weight is derived (m·g), not stored. `visual` is a placeholder primitive until real models exist;
the same primitive and size are the physics collider (sphere: equal size on every axis; cylinder:
x = z, both validated). `body` chooses the simulation: `static` furniture and structures,
`dynamic` objects that fall and settle (steel ball, lamp, microscope), `none` for purely visual
items. Picking up is an interaction: list `"grab"` in `interactions` (dynamic items only,
validated); `throwable` allows throwing it — see [interaction.md](interaction.md#grab-hold-drop-throw-phase-3).
Shipped: the steel ball (grab, throwable), the microscope (grab, not throwable) and the desk lamp
(toggle, then grab — see the secondary action in [interaction.md](interaction.md)); since Phase 6B
the projectile launcher, projectile balls, equipment cart, control desk, dials, RUN/STOP/RESET
buttons, station display, results monitor, instruction board, signs and ceiling lights; since
Phase 6C.2 the pendulum stand (its collider is the base only: the drawn frame is not solid).
`material` presets are renderer looks (`light` glows in the item colour); `matte` is the look
every item had before. Mass, friction and restitution policy:
[physics.md](physics.md#physical-properties-policy).

**Props and decor (phase WX).** `visual.prop` draws an item as a procedural model (one palette of
finishes, `platform/render/palette.ts`); the box stays its collider and aim box, and every prop fits
its box (`props/content.test.ts`). An item tagged `decor` has no interactions, is not dynamic, and
has no inventory, screen, stream, open box or description (checked at boot and in
`decor.test.ts`); the renderer draws all decor of a scene as one `InstancedMesh` per part per item.
Every inspectable item has an honest description in both languages.

**Inventory (phase WX).** An item with `inventory` can be put away from the hands (Q) and carried
across scenes, up to `stack` per slot; `decorative` marks one nothing in the lab uses, and the
inventory shows it so. PPE has no `inventory`: it is worn, never stored. The carried instance keeps
its entity id (`<room>/<placement>`), so it is never spawned twice — see
[persistence.md](persistence.md) and [interaction.md](interaction.md).

PPE (Phase 5): the lab coat, safety goggles and face shield hang in the Preparation Room
wardrobe (the PPE cabinet: its doors swing open about their hinges); nitrile gloves come from
a dispenser at the corridor wash station and, `disposable`, go into its waste bin once used. Worn, an item shows
in its `visual.color` on the slot it is `wornOn`. Procedures that use these objects:
[procedures.md](procedures.md).

### Add an item

Add an entry to `items.json` if only the labs place it, else to `core-items.json` (pick behaviours
from [interaction.md](interaction.md)); place it in a room (`lab-placements.json` in a lab,
`rooms.json` elsewhere, and always for a door: doors are paired at boot, so the pack refuses one),
run `npm test`.

## Room, laboratory, scene

```
Room        id, displayName, bounds { min, max } (m), floorColor, wallColor,
            openings[ { wall: north | south | east | west, center, width, height } ],
            placements[ { id, item, position [x,y,z] (base of the object), rotationY, params } ]
            lights[ { fixture (placement id), role: key | fill | accent, lux?, target?, color?,
                      penumbra? (0–1, default 0.6), reachHeight? (m, key only) } ]
Laboratory  id, displayName, type: physics | chemistry | biology | interdisciplinary,
            rooms[], equipment[] (item ids), experiments[]
Scene       { kind: 'menu', id, displayName }
          | { kind: 'world', id, displayName, rooms[], spawn { position, yaw },
              lighting: basic | enhanced (default basic) }
```

`lighting: enhanced` (the Physics Lab since Phase 6B) adds sun shadows on floors and objects and
filmic tone mapping; `basic` is the original flat look and costs nothing extra. Since Phase P3.3
enhanced also lights the ceiling and undersides with light bounced off the floor (a near-neutral
hemisphere ground), adds a shadowless fill from low on the side away from the sun so walls facing
different ways read apart, and gives walls matte paint (roughness 0.92) and the floor a slight
sheen (0.62). Measured on an RTX 5070 Laptop GPU the Physics Lab's GPU time is unchanged (2.3 ms);
under SwiftShader it is about 5 % higher (`docs/phase-p3.3-report.md`). Item materials are shared
by every room and were left as they were. Since Phase P3.5 the graphics quality setting tunes enhanced
lighting: Low without the sun's shadows, Medium as described, High with image-based room light
(`docs/game-core.md`).

**Scenes joined by a door share their lighting (phase UX1).** Lighting is one rig for the whole
view, chosen by the scene the player is in. A neighbour seen through an open door is therefore lit
like the current scene, and a different preset on either side flips the whole view at the
threshold. This was measured at the corridor ⇄ hub door when the preparation scene was still
`basic`: the mean brightness jumped by 14 to 20 levels (of 255) at that one step.

- The boot check rejects a walk-through pair whose scenes differ in `lighting`.
- Every shipped world scene is `enhanced`.
- The renderer fits the sun and its shadow box over every resident scene
  (`WorldRenderer.fitSun`, the one-light model of Low since phase UX2).

Details: [phase-ux1-report.md](phase-ux1-report.md).

**Room lights (phase UX2).** A room lights itself from its own fixtures.

- **Data.** Its `lights` field lists `{ fixture, role, lux?, target?, color?, penumbra?, reachHeight? }`:
  - `fixture` names a placement of the room whose item glows (`material: "light"`);
  - `role` is `key` (it casts the room's shadows, one per room) or `fill` / `accent` (no shadows).
- **Placement** (`world/lighting.ts`). Each becomes a spot light just under its fixture, aimed
  straight down or at `target`:
  - the key's cone reaches every corner of the room at `reachHeight` (the floor by default; the
    labs give 0.9 m, their bench tops — lighting polish);
  - each fades over `penumbra` of its cone (0.6 by default; the labs' keys 0.25, so their light
    reaches the benches by the walls, not only the middle of the room);
  - a fill's cone stays inside the walls;
  - intensity = lux × height², in the fixture's colour.
- **Walls.** Walls and ceilings cast shadows, so a key light stays in its room.
- **The pool.** The renderer keeps a fixed pool (`LIGHT_SLOTS`: 4 keys, 6 others), so a door
  opening changes no shader. The boot check rejects:
  - a light under a placement that is not a glowing fixture of its room;
  - two keys in one room;
  - a `reachHeight` on a light that is not a key, or not below its fixture;
  - a scene, or a pair of scenes joined by a door, that needs more lights than the pool holds.
- **Which model runs.** Room lights are the Medium and High presets. Low keeps the one-light model,
  the default on a software renderer ([game-core.md](game-core.md)).

Details: [phase-ux2-report.md](phase-ux2-report.md).

A placed object becomes a `WorldEntity` with id `<room id>/<placement id>` — stable across
sessions, used as the save key for its state — and a `Pose`: the **centre** of its box (placement
base + half its height) and a rotation quaternion. Physics updates the pose of dynamic objects;
renderer and interaction read it. Placements and spawns must lie inside their room(s); a
scene's `spawn` must also leave the player's capsule room: at least 0.4 m (`STAND_CLEARANCE`)
from every wall and from every solid object (static or dynamic body; footprints are the item's box
turned by `rotationY`).

### Doors and arrival points (Phase 6A)

Two ways lead from room to room. **Openings** join rooms of one scene: the player walks through,
nothing is teleported. **Doors** (items with the `travel` behaviour) load another scene; each
door names where the player comes out:

```
"params": { "targetScene": "teacher-room", "label": "Go to Teacher Room",
            "arrival": "teacher-room/door-preparation" }
```

`arrival` is the entity id of a door in the target scene. The player is put
`ARRIVAL_DISTANCE` (1 m) in front of it, on its face that points into its room, looking into the
room — so the door just come through is behind them and not targeted, and nothing can pull them
back through it. The point is computed from the door's placement (`arrivalPose` in
`src/world/arrival.ts`), never from where the player was, so repeated trips land on exactly the
same spot. Directions are independent: each door names its own arrival, so one-way doors are
allowed. Without `arrival` the player arrives at the scene's `spawn` — documented fallback, also
what the developer scene jump (F3) uses: a teleport, not a door.

Content validation rejects, with a path (`rooms.<room>.placements.<door>.params.arrival: …`): an
arrival that is not a placement in a room of the target scene, a placement that is not a door,
a door with no unambiguous inside face (both or neither side 1 m out has room to stand), and an
arrival point within 0.4 m of a wall or a solid object. The shipped doors pair up both ways:
Preparation Room ⇄ Teacher Room, cleanroom corridor ⇄ hub, hub ⇄ each laboratory.

### Walk-through doors and the campus (phase WX)

Every shipped door is a `sliding-door` (`door: { travel 1, openS 0.6, closeS 0.6 }`, a kinematic
leaf 1.0 × 2.1 × 0.08 m). The placements and ids are the same as before; each door is now one leaf
of a **pair**: two doors of two scenes, each naming the other as its `arrival`, back to back
through their walls. Each wall has a 0.9 × 2.0 m opening behind its leaf.

Opened, both leaves slide `travel` m along their own +x and the player walks from one scene into
the other; nothing is teleported. `arrival` is now used in two places only:

- where Continue puts a player whose saved spot became unsafe (`continuePose`,
  `src/world/arrival.ts`);
- a door without `door` (test fixtures), which still loads the other scene at its arrival point.

The pairs place the scenes in one **campus frame** (`src/world/campus.ts`). It is computed at boot
from the pairs and never stored: wall faces one wall thickness apart, doors at the same point along
the wall, floors level. Each scene keeps its own coordinates and ids. Offsets from the hub:

| Scene            | Offset (m)      |
| ---------------- | --------------- |
| Physics Lab      | (18.25, 0, −3)  |
| Chemistry        | (0, 0, −16.25)  |
| Biology          | (−18.25, 0, −3) |
| Preparation Room | (0, 0, 17.5)    |
| Teacher Room     | (5.75, 0, 18.5) |

A scene next to the current one is attached in the current scene's coordinates: its rooms are
translated by the difference of the two offsets.

Content validation runs only when everything else passed. It rejects, with a path:

- a door pair that is not mutual, or not back to back;
- a missing or uncovered opening;
- a solid in a leaf's slide path;
- a loop of doors that would put a scene in two places;
- rooms of two scenes closer than a wall in the campus.

Two tests keep space clear:

- `doorBands.test.ts`: no furniture within 2 m of any door along its wall, or within 1.2 m in
  front of it. The one exception is door hardware tagged `door-trim` (a jamb, the track rail,
  small wall plates): within 0.05 m of the wall face and 0.01 m clear of the box the leaf sweeps
  from closed to open. The track cover (`door-header`) hangs above the band, from 2.2 m;
- `stationZones.test.ts`: nothing in the Physics Lab's station zones but each station's own
  fittings.

### Walls and doorways

Every room is closed by a floor, a ceiling and four walls, 0.25 m thick (`WALL_THICKNESS`), just
outside its bounds — the inner faces are the bounds. One function, `roomSlabs` in
`src/world/roomGeometry.ts`, turns a room into these boxes; physics builds its colliders and the
renderer its meshes from it, so what is drawn is what blocks.

Rooms of one scene connect through **openings**: a gap from the floor up to `height`, `width`
wide, centred at `center` along the wall (a world x coordinate on north/south walls, z on
east/west walls; north = −z, east = +x). The wall is built as the pieces beside the opening plus a
lintel above it. Two rooms share a wall when they are exactly one wall thickness apart, and each
lists the doorway on its own side:

```jsonc
// Preparation Room: z −3 … 3        cleanroom corridor: z −11.25 … −3.25 (0.25 m further north)
"openings": [{ "wall": "north", "center": 0, "width": 1.2, "height": 2.2 }]
"openings": [{ "wall": "south", "center": 0, "width": 1.2, "height": 2.2 }]
```

Validated at load (`src/game/content.ts`):

- an opening fits its wall (within the wall's length, no taller than the room) and does not
  overlap another opening in the same wall;
- in every world scene, each opening of each room **lies on a wall shared with another room of
  the scene** that has the same opening (same wall plane + 0.25 m, same floor level, same centre,
  width and height). An opening into the void, a mismatched pair or rooms too far apart fail with
  e.g. `scenes.preparation-room: rooms.preparation-room.openings.0 (south wall) does not lead into
another room of the scene (same opening, 0.25 m away)`.

The player's room (`PlayerEnteredRoom`) changes when they step into the next room's bounds; inside
the doorway (the 0.25 m wall gap) they still count as in the room they came from.

Shipped scenes: Main Menu; **Preparation Room** — the Preparation Room and the **cleanroom
corridor** joined by a doorway, the corridor ending at the door to the hub; Teacher Room; SIMLAB
Hub (26 × 18 × 9 m since phase WX; Chemistry north, Physics east, Biology west, the clean corridor
south); Physics/Chemistry/Biology Laboratory. Other scenes are one room each, joined by doors
(walk-through since phase WX).

A laboratory with no `experiments` is planned, and says so where a player meets it (Phase 14): the
doors into it read "Enter … Lab (no experiments yet)", and a sign inside reads "PLANNED · NO
EXPERIMENTS YET", in both languages. None is planned now: the Chemistry and Biology Labs said so
until their first stations. A test (`catalog.test.ts`) checks every laboratory both ways: a
planned one must say it, one with experiments must not.

| Room               | Bounds (x, z)              | Grey-box furniture and equipment                                                          |
| ------------------ | -------------------------- | ----------------------------------------------------------------------------------------- |
| Preparation Room   | −3 … 3, −3 … 3             | bed, desk, chair, desk lamp (toggle + grab), storage cabinet, door to the Teacher Room    |
| Cleanroom corridor | −1.5 … 1.5, −11.25 … −3.25 | lockers, gowning bench, hand-wash basin, PPE shelf, door to the SIMLAB Hub at the far end |

The cleanroom items describe what they are for; the PPE and hand-washing sequence itself is
planned (next phase), so they only offer Inspect.

### Add a room and scene

Add the room to `rooms.json`, a `world` scene listing it to `scenes.json`, and a door pair
(`"item": "sliding-door"`, `params.targetScene` and `arrival` naming each other, back to back, with
an `opening` in both walls) that leads to it — or put it next to a room of
an existing scene (0.25 m apart) with matching `openings` on both sides and list it in that
scene's `rooms`.

## Experiments and simulation

**An experiment describes; a simulation model runs.**

```
ExperimentDefinition (JSON)               SimulationModel (code, by id)
  id, name, category, description           id
  requiredEquipment[] (item ids)            inputs[]      ids it reads
  model ─────────────────────────────────►  variables[]   state slots (Float64Array)
  parameters[] {id,label,unit,default,min,max,   init(inputs, state)
               symbol?, step?, presets[]}   step(state, dt, inputs) → time advanced (≤ dt)
  initialConditions {id: number}            isComplete?(state)
  inputs {id: {symbol, unit, desk?}}        (how instruments show initial conditions, 6C.2;
                                             desk false: panel and CSV only, not a bench desk)
  simulation {timeStep, maxDuration, sampleInterval}   predictions[]?, predict?(inputs)
  measurements[] {id,label,unit,variable,symbol?}
  results[] {id,label,unit,variable,symbol?,reduce: final|min|max, theory?,
             classes?[] {max?, label}}  (names for ranges of the value, ascending by max, only
                                         the last without one; shown beside the number)
  graphs[] {id,title,x,y[],yLabel?,mark?}   (x, y: "time" or measurement ids; mark: a model
                                             prediction drawn on the x axis of live screens)
  monitor?                                  (graph id the results monitor draws; default first)
  compare[] {graph, series?}                (graphs overlaid when runs are compared, 6C.3;
                                             series: the one to overlay from a multi-series graph)
  instruments[] {result, quantity, name,    (6C.4: reads a result to the resolution held by
                 resolution, excludes}       parameter `resolution`; see experiments.md)
  note                                      (what theory and measurement mean, under results)
  procedure[] {id,instruction,done}         (done: inspected{item} | loaded |
                                             adjusted{parameter?} | completed | viewed | reset)
```

`ExperimentRuntime` (`simulation/ExperimentRuntime.ts`):

```
definition + parameter overrides ─► inputs (defaults, range-checked)
ready ─start─► running ⇄ paused ─► completed (endReason: model | time-limit) | stopped | failed
fixed timestep (accumulator, ≤ 2000 steps per frame) → samples (preallocated) → results
```

- `variable: "time"` reads the simulation clock.
- Models may return less than `dt` to stop exactly at an event (the free-fall model solves
  ground contact analytically, so results match t = √(2h/g) to ~1e-12).
- min/max results are tracked every step, not only at samples.
- Non-finite state, a throwing model or a model that stops advancing ⇒ `failed` with the reason.
  No result is ever invented.
- `endReason: time-limit` means `maxDuration` cut the run short; progression does not count it.

- `theory` names a model prediction (closed form); boot rejects unknown ones, and unknown graph
  `mark`s. Presets must lie within min…max; ids within a definition are unique; graph series
  must be measurements; `monitor` must be one of the graphs, `inputs` keys initial
  conditions, an `adjusted` milestone's `parameter` one of the parameters, and a `compare`
  entry an existing graph — naming a `series` it plots when it plots several. An instrument
  reads an existing result (one instrument per result) in a unit of `READING_UNITS` (`m`, `m³`, `s`,
  `mL`, `g`, `kg`, `N`, `V`, `A`, `J`, `Pa`, `°C`, `°`, `pH`, `mol/L`: linear scales), its resolution parameter
  is in that unit with min > 0, and the model may not read that parameter. A result's `classes`
  ascend by `max`, only the last leaving it out; their labels are translated like any content
  text. A bench station's experiment has at most 4 parameters: its desk has a dial for each.

`ExperimentSession` (Phase 6B) is one experiment set up at one place: parameters, whether its
apparatus is ready, its current run and (Phase 6C.3) the `history` of its ended runs as frozen
`RunRecord`s, at most `RUN_HISTORY_LIMIT` (20); states
`idle → configured → running → stopped | completed`.
`ExperimentSystem` owns the sessions, ticks running ones and publishes
`ExperimentStarted/StateChanged/ParameterChanged/Completed/Failed`. Stations, the models and
the results panel: [experiments.md](experiments.md).

Shipped: **free-fall** (`kinematics.free-fall`, Phase 6F station: h 0.2–3 m, g 1–25 m/s² with
Moon/Mars/Earth/Jupiter presets, timer resolution d; measures height, velocity, acceleration;
results fall time and impact velocity, each with its theory; three graphs; a five-step
checklist); **projectile-motion** (`kinematics.projectile`, Phase 6B: v₀ 1–15 m/s, θ 0–90°, g
1–25 m/s² with Moon/Mars/Earth/Jupiter presets; measures x, y, vx, vy, speed; results flight
time, range, maximum height, impact speed, each with its theory; three graphs; a five-step
checklist); **pendulum** (`mechanics.pendulum`, Phase 6C.2: L 0.25–3 m, θ₀ −60…60°, g with the
same presets; bob mass and ω₀ as initial conditions; measures θ, ω, α, x, y, energies; results
the period against both the small-angle T₀ and the exact period, amplitude, maximum speed and
energy; four graphs; a six-step checklist).

### Subjects and topics (Phase 8)

Four concepts, kept apart:

| Concept    | What it is                                    | Where                                          |
| ---------- | --------------------------------------------- | ---------------------------------------------- |
| Subject    | physics, chemistry, biology, …                | `LAB_TYPES`: experiment `category`, lab `type` |
| Topic      | experiments grouped for learning (kinematics) | `topics.json`                                  |
| Experiment | what is simulated and measured                | `experiments/<id>.json`                        |
| Station    | where it is played: apparatus and controls    | `lab-placements.json` (`experimentId`)         |

A topic names its subject and lists its experiments; it is not a place, so its experiments stay at
their stations wherever those stand. The lab pack's load checks that every listed experiment
exists and has the topic's subject, that every experiment is in at least one topic, and that no
topic is empty — a topic exists only once it has an experiment to play. Shipped: **kinematics**
(free-fall, projectile-motion), **dynamics** (hookes-law, Phase 14A; inclined-plane),
**oscillations-and-waves** (pendulum), **electricity** (ohms-law) and **optics** (refraction) in
physics; **acids-and-bases** (acid-base-titration), **reaction-kinetics** (reaction-rate) and
**states-of-matter** (heating-curve) in chemistry; **cells** (microscope),
**membrane-transport** (osmosis), **enzymes** (enzyme-activity) and **photosynthesis**
(photosynthesis) in biology.

Players find them in the **Experiment catalog** (Phase R4; before it, the main menu's
"Experiments by topic", Phase 9), a page of the main menu opened from its button
(`src/platform/ui/ExperimentCatalog.ts`). `subjectCatalog` groups by subject — each laboratory
type once, named by its laboratory, a planned one (no topics) saying "No experiments yet" — the
topics `topicCatalog` (`src/game/catalog.ts`) builds from the content alone: each topic, its
experiments, and for each the world scene and room of its stations — the placements that name it as `experimentId` — or "no
station yet" when it has none, so it is not shown as playable. The scene and room names are the
content's, translated like any content text; nothing about topics is written in the UI code.
Under each experiment's name stand where it is played and its `description` — what it teaches —
in the language shown (Phase 13B; "No learning objective written yet" when the content gives
none). Opened, its row shows how to run it — its `procedure` steps, the checklist the station
follows — the ways below, and, folded once more, the model's `note`. An experiment that the
save Continue would load has run to a natural end at least once is marked "Run completed", the
others "Not yet run to the end" (Phase 13C,
`Game.savedCompletedExperiments`: that save's `progression.completedExperiments`, kept to the
content's experiments). It says a run ended by itself, not that anything was learned. The
experiments are the lab pack's: the catalog loads it the first time it opens, says "Loading the
experiments…" meanwhile, or why it could not, with Try again — never a made-up entry (INF-1).

In each row, the way to its station's scene from where a new game starts (Phase 11,
`routeBetween`): the scenes through the fewest doors — placements with a `targetScene` — and the
procedure that gates a door, named before the scene it opens (Cleanroom entry before the SIMLAB
Hub). It only informs: nothing moves the player, and the doors and their gates work as before. A
room belongs to one world scene (checked at boot), so a station's scene is never ambiguous.

With a save that Continue accepts, a second line gives the way from the save's scene (Phase 12B):
"From your saved game: SIMLAB Hub → Physics Laboratory", or that the save is already there.
`Game.savedScene()` reads the save through the same check as `continueGame` — the backup if the
save is damaged; its character and a world scene must still exist — so the menu never shows a way
from a save Continue would refuse, nor from the scene being played.

The catalog only reads: browsing it moves nothing and starts nothing (no Play button — New game and
Continue start the game); it is closed by its Back button or Esc. Nothing about it is saved.

### Add an experiment

1. If no existing model fits, implement `SimulationModel` in `src/simulation/models/`, add it to
   `BUILT_IN_MODELS`, and test it against an analytic or reference solution.
2. Add the definition as `src/content/experiments/<id>.json` (model id, parameters, measurements,
   results); the lab pack gathers that folder (`import.meta.glob`).
3. List it in its laboratory and in a topic of its subject (`topics.json`), and build a station:
   an apparatus item and its controls (`items.json`), placed in its lab (`lab-placements.json`) —
   [experiments.md](experiments.md#adding-an-experiment). None of it reaches the menu's JavaScript.
4. `npm test` validates inputs/variables/predictions against the model (the game: when the lab
   pack loads).
