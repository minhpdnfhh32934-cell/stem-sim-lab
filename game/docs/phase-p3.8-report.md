# Phase P3.8 — The Hooke's law apparatus as an assembled stand

The spring stand in the Physics Lab is now drawn as a real apparatus. It has:

- a base on pads and a column on a bolted foot plate;
- a boss clamp holding a braced arm, with an eye bolt at the arm's end;
- a 3D helical spring with end loops;
- a mass hanger with a pointer and a stack of brass masses;
- the ruler on a scale board.

The physics is untouched. The renderer still only copies the length the station gives it.

## 1. Verdict

**PASS WITH LIMITATIONS.**

- `npm run check`, `npm run build`, the Hooke e2e specs and the full e2e suite pass (§5).
- The limitations are in §10:
  - the visual check was done on headless GPU screenshots, not by a person on a real display;
  - the mass stack does not follow the mass that is set.

## 2. Baseline

| Item                       | Result                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| Branch / HEAD              | `main` / `ffbc305` (phase p3.7), clean tree                        |
| `npm run check`            | **PASS** 770/770, 43 files                                         |
| `npm run build`            | **PASS** — JS 959.36 kB, CSS 21.74 kB                              |
| `npm run test:e2e`         | **PASS** 45/45, 0 failed, 0 skipped (9.6 min, 3 workers, no retry) |
| Power (bench precondition) | AC (`BatteryStatus.PowerOnline` True)                              |

**The stand before:**

- the entity mesh was a plain 0.1 × 2 × 0.1 m box column;
- `ExperimentView.addSpring` drew everything else:
  - a 0.3 × 0.03 × 0.45 m box base and a 0.04 m box arm;
  - a 16-turn, 6-sided coil from the hook;
  - a 0.07 m brass cube with a red pointer;
  - the ruler, floating beside the column with nothing holding it.
- The coil was already rewritten in place (`stretchSpring`), with no allocation.

## 3. Implementation

**New: `src/platform/render/hookeModel.ts`.** It follows `pendulumModel.ts` and reuses
`assembly.ts` (`Assembly`, `at`, `slab`). It has three parts:

- **`springLayout(item, stand)`** says where the hook is and where the ruler reads. It is shared by
  the frame, `ExperimentView` and the tests.
  - The ruler is 0.7 m long, marked every 1 cm, at the same x and z as before.
  - Its 0 is at hook − L₀ − 25 mm: the pointer now hangs 25 mm below the spring's lower end, on
    the hanger's stem, so the 0 moved down by the same amount.
- **`buildSpringFrame(item, stand, painted)`** builds the fixed parts. WorldRenderer draws them as
  the entity's apparatus, like the launcher and the pendulum.
  - The chamfered base (same 0.3 × 0.45 m footprint) on four rubber pads.
  - A 0.1 m foot plate with four bolts.
  - The column: a chamfered 60 mm square post. It is the entity's mesh, so focus shows on it, and
    it lies inside the item's box (tested).
  - A plastic cap on top of the column.
  - The boss clamp, with its screw and black knob.
  - The 35 mm arm out to the hook, with a diagonal brace under it.
  - The eye bolt: an eye the spring's top loop rests in, a threaded rod, and a nut under and over
    the arm.
  - The scale board behind the ruler, hung from the arm on a bar, with two screws.
  - Painted parts share the entity's material. Parts too small to show in the shadow map cast no
    shadow. The pads, the nuts and the bolts are instanced.
- **`buildSpringHanger(stand, hook)`** builds what hangs, from top to bottom:
  - the top loop, a half turn of the wire;
  - the coil;
  - the bottom loop;
  - on the bottom loop, the hanger: its eye, the stem, the collar with the red pointer, five brass
    discs (instanced) and a steel base, sized from the item's `weight` (0.07 m).
  - `pose(L)` returns at once when L has not changed. Otherwise it rewrites the coil's own buffers
    at L − 2R (each loop takes R = 18 mm) and moves the hanger to L below the hook. It creates no
    geometry, material or object.
