# Phase WX report: world expansion (campus, hub, walk-through doors, furnishing, inventory)

Dates: 2026-10-27 to 2026-10-28. Base: `main` at `a1ca48c` with W0
([phase-w0-report.md](phase-w0-report.md)). Everything below is **uncommitted** in `main`'s
working tree, and nothing is pushed. The visual changes wait for the user's check on their own
display before any commit. How the work was split between agents, with ownership, waves and
checkpoints, is in [agents/TASK_BOARD.md](agents/TASK_BOARD.md) (section WX).

## A. Summary

**Milestone: PARTIAL.** Every automated check passes:

- `npm run check`: 1423/1423.
- E2E: 73/73.
- Build and bundle guard: PASS.
- GPU bench: PASS.

`PlayerSystem.test.ts:49-62` failed at first. It was investigated at the user's request (H.1): the
cause is a Rapier character-controller artifact that was present before the doors. The test now
checks each step of the slide.

What is missing:

- **No visual check yet.** The furnished rooms, the hub's lighting and the inventory UI have not
  been looked at on the user's display.
  - GPU numbers exist, but only from a headless run: B.3 and F.
- **Sliding doors only.** Hinged and automatic doors were not built (Checkpoint 1, decision 3).

What was built:

- **Walk-through doors.** The ten doors (five pairs) are sliding pairs. The player walks between
  scenes both ways: no teleport, no load screen, the view and control kept. The neighbour scene is
  attached before the door opens. The current scene changes at the threshold, and the scene left
  behind is released when its door closes.
- **A monumental hub,** 26 × 18 × 9 m (it was 12 × 12 × 4):
  - architecture: peristyle columns, beams, pilasters, clerestory bands;
  - the SimLab emblem: an oculus with the 3D emblem under it, and a floor emblem;
  - wayfinding: the wordmark, door headers and a directory;
  - furniture: reception, a pendant, benches, planters;
  - light panels and path lights.
- **Furnished rooms.**
  - Chemistry and Biology are furnished as planned labs, with no fake interactions.
  - The Teacher Room, its bathroom, the clean corridor and the Preparation Room have small
    additions.
  - The Physics Lab is unchanged; its station zones are kept clear by a test.
  - 47 new items, drawn by 30 procedural prop builders from one palette. Decor is drawn as
    `InstancedMesh` batches. The hub, Chemistry and Biology use `enhanced` lighting.
- **Inventory.**
  - A 9-slot hotbar: 1–9 and the wheel select, Q puts away and takes out.
  - A 27-slot panel on I.
  - Save version 3, with a migration from v2; Continue removes invalid items.
- **Continue checks the saved pose.** A pose that now lies in a solid, a wall or a doorway is moved
  to the nearest door's arrival point.

The architecture held throughout:

- one Game, one physics world, one renderer, one canvas;
- the C2 lazy split: three.js stays out of the menu chunk;
- scene, room and placement ids unchanged;
- `roomSlabs` as the only source of room meshes and colliders;
- experiments, run history and CSV work as before.

## B. World architecture

### B.1 Campus, scenes and doors

The scenes stay separate. They sit in one campus frame derived from the door pairs (`src/world/campus.ts`); nothing in it is stored. Offsets from the hub:

| Scene            | Offset (m)      |
| ---------------- | --------------- |
| physics-lab      | (18.25, 0, −3)  |
| chemistry-lab    | (0, 0, −16.25)  |
| biology-lab      | (−18.25, 0, −3) |
| preparation-room | (0, 0, 17.5)    |
| teacher-room     | (5.75, 0, 18.5) |

```
                     chemistry-lab (10 × 8)
                            │
 biology-lab (10 × 8) ── simlab-hub (26 × 18 × 9) ── physics-lab (+ projectile-range, pendulum-bay)
                            │  Cleanroom entry gate
       preparation-room scene: cleanroom-corridor ─ preparation-room ── teacher-room scene
                                                                        (+ teacher-bathroom)
```

