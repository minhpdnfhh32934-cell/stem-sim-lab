# Phase 4 report — World building: doorways, secondary action, Preparation Room + corridor

Date: 2026-10-21 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D`

## 1. Audit and baseline

- Root `C:/Users/ADMIN/Desktop/SimLab 3D`, branch `main`, clean tree, HEAD `36a192b`, no remote.
- Baseline: `npm run check` **PASS** (111/111), `npm run test:e2e` **PASS** (5/5).
- Existing pieces reused: rooms/scenes/items as validated JSON, `SceneManager` spawning several
  rooms per scene (`World.activeRooms`), `PhysicsSystem.createRoom` (one fixed body of slabs per
  room), `WorldRenderer.buildRooms`, `InteractionSystem` actions with availability, HUD prompt,
  `InputState` bindings, the debug panel for E2E state.
- Gaps found: every room was a closed box in both physics (six slabs) and rendering (one
  `BackSide` box), each computed separately; scenes had one room each; only the first available
  action was reachable (E), so the steel ball's Inspect was unreachable while Grab was available.

## 2. Doorway geometry

**Data.** A room lists `openings: [{ wall, center, width, height }]` (`OpeningSchema` in
`src/world/definitions.ts`): a gap from the floor to `height`, `center` is the world coordinate
along the wall (x on north/south, z on east/west). Two rooms share a wall when they are exactly
`WALL_THICKNESS` (0.25 m) apart; each lists the doorway on its own side, so each room's geometry
is complete on its own and physics/rendering need no scene-level lookup.

**One geometry source.** `roomSlabs(room, thickness)` (`src/world/roomGeometry.ts`, pure) returns
the floor, ceiling and wall boxes, each wall split into the pieces beside its openings plus a
lintel above. A closed room gives exactly the six slabs physics built before (same positions,
tested), so every existing room and measurement is unchanged.

- Physics (`PhysicsSystem.createRoom`) makes one cuboid collider per slab at full thickness.
- The renderer (`WorldRenderer.buildRooms`) draws one box mesh per slab at **half** thickness:
  the two rooms of a doorway each draw their half of the shared wall, so their jamb, lintel and
  threshold faces never coincide (no z-fighting). Inner faces are on the bounds in both.
- In physics the two rooms' wall slabs overlap inside the shared wall and their floor slabs
  overlap under the doorway, so the floor is continuous (fixed–fixed overlaps are free).

**Validation** (`src/game/content.ts`): an opening must fit its wall (length and room height)
and not overlap another opening in that wall; in every world scene, each opening must lie on a
wall shared with another room of the scene that has the same opening (`leadsInto`: facing wall
plane exactly 0.25 m away, same floor level, same centre/width/height). Otherwise boot fails
with e.g. `scenes.preparation-room: rooms.preparation-room.openings.0 (south wall) does not lead
into another room of the scene (same opening, 0.25 m away)`.

**Room tracking.** Inside the 0.25 m wall gap the player is in neither room's bounds;
`PlayerSystem` now keeps the room they came from there, so `PlayerEnteredRoom` names the room
actually left (`{ roomId: 'cleanroom-corridor', previousRoomId: 'preparation-room' }`) and
stopping in a doorway does not re-announce the room.

## 3. Secondary action

- New binding `secondary` (default **F**) in `config.input.bindings`.
- `InteractionSystem.secondaryAction(id)` = the second currently available action, in the
  item's `interactions` order; `interact(true)` performs it; on F in `update`. If E and F arrive
  in the same frame only the primary runs (one action per frame).
- HUD prompt shows both keys: `[E] Grab  [F] Inspect`; the hint line lists "F other action".
- Items with several behaviours: steel ball / microscope `grab, inspect` (E Grab, F Inspect); desk
  lamp now `toggle, grab` (E Turn on/off, F Grab).
- Right mouse was not bound: in a browser it needs the context menu suppressed; F is enough for
  this phase and `Mouse2` can be added to the binding list later.

## 4. Preparation Room + cleanroom corridor

The `preparation-room` scene now holds two rooms joined by a 1.2 m × 2.2 m doorway in the
Preparation Room's north wall at x = 0:

| Room               | Bounds x, z                | Furniture (grey-box, from data)                                                                    |
| ------------------ | -------------------------- | -------------------------------------------------------------------------------------------------- |
| Preparation Room   | −3 … 3, −3 … 3             | bed, desk, **chair** (new), desk lamp, storage cabinet, door to the Teacher Room                   |
| Cleanroom corridor | −1.5 … 1.5, −11.25 … −3.25 | **lockers, gowning bench, hand-wash basin, PPE shelf** (new items), door to the SIMLAB Hub (moved) |

The door to the hub moved from the Preparation Room's north wall to the end of the corridor
(`cleanroom-corridor/door-hub`), so the route is Preparation Room → corridor → Hub. New items are
static and inspectable; their descriptions say that gowning and hand washing arrive with the
cleanroom sequence (planned, not faked). Furniture stands along the corridor walls, the centre
line stays clear (player capsule 0.6 m wide).

## 5. Files changed

| Area             | Files                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| New              | `src/world/roomGeometry.ts` (+ test), `e2e/world.spec.ts`, this report                                                                           |
| World / data     | `definitions.ts` (`OpeningSchema`, `openings`), `rooms.json`, `scenes.json`, `items.json`                                                        |
| Validation       | `src/game/content.ts` (opening fit/overlap, shared-wall check)                                                                                   |
| Physics / render | `PhysicsSystem.ts` (`createRoom` from `roomSlabs`), `WorldRenderer.ts` (slab meshes, materials disposed per scene)                               |
| Interaction      | `InteractionSystem.ts` (`secondaryAction`, `interact(secondary)`), `config.ts` (`secondary` binding), `Hud.ts` (both keys)                       |
| Player           | `PlayerSystem.ts` (room kept inside a doorway)                                                                                                   |
| Tests            | `content.test.ts`, `Game.test.ts`, `InteractionSystem.test.ts`, `PhysicsSystem.test.ts`, `World.test.ts`, `e2e/game.spec.ts`, `e2e/grab.spec.ts` |
| Docs             | `data-model.md` (walls and doorways), `physics.md`, `interaction.md`, `architecture.md`, `development-guide.md`, `README.md`                     |

No save-format change: rooms and furniture are content, not save data (`SAVE_VERSION`
unchanged). An old save in the Preparation Room continues into the two-room scene.

## 6. Tests

| Command                                                               | Result                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run check`                                                       | **PASS** — typecheck, ESLint, Prettier, Vitest **125/125** in 12 files (was 111/111) |
| `npm run test:e2e`                                                    | **PASS** — **6/6** (5 dev + 1 production; new `world.spec.ts`)                       |
| `npm run build`                                                       | **PASS**                                                                             |
| `npx playwright test e2e/world.spec.ts --project=dev --repeat-each=8` | **PASS** 8/8 (8 parallel instances, stress)                                          |

