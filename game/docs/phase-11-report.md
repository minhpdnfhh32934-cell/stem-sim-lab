# Phase 11 report — directions to the experiments

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

## 1. Starting state

HEAD `32bb456`, one worktree, nothing staged. The tracked diff was byte-identical to the end of
Phases 9 and 10; kept untouched: the Nhặt / Thả labels, Phase 8 (topics), Phase 9 (the menu
catalog) and the Phase 10 audit report.

## 2. Baseline

`npm run check` PASS 340/340 (19 s) and `npm run build` PASS (4 s), run now. `npm run test:e2e`
not run again: it passed 26/26 at the end of Phase 10 on this very tree (only a report added).

## 3. Change (the Phase 10 recommendation)

- **Directions** — `routeBetween(content, from, to)` in `src/game/catalog.ts`: a breadth-first
  search over world scenes whose edges are doors (placements with a `targetScene`), so the way
  has the fewest doors; a procedure whose `entrance` is a door on the way is named just before the
  scene that door opens; null when nothing leads there. Pure data, no coordinates.
- **Menu** — under the topics, one line per scene that has stations, from where a new game
  starts (`config.game.newGameScene`): "Getting to Physics Laboratory: Preparation Room →
  Cleanroom entry → SIMLAB Hub → Physics Laboratory" / "Đường đến Phòng thí nghiệm Vật lý: Phòng
  chuẩn bị → Vào phòng sạch → Sảnh SIMLAB → Phòng thí nghiệm Vật lý". Names come from the
  content; two keys added (`menu.route`, `menu.noRoute`). One line per scene, not per
  experiment, so the same way is not repeated three times.
- **Rule** — a room belongs to one world scene (`checkReferences`, `src/game/content.ts`): where
  a station stands is never ambiguous.
- **Not done, on purpose:** one shared definition of "station" (the Phase 10 gap). The three
  views — validation through behaviour `references`, `StationSystem.attach` (geometry and
  `experimentId`), the catalog (`experimentId`) — agree on all content today, and merging them
  means refactoring `StationSystem` for no change in behaviour. No locate action, teleport,
  marker or new key: walking, doors, gates, bindings, the save and rendering are unchanged.

## 4. Tests

- **Unit (4 new):** the way from the preparation room and from the teacher room to the Physics
  Lab, through Cleanroom entry; the way out with no gate; the same scene; no way once the hub's
  door is gone; every station's scene reachable from where a new game starts (a content
  invariant). And a room put into a second scene is rejected.
- **E2E:** `topics.spec.ts` — the directions in English and Vietnamese (added to the Phase 9
  test); a new test that walks the way's last door: Continue from a save in the hub, "Enter
  Physics Lab", the Physics Lab's main room (the gap Phase 10 found).
- No existing assertion changed.

## 5. Verification

| Check                     | Result                                                      | Duration |
| ------------------------- | ----------------------------------------------------------- | -------- |
| `npm run check`           | **PASS**: 344/344 unit tests (340 + 4), 31 files            | 18 s     |
| `npm run build`           | **PASS**                                                    | 4 s      |
| `npm run test:e2e`        | **PASS**: 27/27 (26 + the walk to the lab), first run       | 360 s    |
| `npm run bench`           | **NOT RUN**: nothing in rendering or the frame loop changed | —        |
| bench `gpu`, `gpu-native` | **NOT RUN**: visible windows                                | —        |

## 6. Limitations

- The way starts where a new game starts; a player who continues elsewhere still reads it from
  the Preparation Room.
- Directions name scenes, not rooms inside a scene: the experiment's line already names its room
  ("Physics Laboratory · Projectile range").
- The three definitions of "station" remain (see above).