| Door pair (both `sliding-door`, 0.9 × 2.0 m opening in both walls) | Gate                              |
| ------------------------------------------------------------------ | --------------------------------- |
| `preparation-room/door-teacher` ⇄ `teacher-room/door-preparation`  | exit of Cleanroom entry (PPE off) |
| `cleanroom-corridor/door-hub` ⇄ `simlab-hub/door-preparation`      | entrance of Cleanroom entry       |
| `simlab-hub/door-physics` ⇄ `physics-lab/door-hub`                 | —                                 |
| `simlab-hub/door-chemistry` ⇄ `chemistry-lab/door-hub`             | —                                 |
| `simlab-hub/door-biology` ⇄ `biology-lab/door-hub`                 | —                                 |

**Ids and coordinates.**

- No scene, room, placement or entity id changed.
- The hub's bounds grew to `[-13,0,-12]`–`[13,9,6]`, so its three lab doors moved onto the new
  walls.
- The ten door placements switched item (`door` → `sliding-door`), and every wall with a door got
  an `openings` entry.
- Old saves inside a new solid or wall are moved by Continue (`continuePose`).

### B.2 What each card delivered

| Card      | Delivered                                                               |
| --------- | ----------------------------------------------------------------------- |
| C1 (Lead) | hub shell, 26 × 18 × 9 m                                                |
| WX-D01    | scene residency (attach, release, enter; the session frame F3)          |
| WX-DS     | door state machine and geometry                                         |
| WX-W1     | Continue pose validation                                                |
| WX-I      | inventory: system, save v3, UI                                          |
| WX-P      | props, palette, decor batches, emblem shape                             |
| WX-F      | prop wiring in the renderer                                             |
| WX-C2     | furnishing content                                                      |
| WX-D2     | walk-through door content and wiring, fixes from the D01 and DS reviews |

Reviews ran on each card. Each reviewer gets one or four lenses, and every finding then gets two
verifiers that try to refute it. Confirmed findings were fixed, or routed to the card that owned
the file; the D2 review is covered in F.4.

### B.3 Measurements (renderer named on every line)

Draw calls and live WebGL objects per view: `e2e/draw-calls.spec.ts`, SwiftShader, medium quality,
at each scene's spawn. W0 baseline → now:

| View                   | draws     | Programs | Buffers   |
| ---------------------- | --------- | -------- | --------- |
| preparation-room/spawn | 36 → 46   | 1 → 3    | 140 → 170 |
| teacher-room/spawn     | 18 → 22   | 2 → 3    | 72 → 88   |
| simlab-hub/spawn       | 13 → 87   | 1 → 8    | 44 → 237  |
| physics-lab/spawn      | 265 → 266 | 11 → 11  | 531 → 535 |
| chemistry-lab/spawn    | 15 → 63   | 2 → 8    | 60 → 162  |
| biology-lab/spawn      | 15 → 68   | 2 → 8    | 60 → 169  |

Resources across walk-through trips (`e2e/resources.spec.ts`, SwiftShader):

- every GL object, body, collider and the 106 listeners repeat exactly, from the second trip on;
- hub: 28 bodies, 41 colliders; lab: 20 bodies, 45 colliders.

Real GPU: ANGLE NVIDIA GeForce RTX 5070 Laptop GPU, D3D11, headless Edge, 1280 × 720, pixel ratio 1.

- **`npm run bench --project=gpu-headless`** (Physics Lab, production build): PASS 4/4.
  - Every scenario runs at the 300 fps cap.
  - Frame 3.33 ms, CPU 0.7–0.9 ms, GPU 2.1–2.3 ms, 133–188 draws.
  - The Moon flight gives the same result at every frame rate from 300 to 5 fps.
- **Temporary probe** (dev build, deleted after use; copy at `overnight/wx/gpu-probe/`):

