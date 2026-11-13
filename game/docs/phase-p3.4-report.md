# Phase P3.4 report — Physics Lab materials and equipment detail

Date: 2026-10-26 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase p3.4.

**Verdict: PASS WITH LIMITATIONS.** The Physics Lab's surfaces now differ by material: bare steel,
painted frames, brass, rubber, plastic. Physics, interaction and performance are unchanged.
`npm run check`, `npm run build` and the full e2e run pass, and the GPU numbers were measured on
the RTX 5070 Laptop GPU.

Limitations:

- The visual judgement comes from headless screenshots on that GPU, not from a person at a
  display.
- Without an environment map, metals stay simple (deferred, §9).

## 1. Repository and baseline

HEAD `0ba50f4` (phase p3.3) on `main`, with a clean working tree before the change. Baseline:

- `npm run check` PASS 458/458.
- `npm run build` PASS (JS 939.47 kB, CSS 21.70 kB).
- `npm run test:e2e` PASS 44/44 (8.8 min).

## 2. Audit

- **Items** take their look from `visual.material`, one of five presets shared by every room:
  `matte` (default), `satin`, `metal` (0.35 / 0.5), `glass`, `light`.
- **Apparatus parts** drawn by `ExperimentView`:
  - pendulum posts, crossbar, axle, rod and bob;
  - drop-tower base, clamp, pad and ball;
  - spring-stand base, arm, coil and mass;
  - rulers and protractor.
    They had literal materials. The frame material (`#59636e`, 0.35 / 0.5) was written out four
    times.
- **No environment map.** It was rejected in 6B for its software-WebGL cost. So a strongly metallic
  surface (the spring and steel ball at 0.8) renders near-black except at highlights.
- **Wrong looks:**
  - the control dials were `metal` (near-black), though they are plastic or rubber knobs;
  - the bench's steel ball was `matte`, so it looked like plaster.
- **Where the items are.** The Physics Lab scene (rooms `physics-lab`, `projectile-range`,
  `pendulum-bay`) alone uses the dials, desks, stands, tower, launcher, cart, balls, displays and
  buttons. `lab-bench` is also in the chemistry and biology labs, so it was left alone.
- **Lighting** is P3.3's enhanced mode (bounce, fill, matte walls, floor sheen), unchanged here.

## 3. Implemented

- **Palette** (`src/platform/render/looks.ts`, moved out of `WorldRenderer`). One table of how each
  kind of surface answers light. It is shared by item materials and by the apparatus parts in
  `ExperimentView`, each with its own colour.
- **Three presets added** to the content enum `MATERIALS` (`src/gameplay/item.ts`): `painted`,
  `plastic`, `rubber`. Adding to the enum is backward compatible: existing content is unchanged
  unless edited.

| Preset           | Roughness / metalness      | Used for                                                                |
| ---------------- | -------------------------- | ----------------------------------------------------------------------- |
| `matte`          | 0.6 / 0 (unchanged)        | most items, every room                                                  |
| `satin`          | 0.32 / 0.05 (unchanged)    | buttons, displays, teacher-room furniture                               |
| `metal`          | 0.3 / 0.5 (was 0.35 / 0.5) | bare steel and brass: cart, barrel, axle, rod, balls, spring, bob, mass |
| `painted`        | 0.55 / 0.12                | stands, tower, launcher body and yoke, apparatus frames                 |
| `plastic`        | 0.42 / 0                   | control desks (laminate)                                                |
| `rubber`         | 0.9 / 0                    | dials, the drop tower's landing pad                                     |
| `glass`, `light` | unchanged                  |                                                                         |

Why metals stay half metallic: with no environment map, a metal is lit only by its highlights.
At metalness 0.5, in light steel tones, they read as metal rather than black.

## 4. Material mapping

| Object (Physics Lab)                                 | Before               | After                         |
| ---------------------------------------------------- | -------------------- | ----------------------------- |
| Control dials (12)                                   | metal `#2b2f36`      | rubber                        |
| Control desks (3)                                    | satin                | plastic                       |
| Pendulum stand, drop tower, spring stand             | metal `#59636e`      | painted                       |
| Launcher body; its yoke                              | satin                | painted                       |
| Launcher barrel                                      | metal `#59636e`      | metal, steel `#a8b0b8`        |
| Steel ball on the bench                              | matte                | metal                         |
| Apparatus frames (posts, bars, bases, arms, clamp)   | 0.35 / 0.5 `#59636e` | painted `#4f5965`             |
| Pendulum axle                                        | (frame material)     | metal, steel `#b4bcc4`        |
| Pendulum rod                                         | 0.4 / 0.5 `#2b3138`  | metal `#6b737c`               |
| Pendulum bob                                         | brass 0.3 / 0.6      | metal (brass `#c9a24a`)       |
| Drop-tower ball                                      | 0.25 / 0.8           | metal, steel `#cfd5da`        |
| Drop-tower pad                                       | 0.9 / 0 `#2b3138`    | rubber `#24282d`              |
| Spring coil                                          | 0.3 / 0.8            | metal, spring steel `#d0d5da` |
| Spring mass                                          | 0.45 / 0.6 `#8a6d3b` | metal, brass `#b8924c`        |
| Rulers, protractor, screens, buttons, ceiling lights | —                    | unchanged: legibility first   |

