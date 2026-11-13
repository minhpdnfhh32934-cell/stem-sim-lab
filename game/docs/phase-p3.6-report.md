# Phase P3.6 report — projectile launcher model

Date: 2026-10-26 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase p3.6.

**Verdict: PASS WITH LIMITATIONS.**

- The launcher is now drawn as an assembled apparatus: base, pedestal, a bolted fork, trunnion
  bearings, a lock, a spring-launcher tube, and an angle scale whose pointer turns with the barrel.
- Physics, the trajectory, interaction and history are untouched.
- An old clipping fault is fixed: the barrel used to sink into the box above 40°.
- `npm run check`, `npm run build` and the full e2e run pass.
- Performance was measured on the RTX 5070 Laptop GPU and under SwiftShader.

Limitations:

- The look was judged from headless captures on the GPU, not by a person at a display.
- The scale has ticks but no numbers.

## 1. Repository and baseline

HEAD `13b97b4` (phase p3.5) on `main`. The tree was clean with nothing staged, and
`git diff --check` was clean. The baseline, run before any edit:

- `npm run check` PASS 460/460.
- `npm run build` PASS (JS 949.42 kB, CSS 21.74 kB).
- `npm run test:e2e` **PASS 45/45** (9.3 min).

No source was edited while that run was going.

## 2. The launcher before

Item `projectile-launcher` (`items.json`):

- `visual` box 0.45 × 0.35 × 0.35 m, painted.
- `launcher.muzzle` [0.1, 0.62, 0]: the launch point and the barrel's pivot, from the base centre;
  +x is the launch direction.
- `barrelLength` 0.36 m, `barrelDiameter` 0.075 m.

Drawn by `WorldRenderer.barrelFor`, as three primitives:

- the item's box;
- a box "yoke" on top;
- a solid cylinder barrel reaching back from the pivot, turned about z by the `param.angle` state
  (0–90°, step 5).

Because the barrel turns about its front end, its rear swings down. From about 40° on (the default
is 45°) it sank into the box; at 90° it sank about 9 cm into it.

**Physics boundary**, read from the code:

- The collider is a cuboid of `visual.size` (`PhysicsSystem.shapeOf`).
- Focus uses `rayBox` on the item's half-extents (`InteractionSystem`), plus one physics ray for
  occlusion.
- The launch point and direction come from `launcher.muzzle` and the entity's +x
  (`StationSystem.launcherStation`).
- None of these reads a render mesh, so the model could be rebuilt without touching content,
  colliders or the simulation.

## 3. The launcher after (`src/platform/render/launcherModel.ts`)

`buildLauncher(item, launcher, painted)` returns:

- the pedestal geometry, which the entity's own mesh takes, so focus glows on it;
- the fixed parts;
- the barrel's pivot group, turned by the angle state as before;
- `dispose()`.

Every painted part shares the entity's material, so focus highlights the whole painted assembly.
Every dimension is derived from the item data.

| Assembly    | Parts                                                                                                                                                                  | Role                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Base        | bevelled base plate with rounded corners; 4 rubber feet; chamfered pedestal                                                                                            | a heavy, stable footing on the floor                                       |
| Fork        | flange (4 socket screws, at its corners clear of the cheeks); two cheeks with round tops about the pivot; 4 gussets on their outer faces                               | carries the barrel; the screws are what fixes the fork to the pedestal     |
| Pivot       | stub trunnions on the muzzle block's sides (none across the bore); steel bearing bosses on the cheeks; a hex nut far side; a rubber lock knob near side                | the axis the barrel turns about; the knob is the angle lock                |
| Barrel      | one lathe profile: bored muzzle block straddling the pivot, the tube, the spring housing and its rear face; rubber plunger face in the bore; cocking rod and ball knob | a spring launcher; the bore shows depth, the ball sits in it when loaded   |
| Angle scale | cream quarter-ring plate on the near cheek, ticks every 5° (longer every 15°), red pointer on the barrel's axis                                                        | shows the simulated angle: the ticks and the pointer use the same rotation |

- **Clearance by construction.** The pedestal's top is set from how far the barrel's rear reaches
  below the pivot (rod, knob and housing rim), less 8 mm. The slot between the cheeks (55 mm
  half-width) is wider than the muzzle block (51.5 mm), and that is wider than the ball (30 mm). The
  barrel therefore swings between the cheeks over 0–90° without passing through anything.
- **No fake scale.** The scale has no numbers. A tick at θ lies along (−cos θ, −sin θ) from the
  pivot, and the pointer is the barrel's rearward axis rotated by the same θ.
