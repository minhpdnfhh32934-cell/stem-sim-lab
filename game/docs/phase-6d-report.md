# Phase 6D report — Teacher Room furniture (roadmap §2.2)

Date: 2026-10-22 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D`

## 1. Baseline

- **Start:** `1cc068e` "chore: ignore Claude worktrees". Clean tree, one worktree, no remote.
- **Teacher Room before:** a desk and the door back to the Preparation Room (2 entities).
- **Checks on that content** (run just before `1cc068e` was committed, same files):
  `npm run check` PASS, 308/308 tests in 26 files. `npm run test:e2e` was not re-run on the
  base; the last recorded run is 6C.5's 21/21.

## 2. Scope

Roadmap §2.2 lists for the Teacher Room: a private room, a door, a PC, a bed, a cabinet, a toilet
and smaller items. The room and the door existed. This phase adds three pieces of grey-box
furniture that can be inspected: the PC, the cabinet and the bed.

Not in scope: the toilet (it needs its own room or doorway), the teacher (NPC, Phase 5 of the
roadmap), using the PC, opening the cabinet, sleeping, and any graphics work.

## 3. Change

| Placement              | Item                    | Position, rotation                   | Size (m)           | Body                     |
| ---------------------- | ----------------------- | ------------------------------------ | ------------------ | ------------------------ |
| `teacher-room/pc`      | `teacher-pc` (new)      | `[0, 0.75, -2.25]`, on the desk      | 0.56 x 0.36 x 0.05 | none (rests on the desk) |
| `teacher-room/cabinet` | `teacher-cabinet` (new) | `[2.25, 0, -1.4]`, -90°, east wall   | 1.0 x 1.8 x 0.45   | static                   |
| `teacher-room/bed`     | `bed` (existing)        | `[1.95, 0, 1.45]`, south-east corner | 1.0 x 0.5 x 2.0    | static                   |

- **Inspect only.** Each offers Inspect through the existing behaviour; the HUD shows its
  description. What is not built yet is said there:
  - PC: "The teacher's desktop computer. It cannot be used yet."
  - Cabinet: "A steel cabinet for the teacher's documents and teaching tools. It cannot be opened
    yet."
  - Bed (unchanged item): "A simple single bed. Sleeping arrives with the time system."
- **The PC's screen** is the existing `visual.label` (dark, "SIMLAB"), drawn on the box's +z face,
  which faces the room.
- **Layout:** desk and PC on the north wall, cabinet on the east wall, bed in the south-east
  corner, door on the west wall. Every new object is at least 1.2 m from the arrival point
  (−1.45, 0, 0) and the spawn (−1.5, 0, 0), and outside the lane z ∈ [−0.5, 0.5] east of the door
  that the arrival and transition tests walk.
- **Ids:** the new items use the `teacher-` prefix. The bed reuses the Preparation Room's `bed`
  item, so no new definition was needed for it.
- **No code changed.** The data uses existing behaviours and visuals; no TypeScript outside tests.

## 4. Tests

- **`src/game/Game.test.ts`:**
  - the Teacher Room's interactables after travelling there: 2 → 5 (door, desk, computer,
    cabinet, bed). This is the room's real count, not a loosened check;
  - new: "lets the Teacher Room furniture be inspected from the free floor". For each new object
    the player stands on free floor and aims at it. The crosshair must focus that object (its box
    and the physics line of sight), and E must publish `ItemInspected` for it.
- **`e2e/game.spec.ts`:** the debug panel's `Entities` in the Teacher Room: 2 → 5.
- **Unchanged and still passing:**
  - the content cross-checks (the arrival point and the spawn are not blocked);
  - `arrival.test.ts` (walking forward from every arrival);
  - `transitions.spec.ts` (walking east from the arrival point to x > −0.6);
  - `preparation.spec.ts` (the door back, aimed at from the arrival point).

## 5. Verification

| Check              | Result                                                                        | Duration |
| ------------------ | ----------------------------------------------------------------------------- | -------- |
| `npm run check`    | **PASS**: 309/309 unit tests (308 + 1 new), 26 files; typecheck, lint, format | —        |
| `npm run test:e2e` | **PASS**: 21/21, 3 workers; includes the production build                     | 294 s    |
| `npm run build`    | **NOT RUN** separately: the e2e production web server runs it                 | —        |
| `npm run bench`    | **NOT RUN**: not a rendering or physics performance change                    | —        |

**Visual check.** `test-results/teacher-room.png` (software WebGL, SwiftShader; the arrival pose,
facing east): the cabinet on the east wall, the bed in the south-east corner, the lane east of
the door clear. The debug panel reads "Entities: 5 interactables: 5".

## 6. Invariants

Unchanged: physics, movement, the doors and arrival rules, `SAVE_VERSION` and `src/persistence`,
every other room, `package.json`. The new furniture has no state (Inspect only), so saves are not
affected.

## 7. Limitations

1. **The PC was not seen in a screenshot.** The e2e screenshots face east from the door, and the
   PC is behind the player's left shoulder there. Its position and Inspect are verified headless
   (the focus ray from the floor in front of the desk).
2. **Planned, not built:** using the PC, opening the cabinet and sleeping. Each says so when
   inspected.
3. **The toilet** of roadmap §2.2 is not built.
4. **E2E runs on SwiftShader** (software WebGL). No performance numbers were taken.

## 8. Commit

Not committed: waiting for the user's approval. Nothing pushed (the repository has no remote).
