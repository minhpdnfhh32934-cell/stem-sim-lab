# Phase 14 report — the planned laboratories say so

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

## 1. Starting state

HEAD `e7dec42` (ui: redesign the main menu as a scientific instrument panel), clean working
tree, no remote.

| Baseline check     | Result                                 | Duration |
| ------------------ | -------------------------------------- | -------- |
| `npm run check`    | **PASS**: 361/361 unit tests, 31 files | 19 s     |
| `npm run build`    | **PASS**                               | 4 s      |
| `npm run test:e2e` | **PASS**: 30/30, first run             | 358 s    |

## 2. Why this phase

The order of priority was correctness first, then misleading UX. The Phase 13A and 13C audits
found no confirmed correctness defect, and the baseline above is green. So the first item with
evidence was misleading UX:

- **The hub doors** read "Enter Chemistry Lab" and "Enter Biology Lab", like the door to the
  Physics Lab (`rooms.json`).
- **Behind them** are placeholder rooms: a bench and a fume hood, or a bench and a microscope.
  `laboratories.json` gives both labs no `experiments`.
- **Nothing says so.** There is no sign, and once the player is inside the room has no objective.
  A student could reasonably look for experiments there.
- **The project's rules ask for this:** unimplemented features are labelled as planned
  (CLAUDE.md). It was item 2 of the Phase 13A backlog and the next step in the Phase 13C report.

## 3. Change (content only)

- **Doors** (`src/content/rooms.json`): "Enter Chemistry Lab (no experiments yet)" / "Vào phòng
  thí nghiệm Hóa học (chưa có thí nghiệm)", and the same for Biology. The wording matches the
  catalog's own "no station yet".
- **Signs** (`src/content/items.json`, placed in `rooms.json`): `sign-chemistry-lab` and
  `sign-biology-lab` use the Physics Lab's sign mechanism (an item with a `visual.label`). They
  read "CHEMISTRY LABORATORY / PLANNED · NO EXPERIMENTS YET" (Vietnamese "PHÒNG THÍ NGHIỆM HÓA
  HỌC / DỰ KIẾN · CHƯA CÓ THÍ NGHIỆM"), in slate rather than the Physics Lab's blue. Each hangs on
  the wall facing the lab's door, 2.45 m up, so it is in view on arrival. Content validation
  accepted the positions.
- **Unchanged:**
  - the labs stay walkable;
  - the doors, routes and scene graph, the catalog, saves, physics and code;
  - the room names (the arrival notice still reads "Chemistry Laboratory").

## 4. Tests

- **Unit, 1 new** (`src/game/catalog.test.ts`, "planned laboratories"). For every laboratory in
  `laboratories.json`, a lab with no experiments must say "no experiments yet" / "chưa có thí
  nghiệm" on every door into it and on a sign inside. A lab with experiments must not say it.
  The rule is checked both ways, so a lab that gains experiments cannot keep its old label
  unnoticed.
- **Existing tests:** the content checks of every door's arrival point and of each placement's
  position also cover the new signs. No existing assertion changed.
- **Visual check** (not a test): a script continued from a save in the hub, facing each planned
  lab's door, in English and in Vietnamese, in headless Edge at 1280 × 720.
  - The prompt read "E Enter Chemistry Lab (no experiments yet)" / "E Vào phòng thí nghiệm Sinh
    học (chưa có thí nghiệm)".
  - After going through, the sign was in view on arrival.
  - No page errors.

## 5. Verification

| Check              | Result                                                    | Duration |
| ------------------ | --------------------------------------------------------- | -------- |
| `npm run check`    | **PASS**: 362/362 unit tests (361 + 1), 31 files          | 19 s     |
| `npm run build`    | **PASS**                                                  | 4 s      |
| `npm run test:e2e` | **PASS**: 30/30, first run, no retry                      | 362 s    |
| `git diff --check` | clean                                                     | —        |
| `npm run bench`    | **NOT RUN**: two small signs; the frame loop is unchanged | —        |

Each command ran on its own, after the previous one finished. `npm run check` ran again after
this report was written.

## 6. Limitations

- **Labels only:** the labs are still empty rooms. Real chemistry or biology experiments are
  future content.
- **Hand-written:** the door wording and the signs are content, not derived from the stations.
  The test above is what keeps them true.
- **Seen in software rendering only:** the signs were checked in headless Edge (SwiftShader). On
  arrival in the Biology Lab the sign is 10 m away and its text is small, though readable there.
- **Not native-reviewed:** the Vietnamese wording has not been reviewed by a native speaker.

## 7. Next step

From the Phase 13A backlog, in order:

1. One e2e test of the whole journey: New game → the cleanroom entry → the hub → the Physics Lab →
   a completed run, without saves or the developer jump.
2. Investigate the intermittent mid-test page reloads seen in the Phase 12A and 13B e2e runs,
   with the dev server's log kept.
3. An in-game pause menu: controls, language, back to the menu.