- **The coil** keeps the old in-place helix (`stretchSpring`, moved here unchanged), with three
  changes:
  - **14 turns instead of 16.** Closed, 14 turns are 61.6 mm, shorter than the shortest coil ever
    drawn: 0.1025 m held − 2R = 66.5 mm (tested).
  - **8 sides instead of 6**, so the wire looks rounder.
  - **Loops at both ends.**

**Changed:**

- **`ExperimentView`:**
  - `SpringRig` now holds the model and the ruler.
  - `addSpring` draws the ruler at `springLayout` and adds the hanger.
  - `pose` passes `L₀ + (run ? springExtension(session) : held)` to `model.pose`. This is the same
    expression as before.
  - `removeRig` frees the model.
  - The old base, arm, coil and weight code and the coil functions are removed.
- **`WorldRenderer`:** builds and frees the spring frame next to the launcher and the pendulum.
- **`docs/experiments.md`:** a "How the stand is drawn" paragraph, and 14 turns instead of 16.

## 4. Physics preservation

**Not changed:**

- `StationSystem`, `springExtension`, `SpringView.held`;
- the spring model (`simulation/models/spring.ts`) and the experiment data;
- `items.json` (hook, L₀, elastic limit, weight, the 0.1 × 2 × 0.1 m collider box);
- the interactions, the refusals, the save and the run history;
- FrameClock, the single RAF, quality and lighting.

**How the length is drawn:**

- The renderer computes no Hooke's law. The only length it draws is the station's: the run's
  extension, or the held Δl + y₀, plus L₀.
- The pointer still reads L − L₀ exactly. A unit test checks this to 10⁻⁹ m at 12 lengths.
- The screenshots read 0.000, 0.049, 0.196, 0.59 and 0.345 m, the held Δl + y₀ of the loads set.

## 5. Tests

| Command                                                                       | Result                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------- |
| `npm run check`                                                               | **PASS** 810/810, 44 files (+40)              |
| `npm run build`                                                               | **PASS**                                      |
| `npx playwright test hooke.spec oscillation.spec analysis.spec progress.spec` | **PASS** 6/6 (1.5 min)                        |
| `npm run test:e2e` (3 workers, no retry)                                      | **PASS** 45/45, 0 failed, 0 skipped (9.6 min) |
| `git diff --check`                                                            | clean                                         |

After that full e2e run, one comment in `hookeModel.ts` was reworded ("slotted" masses to "disc"
masses). `check`, the full e2e suite and `build` were then run again on the exact committed tree
(§12), and all pass.

**Unit tests** (`hookeModel.test.ts`, 40):

- **Dispose.** Everything the frame and the hanger make is freed: geometries, their own materials
  and the instance buffers. The entity's material is left alone.
- **Collider.** The column lies within the item's box.
- **Solid length.** The closed coil (turns × wire diameter) is shorter than the shortest coil drawn.
- **For 12 lengths**, from 0.1025 m (shortest held: 0.05 kg, 200 N/m, y₀ −0.1 m) through L₀,
  0.25…0.8 m (the elastic limit) to 1.0 and 1.28 m (2 kg on 20 N/m, a held load that RUN refuses):
  - every coil vertex is finite and every normal has unit length; the indices are in range;
  - the coil's first ring is centred on the top loop's end, its last ring on the bottom loop's end
    (to 1 µm, float32);
  - the hanger is at L below the hook;
  - the pointer's tip is on the ruler's near edge and reads L − L₀ (to 10⁻⁹ m);
  - no box of a hanging part meets a box of the frame or the ruler's plane. Instanced parts are
    boxed per copy. Left out by design: the top loop, which hangs in the eye bolt, and the eye
    itself; the pointer, which touches the ruler and is checked above.
- **In place.** Posing reuses the same position buffer and array, does not rewrite it when the
  length is unchanged, and adds no object over 12 poses.
