# Phase 6E report — Teacher's bathroom (roadmap §2.2)

Date: 2026-10-22 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D`

## 1. Baseline

- **Start:** `64ccf6b` "phase 6d: add teacher room furniture". Clean tree, one worktree, no remote.
- **Checks on that commit** (the Phase 6D post-commit verification, same tree): `npm run check`
  PASS, 309/309 tests in 26 files; `npm run test:e2e` PASS, 21/21.

## 2. Scope

Roadmap §2.2 lists a toilet for the Teacher Room. This phase adds a private bathroom with a toilet
and a sink, joined to the room by an open doorway: the mechanism that already joins the
Preparation Room and the cleanroom corridor.

Not in scope: a door leaf (no hinged or sliding door exists), using the fixtures (water,
animation, sound, hygiene), the teacher (NPC), and any graphics work.

## 3. Change

**Room and doorway.**

- **`teacher-bathroom`** ("Teacher's bathroom"): x −2.5 … −0.5, z 2.75 … 4.75, 3 m high like the
  Teacher Room.
- **Doorway:** `{ wall: "south", center: -1.5, width: 1.0, height: 2.1 }` on `teacher-room` and the
  same on the bathroom's north wall.
  - `center` is a world coordinate along the wall (x on north and south walls, `definitions.ts`).
  - The rooms are `WALL_THICKNESS` (0.25 m) apart, which `leadsInto` requires (`roomGeometry.ts`).
  - Both sides are validated at boot, like every doorway.
- **Scene `teacher-room`:** its rooms are now `["teacher-room", "teacher-bathroom"]`.
  - The spawn and the door's arrival point stay in the Teacher Room.
  - Walking into the bathroom shows its name on the HUD, and the debug panel's Room line follows.
- **Order in `rooms.json`:** the bathroom comes right after `teacher-room`, so the doorway tests
  that address rooms `[0]` and `[1]` are untouched.

**Fixtures.**

| Placement               | Item                  | Position, rotation                 | Size (m)          | Body   |
| ----------------------- | --------------------- | ---------------------------------- | ----------------- | ------ |
| `teacher-bathroom/wc`   | `teacher-wc` "Toilet" | `[-2.1, 0, 4.4]`, south wall       | 0.4 x 0.75 x 0.65 | static |
| `teacher-bathroom/sink` | `teacher-sink` "Sink" | `[-0.72, 0, 3.9]`, -90°, east wall | 0.5 x 0.85 x 0.4  | static |

- **Inspect only:**
  - toilet: "The teacher's toilet. It cannot be used yet.";
  - sink: "The teacher's hand-wash sink. It cannot be used yet.".
- **No `use` or `wash`.** The sink has no washing behaviour, and `wash-basin` is not reused (it
  belongs to the `cleanroom-entry` procedure).
- **Footprints:** toilet x −2.3 … −1.9, z 4.075 … 4.725; sink x −0.92 … −0.52, z 3.65 … 4.15. The
  doorway (x −2.0 … −1.0) and the lane south of it stay clear.
- **No code changed.** The Phase 6D furniture and the spawn are where they were.

## 4. Tests

- **`src/game/Game.test.ts`:**
  - after travelling to the Teacher Room: interactables 5 → 7, because the scene now holds the
    bathroom's two fixtures;
  - the inspect test also covers the toilet and the sink: each is focused from the free floor
    (its box and the physics line of sight), and E publishes `ItemInspected` for it;
  - new: "walks from the Teacher Room through the doorway into its bathroom and back". It checks
    the scene's two rooms and that both fixtures belong to the bathroom. Then it walks south and
    back north: `PlayerEnteredRoom` for `teacher-bathroom`, then `teacher-room`, and the doorway
    does not stop the walk (z > 3.5, then < 2).
  - **Its first run failed.** It subscribed before the scene's first frame, and that frame
    announces the room the player starts in (`SceneManager` clears `roomId` on load). The test
    now lets that frame pass. The assertions did not change.
- **`e2e/game.spec.ts`:**
  - `Entities` in the Teacher Room: 5 → 7;
  - new: "teacher room: through the doorway to the bathroom, its fixtures, and back":
    1. enter the Teacher Room through its door;
    2. line up in front of the doorway and look through it;
    3. walk in: Room `teacher-bathroom`, HUD "Teacher's bathroom";
    4. focus and Inspect the toilet, then the sink, each with its exact text;
    5. walk back: Room `teacher-room`, HUD "Teacher Room";
    6. Inspect the PC, the cabinet and the bed again;
    7. no console errors. Two screenshots are taken along the way.
- **Unchanged and still passing:**
  - the content cross-checks (the doorway rules, the spawn and the arrival point);
  - the doorway tests in `content.test.ts`;
  - `arrival.test.ts`, `transitions.spec.ts`, `preparation.spec.ts` and `world.spec.ts`.

## 5. Verification

| Check              | Result                                                                        | Duration |
| ------------------ | ----------------------------------------------------------------------------- | -------- |
| `git diff --check` | **PASS**: clean                                                               | —        |
| `npm run check`    | **PASS**: 310/310 unit tests (309 + 1 new), 26 files; typecheck, lint, format | 16 s     |
| `npm run test:e2e` | **PASS**: 22/22 (21 + 1 new), 3 workers; includes the production build        | 330 s    |
| `npm run build`    | **NOT RUN** separately: the e2e production web server runs it                 | —        |
| `npm run bench`    | **NOT RUN**: not a performance change                                         | —        |

**Visual check** (software WebGL, SwiftShader, headless Edge, 1280×720; both reviewed):

- `test-results/teacher-bathroom-doorway.png`: from the Teacher Room in front of the doorway. The
  opening and its lintel, the bathroom's walls and floor, the sink (left) and the toilet (right)
  inside, the middle of the floor clear.
- `test-results/teacher-bathroom.png`: inside, the toilet and the sink in one frame, on the floor
  against their walls; the HUD shows "Teacher's bathroom".

## 6. Invariants

Unchanged: TypeScript outside tests, the schema, physics, movement, the doors and arrival rules,
`SAVE_VERSION` and `src/persistence`, every other room, the Phase 6D furniture, `package.json`. A
save made in the bathroom is a position in a room of the same scene.

## 7. Limitations

1. **No door leaf.** The bathroom is reached through an open doorway; no door mechanic exists yet.
2. **Planned, not built:** using the toilet and the sink. Each says so when inspected.
3. **Grey-box look.** Both fixtures are plain light boxes, told apart by size, place and their
   Inspect names.
4. **Software WebGL only.** No GPU or visible-window check; no performance numbers were taken.

## 8. Commit

Not committed: waiting for the user's approval. Nothing pushed (the repository has no remote).