| View                                                 | fps | GPU ms (p95) | CPU ms | draws |
| ---------------------------------------------------- | --- | ------------ | ------ | ----- |
| hub spawn                                            | 300 | 2.35 (2.80)  | 0.47   | 87    |
| hub, from the east door                              | 300 | 2.04 (2.85)  | 0.49   | 95    |
| hub, emblem                                          | 300 | 2.06 (2.79)  | 0.51   | 96    |
| chemistry                                            | 300 | 2.24 (2.84)  | 0.46   | 63    |
| biology                                              | 300 | 2.16 (2.81)  | 0.48   | 68    |
| hub with the physics door open (two scenes resident) | 300 | 2.08 (2.68)  | 1.06   | 252   |

These are not numbers from the user's display or from a visible window.

**Bundle:**

- Menu chunk 451,225 B. It was 384,416 B at W0; the guard is 500,000 B and is unchanged. It holds
  no `__THREE__`.
- Renderer chunk 620,019 B, Rapier 4,332,821 B.
- `renderer.production.spec`: 451,162 B at the menu; 5,404,002 B after the world starts.

## C. Door system

**Residency.** `SceneManager.attach` and `release` keep a neighbour scene resident beside the current one. Its rooms are translated into the current scene's coordinates.

- Crossing a threshold makes that scene current (`SceneEntered`), with no load events and no
  teardown.
- An attach that fails or goes stale is rolled back and leaves a recoverable state.
- A released scene takes what is in its rooms. Objects of a scene that is still loaded go back to
  their placements.
- A placement whose object already exists elsewhere (carried, or taken out) is skipped.

**State machine** (`src/gameplay/door/DoorSystem.ts`; the pure geometry is in `src/world/door.ts`):

- closed → preparing → opening → open → closing → closed, plus blocked.
- E opens a closed door; "Close the door" is offered while it is not closed.
- An open door closes 1.5 s after the player is more than 2 m away. A procedure's door closes at
  once, but only after the player has come near it.
- Opening waits while the player stands in the rest of the leaves' path. Closing never slides into
  the player's capsule or a dynamic body (0.1 m margin): the door stays open and checks again every
  0.25 s.
- A failed preparation keeps the door closed, with the reason, and nothing is detached.
- The leaves are kinematic bodies, moved in the physics step without allocation.
- The game autosaves on `SceneEntered` and after a door closes. Door states are never saved.

**Procedures.**

- The Cleanroom entry's "entered" and its reset happen when the player walks through.
- Taking off required PPE is refused while the entrance is not closed.
- Procedure conditions count only their own scene's objects.

**No-teleport evidence.**

- Unit tests with real Rapier, in `src/world/doors.test.ts`:
  - Every pair is walked both ways, frame by frame, with no frame moving more than one walking step
    in the campus frame or as drawn.
  - The view stays untouched, nothing loads, the door closes behind, and the scene left is
    released.
  - The negative control, a teleport door, is detected.
  - Also covered:
    - never closing on a player in the doorway;
    - never closing on the steel ball left in the doorway (added after the review);
    - a failed preparation;
    - a load during preparing;
    - 3 round trips with identical counts;
    - a save at the crossing, then Continue;
    - the entrance gate and the PPE interlock.
- `src/world/arrival.test.ts`: 4 round trips end within 0.5 mm of the start, in the campus frame.
- E2E in the real app (`e2e/doors.spec.ts`, `transitions.spec.ts`, and the specs rewritten from
  teleport travel): walking through the three lab doors, the entrance, and the Preparation ⇄
  Teacher Room pair.
  - The debug panel's `Campus:` position is sampled at about 4 Hz. Each sample may move at most
    walking speed × the time since the last sample, plus slack, capped at 1 m, and never backwards.
  - A door teleport would move at least 2.3 m at once.

**Limits.**

- Sliding doors only.
- An object propped in the exit (Teacher Room) doorway keeps that door open, and nothing stops a
  player who puts PPE on from walking out (no interlock as at the entrance).