- **Mutation check** (temporary, reverted). Each of these breaks fails the tests:

  | Break                              | Tests failed |
  | ---------------------------------- | -----------: |
  | ruler 0 not moved with the pointer |           12 |
  | hanger 1 % short                   |           24 |
  | coil not shortened for its loops   |           12 |
  | 16 turns                           |            1 |
  | ruler moved into the hanger        |           12 |

**Physics, end to end.** The Hooke e2e specs passed unchanged:

- refusal, RUN/STOP/RESET, Δl and k within 0.1 %, the readings, the history and the CSV;
- the swing in Vietnamese;
- the analysis;
- the progress.

## 6. Performance

A temporary bench scenario (deleted) was run with the same code before and after:

- the production build, Edge headless, 1280×720, Medium graphics, AC power;
- the player at the Hooke desk looking at the stand, with m 2 kg, k 100 N/m, y₀ 0.1 m;
- measured idle, oscillating after RUN, then stopped after STOP, 5 s each.

**RTX 5070 Laptop GPU (ANGLE D3D11), gpu-headless, no cap.** Two rounds each:

| Scenario    | FPS before → after |     GPU ms before → after |     CPU ms before → after | Draw calls |
| ----------- | -----------------: | ------------------------: | ------------------------: | ---------: |
| idle        |          300 → 300 | 2.15 / 2.11 → 2.18 / 2.22 | 0.81 / 0.82 → 0.88 / 0.89 |  171 → 199 |
| oscillating |        290.6 → 291 | 2.25 / 2.14 → 2.11 / 2.16 | 0.94 / 1.00 → 1.08 / 1.09 |  171 → 199 |
| stopped     |          300 → 300 | 2.19 / 2.12 → 2.20 / 2.16 | 0.81 / 0.82 → 0.90 / 0.92 |  171 → 199 |

- GPU time is within noise.
- Draw calls are +28 (main and shadow passes) and CPU time is about +0.08 ms.
- While oscillating, the coil's in-place rewrite was already paid before.

**SwiftShader** (software, uncapped):

| Scenario    | FPS before → after | GPU ms before → after |
| ----------- | -----------------: | --------------------: |
| idle        |        26.3 → 25.3 |         34.52 → 35.92 |
| oscillating |        17.5 → 17.1 |         53.72 → 55.49 |
| stopped     |        24.7 → 24.4 |         36.69 → 37.08 |

About 1–4 % slower under SwiftShader. The Hooke e2e specs pass at this cost.

**Geometry of the stand** (counted from the built model by a temporary test, deleted; the ruler is
not counted, it is the same):

| Measure    | Before                                     | After                                     |
| ---------- | ------------------------------------------ | ----------------------------------------- |
| Objects    | 6 (column, base, arm, coil, cube, pointer) | 25 (4 of them instanced), 14 cast shadows |
| Triangles  | ~3,130 (coil 3,072)                        | 6,536 (coil 3,584)                        |
| Geometries | 6                                          | 24                                        |
| Materials  | 4 own, plus the entity's                   | 8 own, plus the entity's                  |

## 7. Resource stability

A temporary e2e probe (deleted) counted live WebGL buffers and textures. It ran in the dev app,
starting at the Hooke desk looking at the stand, then did five Physics Lab ↔ hub round trips by
developer scene jump (used only to unload and reload the room). It ran on this tree, and on HEAD in
a temporary worktree that was removed afterwards.

| Tree  | Start (desk view) | After each of the 5 round trips |
| ----- | ----------------: | ------------------------------: |
| HEAD  |  362 buf / 16 tex |      387 buf / 22 tex, all five |
| after |  432 buf / 16 tex |      457 buf / 22 tex, all five |

- There is no growth across trips, so no leak.
- The new geometry adds 70 buffers, which live while the room does.
- The first count is lower in both trees: it is taken before the rest of the room is drawn.

## 8. Visual validation

- **Method.** Headless screenshots on the real GPU (RTX 5070, gpu-headless) at 1280×720, Medium
  graphics, of the same 14 views before and after. They are saved in the session's scratchpad
  (`p38/before`, `p38/after`).
