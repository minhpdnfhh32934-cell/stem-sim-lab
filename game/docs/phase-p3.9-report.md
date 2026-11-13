# Phase P3.9 — The free-fall tower as a laboratory instrument

The free-fall tower in the Physics Lab is now drawn as a real apparatus:

- a base on pads, a bolted column with a rail and a drive housing;
- a carriage that rides the column to the release height, with a locking knob, an index on the
  scale, and a release head whose two jaws hold the ball and swing open when the run lets it go;
- a lamp on the head that is lit while the ball is held;
- a rubber landing mat and the light gate that stops the timer.

The physics is untouched: the renderer copies the heights the station gives it and whether a run
exists.

## 1. Verdict

**PASS WITH LIMITATIONS.**

- `npm run check`, `npm run build`, the free-fall e2e specs and the full e2e suite pass (§5).
- The limitations are in §10:
  - the visual check was done on headless GPU screenshots, not by a person on a real display;
  - the GPU numbers were measured on battery power, where headless Edge caps frames at 60 Hz.

## 2. Baseline

| Item                       | Result                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| Branch / HEAD              | `main` / `1dab77e` (P3.8 closure), clean tree                      |
| `npm run check`            | **PASS** 810/810, 44 files                                         |
| `npm run test:e2e`         | **PASS** 45/45, 0 failed, 0 skipped (9.7 min, 3 workers, no retry) |
| `npm run build`            | **PASS** — JS 963.80 kB, CSS 21.74 kB                              |
| Power (bench precondition) | AC at the start; **battery** (`PowerOnline` False) for every bench |

**The tower before.**

- The entity mesh was a plain 0.12 × 3.3 × 0.12 m box column.
- `ExperimentView.addTower` drew everything else:
  - a 0.4 × 0.03 × 0.24 m box base and a 4 mm landing pad;
  - the scale on the column's face;
  - the clamp: a block across the column's front and a box arm whose underside sat on the ball's
    top;
  - the 50 mm steel ball.
- `pose` put the ball's lowest point at `dropHeight` and the clamp at `releaseHeight`.
- Nothing showed whether the ball was held or released.

**The experiment as traced.**

- The model (`simulation/models/freeFall.ts`) computes y, the height of the ball's lowest point
  above the floor, from h to 0.
- `StationSystem` gives the renderer two heights:
  - `dropHeight(session)`: the run's y, or else the dial's h;
  - `releaseHeight(session)`: the run's h, or else the dial's.
- `session.run` is non-null from RUN until RESET, so a stopped or landed run keeps it.
- h is 0.2–3 m (`experiments.json`). The tower's `highest` release is 3.15 m, which the dial's range
  never reaches.
- Free-fall e2e coverage: `free-fall.spec`, plus the tower parts of `vietnamese.spec`,
  `settings.spec` and `experiment.spec`.

## 3. Implementation

**New: `src/platform/render/towerModel.ts`.** It follows the `pendulumModel` / `hookeModel` pattern
and reuses `assembly.ts` (`Assembly`, `at`, `slab`). It has three parts:

- **`towerLayout(item, tower)`** gives the positions that the frame, `ExperimentView` and the tests
  share: the floor, the ball's axis (the item's `landing` x and z), the ball's radius, and the
  scale.
  - The scale has the same length (same formula, 3.1 m), reads from the floor, and has the same
    x. It moved from z 0.063 to 0.057 m because the drawn column is now 0.11 m wide inside the
    0.12 m collider box.
- **`buildTowerFrame(item, tower, painted)`** builds the fixed parts. WorldRenderer draws them as
  the entity's apparatus.
  - A chamfered 0.36 × 0.26 m base on four rubber pads, behind the landing point as before.
  - A 0.17 m foot plate with four bolts.
  - The column: a chamfered 0.11 m square post. It is the entity's mesh, so focus shows on it, and
    it lies inside the item's box (tested).
  - A steel rail on the column's +x side, which the carriage runs on.
  - The drive housing on top, with four bolts and a cable gland at the back.
  - At the landing point, a 2 mm rubber mat and the light gate: a fork open towards the room, its
    prongs either side of the path and its two sensor heads facing each other across it.
  - Painted parts share the entity's material. Small parts cast no shadow. The pads, bolts, prongs
    and sensors are instanced.