- The one-frame wall-slide stall: see H.1.

## D. Hub and laboratory environments

| Room                                | New placements | What                                                                                                        |
| ----------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| SIMLAB Hub                          | 65             | the architecture, emblem, wayfinding, furniture and lights listed in A                                      |
| Chemistry Lab                       | 21             | benches, cabinets, fume hood (prop), glassware, safety station, signage; still planned, no fake interaction |
| Biology Lab                         | 17             | benches, microscopes (prop), specimens, cabinets, a wall screen (off)                                       |
| Teacher room and bathroom           | 8              | bookshelf, chair, …                                                                                         |
| Preparation room and clean corridor | 7              | no solids                                                                                                   |
| Physics Lab                         | 0              | its 14 station zones are kept clear (`stationZones.test.ts`)                                                |

- **The SimLab logo.** The menu's emblem drawing is now shared data (`src/platform/ui/emblemShape.ts`, and the menu SVG is byte-identical). In the hub it appears as a 3D emblem under the oculus and as a floor emblem, together with the wordmark.
- **Materials and lights.**
  - One `Palette` of 24 finishes. Light and glass finishes never cast shadows.
  - No new dynamic lights; the shadow pipeline and shadow fit are unchanged. The three new rooms
    use the existing `enhanced` preset.
  - The emissive panels, path lights and pendant are materials, not lights.
- **Departures from the design.**
  - The four door portals were dropped, because they sat in the sliding leaves' band. Five
    placements were moved out of door bands.
  - The tacky mat was dropped, and the clean-zone floor was shortened.
- **To check on the real display:**
  - hub scale and emblem readability from all four doors;
  - the emissive balance of the oculus, clerestory, path lights and pendant;
  - shadows in the hub, Chemistry and Biology;
  - glass and specimen-jar sorting;
  - z-fighting of the floor emblem and the floor zones;
  - label legibility (directory, wordmark);
  - the headers without portals;
  - hotbar size, borders and item pictures.

## E. Inventory

- **Schema.** An item becomes carriable through its `inventory { stack, decorative }` field. An
  instance is its placement's entity id.
- **State.** `player.inventory { stacks [{ slot, item, placements[] }], selected }`, written only by
  `InventorySystem`.
- **Hotbar.**
  - 9 slots, bottom centre: pictures, counts, key numbers.
  - The selected slot is outlined; decorative items have a dashed border.
  - The selected item is named above the bar.
- **Panel (I).**
  - 27 slots: a single Tab stop, then arrows.
  - Click, Enter or Space picks up and puts down; Shift+Enter or a right click takes half.
  - Merging and swapping are supported.
  - It also shows details, a Take out button and the worn PPE (read-only).
  - It opens without pausing and releases the mouse; Esc or I closes it and recaptures the mouse.
- **Taking out.**
  - The item starts on the capsule axis.
  - If it is not clear of the capsule within 0.3 s, or is let go before that, it goes back to its
    slot with a reason. It never pushes the player.
- **Saves.**
  - v3, migrated from v2 (and from v1 through v2). The round trip is tested.
  - Continue removes unknown or invalid items and instances, with one warning each.
- **Rules.** PPE is worn, never stored. A carried instance is never spawned twice, and it crosses
  scenes with the player.
- **Limits.** No focus trap in the panel; Ctrl+digit in Edge was not checked; the wheel moves one
  slot per event on a trackpad; the panel fills about 640 of 688 px at 1280 × 720.

## F. Test results

All runs use Microsoft Edge. E2E runs on SwiftShader with the dev build, plus a production project.