- **Views:**
  - the player's view from the Hooke desk, at the default load and at the high load;
  - front and side;
  - close-ups of the top (clamp, arm, eye bolt), the hanger and the base;
  - the front view at four held lengths: rest (0.2025 m), low (0.249 m), mid (0.396 m) and high
    (0.79 m).
- **What the after shots show:**
  - The stand reads as a clamp stand: the base and the foot plate's bolts, the column and its cap,
    the clamp with its knob, the braced arm, and the eye bolt with its nuts.
  - The spring's top loop hangs from the eye.
  - The coil is round, with even turns, closer at rest and spread at 0.79 m.
  - The mass hanger hangs from the bottom loop.
  - The red pointer reaches the ruler, which now sits on its board instead of floating.
  - The pointer reads 0.00, 0.05, 0.20, 0.59 and 0.345 m for those loads, as before.
  - No interpenetration or floating part was seen.
- **Not done:**
  - Nobody looked at a real display, or at other resolutions or qualities.
  - Shots were taken of held states; the motion is covered by the sampled unit tests and the e2e
    specs.

## 9. Bundle impact

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 959.36 kB | 963.80 kB | +4.44 kB |
| CSS   | 21.74 kB  | 21.74 kB  | 0        |

The JS stays under the 1,000,000-byte budget, with about 36 kB left. No dependency or asset was
added. The model reuses `assembly.ts` and the coil code that was already there.

## 10. Limitations

- **The mass stack** is always the same five discs, sized from the item's `weight`. It does not
  follow the mass set (0.05–5 kg), as the old cube did not either. The discs have no slots drawn.
- **Held lengths past the limit are drawn as set**, as before. RUN refuses them, but the mass is
  still shown at Δl + y₀:
  - 2 kg on 20 N/m is 1.28 m, which is tested;
  - 5 kg on 5 N/m would be about 10 m, through the floor. That case is unchanged from before and
    neither tested nor visually validated.
- **Clearance** is checked with axis-aligned boxes at 12 sampled lengths, not continuously.
- **The end loops** are half turns in one plane, and the loop meets the coil with a small gap on
  the far side (about a turn's rise × ½). It is not visible at normal distances.
- **No real-display visual validation.** The look was judged on headless GPU screenshots only;
  nobody looked at the stand on the RTX 5070 Laptop's own display.
- **Measurement scope.**
  - Performance was measured headless; no real-display or windowed GPU run was done.
  - SwiftShader numbers are software rendering, not GPU results.

## 11. Git

Committed on request as `3ee280c` ("phase p3.8: draw the Hooke's law stand as a clamp stand with a
real spring"), on top of `ffbc305`. Not pushed (the repository has no remote).

- Modified: `src/platform/render/ExperimentView.ts`, `src/platform/render/WorldRenderer.ts`,
  `docs/experiments.md`.
- New: `src/platform/render/hookeModel.ts`, `src/platform/render/hookeModel.test.ts`, this report.
- The temporary bench spec, leak probe, count test and HEAD worktree were all deleted.

## 12. Closure verification

These were run again on the exact committed tree (`3ee280c`, clean working tree), after the
comment rewording of §5:

| Command                                  | Result                                                 |
| ---------------------------------------- | ------------------------------------------------------ |
| `npm run check`                          | **PASS** 810/810, 44 files                             |
| `npm run test:e2e` (3 workers, no retry) | **PASS** 45/45, 0 failed, 0 flaky, 0 skipped (9.5 min) |
| `npm run build`                          | **PASS** — JS 963.80 kB, CSS 21.74 kB                  |
| `git diff --check`                       | clean                                                  |

The diff from `ffbc305` touches only `src/platform/render` (ExperimentView, WorldRenderer, the new
hookeModel and its test) and two docs. It changes nothing in StationSystem, the simulation models,
`items.json`, colliders, RunRecord, persistence, FrameClock or the RAF. The performance,
resource-stability (457 buffers / 22 textures on every round trip, no growth) and bundle figures
above stand; the closure did not re-measure performance or resources.
