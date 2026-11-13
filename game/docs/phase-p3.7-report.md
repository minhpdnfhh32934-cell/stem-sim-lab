# Phase P3.7 report — pendulum stand model

Date: 2026-10-26 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase p3.7.

**Verdict: PASS WITH LIMITATIONS.** The pendulum stand is now drawn as an assembled gantry with a
real bearing. The scales, which used to float, are held by the frame. The swing clears the frame
and both scales at every sampled length and angle. Physics, results and history are unchanged, no
GPU resources leak, and `npm run check`, `npm run build` and the full e2e run pass.

Limitations:

- The clearance is tested at sampled angles, not continuously.
- The look was judged from headless GPU captures; nobody looked at it on a real display.
- SwiftShader frames in the pendulum bay are about 7 % slower.

## 1. Repository and baseline

HEAD `8013a26` (phase p3.6) on `main`. The tree was clean with nothing staged; `git diff --check`
was clean. The baseline, run before any edit:

- `npm run check` PASS 518/518.
- `npm run build` PASS (JS 956.14 kB, CSS 21.74 kB).
- `npm run test:e2e` **PASS 45/45** (9.3 min).

No source was edited while it ran.

## 2. The stand before

Item `pendulum-stand` (`items.json`):

- `visual` box 0.24 × 0.08 × 1.6 m: the base, and the collider.
- `pendulum.pivot` [0, 3.6, 0] from the base centre, `bobRadius` 0.06, `bobMass` 0.5.

The model's ranges (`experiments.json`): L 0.25–3 m, θ₀ −60…60°. A frictionless swing stays within
±θ₀, in the item's x–y plane, with positive angles towards +x.

Drawn by `ExperimentView.addPendulum`:

- two plain box posts at z = ±0.74;
- a box crossbar;
- a thick axle along z through the pivot;
- the protractor and length scale, canvas textures behind the swing plane;
- a swing group: a unit rod scaled to L, the bob at −L, turned by `swingAngle`.

The protractor hung in the air under the crossbar, and the length scale floated 0.5 m from the
frame with nothing holding it.

**Physics boundary**, read from the code:

- Collider: `visual.size` (`PhysicsSystem.shapeOf`), the base box.
- Pivot, L and θ: the item and the run (`swingLength`, `swingAngle`, from the model's state).
- The renderer only copies these values; nothing in physics or the simulation reads a mesh.

## 3. The stand after

- **`platform/render/assembly.ts` (new).**
  - The `Assembly` class owns everything a drawn apparatus makes: geometries, materials and
    InstancedMeshes. One `dispose()` frees them all, so the instance-buffer fix from P3.6 lives in
    one place.
  - It also holds the solids `loft`, `slab` and `arc`, moved from `launcherModel.ts`.
  - `launcherModel.ts` now uses it (−138 lines). Its 58 tests pass unchanged.
- **`platform/render/pendulumModel.ts` (new):**
  - `buildPendulumFrame`: drawn by `WorldRenderer`. The base is the entity's mesh, so focus shows on
    the painted frame, which shares its material.
  - `buildPendulumSwing`: drawn by `ExperimentView` and posed from the run.
  - `scaleLayout`: where the protractor and length scale hang. `ExperimentView` draws them from it,
    the frame's clip and arm hold them there, and the tests check the swing against it.

| Assembly     | Parts                                                                                                                                                                                    | Role                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Base         | chamfered slab (the entity mesh) on 4 rubber pads                                                                                                                                        | heavy footing; the collider is unchanged                               |
| Posts        | a foot plate at each end, bolted to the base (4 screws each); a chamfered steel post on it; a diagonal brace from the base's edge to each post                                           | the gantry's legs, braced against tipping in the swing direction       |
| Beam         | chamfered beam resting on both posts; a knee gusset under each end                                                                                                                       | carries the bearing                                                    |
| Bearing      | two hanger plates bolted under the beam's middle, round about the pivot; a steel axle through them; a hex nut on each end                                                                | the pivot itself, on the model's pivot                                 |
| Scale mounts | a clip from the beam down to the protractor's top; an arm from the beam's side out to the length scale and a plate holding its top                                                       | the scales no longer float                                             |
| Swing        | hub on the axle between the hangers; clamp and its screw holding the rod; rod from the pivot to the bob's centre; brass bob with the rod's lock nut on top and a matching nut underneath | the moving part; the bob stays visually centred where the model has it |

- **Pose without allocation.** `pose(length, angle)` only assigns: the rod's y-scale and the bob's
  position when L changes, then the swing's rotation. No geometry is made after the build.
- **Materials** from the P3.4 palette:
  - the entity's painted material for the frame;
  - `metal` steel for the bearing, screws and nuts;
  - `rubber` for the pads;
  - brass for the bob; the P3.4 rod steel (`#6b737c`) for the rod.
- **Cost reductions** after the first measurement (§6):
  - pairs (foot plates, posts, hangers) and all screws are instanced;
  - parts smaller than a shadow-map texel (~2 cm over the lab) cast no shadow: pads, screws, nuts,
    the clamp screw, the bob's nuts, the clip.
- The posts stay where they always stood (z = ±0.74, along the base). Seen straight along z, the
  near post hides the swing's centre, as before. The player's desk sees it at an angle.

## 4. What was kept to protect physics

Unchanged:

- `items.json`; the collider; pivot, L, θ;
- the pendulum model, its integration, period, sampling and end condition;
- `swingAngle` and `swingLength`;
- RunRecord, completion, the save and IndexedDB;
- FrameClock, the cap, graphics quality, lighting;
- the Game and the RAF;
- the protractor's and length scale's textures and positions (`scaleLayout` computes the same
  positions the code did).

## 5. Tests and clearance

| Command                                                                                                            | Result                                        |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `npm run check`                                                                                                    | **PASS** 770/770, 43 files (+252)             |
| `npm run build`                                                                                                    | **PASS**                                      |
| `npx playwright test pendulum.spec history.spec results-view.spec measurement.spec run-history.spec --project=dev` | **PASS** 13/13                                |
| `npm run test:e2e` (3 workers, no retry)                                                                           | **PASS** 45/45, 0 failed, 0 skipped (9.1 min) |
| `git diff --check`                                                                                                 | clean                                         |

- **Unit tests** (`pendulumModel.test.ts`, 252):
  - **Dispose.** Everything the frame and swing make is freed: geometries, their own materials and
    the instance buffers. The entity's material is left alone.
  - **Concentric.** The axle and the hub are on the pivot. Each hanger copy's origin, about which
    its round end is drawn, is the pivot. The nuts are centred on the pivot to 1 µm (instance
    transforms are float32).
  - **Rod.** For L = 0.25, 0.5, 1, 2 and 3 m and θ = −60, −55, … 60° (25 angles):
    - the rod's top is the pivot and its end is the bob's centre (to 10⁻⁹ m);
    - the bob is at distance L, at x = L sin θ.
  - **Clearance.** For the same 125 samples, no box of a swinging part (clamp, screw, rod, bob and
    its nuts) meets:
    - any fixed part: base, pads, foot plates, screws, posts, braces, beam, knees, hangers, nuts,
      clip, arm, holder; instanced parts are boxed per copy, since a union box would be falsely
      large;
    - the protractor's or the length scale's plane.
      The hub, which turns on the axle by design, and the axle are left out of that check; their
      shared axis is checked above.
- **Method limits:**
  - These are axis-aligned boxes, which are conservative for the diagonal rod; they still pass,
    because everything is separated in z.
  - The angles are samples every 5°, not a continuous sweep. Nothing lies in the swing plane near
    the swing, so nothing lies between samples either; that is a design fact, not a test result.
- **Physics unchanged.** The pendulum e2e specs assert the period against theory, the readings, the
  CSV and the history, and pass unchanged. So do the history, results and run-history specs.
- **Resource leak probe.** A temporary e2e probe (deleted) counted live WebGL buffers and textures
  over four Physics Lab ↔ hub round trips, by developer scene jump, used only to unload and reload:
  - after: 387 buffers and 22 textures on every trip;
  - HEAD: 360 and 22 on every trip.
  - No growth, so no leak. The extra 27 buffers are the new geometry, live while the room is.

## 6. Benchmark

All runs: `npm run bench`, "pendulum bay frame times" (idle at the desk, swinging, after the run),
production build, Edge headless, 1280×720, Medium graphics, AC power.

**RTX 5070 Laptop GPU (ANGLE D3D11), gpu-headless, no cap.** Two rounds each:

| Scenario  | FPS |     GPU ms before → after |     CPU ms before → after | Draw calls before → after |
| --------- | --: | ------------------------: | ------------------------: | ------------------------: |
| idle      | 300 | 2.39 / 2.39 → 2.34 / 2.38 | 0.69 / 0.70 → 0.82 / 0.84 |                 130 → 151 |
| swinging  | 300 | 2.31 / 2.32 → 2.32 / 2.34 | 0.71 / 0.71 → 0.80 / 0.83 |                 130 → 151 |
| after run | 300 | 2.35 / 2.40 → 2.41 / 2.40 | 0.69 / 0.70 → 0.81 / 0.82 |                 130 → 151 |

- GPU time is within noise. Draw calls are +21 and CPU time is about +0.13 ms.
- The first version, before the cost reductions of §3, had 166 draw calls and about +0.2 ms CPU.

**SwiftShader** (software, uncapped):

| Scenario  | FPS before → first version → after | GPU ms before → after |
| --------- | ---------------------------------: | --------------------: |
| idle      |                 40.1 → 36.3 → 37.4 |         21.58 → 23.21 |
| swinging  |                 34.7 → 32.1 → 33.0 |         24.18 → 25.68 |
| after run |                 39.5 → 36.1 → 37.3 |         21.91 → 23.35 |

About 5–7 % slower under SwiftShader. The pendulum e2e specs passed at this cost, in the full run
too.

**Geometry**, counted from the built model by a temporary test (deleted):

| Measure    | Before                                 | After                    |
| ---------- | -------------------------------------- | ------------------------ |
| Objects    | 7 (base, 2 posts, bar, axle, rod, bob) | 21 (8 of them instanced) |
| Triangles  | 864                                    | 2,848                    |
| Geometries | 6, plus the shared base box            | 20                       |
| Materials  | 5, plus the entity's                   | 6 own, plus the entity's |

## 7. Visual validation

- **Method.** Headless screenshots on the real GPU (RTX 5070, gpu-headless) at 1280×720, Medium
  graphics, of the same nine views before and after, saved in the session's scratchpad
  (`p37/before`, `p37/after2`). The close-ups were enlarged to inspect the pivot and the base.
- **Views:**
  - far, from the desk side;
  - mid: front (along z), side (along x), rear;
  - wide at both swing limits (L 3 m, +60° and −60°);
  - close: the bearing from below, the bob, the base.
- **What the after shots show:**
  - The frame reads as a braced gantry, with knee gussets under the beam's ends.
  - The protractor hangs from its clip, and the length scale from its arm and holder.
  - The hanger plates, hub and axle read as a bearing; the rod runs from the hub to the nut on top
    of the bob.
  - The foot plates show their screws, and the braces meet the posts.
  - At both limits the bob is far from any part.
  - No interpenetration or floating part was seen in the nine views.
  - The optimised version looks the same as the first.
- **Not done:**
  - Nobody looked at a real display, or at other resolutions.
  - The screenshots show the stand at rest at set angles; the motion is covered by the sampled
    unit tests.
  - From the rear, the scales are nearest the viewer (they hang behind the swing plane), as before.

## 8. Bundle

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 956.14 kB | 959.36 kB | +3.22 kB |
| CSS   | 21.74 kB  | 21.74 kB  | 0        |

The JS stays under the 1,000,000-byte budget, with about 41 kB left. No dependency or asset was
added. The shared `assembly.ts` keeps the two models from duplicating their helpers.

## 9. Files changed

| File                                              | Why                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/platform/render/assembly.ts` (new)           | resource ownership (`Assembly`, `at`), `loft`, `slab`, `arc`                                        |
| `src/platform/render/pendulumModel.ts` (new)      | the frame, the swing, `scaleLayout`                                                                 |
| `src/platform/render/pendulumModel.test.ts` (new) | 252 unit tests (§5)                                                                                 |
| `src/platform/render/launcherModel.ts`            | uses `assembly.ts`; its helpers moved there                                                         |
| `src/platform/render/WorldRenderer.ts`            | draws the pendulum frame; frees it with the view                                                    |
| `src/platform/render/ExperimentView.ts`           | scales from `scaleLayout`; the swing from `buildPendulumSwing`; frame code removed; frees the swing |
| `docs/experiments.md`                             | how the stand is drawn                                                                              |
| this report                                       |                                                                                                     |

## 10. Open points and next

- **Open:**
  - No look at a real display.
  - The clearance tests are sampled.
  - SwiftShader frames are 5–7 % slower in the bay.
  - The near post still hides the swing's centre when seen exactly along z, as before.
- **Next:**
  - The spring stand and the drop tower, one at a time, with the same pattern: `Assembly`, a pure
    layout shared by the code and the tests, clearance over the model's ranges, dispose tests, the
    leak probe, before/after bench.
  - If draw calls start to matter, merge each model's static painted parts into one geometry.

## 11. Git

- Base `8013a26`; committed as phase p3.7, not pushed.
- `git diff --stat`: 4 files, +79 −223, plus `assembly.ts`, `pendulumModel.ts`,
  `pendulumModel.test.ts` and this report (new).
- The temporary specs and the worktree were removed.