| Check                                        | Result                                            | Command / evidence                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format                      | PASS                                              | `npm run check` (its first three steps)                                                                                                                                                                                                                                                                   |
| Unit tests                                   | PASS: 1423/1423, 76 files                         | `npm run check` (after the H.1 investigation; before it: FAIL 1422/1423, `PlayerSystem.test.ts:59`)                                                                                                                                                                                                       |
| Build                                        | PASS                                              | `npm run build`: menu 451,225 B, no `__THREE__`                                                                                                                                                                                                                                                           |
| E2E, full suite                              | **PASS** 73/73 (13.4 min; no flaky, none skipped) | `PLAYWRIGHT_JSON_OUTPUT_NAME=… npx playwright test --reporter=list,json`                                                                                                                                                                                                                                  |
| Door tests                                   | PASS                                              | `npx vitest run src/world/doors.test.ts src/gameplay/door src/world/door.test.ts src/world/campus.test.ts src/world/residency.test.ts src/platform/render/residencyRooms.test.ts src/platform/render/doorLeaves.test.ts src/world/doorBands.test.ts`: 102/102; e2e `doors.spec.ts`, `transitions.spec.ts` |
| World layout tests                           | PASS                                              | `layout.test.ts`, `layoutSweep.test.ts` (real Rapier), `stationZones.test.ts`, `doorBands.test.ts`, `arrival.test.ts`, `continuePose.test.ts` (in the unit run)                                                                                                                                           |
| Inventory tests                              | PASS                                              | `InventorySystem.test.ts` (16 tests); e2e `inventory.spec.ts` 2/2                                                                                                                                                                                                                                         |
| Save/load tests                              | PASS                                              | `persistence.test.ts` (v1/v2 → v3, round trip); `doors.test.ts` save at the crossing; `continuePose.test.ts`                                                                                                                                                                                              |
| Bundle guard                                 | PASS                                              | `renderer.production.spec.ts`: 451,162 B < 500,000 (guard unchanged)                                                                                                                                                                                                                                      |
| Resource checks                              | PASS                                              | `resources.spec.ts` (exact over trips 2–4; draws excluded, measured reason); `draw-calls.spec.ts` (stable over 10 frames)                                                                                                                                                                                 |
| Performance, GPU                             | PASS (headless)                                   | `npx playwright test -c playwright.bench.config.ts --project=gpu-headless`: 4/4; probe 8/8 (B.3)                                                                                                                                                                                                          |
| Performance, visible window / user's display | NOT RUN                                           | needs the user at the machine                                                                                                                                                                                                                                                                             |

### F.1 E2E runs during integration (SwiftShader)

| Tree               | Result                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| After wave A       | 58/63; the failures were page reloads from worktrees the Lead created, and they passed on rerun 64/64 |
| Hub shell          | 67/67                                                                                                 |
| UI and prop wiring | 69/69                                                                                                 |
| Furnishing         | 69/69                                                                                                 |
| D2 merged          | 68 passed, 1 failed, 4 did not run                                                                    |

In the D2-merged run, the failure was `inventory.spec.ts:50`. It still crossed doors as teleports and was rewritten to walk through them. That spec then passed 2/2 alone, and the 4 timed specs passed 4/4 alone.

### F.2 Existing assertions changed (each one deliberately replaced by this milestone)

- **Counts** (Z1 §7 and Z3 §7, recomputed for the merged content): bodies and colliders per scene,
  and entity and interactable counts.

  | Scene            | Bodies / colliders |
  | ---------------- | ------------------ |
  | Preparation Room | 14/32              |
  | Teacher Room     | 11/27              |
  | Hub              | 28/41              |
  | Physics Lab      | 20/45              |
  | Chemistry        | 20/27              |
  | Biology          | 13/20              |

  Files: `PhysicsSystem.test.ts`, `hold.test.ts`, `layoutSweep.test.ts`, `Game.test.ts`,
  `InteractionSystem.test.ts`, `WorldRenderer.test.ts`, `e2e/world.spec.ts`, `e2e/game.spec.ts`.