New unit/integration tests (14):

- `roomGeometry.test.ts` (4): a closed room is the six old slabs; an opening → two pieces + lintel
  with exact extents; two openings in one wall incl. a full-height one (no lintel); half
  thickness keeps inner faces.
- `content.test.ts` (3): shipped scene has the two rooms and the doorway; rejected: opening on a
  wall with nothing behind it, rooms 0.5 m apart, mismatched widths; opening overlapping another,
  wider than the wall, taller than the room.
- `PhysicsSystem.test.ts` (4, real game + Rapier): walking north from the spawn passes the doorway
  (z < −5.5 after 3 s, x unchanged < 1 mm) into the corridor and back, with the three
  `PlayerEnteredRoom` events naming the previous room; beside the doorway the capsule stops at
  z = −3 + 0.31 (Preparation side) and −3.25 − 0.31 (corridor side) to 1 mm; a ray at eye height
  through the doorway hits the hub door at 12.16 m, beside it and above it (lintel) the wall at
  4 m; counts 14 bodies / 28 colliders in the Preparation scene and 6 / 11 in the hub, identical
  over 3 round trips.
- `InteractionSystem.test.ts` (3): lamp E = Turn on, F = Grab (F grabs, does not toggle); cabinet
  has no secondary; E+F in one frame runs only the primary; steel ball E = Grab, F = Inspect
  (`ItemInspected`, not held), then E still grabs.
- Updated expectations: new-game entity/interactable count 6 → 11; door-travel test uses the
  corridor's hub door; two content tests referenced the old `door-hub` placement index.

