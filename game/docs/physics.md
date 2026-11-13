# Physics

Rapier 3D (`@dimforge/rapier3d-compat` 0.21.0, WebAssembly) simulates collisions and objects in the
3D world. Everything Rapier-specific lives in `src/physics/`; ESLint rejects Rapier imports
anywhere else. Scientific experiments do **not** use this engine — see
[data-model.md](data-model.md#experiments-and-simulation).

## Ownership and lifecycle — `src/physics/PhysicsSystem.ts`

One `PhysicsSystem` (a `GameSystem`, id `physics`) owns **one Rapier world for the whole game**,
created by the first `load()` and freed in `dispose()`. Scene changes add and remove bodies in
that world; nothing creates a world per frame or per scene.

### Loading (lazy, since Phase 2.1)

Rapier is **not** part of the startup bundle. `src/physics/rapier.ts` imports it with a dynamic
`import()`, so Vite puts it (with its WebAssembly) in a separate chunk, and nothing requests that
chunk until a world scene needs physics:

```
boot ─ init(): subscribe only ─────────────► menu   (status idle — Rapier not downloaded)
New game / Continue / any world scene
  └─ SceneManager.load ─ await prepareWorld = physics.load() (+ the renderer's load, Phase C2)
        idle → loading: import() chunk, rapier.init() (WASM), create world + controller
        loading → ready  ─► scene is built, phase "playing", physics steps
        loading → failed ─► load rejects, current scene and phase kept, error shown, retry allowed
dispose() ─► disposed (a load still in flight creates no world)
```

- `load()` is idempotent: concurrent and repeated calls share one promise, so Rapier is fetched
  and the world created once per game (later world scenes resolve immediately).
- No world scene can exist without physics: `SceneManager` awaits `prepareWorld` before tearing
  down the current scene or spawning anything, and physics only steps while `ready` and playing.
- Both the dynamic import (module cache) and Rapier's `init()` (returns early when instantiated)
  are idempotent, so no module-level Rapier singleton is kept.
- Failure (e.g. no WebAssembly) is logged on the `Physics` channel and surfaces as
  "Physics engine could not be loaded: …" in the main menu; the game stays on the menu.

| Owner event           | Physics does                                                                    |
| --------------------- | ------------------------------------------------------------------------------- |
| `init()` (boot)       | subscribe to the events below; no Rapier                                        |
| `load()`              | download + initialize Rapier once, create world + character controller          |
| `EntitySpawned`       | create a fixed or dynamic body + collider from the item, keyed by entity id     |
| `EntityDespawned`     | remove that body (and its collider)                                             |
| `SceneLoaded` (world) | build room slabs and the player capsule, then refresh scene queries (see below) |
| `SceneUnloaded`       | remove room slabs and the player capsule                                        |
| `dispose()`           | unsubscribe, `world.free()`; later `update()` calls are no-ops                  |

Bodies are tracked in a map by stable entity id (never by array index). A duplicate spawn is
logged and ignored. Loading behaviour is tested in `src/physics/physicsLoading.test.ts`.

**Scene-query refresh.** Rapier's character controller only sees colliders that have been
through a step. Measured: without a refresh, a capsule spawned against a bench moved 7.5 cm into
it on the first frame. After building a scene the system runs one zero-length step
(`timestep = 0`), which registers new colliders without advancing the simulation. A teleport
calls `propagateModifiedBodyPositionsToColliders()` for the same reason.

## Fixed timestep

| Setting (`config.physics`) | Default   | Meaning                                                       |
| -------------------------- | --------- | ------------------------------------------------------------- |
| `fixedStep`                | 1/60 s    | Every Rapier step is exactly this long (allowed 1/240 … 1/30) |
| `maxSubSteps`              | 6         | Steps per rendered frame at most; extra time is dropped       |
| `gravity`                  | 9.81 m/s² | Downwards                                                     |

`update(dt)` adds the frame time to an accumulator (capped at `fixedStep × maxSubSteps`) and runs
whole steps while it holds at least one step. Frames already arrive capped at 0.1 s (`main.ts`),
and 6 steps are 0.1 s, so the game keeps real time down to 10 fps (until Phase 6B the cap was 5
steps: below 12 fps everything ran in slow motion).
Consequences: rendering and simulation rates are independent; a slow frame makes the simulation
lag behind real time rather than spiral; identical step sequences give identical results
(tested with irregular frame times). Measured (Phase 6C.1, Node, Physics Lab): a step costs about
0.02 ms, so even a capped 0.1 s frame (6 steps, plus 100 model steps while a projectile flies)
takes about 0.25 ms of CPU — the cap can never feed a catch-up spiral. Physics steps only while `session.phase === 'playing'`; the
accumulator is reset when not playing so a pause never turns into a burst of catch-up steps.

**Synchronization.** After the steps of a frame, physics writes results back once: the player's
feet position and `grounded` into `GameState`, and the pose (centre position + quaternion) of every
awake dynamic body into its entity's `Pose`. Interaction targets, gameplay and stations read those
authoritative values.

**Drawing between steps (Phase P3.12).** The screen may refresh faster than physics steps (300 Hz
on the development laptop): drawn as last stepped, the player's position and dynamic bodies moved
in 1/60 s jumps under a view that turns every frame, and a held object sawed ±5 px against it. The
renderer now draws `renderPlayer(out)` and `renderPose(id, position, rotation)` instead:

- the last two steps blended by α = accumulator / `fixedStep` (0–1): the world as it was one
  step ago (16.7 ms), moving evenly; the view's rotation is not delayed (the latest input);
- what is held: its place as seen from the eye at each of the last two steps, blended, then shown
  in the view as it is now — so it stays steady in the view while turning at any frame rate;
- driven bodies (a pose driver poses them every frame) and fixed bodies: as they are;
- snapped (drawn where they are, no blend) on a teleport, a scene load, a new body, the end of
  driving, and every frame physics does not step for (menus, loading).

The previous poses are copied from Rapier just before each step into buffers made with the body;
nothing is allocated per frame, and nothing drawn is written back: physics computes exactly what it
did (tested bit for bit). Measured on the RTX 5070 Laptop (headless, 300 Hz frames): a walking
player's drawn error against even motion fell from 15 mm to 0.03 mm, and a held object's wobble
while turning from 10.6 px to 0.15 px. At the 90 FPS cap the steps sample the turning view
unevenly, so the held body's own lag varies (4.8 px drawn, from 10.8). Details:
`docs/phase-p3.12-report.md`.

## Colliders from data

- **Rooms**: one fixed body per room with cuboid slabs from `roomSlabs` (`src/world/roomGeometry.ts`):
  floor, ceiling and four 0.25 m walls just outside `bounds`, a closed room is six slabs. A wall
  with an **opening** (doorway, [data-model.md](data-model.md#walls-and-doorways)) is built as the
  pieces beside it plus a lintel above, so the doorway wall of the Preparation Room is three
  colliders. The renderer draws the same slabs (at half thickness, so the two rooms of a doorway
  never draw coinciding faces), so what is drawn is what blocks. Two connected rooms are one wall
  thickness apart: their wall slabs overlap in the shared wall and their floor slabs overlap under
  the doorway, so the floor is continuous (fixed–fixed overlaps cost nothing). Measured: walking
  straight through the 1.2 m doorway leaves x unchanged (< 1 mm, no jamb contact) and the speed
  unchanged; beside it the capsule stops at the wall face + 0.31 m (± 1 mm) from both sides; a ray
  at eye height through the doorway reaches the hub door 12.16 m away, one beside or above it hits
  the wall at 4 m.
- **Items**: the collider is the item's visual primitive at the entity pose — `box` → cuboid,
  `sphere` → ball (diameter `size[0]`), `cylinder` → Y-axis cylinder. `physical.body` decides:
  `static` (fixed body), `dynamic` (simulated), `none` (visual only, no collider). An item
  with `hinged` (UX3.1: the PPE cabinet, the washroom door) has a fixed body with one cuboid per
  `carcass` box (none for the door: only its leaf is solid) and a kinematic body per leaf, turned
  about its hinge to the hinge system's fraction (`setSwing`) inside the fixed step, like a sliding
  leaf (`setNextKinematicTranslation` + `Rotation`; posed directly at spawn, open or not as its
  state says). Open, nothing stands at the cabinet's mouth; its sides and back stay solid. The
  hinge system holds a leaf rather than let it push the player.
- Entity poses are the **centre** of the item's box (`entityFromPlacement` converts the placement's
  base point), so body, collider, mesh and interaction box share one origin.

## Physical properties policy

| Property    | Source                                   | Notes                                                       |
| ----------- | ---------------------------------------- | ----------------------------------------------------------- |
| mass        | `physical.massKg` (> 0)                  | Authoritative; Rapier derives density and inertia from it   |
| friction    | `physical.friction` (0–2)                | Rapier combines pairs by average                            |
| restitution | `physical.restitution` (0–1)             | Average with the other surface; < 1 so bounces always decay |
| damping     | `linearDamping`, `angularDamping` (0–10) | Dynamic bodies only                                         |
| CCD         | `physical.ccd`                           | For small, fast objects (on for the 8 cm steel ball)        |
| shape/size  | `visual.shape`, `visual.size` (> 0)      | Sphere: all axes equal; cylinder: x = z (validated)         |

Invalid values fail content validation at boot with their JSON path. Runtime bodies never enter
save data; dynamic objects return to their placements when a scene loads.

## Player character controller

The player is a **kinematic capsule** (radius `config.player.radius` 0.3 m, total height = the
character's `heightM`) moved by Rapier's `KinematicCharacterController`, separate from the
camera:

1. `PlayerSystem` turns input into `player.moveIntent` (horizontal m/s) and yaw/pitch.
2. Each fixed step, `PhysicsSystem` asks the controller to move the capsule by
   `intent × step` horizontally and `verticalSpeed × step` vertically, applies the corrected
   movement, then steps the world.
3. Gravity accumulates `verticalSpeed` only while **airborne**. Measured: pushing a grounded
   capsule into the floor every step cost 1–6 % of horizontal speed; with snap-to-ground
   (0.1 m) and no push the walking speed is 2.1999 m/s for 2.2 requested and feet stay within
   about 2 mm of the floor.
4. The controller keeps a 1 cm skin; physics subtracts it, so feet read y ≈ 0 on the floor.
5. Slides along walls are enabled; autostep is off (all floors are flat). Dynamic objects are
   obstacles: the player does not push them yet (`setApplyImpulsesToDynamicBodies(false)`), and
   being kinematic, the player cannot be launched by them.

**Neighbour scenes and door leaves (phase WX).** A scene attached beside the current one adds its
room slabs as their own fixed bodies (`SceneAttached`) and removes them on `SceneDetached`; its
placements' bodies come and go with their entities. One world, one capsule throughout: walking into
the attached scene changes nothing in physics. A walk-through door's leaf is a kinematic body
(`physical.body` "kinematic", only with `door`). The door system sets its opening fraction
(`DoorDriver`), and physics moves the leaf inside its fixed step with reused vectors. A leaf pushes
what it meets, but the door system never closes it while the player's capsule or a dynamic body is
in its path (0.1 m margin; `dynamicBodyIn` is the query). The opening in each wall (0.9 × 2.0 m) is
built from `roomSlabs` like any doorway: the pieces beside it plus a lintel.

**Known Rapier effect: a dropped slide step (investigated in phase WX).** Sliding along a wall it
touches, Rapier's character controller (0.21) sometimes drops the whole slide of one fixed step.
That step moves only the 0.1 mm normal nudge; the next step slides normally again.

The mechanism, logged step by step:

- The cast hits the wall at time of impact 0, then the floor at 0, then the wall again.
- After that third hit, only the nudge is left of the remaining translation.

What changes it:

| Setting                | Stalled steps / 2400 |
| ---------------------- | -------------------- |
| Our settings (default) | 22                   |
| Snap-to-ground off     | 1                    |
| Normal nudge 0         | 2095                 |

Snap-to-ground and the nudge are deliberate settings, so both stay.

**It is not caused by doorways.** The dropped steps happen on a continuous wall just as on a wall
split by an opening:

- **Pure Rapier, floor and wall only, at the game's settings, 40 starts × 60 steps:**

  | Wall                                                                        | Stalled steps |
  | --------------------------------------------------------------------------- | ------------- |
  | The preparation room's east wall as it was before the door (z −3.25 … 3.25) | 10            |
  | The piece beside the door (z −3.25 … 0.55)                                  | 8             |
  | A 20 m wall                                                                 | 22            |

  Along the piece, the doorway and the wall beyond it change nothing: the stalled steps are
  identical with and without them.

- **In the game, 52 starts along that wall:**
  - with the doorway: 3 stalled steps;
  - without it: 2.

  During a stall the only contacts are the wall piece and the floor, 0.78 m from the doorway's edge.

Which step is dropped follows the exact size of the wall's collider. The door changed that size,
which moved one dropped step into `PlayerSystem.test.ts`'s 0.5 s slide; that test now allows one
dropped step and nothing else.

Two different things that are not this effect:

- A player hugging a wall stops at a closed door leaf, which stands 9 cm out from the wall.
- Inside a doorway, the edge of the wall beside it (the jamb) is a real obstacle.

In a test that walks into an open doorway without its leaf, sliding along the wall catches on
that edge.

**Teleports.** Anything other than physics that writes `state.player.position` (scene spawn,
door arrival point of a door without `door`, Continue, the debug scene jump, tests) is detected on the next update and the
capsule is moved there; physics remembers the last position it wrote, so a different value means a teleport.

Room tracking (`PlayerEnteredRoom`) uses the position physics resolved on the previous frame,
so the event can arrive one frame (≈ 16 ms) after crossing.

## Precision

Rapier stores state as 32-bit floats: positions are good to ~1e-4 m and contact stops to about a
millimetre. Tests compare with tolerances, never exact equality. Measured, from the tests:

| Behaviour                      | Result                                                           |
| ------------------------------ | ---------------------------------------------------------------- |
| Ball speed in free flight      | equals g·t (4 decimals)                                          |
| Ball dropped 0.5 m onto bench  | bounces, never sinks > 5 mm, rests at centre y = 0.940 m, sleeps |
| Capsule walking into the bench | stops at face + 0.31 m (± 2 mm), keeps stopping while held       |
| Feet height while walking 10 s | \|y\| < 5 mm                                                     |

## Diagnostics

The debug panel (F3, dev builds) shows: the load status (`idle (Rapier not loaded)`, `loading`,
`ready … loaded in N ms`, `failed`), body and collider counts,
average milliseconds per step, `grounded`/`airborne`, and up to four dynamic bodies (the focused
one first) with position, speed and sleep state. Nothing is logged per frame.

## Bundle impact

The compat package inlines the 3.08 MB `.wasm` as base64 (`rapier.mjs` 4.34 MB). Phase 2 shipped it
in the startup bundle (5,017 kB, gzip 1,848 kB). Since Phase 2.1 it is a lazy chunk (sizes as
of Phase 6B; the entry was 686.2 kB in Phase 2.1 and 725.7 kB in Phase 6A):

| Production build (Vite)    | JS         | gzip       | Loaded            |
| -------------------------- | ---------- | ---------- | ----------------- |
| Entry (three.js + game)    | 777.2 kB   | 207.0 kB   | at startup (menu) |
| Rapier chunk (WASM base64) | 4,332.8 kB | 1,669.3 kB | first world scene |

Since Phase C2 three.js and the world renderer are a lazy chunk too, fetched at the same time as
Rapier for the first world scene: the menu's entry is 384,416 bytes, the renderer's chunk 588,464
and Rapier's still 4,332,821 ([phase-c2-report.md](phase-c2-report.md)).

The non-compat `@dimforge/rapier3d` (separate `.wasm`, 27 % smaller compressed, streaming
compilation) was investigated and not adopted yet: Vite 8 builds it, but the dev server needs
`optimizeDeps.exclude` and Vitest cannot resolve it in Node, so tests would have to run a
different Rapier build than the browser. Details: [phase-2.1-report.md](phase-2.1-report.md).

## Held objects

The player holds a body through `ObjectHolder` (`grab` / `release`), called by the interaction
system. Approaches considered:

| Approach                                                         | Verdict                                                                                                                                                         |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Switch the body to kinematic while held                       | Rejected: kinematic bodies are not stopped by walls or fixed bodies and shove dynamic bodies with unlimited force.                                              |
| B. Keep it dynamic and drive its velocity towards the hold point | **Chosen.** Walls, the bench and other objects still stop it through the contact solver; mass and materials stay authoritative; release is just "stop driving". |
| C. A separate kinematic carrier with hand-written collision      | Rejected: duplicates what the solver already does.                                                                                                              |

While held (`grab`): gravity scale 0, CCD on, collision groups set so the **player capsule and the
held object ignore each other** (the character controller also skips it) — a carried object can
neither block nor push its carrier, and the player is kinematic so it is never pushed anyway.

Every physics step (`driveHeld`, before `world.step()`):

1. hold point = eye + aim (pitch clamped ±50°) × `holdDistance` (`holdPoint` in `hold.ts`);
2. the body's own shape is **swept** from where it is towards that point (`castShape`, static
   colliders only, 2 mm clearance); if a wall or the bench is in the way the target is clamped to
   that surface — so the drive never pushes into static geometry;
3. velocity = (target − position) / 0.08 s, capped at 8 m/s; angular velocity 0 (orientation steady).

`release(velocity)` restores gravity scale 1, the item's own CCD setting and default collision
groups, and sets the velocity (zero for a drop, aim × impulse / mass for a throw); angular velocity
is reset. The body was dynamic all along, so nothing else changes: it is simulated normally from
the next step. The interaction system lets go before a scene unloads; if a held body is removed
anyway, `removeEntity` clears the hold binding.

Measured (unit tests and a measurement run, Physics Lab, 60 Hz):

| Behaviour                                        | Result                                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Grab → within 1 cm of the hold point             | 133 ms                                                                                         |
| Steady hold                                      | error 0.00 mm, spread 0.005 mm over 0.5 s (no jitter)                                          |
| Held against the west wall, hold point behind it | rests 2.0 mm off the wall (the sweep clearance); player still stops at x = −4.69 as without it |
| Held into the bench top                          | lowest centre 0.942 m (top + r + 2 mm)                                                         |
| Throw of the 0.25 kg ball                        | 10.000 m/s along the aim                                                                       |
| Thrown ball hitting the wall at 10 m/s           | max centre x 4.965 (≈ 5 mm transient contact penetration), bounces back                        |
| Drop over the bench                              | lands at the drop x/z, rests at 0.940 m, sleeps                                                |

**Line-of-sight rays.** `castRay(origin, dir, maxDistance)` returns the first solid hit (distance
and entity id, via a body-handle map), ignoring the player capsule and the held body; the
interaction system uses it to reject targets hidden behind other colliders.

## Experiment-driven bodies (Phase 6B)

A projectile in flight is the **scientific model's**, not Rapier's: the game physics would add
friction-free but 32-bit, collision-dependent motion and could never reproduce the theory. The
`PoseDriver` port (`hold.ts`, implemented by `PhysicsSystem`) hands such a body over:

- `drive(entityId)` — only a dynamic body that is not held: `setEnabled(false)` takes it out of the
  simulation (no contacts, no gravity, no sleeping), and write-back skips it. Returns false
  otherwise. The caller (`StationSystem`) then sets the entity pose itself, from the model state,
  every frame; the renderer and targeting read that pose as usual.
- `stopDriving(entityId)` — moves the body to the entity's current pose, zeroes its velocities,
  re-enables and wakes it: from the next step it is an ordinary object again (it settles where
  the run left it, can be grabbed, falls if unsupported).

A loaded ball sits in the launcher the same way (driven, at the muzzle), so it cannot roll off.
A new Rapier world takes one real step while still empty (`createWorld`): Rapier 0.21 panics
("unreachable") on the next step when a body is disabled after a world's first, zero-length
step — exactly Continue into the Physics Lab with a ball in the launcher (found and fixed in
Phase 6C.1; regression test: Continue, then RUN, in `StationSystem.test.ts`).
`stats()` counts driven bodies and the debug panel marks them "driven (its pose is set by an
experiment)". Removing the entity clears its driven flag. No gameplay code imports Rapier: the
station only sees the two-method port.

## Limitations

- Item colliders do not follow state-driven visual changes (an `open` cabinet's drawn-out part
  has no collider).
- The player does not push objects by walking into them; held objects follow by velocity, so
  a heavy carried object follows as quickly as a light one (mass matters in its collisions only).
- No rotation control for held objects; the hold point lags the player by at most one frame.
- No ramps/stairs support beyond the controller defaults (autostep off).
- No render interpolation between physics steps.
- The pendulum's bob (Phase 6C.2) is never a body: it is drawn at the model's angle, so it swings
  through the player and anything else in its path, and only the stand's base is a collider (the
  drawn frame is not solid).
- A projectile in flight passes through everything, the player included (the ideal model has no
  obstacles); the station refuses runs that would reach the far wall or the ceiling instead.