- **Visual hierarchy.** Light furniture (plastic desks, matte walls, a light floor) sits behind dark
  painted apparatus frames. The parts that move or are measured stand out of those frames: steel
  balls, coil, axle, brass mass and bob. No emissive, outline or bloom.
- **Lighting**: no change. The P3.3 setup was kept.

## 5. Physics safety

- No collider, rigid body, mass, gravity, restitution, friction, fixed step, model, sampling or
  completion change. Only `visual.material` in content, and material parameters in the renderer,
  changed.
- `visual.material` is read by the renderer alone. The physics bodies come from `visual.size` and
  `physics`, both unchanged.
- The geometry of every part is unchanged. Material instances per rig: +1 (the pendulum's axle has
  its own steel material).

## 6. Performance

All numbers come from `npm run bench` (`playwright.bench.config.ts`) in Edge headless, at
1280×720, on the production build, Physics Lab projectile range. "Before" is the P3.3 code (HEAD
`0ba50f4`); "after" is this phase.

**RTX 5070 Laptop GPU (ANGLE, Direct3D11), GPU ms mean (p95), before → after:**

| FPS cap | Scenario      | Frame ms       | GPU ms                    | Draws |
| ------- | ------------- | -------------- | ------------------------- | ----- |
| none    | idle          | 3.33 → 3.33    | 2.42 (2.88) → 2.46 (2.90) | 125   |
|         | interacting   | 3.33 → 3.33    | 2.30 (2.90) → 2.32 (2.93) | 99    |
|         | running       | 3.33 → 3.33    | 2.43 (3.00) → 2.42 (3.00) | 126   |
|         | after landing | 3.33 → 3.33    | 2.43 (2.87) → 2.44 (2.86) | 128   |
| 60      | idle          | 19.10* → 16.67 | 0.14 → 0.10               | 125   |
|         | interacting   | 16.67 → 16.67  | 0.20 → 0.21               | 99    |
|         | running       | 16.67 → 16.67  | 1.10 → 1.13               | 126   |
|         | after landing | 16.67 → 16.67  | 0.10 → 0.11               | 128   |
| 30      | idle          | 33.33 → 33.33  | 0.11 → 0.11               | 125   |
|         | interacting   | 33.33 → 33.34  | 0.29 → 0.30               | 99    |
|         | running       | 33.34 → 33.33  | 2.43 → 2.18               | 126   |
|         | after landing | 33.34 → 33.33  | 0.10 → 0.09               | 128   |

\* One 422 ms stall at the start of that sample (before), not repeated.

- **Under a cap**, the timer query reports 0.1–0.3 ms a frame against about 2.4 ms with no cap.
  Uncapped, the GPU is kept saturated at about 300 frames a second, and the query then likely
  includes queued work. The capped and uncapped GPU columns are therefore not comparable with each
  other; before and after within one cap are.
- **SwiftShader** (software, uncapped), GPU ms after → P3.3's measurement of the same code:
  idle 18.66 (19.61), interacting 22.74 (23.62), running 25.36 (26.76), after landing 19.30 (20.61).
  No regression, within noise.
- **Draw calls** are unchanged everywhere.

**Bench harness changes**, needed to measure under a cap:

- `BENCH_FRAME_CAP=30|60|90|120` sets the game's cap. The recorder now counts only the frames the
  game drew: a capped game skips display frames without a draw call. Uncapped, every frame draws,
  so the numbers mean what they did.
- A harness bug exposed by capped aiming, and fixed: `Aim.to` (e2e) frees the mouse between steps
  of a large turn. That pauses the game, and a pause drops look movement no game frame has read
  yet (P1, `input.reset()`). Under a cap, where not every display frame is a game frame, a
  2.6 rad turn came out 0.25 rad short.
  - Root cause, measured by a temporary probe that read the saved yaw back: 2.233 wanted, 1.983 got
    under caps 60 and 30; 2.233 with no cap.
  - Fix: `gameFrame()` waits for a game frame between steps (two cap intervals when a cap is set).
    After the fix, all three caps read 2.233.
  - The game's pause semantics were not changed. For a player this is at most one frame of mouse
    movement right before Esc.