- **Materials** come from the P3.4 palette (`looks.ts`):
  - painted: the entity's own material;
  - `metal` steel `#b4bcc4`: tube, screws, bosses, nut, trunnions, rod;
  - `rubber`: feet, knob, plunger, rod knob;
  - `plastic`: the scale plate;
  - unlit ink and red for the ticks and the pointer, like the spring stand's pointer.
- **Geometry choices:**
  - **LatheGeometry** for the barrel's turned profile.
  - **A small `loft()`** for the slabs, cheeks and gussets: a solid between stacked convex outlines,
    with chamfers, smooth along arcs and creased at sharp corners.
  - **Why not ExtrudeGeometry:** a first version used it, and three's `ExtrudeGeometry` brought the
    whole Shape/Path/Curve family into the bundle: JS rose to 983.61 kB (+34 kB), 16 kB under the
    budget. `loft()` brought it back to +6.7 kB.
  - **Repeated parts** (feet, screws, gussets, bosses, trunnions) are InstancedMeshes: one draw call
    each, one shared geometry.
  - **Primitives** (Cylinder, Ring, Circle, Plane, Sphere) for the rest.
- **Replaced:** `WorldRenderer.barrelFor` was removed. `addEntity` builds the model for items with
  `launcher`, and `removeEntity` frees it.

## 4. What was kept to protect physics

Unchanged:

- `items.json` (size, muzzle, barrel data, mass);
- `PhysicsSystem` (collider), `InteractionSystem` (focus box);
- `StationSystem` (launch point, direction, PoseDriver), the projectile model, sampling and
  completion;
- RunRecord and IndexedDB history, `SAVE_VERSION`;
- FrameClock, the FPS cap, the graphics quality, lighting and the environment.

The only change is how the launcher is drawn.

## 5. Tests

| Command                                                                                                                            | Result                                        |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `npm run check`                                                                                                                    | **PASS** 518/518, 42 files (+58 tests)        |
| `npm run build`                                                                                                                    | **PASS**                                      |
| `npx playwright test experiment.spec history.spec measurement.spec results-view.spec run-history.spec settings.spec --project=dev` | **PASS** 16/16                                |
| `npm run test:e2e` (3 workers, no retry)                                                                                           | **PASS** 45/45, 0 failed, 0 skipped (9.0 min) |
| `git diff --check`                                                                                                                 | clean                                         |

- **Unit tests** (`launcherModel.test.ts`, 58):
  - Everything the model makes is freed by `dispose()`: geometries, its own materials and the
    InstancedMeshes' transform buffers. The entity's material is left alone.
  - At each of 0, 5, … 90°:
    - the barrel, rod and knob stay above the flange and touch neither cheek;
    - nothing fixed stands within a ball radius of the launch path, from 4 cm to 60 cm past the
      pivot;
    - the pointer lies on exactly one tick, the one for that angle.
- **Mutation check.** With the InstancedMesh disposal removed, the dispose test fails; with it
  restored, it passes.
- **Projectile behaviour** is covered by e2e that assert the range, flight time and CSV against
  the closed-form theory (`experiment.spec`, `history.spec`, `run-history.spec`). All pass
  unchanged, so the trajectory and launch point are the same. Grab, pause, settings, FPS and
  graphics are covered by the full run.
- **Resource leak.** A temporary e2e probe (deleted) counted live WebGL buffers and textures across
  four Physics Lab ↔ hub round trips. Those were developer scene jumps, used only to unload and
  reload; they are not evidence about doors.
  - The first version **leaked 5 buffers a trip** (365 → 370 → 375 → 380): the InstancedMeshes'
    `instanceMatrix` buffers, which only `InstancedMesh.dispose()` frees.
  - After the fix: **360 on every trip**. HEAD measured 312 on every trip; the difference is the new
    geometry, live while the room is.
  - Textures: 22 in both.

## 6. Benchmark

All runs: `npm run bench` (physics-lab scenario: idle down the lane with the launcher in view,
dial, flight, after landing), production build, Edge headless, 1280×720, Medium graphics, on AC
power. "Before" was run at `13b97b4`, before any edit; "after" with this change.

**RTX 5070 Laptop GPU (ANGLE D3D11), gpu-headless, no cap.** Two rounds each:

| Scenario      | FPS before → after |     GPU ms before → after |     CPU ms before → after | Draw calls |
| ------------- | -----------------: | ------------------------: | ------------------------: | ---------: |
| idle          |          300 → 300 | 2.31 / 2.36 → 2.28 / 2.28 | 0.61 / 0.54 → 0.65 / 0.67 |  125 → 138 |
| interacting   |          300 → 300 | 2.25 / 2.19 → 2.19 / 2.17 | 0.47 / 0.45 → 0.59 / 0.58 |   99 → 112 |
| running       |          299 → 300 | 2.35 / 2.35 → 2.33 / 2.27 | 0.55 / 0.57 → 0.67 / 0.71 |  126 → 139 |
| after landing |          300 → 300 | 2.36 / 2.34 → 2.27 / 2.26 | 0.60 / 0.63 → 0.71 / 0.68 |  128 → 141 |