- **`buildTowerCarriage(item, tower)`** builds what moves.
  - **The carriage**, with its origin at the held ball's lowest point:
    - a sleeve round the column and rail, with a screw and black locking knob;
    - a tab down from the sleeve, whose red index line lies across the scale's ticks at y = 0, so
      it marks h;
    - an arm out over the path to the release head (black), whose underside is 4 mm above the
      ball's top;
    - an amber lamp on the head's front;
    - two steel jaws hinged under the head either side of the ball, with rubber pads whose top
      inner edges touch the ball just below its equator.
  - **The steel ball**, 50 mm, 24 × 16 segments as before.
  - **`pose(release, height, released)`**:
    - puts the carriage at the floor + release height and the ball's lowest point at the floor +
      height;
    - only when the release state changes, swings both jaws open by 0.45 rad (or closed) and
      swaps the lamp between its two prebuilt materials.
  - Everything is created once; posing allocates nothing.

**Changed:**

- **`ExperimentView`:**
  - `TowerRig` now holds the model and the scale.
  - `addTower` draws the scale at `towerLayout` and adds the carriage.
  - `pose` calls `rig.model.pose(releaseHeight(session), dropHeight(session), session.run !== null)`.
  - `removeRig` frees the model.
  - The old base, pad, clamp and ball code and the now unused `LOOKS` import are removed.
- **`WorldRenderer`:** builds and frees the tower frame next to the launcher, pendulum and spring.
- **`docs/experiments.md`:** a "How the tower is drawn" paragraph; the `ExperimentView` row of the
  concepts table updated (Prettier re-padded that table).

## 4. Physics preservation

**Untouched:**

- the free-fall model, its equations, gravity, the initial and release conditions, the timing and
  sampling, completion, the results and the measurement (the timer reading);
- `StationSystem` and its semantics (`dropHeight`, `releaseHeight`, the `highest` refusal);
- `RunRecord`, the history, CSV, IndexedDB and the save;
- `items.json` and the collider (the 0.12 × 3.3 × 0.12 m box);
- FrameClock, the FPS cap, quality, lighting and the single RAF.

**What the renderer does:**

- It draws the ball where it was drawn before, at the floor + r + `dropHeight`, and computes no
  gravity.
- The only new input it reads is `session.run !== null`, an existing state, to show held versus
  released. It adds no state machine and no timer.

## 5. Tests

| Command                                                                            | Result                                        |
| ---------------------------------------------------------------------------------- | --------------------------------------------- |
| `npm run check`                                                                    | **PASS** 863/863, 45 files (+53)              |
| `npm run build`                                                                    | **PASS**                                      |
| `npx playwright test free-fall.spec vietnamese.spec settings.spec experiment.spec` | **PASS** 7/7 (2.4 min)                        |
| `npm run test:e2e` (3 workers, no retry)                                           | **PASS** 45/45, 0 failed, 0 skipped (9.6 min) |
| `git diff --check`                                                                 | clean                                         |

**Unit tests** (`towerModel.test.ts`, 53):

