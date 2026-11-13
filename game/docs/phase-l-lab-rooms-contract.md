# Phase L contract — the three labs twice as large (2026-11-02)

Status: **BUILT** 2026-11-03 (report `docs/phase-labs-report.md` §15), awaiting Phú's display QA;
APPROVED by Phú 2026-11-03 with the decisions of §12, each room's plan approved before the build.
Request (Phú, 2026-11-02): the rooms about twice as large as now — all three labs (Physics,
Chemistry, Biology), twice the floor area.

## 1. Objective

Each lab's floor goes from 10 × 8 m (80 m²) to 14 × 11.4 m (159.6 m², ×2.0), its height unchanged
(3.5 m). The equipment is spread over the new floor with wider aisles, the room lit for its size,
and everything that works today works the same way: doors to the hub, the Physics Lab's range and
pendulum bay, every experiment, task, path and save.

## 2. Scope

| #   | Part    | What                                                                                                                                                                                                                                                     |
| --- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Bounds  | `rooms.json`: each lab's `bounds` 14 × 11.4 m. The wall with the hub door stays where it is (the walk-through doors and the campus keep their places); the room grows on its other three sides.                                                          |
| L2  | Annexes | The Physics Lab's projectile range (south) and pendulum bay (north) move with the walls they open from, their doors still facing the lab's openings.                                                                                                     |
| L3  | Layout  | Each lab laid out anew by hand (D2): a plan per room (benches, stations, walls, aisles ≥ 1.2 m, e2e stand points) approved by Phú before it is built; then checked by the zone tests (no overlap, every stand point clear).                              |
| L4  | Light   | Two more ceiling fixtures per lab (4), the key and fill lux kept per m², so the larger room is lit as now.                                                                                                                                               |
| L5  | Saves   | A saved pose of a container from the old layout would stand somewhere else: saves of these three labs drop their container poses and reset stations' bench states on load (a migration, SAVE_VERSION 6), the player put at the lab's door if inside one. |
| L6  | Tests   | Zone tests, the layout sweep, nav grid tests and every e2e spec with lab coordinates (34 of 43 specs) updated to the new layout; the guided-task paths re-measured.                                                                                      |

## 3. Non-goals

- New equipment or new experiments; the hub, the preparation room and the teacher's room.

## 4. Constraints

- No experiment model, definition, result or measurement changes: only places move.
- Door positions to the hub and between scenes unchanged (campus, arrival points).
- High holds 300 fps with vsync at 2560×1600 in every lab (two more lights each: measured before
  and after, GPU A/B).

## 5. Risks

- Size of the change: 165 placements, 34 e2e specs, the saves. It lands as one phase with its own
  checkpoint, so it can be reverted whole.
- A save made before Phase L loses its glass poses and bench set-up in the labs (L5): reported to
  the player? (D3).
- Walking: stations further apart (about 40 % further); guided tasks' floor paths cover it.

## 6. Tests and verification

`npm run check`; full `npx playwright test`; the labs bench A/B (`gpu-fullscreen`, High, vsync and
uncapped) before and after; a look at each lab from its door (screenshots).

## 7. Rollback

One checkpoint before Phase L; the content, the migration and the tests revert together.

## 11. Decisions for Phú

- **D1 — which walls grow.** (a) **Recommended:** the door wall stays, the room grows on its other
  three sides (no change to the hub or the campus). (b) The room grows evenly about its centre
  (then the hub doors and the campus move too).
- **D2 — the layout.** (a) **Recommended:** today's arrangement spread out by rule (§L3). (b) A new
  arrangement drawn by hand for each lab (slower: a layout review per lab first).
- **D3 — old saves in the labs.** (a) **Recommended:** migrate (v6): glass back to its places, the
  benches cleared, a note in the log. (b) Keep v5 and refuse to load old lab saves.

## 12. Decisions (Phú, 2026-11-03)

1. D1 (a): the wall with the hub door stays; each lab grows on its other three sides.
2. D2 (b): a new arrangement drawn for each lab, its plan approved by Phú first.
3. D3 (a): SAVE_VERSION 6, old lab saves migrated (glass home, benches cleared, the player at the
   lab's door if inside one).