- **Teleport travel rewritten as walking:**
  - `e2e/game.spec.ts`, `experiment.spec.ts`, `grab.spec.ts`, `pendulum.spec.ts`,
    `preparation.spec.ts`, `production.spec.ts`, `topics.spec.ts`, `transitions.spec.ts`,
    `inventory.spec.ts`;
  - the `InventorySystem.test.ts` `through` helper;
  - `residency.test.ts` and `arrival.test.ts`, whose round-trip test now checks absolute campus
    positions to 0.5 mm.
- **Accepted by the Lead,** each with its reason:
  - `Game.test.ts`: the system list gains `doors` and `inventory`.
  - `content.test.ts`: "every shipped door" now means doors offering travel.
  - The `DoorSystem.test.ts` and `door.test.ts` changes made by the two DS review fixes.
  - `resources.spec.ts`: it now looks all round before reading. The frame's draw count is excluded,
    measured at 63 vs 62 and 192 vs 191. Every GL object is still compared exactly.
  - `StationSystem.test.ts`: a 0.3 s setup wait before a drop.
  - `residencyRooms.test.ts` and `propsWiring.test.ts` fixtures.
  - The `content.test.ts` campus-loop fixture door moved clear of a pilaster.

### F.3 Changed after an investigation

- **`PlayerSystem.test.ts:49-62`.** Changed after the investigation in H.1.
  - Before: it checked the end of a 0.5 s slide to 5 mm.
  - Now: every one of its 30 steps must slide the full step (±1 mm), except at most one step that
    does not move at all (< 1 mm); the end point is then checked to 5 mm.
  - Mutation checks: with slide off the test fails, and with the slide 5 % slower it fails.

### F.4 Review of WX-D2 (four lenses, two refute-biased verifiers per finding)

- **Confirmed and fixed:**
  - The round-trip drift test compared each trip with the first, so a steady drift passed. It now
    checks absolute campus positions after each trip, to 0.5 mm.
  - The e2e per-sample step bound grew with the gap between samples. It is now capped at 1 m.
  - No real-Rapier test covered "never closing on a dynamic body". One was added and
    mutation-checked: it fails when the door ignores bodies.
  - `resources.spec` had dropped VertexArray and Program from the exact comparison. They are back.
  - The content check ignored the leaf's height (a raised leaf left a gap below). Fixed, with a
    test case.
  - The vertical drift tolerance was 5 mm. It is now 0.5 mm.
  - Untested travel/close-door swap and autosave on closing: both are now tested.
- **Not confirmed:** opening after a capped frame. The opening check covers the whole remaining
  path to fully open, not one frame's step.

## G. Git state

- HEAD `a1ca48c` on `main`; no new commits, and nothing pushed (no remote is configured).
- Uncommitted:
  - 58 tracked files modified (4,023 insertions, 529 deletions; docs and the board included);
  - 51 untracked files (this report included);
  - `git diff --check` clean.
- Worktrees: `.claude/worktrees/w0a`, `w0b`, `w0c`, and `wx-c2`, `wx-d01`, `wx-d2`, `wx-ds`, `wx-f`,
  `wx-i`, `wx-i1r`, `wx-p`, `wx-w1`.
  - Their changes are all integrated in `main`; their patches and reports are kept outside the
    repository.
  - Not removed (the Lead does not delete worktrees before the user has checked the result).
- No stash.

## H. Next steps