## 7. Bundle

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 939.47 kB | 939.56 kB | +0.09 kB |
| CSS   | 21.70 kB  | 21.70 kB  | 0        |

No dependency or asset was added. The JS stays under the 1,000,000-byte budget.

## 8. Tests

| Command                                                                                                                                                | Result                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `npm run check`                                                                                                                                        | **PASS** 458/458, 41 files                    |
| `npm run build`                                                                                                                                        | **PASS**                                      |
| `npx playwright test experiment.spec pendulum.spec hooke.spec free-fall.spec settings.spec --project=dev`                                              | **PASS** 6/6                                  |
| `npx playwright test grab.spec --project=dev-timed --no-deps`                                                                                          | **PASS** 1/1                                  |
| `npm run test:e2e` (3 workers, no retry)                                                                                                               | **PASS** 44/44, 0 failed, 0 skipped (8.9 min) |
| `BENCH_FRAME_CAP=<none,60,30> npx playwright test -c playwright.bench.config.ts physics-lab.bench --project=gpu-headless -g "physics lab frame times"` | **PASS** ×3 (§6)                              |
| `npx playwright test -c playwright.bench.config.ts physics-lab.bench --project=software -g "physics lab frame times"`                                  | **PASS**                                      |
| `git diff --check`                                                                                                                                     | clean                                         |

The FPS settings are unchanged since P3.3: the cap is still applied and the frames are paced, by
the bench at 60 and 30. That the simulation does not depend on the cap is covered by the
unchanged `src/game/frameCap.test.ts`, inside `npm run check`.

## 9. Visual validation

- **Headless screenshots on the real GPU** (RTX 5070 Laptop, gpu-headless), 13 views, before and
  after. Saved in the session's scratchpad (`p34/before`, `p34/after`). The before shots come from
  a temporary git worktree at HEAD, now removed.
  - Views: lab broad (A), projectile station (B), pendulum bay (C), Hooke (D), free-fall tower,
    bench and ball, plus close-ups of the Hooke stand, the tower, the launcher, the cart, the
    pendulum base, the dials and the steel ball.
- What the after shots show:
  - The steel balls (bench and tower) catch a metallic highlight; before, the bench ball looked
    like plaster.
  - The spring's mass reads as brass instead of near-black brown.
  - The stands' columns and bases read as painted grey-blue, apart from the steel parts.
  - The pad and the dials are matte.
  - The tape, the rulers, the protractor and the screens are as legible as before.
  - The far views change little: the differences are at station distance.
- **Not done:**
  - No look at a real display. Nobody judged it by eye on the laptop's screen.
  - No validation at other resolutions or HDR.
    The GPU numbers are real GPU numbers; the visual judgement is from headless captures.
- **Deferred:**
  - An environment map, so that metals and the floor reflect the room. On capable GPUs only, or
    behind a quality setting: under SwiftShader it once halved the Physics Lab's frame rate.
  - Advanced reflections or post-processing (SSAO, bloom).
  - Textures or normal maps for floor and walls.

## 10. Files changed

| File                                                           | Why                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/platform/render/looks.ts` (new)                           | the material palette, shared                                            |
| `src/platform/render/WorldRenderer.ts`                         | uses the palette; steel barrel, painted yoke                            |
| `src/platform/render/ExperimentView.ts`                        | apparatus parts from the palette (painted frames, steel, brass, rubber) |
| `src/gameplay/item.ts`                                         | `painted`, `plastic`, `rubber` in `MATERIALS`                           |
| `src/content/items.json`                                       | 7 Physics Lab items' `visual.material`                                  |
| `e2e/physics-lab.bench.ts`                                     | `BENCH_FRAME_CAP`; counts only frames drawn                             |
| `e2e/support.ts`                                               | `gameFrame()`; `Aim.to` waits for one between steps                     |
| `docs/data-model.md`, `docs/development-guide.md`, this report | documentation                                                           |

## 11. Git

- Base `0ba50f4`; committed as phase p3.4, not pushed.
- `git diff --stat`: 8 files, +89 −57, plus `looks.ts` and this report (new).
- The temporary specs (`zz-look.bench.ts`, `zz-aim.bench.ts`) were deleted. The temporary worktree
  was removed.