**Mutation checks** (each made the suite fail, then was restored): physics ignoring openings (3
failures), room tracking reset in the doorway gap (1), shared-wall check removed (2), width
mismatch accepted (1), secondary key ignored (2), both actions in one frame (1), no lintel (4),
renderer ignoring openings (E2E pixel check: through-doorway pixel equal to the wall, difference
0).

## 7. E2E verification

Microsoft Edge (installed), headless, software WebGL (SwiftShader) — **no GPU**.

- `world.spec.ts`: New game → Preparation Room. **Rendering:** from the spawn the pixel through
  the doorway is the hub door 12 m away, `[90,69,48]`, the wall pixels 200 px either side are
  `[154,151,144]` and `[154,151,144]` (a closed wall would give three equal wall pixels — the
  mutation run confirmed difference 0). **Walking:** W until z < −4 → `Room: cleanroom-corridor`,
  x = 0.00 (no jamb contact), toast "Cleanroom corridor"; S back → `Room: preparation-room`;
  strafe west of the opening and W into the wall → stops at z = −2.69 and stays while pushing.
  **Counts:** `bodies 14 · colliders 28`, hub `6 · 11`, identical over 2 round trips. No console
  errors. Walks are closed-loop (walk until a position is reached), not timed, so they hold on a
  slow loaded browser.
- `grab.spec.ts` (extended): looking at the steel ball the prompt reads `E Grab F Inspect`; F shows
  the toast "Steel ball: A polished steel ball used for kinematics experiments." and nothing is
  held; then the Phase 3 grab/carry/drop/throw sequence passes unchanged.
- `game.spec.ts`: the walk from the spawn now goes through the doorway and down the corridor to
  `cleanroom-corridor/door-hub`, then into the hub; `production.spec.ts` (walk forward to "Go to
  SIMLAB Hub") passes unchanged.
- Screenshots (git-ignored): `test-results/world-doorway.png` (doorway with jambs, lintel,
  corridor and hub door seen through it), `world-corridor.png` (lockers, basin, PPE shelf along
  the walls), plus the existing ones. Reviewed by eye: geometry and colours as intended.

## 8. Build

`npm run build` **PASS**: entry 695.78 kB (gzip 182.40 kB; Phase 3: 691.57 / 181.04), Rapier
chunk unchanged 4,332.82 kB.

## 9. Known limitations

- Openings are full-height-from-floor rectangles in axis-aligned walls only; no windows, no
  rotated rooms, rooms on different floor levels cannot connect (validated as an error).
- Each side lists the doorway (mirrored data); a mismatch is a load error, not auto-fixed.
- A doorway is an open gap: no door leaf that opens/closes inside it yet; scene-change doors
  stay as before.
- The scene has one spawn: arriving from the hub puts the player in the Preparation Room, not at
  the corridor's hub door.
- Ceilings render dark (their faces point down, away from the light) — unchanged: the same view
  rendered with the Phase 3 renderer (temporarily restored) has identical wall, floor and ceiling
  shading and a closed north wall; lighting is still the Phase 1 placeholder.
- Only two actions per target are reachable by key (E, F); right mouse is not bound.
- Verified in headless Edge with software WebGL only.
- Stress observation, not fixed (out of scope): under 10 parallel instances the Phase 3
  `grab.spec.ts` failed once by 1 mm on its timed walk (`distance(landed, spawn)` 0.299 vs
  > 0.3); it passes in every normal run. Its walks could be made closed-loop like `world.spec.ts`.

## 10. Technical debt

- `roomSlabs` allocates its slab list per call — only on scene load, never per frame.
- Interaction still scans all interactables linearly (now 11 in the Preparation scene).

## 11. Verdict

**PASS** — the player walks between the connected rooms through the doorway and is stopped by
the walls beside it (unit + browser), physics and rendering leave the same opening from one
geometry function, content validation rejects openings not on a shared wall, body/collider
counts are stable across scene changes, the secondary action works in unit and E2E tests,
check/build/E2E pass.

## 12. Recommended next phase

The cleanroom PPE / hand-washing sequence on the corridor furniture (stateful behaviours on the
lockers, basin and PPE shelf; the hub door gated until gowning is complete), plus per-door spawn
points so arriving from the hub places the player at the corridor end.