- **Dispose.** Everything the frame and the carriage make is freed: geometries, their own
  materials (including the lamp's unlit one) and the instance buffers. The entity's material is
  left alone.
- **Collider and scale.** The column lies within the item's box; the scale's 0 is the floor and its
  face is just in front of the column's.
- **Held, at h = 0.2, 0.5, 1, 1.5, 2, 2.5 and 3 m:**
  - the ball is on the path at the floor + r + h (to 10⁻¹²);
  - the head is centred on the path, its underside 4 mm above the ball's top;
  - each pad's top inner edge is on the ball's surface, below its centre;
  - the index line is at h (to 10⁻¹²), from beside the scale's left edge across the long ticks,
    short of the figures.
- **Falling, at the same 7 heights and 6 points each** (held, just let go, 90 %, half, 10 %,
  landed), sampled, not continuously:
  - every coordinate is finite and the ball stays on the path;
  - the ball meets nothing fixed: base, pads, foot plate, bolts, column, rail, housing, gate, and
    the scale's plane;
  - the landed ball goes at most 2 mm into the mat (it rests on the floor through it);
  - once let go, the ball meets no part of the open clamp. While held, only the pads touch it, by
    design;
  - the carriage meets nothing fixed except the column and rail it rides on and the scale it slides
    over.
- **State.** Held: the jaws are at 0 and the lamp is lit. Released: the jaws are open more than
  0.3 rad each way and the lamp is out, still while landed. After a reset: held again.
- **Assignment only.** After 42 poses across every height and state, the object and material counts
  are the same.
- **Mutation check** (temporary, reverted). Each break below fails the tests:

  | Break                    | Tests failed |
  | ------------------------ | -----------: |
  | carriage 1 cm high       |            7 |
  | ball centred at y        |           49 |
  | jaws never open          |            9 |
  | lamp never out           |            1 |
  | head 2 cm above the ball |            7 |
  | mat 1 cm thick           |            7 |

  Wider jaws still pass: the pads lengthen to meet the ball, so the clamp still holds it, which is
  correct.

**Physics, end to end.** The free-fall specs passed unchanged:

- the fall time and impact velocity against t = √(2h/g) and v = −√(2gh) on Earth and the Moon;
- the timer reading, the results panel and the history;
- the Vietnamese run;
- the free-fall run at 30 FPS under High graphics (`settings.spec`).

## 6. Performance

A temporary bench scenario (deleted) was run with the same code before and after:

- the production build, Edge headless, 1280×720, Medium graphics;
- the player at the free-fall desk looking at the tower, with h 3 m and Moon gravity (a 1.9 s
  fall);
- measured idle for 5 s, falling for 1.5 s after RUN, and landed for 5 s.

**The machine was on battery for every bench run** (`PowerOnline` False, before and after). Headless
Edge then paces frames at 60 Hz, as in earlier phases. So frame time and FPS are capped (60 fps),
and GPU time is measured at the clocks the GPU keeps under that load. These numbers compare before
with after only. They are not comparable to the AC figures of P3.6–P3.8.

**RTX 5070 Laptop GPU (ANGLE D3D11), gpu-headless, battery.** Two rounds each:

| Scenario | FPS before → after |     GPU ms before → after |     CPU ms before → after | Draw calls |
| -------- | -----------------: | ------------------------: | ------------------------: | ---------: |
| idle     |      60 → 60 (cap) | 3.39 / 3.17 → 3.98 / 4.12 | 1.66 / 1.71 → 1.97 / 1.99 |  178 → 204 |
| falling  |      60 → 60 (cap) | 6.34 / 6.45 → 6.88 / 7.05 | 2.01 / 1.69 → 2.01 / 1.95 |  178 → 204 |
| landed   |      60 → 60 (cap) | 3.25 / 3.23 → 3.99 / 3.81 | 1.67 / 1.55 → 1.92 / 1.84 |  178 → 204 |

- GPU time is about +0.6–0.8 ms and CPU about +0.25 ms, with +26 draw calls (main and shadow
  passes).
- Frames stay at the 60 Hz pace with p95 under 17 ms.

**SwiftShader** (software, uncapped, battery):

| Scenario | FPS before → after | GPU ms before → after |
| -------- | -----------------: | --------------------: |
| idle     |        11.1 → 11.0 |         84.17 → 85.07 |
| falling  |        11.1 → 11.1 |         84.39 → 85.80 |
| landed   |        11.3 → 11.0 |         83.31 → 85.19 |

About 1–3 % slower. On battery SwiftShader runs at less than half its AC speed (P3.8 measured 25
fps at the Hooke stand), so only the before/after difference means anything. The free-fall e2e
specs, which run on SwiftShader, pass at this cost.

**Geometry of the tower** (counted from the built model by a temporary test, deleted; the scale is
not counted, it is unchanged):

| Measure    | Before                                  | After                                        |
| ---------- | --------------------------------------- | -------------------------------------------- |
| Objects    | 6 (column, base, pad, block, arm, ball) | 25 (4 of them instanced), 11 cast shadows    |
| Triangles  | ~780 (ball ~720)                        | 2,520                                        |
| Geometries | 6                                       | 23                                           |
| Materials  | 3 own, plus the entity's                | 11 own (the lamp has two), plus the entity's |
| Textures   | the scale                               | the scale (none added)                       |

## 7. Resource stability

A temporary e2e probe (deleted) counted live WebGL buffers and textures in the dev app. It started
at the free-fall desk looking at the tower, then did five Physics Lab ↔ hub round trips by
developer scene jump (used only to unload and reload the room). The before count was taken on the
unchanged tree before any edit.

| Tree   | Start (desk view) | After each of the 5 round trips |
| ------ | ----------------: | ------------------------------: |
| before |  369 buf / 16 tex |      457 buf / 22 tex, all five |
| after  |  434 buf / 16 tex |      522 buf / 22 tex, all five |

- There is no growth across trips, so no leak.
- The new geometry adds 65 buffers, which live while the room does. It adds no textures.
- The first count is lower in both trees: it is taken before the rest of the room is drawn.
- Geometry objects themselves are not counted by the probe. Their freeing is unit-tested (§5,
  dispose).

## 8. Bundle

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 963.80 kB | 966.96 kB | +3.16 kB |
| CSS   | 21.74 kB  | 21.74 kB  | 0        |

The JS stays under the 1,000,000-byte budget, with about 33 kB left. No dependency or asset was
added; the model reuses `assembly.ts`.

## 9. Visual validation

**Method.**

- Headless screenshots on the real GPU (RTX 5070, ANGLE D3D11) at 1280×720, Medium graphics,
  saved in the session's scratchpad (`p39/before`, `p39/after`).
- The production build gave 13 views, through Continue from a save:
  - player view from the desk, front, side, wide;
  - close-ups of the release mechanism, the scale and the base;
  - the wide view at h 0.2, 1, 2 and 3 m;
  - the ball mid-fall from 3 m on the Moon, and landed.
- The dev app, also on the real GPU, gave 2 more views after a real RUN at h 1.5 m, walked to with
  the e2e helpers: the open clamp, and the landed ball.
- Before shots were taken on the unchanged tree; the wide and released views on a temporary HEAD
  worktree (removed).

**What the after shots show:**

- The tower reads as an instrument: the base and its bolted foot plate, the column with its side
  rail, the drive housing on top.
- The carriage and its knob ride on the column.
- The index line reads 1.5 on the scale at h 1.5 m.
- The head sits over the ball with its amber lamp lit, and the jaws hold the ball at its sides.
- After RUN the jaws stand open and the lamp is dark. The ball lies on the mat inside the light
  gate's fork.
- At h 0.2 m the carriage sits just above the gate; at 3 m it is just under the housing.
- Mid-fall, the ball is on its path in front of the scale.
- No clipping, floating part or misalignment was seen.

**Not done:**

- Nobody looked at a real display, or at other resolutions or qualities.
- The motion between the samples is covered by the unit tests and the e2e specs, not by images.

## 10. Limitations

- **Battery-power benchmark.** The bench ran on battery. GPU numbers are at a 60 Hz cap and lower
  clocks, and compare before with after only. No AC or real-display GPU run was done.
- **No real-display visual validation.** Only headless GPU screenshots.
- **The landed ball rests 2 mm into the rubber mat — a deliberate visual overlap, not a
  positioning bug** (re-checked at closure, §12). Before, it went 4 mm into the pad.
- **The jaws snap open.** They open at once when the run starts; there is no opening animation,
  because the station exposes no release progress.
- **The light gate is a fixture only.** It is drawn at the floor; it does not light up or show the
  stop, because no such state exists. The start gate (the clamp opening) is the jaws.
- **The carriage's paint is its own material.** Focus therefore does not glow on the carriage,
  only on the frame, as with the old clamp.
- **Clearance** is checked with axis-aligned boxes at sampled heights and points of the fall, not
  continuously.
- **Untested release heights.** Heights above 3 m (up to the station's 3.15 m `highest`) are not
  reachable with the dial and were not tested.

## 11. Git

Committed on request as `8965e65` ("phase p3.9: draw the free-fall tower as a laboratory
instrument"), on top of `1dab77e`. Not pushed (the repository has no remote).

- Modified: `src/platform/render/ExperimentView.ts`, `src/platform/render/WorldRenderer.ts`,
  `docs/experiments.md`.
- New: `src/platform/render/towerModel.ts`, `src/platform/render/towerModel.test.ts`, this report.
- Deleted again: the temporary bench spec, leak probe, dev close-up spec and config, count test and
  HEAD worktree.

## 12. Closure verification

These were run again on the exact committed tree (`8965e65`, clean working tree):

| Command                                  | Result                                                 |
| ---------------------------------------- | ------------------------------------------------------ |
| `npm run check`                          | **PASS** 863/863, 45 files                             |
| `npm run test:e2e` (3 workers, no retry) | **PASS** 45/45, 0 failed, 0 flaky, 0 skipped (9.3 min) |
| `npm run build`                          | **PASS** — JS 966.96 kB, CSS 21.74 kB                  |
| `git diff --check`                       | clean                                                  |

The bundle is the same file as at commit time (same content hash).

**Scope.** The diff from `1dab77e` touches only `src/platform/render` (ExperimentView,
WorldRenderer, the new towerModel and its test) and two docs. It has no line in `src/simulation`,
`src/gameplay` (StationSystem), `src/content` (`items.json`, the collider's box), `src/persistence`
(RunRecord store, save), `src/core` (FrameClock), `src/physics`, `main.ts` (the RAF) or the
package files.

**The 2 mm landing-mat overlap: a deliberate visual overlap.**

- **Coordinates, in the item's frame:**
  - The floor is at y = −1.65 m.
  - The mat is a 0.2 × 0.002 × 0.2 m box centred 1 mm above the floor, so it fills the first
    2 mm above the floor.
  - The ball (r = 25 mm) is drawn at floor + r + y, the formula from before P3.9.
  - On landing the model sets y to exactly 0 (`state[Y] = 0`, complete at y ≤ 0). The ball's lowest
    point is then at the floor, where the scale reads 0, as the model and the scale both say.
- **Size of the overlap:** 2 mm. The ball's hidden cap meets the mat's top in a disc 19.6 mm across,
  4 % of the ball's 50 mm diameter.
- **Why it is kept.** The only ways to remove it are worse:
  - lifting the ball 2 mm would change the position formula and draw it off the model's height;
  - sinking the mat to the floor would hide it or make it z-fight with the floor plane.
- **Evidence:**
  - The 2 mm mat was chosen at design, against the old pad's 4 mm.
  - It is unit-tested to stay at most 2 mm.
  - The landed close-up (§9) shows the ball resting on the mat with no artifact.
- No change was made.

**Limitations that stand (§10):**

- Benchmarks were taken on battery power at the 60 Hz headless cap. AC power was back at closure,
  but the benchmarks were not rerun; that is outside closure scope.
- Resources are stable: 522 buffers / 22 textures on every Physics Lab ↔ hub round trip, before
  457 / 22.
- There is no real-display validation.
- The jaws open at once, with no animation.
- The light gate is a static fixture.
- Clearance is proven only at the sampled heights and points of the fall.