- **GPU:** within noise.
- **Draw calls:** +13 a frame, the shadow pass included.
- **CPU:** about +0.1 ms (more objects to sort and submit).

**Under a cap, after:**

| Cap | Frame ms, idle / running | Draw calls |
| --- | -----------------------: | ---------: |
| 60  |            16.67 / 16.67 |  138 / 139 |
| 30  |            33.33 / 33.34 |  138 / 139 |

**SwiftShader** (software, uncapped):

| Scenario      | FPS before → after | GPU ms before → after |
| ------------- | -----------------: | --------------------: |
| idle          |        44.2 → 42.8 |         19.34 → 19.99 |
| interacting   |        39.3 → 37.1 |         22.38 → 23.67 |
| running       |        34.7 → 34.2 |         25.73 → 26.18 |
| after landing |        43.3 → 42.3 |         19.84 → 20.28 |

That is about 1–6 % slower under SwiftShader.

**Geometry cost of the launcher:**

| Measure                                    | Before                 | After                    |
| ------------------------------------------ | ---------------------- | ------------------------ |
| Objects                                    | 3 (box, yoke, barrel)  | 19 (5 of them instanced) |
| Triangles                                  | 120                    | 2,932                    |
| Geometries                                 | 2, plus the shared box | 18                       |
| Materials                                  | 2, plus the entity's   | 5, plus the entity's     |
| Live WebGL buffers (whole scene, measured) | 312                    | 360                      |

These numbers were counted from the built model by a temporary test, now deleted.

## 7. Visual validation

- **Method.** Headless screenshots on the real GPU (RTX 5070, gpu-headless) at 1280×720, Medium
  graphics, of the same nine views before and after. Saved in the session's scratchpad
  (`p36/before`, `p36/after`).
- **Distances and angles:**
  - far (about 4 m): the silhouette;
  - mid (about 1.5 m): near side at 0°, 45° and 90°, the front, the rear, the far side;
  - close (about 0.7 m): from above, at 45° and 60°.
    The close-ups were enlarged to inspect the scale, the pointer, the knob and the bore.
- **What the after shots show:**
  - The base, pedestal and fork read as one footed assembly.
  - The pivot reads as a bearing with a lock knob, and as a hex nut on the far side.
  - The tube shows a bored muzzle with the loaded ball in it, the spring housing and the rod.
  - The red pointer sits on the 45° tick at 45°.
  - At 90° the barrel hangs within the slot; it no longer sinks into the base.
  - No interpenetration or floating part is visible in any of the nine views.
  - Bolts sit on the flange; bosses, nut and knob are concentric with the pivot.
- **Not done:** no person looked at a real display; no other resolution; not seen in flight.
- **Limits of the look:**
  - The scale has ticks but no numbers. Numbers would need a texture, or a test proving they match;
    the ticks alone cannot mislead.
  - From the far (−z) side there is no scale.

## 8. Bundle

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 949.42 kB | 956.14 kB | +6.72 kB |
| CSS   | 21.74 kB  | 21.74 kB  | 0        |

The JS stays under the 1,000,000-byte budget, with about 44 kB left. No dependency or asset was
added.

## 9. Files changed

| File                                              | Why                                                         |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `src/platform/render/launcherModel.ts` (new)      | the launcher model, `loft()`, ticks                         |
| `src/platform/render/launcherModel.test.ts` (new) | 58 unit tests (§5)                                          |
| `src/platform/render/WorldRenderer.ts`            | uses the model; `barrelFor` removed; frees it with the view |
| `docs/experiments.md`                             | how the launcher is drawn                                   |
| this report                                       |                                                             |

## 10. Open points and next phase

- **Open:**
  - No look at a real display.
  - The CPU cost of more objects (+0.1 ms) adds up if every apparatus gets this treatment. Merging
    static parts per material would cut draw calls if that matters.
- **Next:** give the other apparatus the same treatment one at a time, with the same tests
  (clearance, path, dispose) and measurements:
  - the spring stand (mass hanger, clamp, scale mounting);
  - the pendulum stand (pivot bearing, clamp, base levelling feet);
  - the drop tower (release clamp mechanism).

## 11. Git

- Base `13b97b4`; committed as phase p3.6, not pushed.
- `git diff --stat`: 2 files, +27 −42, plus `launcherModel.ts`, `launcherModel.test.ts` and this
  report (new).
- The temporary specs and the worktree were removed.