1. **`src/gameplay/player/PlayerSystem.test.ts:49-62`: investigated at the user's request, closed.**

   **Cause.** Rapier's character controller (0.21) sometimes drops the slide of a single 1/60 s step
   along a wall it touches; it is a numerical and contact artifact, not a regression.
   - In the failing step the cast hits the wall at time of impact 0, then the floor at 0, then the
     wall again, and only the 0.1 mm normal nudge remains of the remaining translation.
   - It depends on snap-to-ground and the normal nudge. On one 20 m wall, 40 starts × 60 steps:

     | Setting                | Dropped steps |
     | ---------------------- | ------------- |
     | Default                | 22            |
     | Snap off               | 1             |
     | Nudge 0                | 2095          |
     | Nudge 1e-3             | 13            |
     | Second controller pass | 2             |

   - The door only changed the size of the wall's collider. Which step gets dropped follows that
     size, so the door moved a dropped step into this test's window.

   **Evidence** (logs and the two temporary investigation tests are kept in
   `overnight/wx/stall/`, outside the repository):
   - **The test's own run, every step logged.**
     - One physics step per frame; the desired move is (0.025927, 0, −0.025927) every step.
     - At step 9 the controller returns (0.000109, 0.000100, −0.000109), so the player moves
       0.11 mm instead of 25.9 mm.
     - The contacts in that step: the wall piece z −3.25 … 0.55 (normal −x) and the floor, nothing
       else. The player is at z −0.233, 0.78 m from the doorway's edge.
     - Velocity 0.009 m/s in that step, 1.556 m/s in every other step; grounded throughout.
     - Everything else unchanged: `PlayerSystem` and `PhysicsSystem.moveCharacter` are untouched
       by the milestone, and so are the controller's settings.
   - **Geometry before and after the door.**
     - Before: the east wall was one slab, z −3.25 … 3.25.
     - Now: z −3.25 … 0.55, a lintel over z 0.55 … 1.45 (y 2 … 3), and z 1.45 … 3.25.
   - **Minimal reproduction:** pure Rapier at the game's controller settings, floor and wall only, 40
     starts × 60 steps.

     | Wall                                               | Dropped steps                                                   |
     | -------------------------------------------------- | --------------------------------------------------------------- |
     | Continuous, the shape the wall had before the door | 10                                                              |
     | Continuous, 20 m                                   | 22                                                              |
     | Wall → doorway gap → wall                          | the same steps as the piece alone, for every start on the piece |
     - Two pieces meeting at a seam with no gap: 23 dropped steps, about the same as continuous
       walls.
     - So neither the gap, nor the wall beyond it, nor a seam causes the dropped steps.

   - **In the game, 52 starts along that wall, 30 steps each:**

     | Wall                               | Dropped steps |
     | ---------------------------------- | ------------- |
     | With the doorway                   | 3             |
     | Without the doorway (as before D2) | 2             |

     The effect exists without the door. The 9 starts within 0.3 m of the closed leaf are pressed
     against it in both geometries: a real obstacle, the same before and after.

   **Decision** (the user's rule 3): this is not a `PlayerSystem` regression and not an edge
   artifact of the new collider, so neither the implementation nor the colliders were changed.
   - Not changed either: the global physics tolerances (offset, snap, nudge), the colliders, and
     D2's behaviour.
   - The test was changed as described in F.3. It no longer depends on which step Rapier drops, and
     still fails on a slower slide or on catching.
   - `npm run check`: FAIL 1422/1423 before, PASS 1423/1423 after.
   - The e2e result (73/73) stands, because no runtime file changed after it.
   - Open: if the dropped step is noticeable in play, a fix belongs in how `PhysicsSystem` calls
     the controller, measured against the e2e suite.

2. **The visual review on the user's 300 Hz display** (list in D). Commit only after it.
3. **Exit door.** A PPE interlock at the exit like the entrance's, or a rule that an object in the
   exit doorway closes the procedure: `src/gameplay/procedure/ProcedureSystem.ts`.
4. **Hinged or automatic door types,** if wanted: a new `door` kind next to `travel` in `item.ts`,
   with the geometry in `door.ts`.
5. **Clean up the worktrees** (`.claude/worktrees/w0*`, `wx-*`) once the user is satisfied.
6. **Proposed CLAUDE.md rule** (not added; the user decides):

   > Doors are walk-through pairs (`sliding-door`): `DoorSystem` is the only authority for opening
   > and closing, the far scene is attached before a door opens and released after it closes, and
   > nothing is teleported. The inventory (`InventorySystem`) is the only writer of
   > `player.inventory`; PPE is never stored.
