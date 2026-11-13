# Phase 6C.1 report — GPU and performance validation

Evidence that the Physics Lab renders correctly and fast on the real GPU, that the projectile
experiment's physics does not depend on the render frame rate, and that Phase 6B still holds.
The validation found one real Phase 6B bug, Continue with a ball in the launcher crashed the
physics, which is fixed with a regression test. No experiment, feature or UI was added.

Evidence kinds are kept apart throughout:

- **GPU:** WebGL on the NVIDIA GPU, renderer string checked.
- **Software:** SwiftShader.
- **CPU and simulation:** Node, the same machine.
- **E2E timing:** the parallel headless suite.

## 1. Verdict

| Question                 | Verdict                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| GPU                      | **GPU PASS**                                                              |
| Performance              | **PASS**                                                                  |
| Experiment vs render FPS | Independent: bit-identical at 300 … 10 fps, identical in the real browser |
| Phase 6B functionality   | Intact after one fix (Continue with a loaded launcher)                    |
| Proceed to Phase 6C.2    | **YES**                                                                   |

**GPU PASS.** Edge renders WebGL on the NVIDIA GeForce RTX 5070 **Laptop** GPU (ANGLE,
Direct3D 11). The Physics Lab renders correctly there and holds the display's 300 fps in every
scenario, at 1280×720 and at the display's native 2548×1402. Frames take about 0.3 ms of CPU
and 2.1–2.5 ms of GPU time.

**Performance PASS.** The lab is far inside its frame budget on the GPU, and at 34–47 fps
usable in software. Nothing expensive came back: no environment map, and shadows stay with a
measured cost. The simulation costs 0.25 ms of CPU at worst per 0.1 s frame.

**Correctness:** the tests below prove the projectile's physics independent of frame rate.

**Code change:** one, the Continue fix (§11). The rest is tests, a benchmark, E2E stability and
documentation.

## 2. Baseline (before any change)

| Item               | State                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------- |
| HEAD               | `f1fc861` (Phase 6B docs), as reported                                                   |
| `git status`       | clean, no stash, no remote                                                               |
| `npm run check`    | PASS — 223/223 unit tests (20 files)                                                     |
| `npm run test:e2e` | PASS — 10/10, 2.0 min, 4 workers                                                         |
| `npm run build`    | PASS — entry 777.20 kB (gzip 207.00), CSS 5.37 kB, Rapier 4,332.82 kB (lazy)             |
| 6B decisions       | environment map absent (no PMREM, RoomEnvironment or `environment` in `src`), shadows on |

## 3. Hardware detected

| Item       | Detected                                                                              |
| ---------- | ------------------------------------------------------------------------------------- |
| Machine    | ASUS ROG Strix G16 (G614PP), Windows 11 Home 10.0.26200, 16 GB RAM                    |
| CPU        | AMD Ryzen 9 8940HX, 16 cores / 32 threads                                             |
| GPU        | **NVIDIA GeForce RTX 5070 Laptop GPU**, PCI 10DE:2D58, 8,151 MiB, PCIe gen 4          |
| Driver     | NVIDIA 617.42 (Windows 32.0.16.1742), `nvidia-smi` present                            |
| Integrated | AMD Radeon 610M (driver 32.0.21036.11002)                                             |
| Display    | 2560×1600 at **300 Hz**, attached to the NVIDIA adapter; Windows scaling 150 %        |
| Switching  | `edge://gpu`: Optimus false, AMD switchable false — the NVIDIA GPU drives the display |

The brief expected an "RTX 5070". The machine has the **Laptop** variant, a different, lower-power
part than the desktop card. All GPU results here are for the Laptop GPU.

## 4. Browser GPU renderer

The browser is Microsoft Edge 155.0.4283.62, launched by Playwright 1.63 (`channel: 'msedge'`)
with a fresh profile. Playwright's default automation switches don't touch the GPU. The user's own
Edge profile doesn't disable hardware acceleration (setting unset, so on), and Windows has no
per-app GPU preference for Edge.

The three layers, recorded separately:

| Layer                     | Evidence                                                                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical GPU exists       | `nvidia-smi`, `Win32_VideoController`                                                                                                                                                                                       |
| Browser uses the GPU      | `edge://gpu`: WebGL, Canvas, Compositing, Rasterization **Hardware accelerated**; GPU0 NVIDIA `*ACTIVE*`; display type `ANGLE_D3D11`                                                                                        |
| WebGL uses the NVIDIA GPU | `WEBGL_debug_renderer_info`: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58) Direct3D11 vs_5_0 ps_5_0, D3D11)` — WebGL 1 and 2, every `powerPreference`, and in the game's own context during the benchmark |

The renderer for each launch:

| Launch                                          | WebGL renderer                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| E2E suite (headless, `--use-angle=swiftshader`) | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)` — software |
| Headless, no flags                              | NVIDIA RTX 5070 Laptop GPU, Direct3D 11                                                      |
| Visible window, no flags (as a player runs it)  | NVIDIA RTX 5070 Laptop GPU, Direct3D 11                                                      |

`EXT_disjoint_timer_query_webgl2` is available, so GPU time was measured rather than estimated.

## 5. Hardware and software rendering status

- **E2E (`npm run test:e2e`):** software (SwiftShader), by design. It is deterministic and needs no
  GPU. Its frame rates are never GPU numbers.
- **Benchmark (`npm run bench`):**

  | Project        | Renderer and window                                                  |
  | -------------- | -------------------------------------------------------------------- |
  | `gpu`          | hardware (NVIDIA), a visible window at 1280×720                      |
  | `gpu-native`   | hardware, a maximized window at the display's 2548×1402, 1.5 scaling |
  | `gpu-headless` | hardware, no window                                                  |
  | `software`     | SwiftShader                                                          |

  A GPU project fails on purpose if WebGL reports a software renderer.

## 6. Physics Lab benchmark

**Method.** The benchmark measures the production build. It continues from a save of a player in
the projectile range: ball loaded, v₀ 5 m/s, θ 45°, Moon gravity. That is the game's own load
path, with no debug tools. A recorder injected before the game starts measures every animation
frame:

- the frame interval;
- the main-thread time of the frame (simulation, logic and issuing draws);
- the GPU elapsed time of its draws (timer query);
- the draw calls.

Scenarios:

- **Idle:** looking down the lane, 5 s.
- **Interacting:** the θ dial, 8 presses.
- **Running:** ball in flight, 2.5 s.
- **After landing:** trail and results, 5 s.

Shadows are on in all of them.

**Rendering audit.** The lab renders:

- **Lights:** two real lights (hemisphere and sun). The ceiling panels are emissive materials,
  not lights.
- **Shadows:** one 1024² PCF shadow map, sun only. Floors, objects and the tape receive shadows;
  walls and ceilings don't.
- **Tone mapping:** ACES.
- **Absent:** no post-processing, environment or reflection maps, or physical materials.
- **Transparency:** only two transparent kinds, glass and the faucet stream.
- **Antialiasing:** MSAA, pixel ratio capped at 2.
- **Per-frame work:** the renderer copies dynamic poses; the screens repaint on change and at
  10 Hz while running; the results panel refreshes at 4 Hz while open and running.

| GPU (production build)  | Scenario      | fps   | frame mean / p95 / max (ms) | CPU mean / p95 (ms) | GPU mean / p95 (ms) | Draws |
| ----------------------- | ------------- | ----- | --------------------------- | ------------------- | ------------------- | ----- |
| `gpu` 1280×720          | idle          | 300.0 | 3.33 / 3.40 / —             | 0.30 / 0.50         | 2.15 / 2.92         | 51    |
|                         | interacting   | 300.0 | 3.33 / 3.40 / —             | 0.27 / 0.40         | 2.15 / 2.96         | 44    |
|                         | running       | 299.2 | 3.34 / 3.40 / —             | 0.32 / 0.50         | 2.15 / 2.99         | 52    |
|                         | after landing | 300.0 | 3.33 / 3.40 / —             | 0.30 / 0.40         | 2.05 / 2.88         | 54    |
| `gpu-native` 2548×1402  | idle          | 300.0 | 3.33 / 3.40 / 3.8           | 0.32 / 0.50         | 2.41 / 3.10         | 51    |
|                         | interacting   | 299.9 | 3.33 / 3.40 / 3.6           | 0.38 / 0.60         | 2.42 / 3.02         | 44    |
|                         | running       | 299.2 | 3.34 / 3.40 / 6.7           | 0.36 / 0.60         | 2.45 / 3.12         | 52    |
|                         | after landing | 300.0 | 3.33 / 3.40 / 3.6           | 0.37 / 0.60         | 2.41 / 2.96         | 54    |
| `gpu-headless` 1280×720 | idle          | 300.0 | 3.33 / 3.40 / 3.6           | 0.30 / 0.50         | 2.10 / 2.82         | 51    |
|                         | interacting   | 300.0 | 3.33 / 3.40 / 3.6           | 0.28 / 0.40         | 2.17 / 2.92         | 44    |
|                         | running       | 300.0 | 3.33 / 3.40 / 3.6           | 0.31 / 0.50         | 2.15 / 2.95         | 52    |
|                         | after landing | 300.0 | 3.33 / 3.40 / 3.7           | 0.30 / 0.40         | 2.07 / 2.84         | 54    |

| Software (SwiftShader) | Scenario      | fps       | frame mean / p95 (ms) | CPU (ms) | SwiftShader "GPU" (ms) |
| ---------------------- | ------------- | --------- | --------------------- | -------- | ---------------------- |
| `software` 1280×720    | idle          | 45.0–46.6 | 21.5–22.2 / 23.4–26.6 | 0.8–1.3  | 17.9–19.1              |
|                        | interacting   | 39.6–41.4 | 24.1–25.2 / 26.8–33.3 | 0.8–1.2  | 20.7–22.1              |
|                        | running       | 34.3–34.8 | 28.8–29.2 / 50.0      | 1.0–1.5  | 25.1–26.3              |
|                        | after landing | 43.6–44.3 | 22.6–22.9 / 23.4–26.7 | 0.7–1.2  | 19.1–19.7              |

The software ranges span two runs. The `gpu` 1280×720 row comes from an undisturbed run before
the worst-frame column existed.

**Shadows cost.** Measured once at native resolution with the sun's shadows turned off in a
temporary build, which was then restored byte-identical:

- draws 51 → 26 (the shadow pass draws every caster again);
- CPU 0.27 → 0.19 ms;
- GPU time 2.17 → 2.16 ms idle;
- 300 fps either way.

Shadows cost about 0.08 ms of CPU and no measurable GPU time, so they stay.

**Reading the GPU numbers.** The GPU time is the same at 1280×720 and at 3.9× the pixels, and
with or without shadows. One sample even read 0.17 ms for a desk close-up. That points to a GPU
working at low clocks under a tiny load rather than to a pixel or shadow cost, so the values
are an upper bound of GPU work at whatever clock the driver chose. The 300 Hz budget (3.33 ms) is
met: p95 frame intervals are 3.40 ms, which is vsync jitter, and the worst frame seen was 6.7 ms.

## 7. Simulation timing validation

**How time flows:**

1. `main.ts` caps a frame at 0.1 s (`MAX_FRAME_S`).
2. The experiment runtime adds the frame time to its own accumulator and steps the model in fixed
   1 ms steps. The frame time only decides how many steps run, never their size.
3. Samples are taken on simulated time, every 10 ms, and the landing is solved inside its step.
4. `MAX_STEPS_PER_ADVANCE` (2,000 steps) is unreachable, because a capped frame is 100 steps.
5. Rapier steps 1/60 s, at most 6 per frame, for the player and loose objects. A projectile in
   flight is disabled in Rapier and posed from the model.

**The 0.1 s catch-up cap, audited (unchanged):**

- **Why 0.1 s:** it equals the frame cap in `main.ts`. With 6 × 1/60 s the game keeps real time
  down to 10 fps; 6B found that 5 steps put everything in slow motion below 12 fps.
- **Spiral risk:** none. Measured in Node on this CPU:

  | Work                                                 | Cost     |
  | ---------------------------------------------------- | -------- |
  | one Rapier step in the lab                           | 0.019 ms |
  | one model step                                       | 0.046 µs |
  | a whole 4.53 s flight                                | 0.21 ms  |
  | headless game frame at 60 fps                        | 0.042 ms |
  | idle frame at the 0.1 s cap (6 Rapier steps)         | 0.165 ms |
  | flight frame at the cap (6 Rapier + 100 model steps) | 0.248 ms |

  The worst case is 0.25 % of the time it simulates, about 400× short of a spiral.

- **Determinism:** unaffected. The cap limits how much time one frame may simulate; the
  experiment integrates exactly that time in fixed steps.
- **What the cap is:** game-time recovery for Rapier, plus the general frame clamp. The
  experiment integrates up to 0.1 s of physical time per frame. Below 10 fps the whole game,
  experiment included, plays slower but never differently.

## 8. Frame-rate independence results

**Game loop, unit test.** `StationSystem.test.ts`, "flies the same at any frame rate", runs the
Moon example through `Game.update`. It covers 300, 60, 30, 20, 15 and 10 fps, plus a jittery mix
(1/144, 0.1, 1/60, 0.0371, 1/300, 0.08 s). The results:

- **Bit-identical:** all 454 samples × 6 series, the results, the final state (x, y, vx, vy,
  speed) and the landing pose.
- **Rest:** the ball rests within 1 mm of the landing point once physics owns it again.
- **Pace:** game time reaches the flight time within the frame that contains it.
- **Theory:** within 10⁻⁹ of the closed form.

**Real browser, GPU, production build.** The game is given 1 animation frame in n:

| Run                    | Rate (fps) | Flight time | Range    | Max height | Impact speed | Samples | Time to watch |
| ---------------------- | ---------- | ----------- | -------- | ---------- | ------------ | ------- | ------------- |
| visible window, 300 Hz | 300        | 4.526 s     | 16.001 m | 4.448 m    | 5.188 m/s    | 454     | 4.96 s        |
|                        | 60         | identical   | …        | …          | …            | 454     | 4.96 s        |
|                        | 30         | identical   |          |            |              | 454     | 4.97 s        |
|                        | 20         | identical   |          |            |              | 454     | 5.00 s        |
|                        | 15         | identical   |          |            |              | 454     | 5.02 s        |
|                        | 10         | identical   |          |            |              | 454     | 4.92 s        |
|                        | 5          | identical   |          |            |              | 454     | 9.31 s        |
| `gpu-headless` (final) | 300 … 10   | identical   |          |            |              | 454     | 4.63–5.04 s   |
|                        | 5.1        | identical   |          |            |              | 454     | 9.54 s        |

Theory gives 4.526 s and 16.001 m. At 10 fps and above a run takes its real flight time (plus
notice latency); at 5 fps it plays at half speed, as designed, with the same result.

**Tolerance:**

- exact equality across frame rates in the unit test;
- 10⁻⁹ against theory;
- equal to the displayed three decimals, with identical sample counts, in the browser.

**Mutation checks** (scratch script, files restored and hash-verified): **14/14 caught.**

- **The ten Phase 6B mutations** are still caught: gravity, degrees vs radians, speed, the range
  formula, landing inside the step, sample times, STOP, RESET, lane limit, physics vs gameplay
  separation.
- **Four new frame-rate couplings** are all caught by the new test:
  - experiment time capped at 1/30 s per frame — the new test is the **only** one that catches
    this;
  - integration step tied to the frame time;
  - the landed ball handed back from the previous frame's pose;
  - catch-up cut to 50 steps per frame.

## 9. Regression tests

| Command            | Result                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`    | PASS — **224/224** (20 files): +1 frame-rate test; the Continue test now runs frames and RUN                                         |
| `npm run test:e2e` | PASS — **10/10** in the last three consecutive runs (2.4 min each), on the final configuration                                       |
| `npm run bench`    | `gpu-headless` 2/2 and `software` 1/1 (1 skipped) in the final runs; `gpu` and `gpu-native` passed in earlier undisturbed runs (§13) |
| Mutation checks    | 14/14 caught                                                                                                                         |

**E2E stability, found and handled.** Late in the session the 4-worker suite turned flaky. Even
alone, the laptop rendered the lab at 37–39 fps instead of 44 that morning. The failures were all
in load-sensitive spots:

- the fixed-time walk in `game.spec` ended at x = 0.25–1.13 m (it needs 1.20 m or more);
- a closed-loop walk in `preparation.spec` timed out;
- `experiment.spec` lost a race: its STOP step aims and checks after RUN, which took longer
  than the 3.3 s flight, so the run had already completed.

A/B runs proved the cause was machine load, not the Phase 6C.1 fix: suites with the fix reverted
failed the same way. Changes made, none of them weakening an assertion:

- `workers` 4 → 3;
- `game.spec` and `grab.spec` moved into a `dev-timed` project that starts after `dev` and runs
  one test at a time;
- `experiment.spec` works out the STOP aim before pressing RUN.

With those changes the suite passed five runs in a row. The sixth (the record run) failed on a
second, latent `experiment.spec` flake that has nothing to do with load. Step 8 walks from the
desk towards the lab opening, and `approach` steers only once. The straight line passes the
launcher 0.23 m from its edge, inside the player's 0.3 m radius, so depending on where step 6
left the player the walk could slide off course ("did not reach (−2, 5.4)"; seen twice today).
It now goes around the launcher through a waypoint at (−2.2, 8.8). After that fix: three runs in a
row, 10/10.

The 7-worker setup was not restored.

## 10. Build result

`npm run build`: PASS.

| Chunk         | Phase 6B                    | Phase 6C.1                  |
| ------------- | --------------------------- | --------------------------- |
| Entry JS      | 777.20 kB (gzip 207.00)     | 777.22 kB (gzip 207.00)     |
| CSS           | 5.37 kB                     | 5.37 kB                     |
| Rapier (lazy) | 4,332.82 kB (gzip 1,669.31) | 4,332.82 kB (gzip 1,669.31) |

The only growth is the one-line fix. No dependency was added, and Rapier still loads lazily.

## 11. Code changes

**Application, one change.** `src/physics/PhysicsSystem.ts`: a new Rapier world takes one real
step while it is still empty (+1 line, 3 comment lines).

- **Bug:** Continue into the Physics Lab with a ball loaded in the launcher panicked inside
  Rapier (`RuntimeError: unreachable`) on the first frame. The physics and interaction systems
  were disabled, so nothing in the lab could be targeted until the page was reloaded. A player
  who reloads while a ball is loaded hits this.
- **Found by:** the benchmark, whose save-and-Continue path no test had exercised with frames
  afterwards.
- **Root cause, isolated in raw Rapier 0.21:** in a fresh world whose first step is zero-length
  (`buildScene` registers colliders that way), with a kinematic body present (the player
  capsule), disabling a dynamic body (`PoseDriver.drive`) before the next real step makes that
  step panic. Twenty scenarios bisected it. It needs the zero-length first step and the kinematic
  body; CCD and contacts don't matter. A world that had already stepped never failed, which is
  why door re-entry worked.
- **Regression test:** the Continue test in `StationSystem.test.ts` now runs frames after
  Continue and RUNs the restored ball. It fails without the fix, with physics and interaction
  `failed`.
- **Effect:** walking traces with and without the fix are the same.

**Tests and benchmark:**

- `StationSystem.test.ts`: the frame-rate test and the extended Continue test.
- `e2e/physics-lab.bench.ts` and `playwright.bench.config.ts`: new.
- `package.json`: `npm run bench`.
- `tsconfig.json`: includes the bench config.

**E2E helpers** (`e2e/support.ts`):

- The projectile station targets, its theory and `lookAngles` are shared now, moved from
  `experiment.spec.ts`.
- `Aim.at(point, from?)` aims from a known position, without the debug panel.
- `Aim.to` starts every move at the real window centre. In a visible window Chromium measures
  the first pointer-lock delta from there; the old fixed 640×360 was only right for 1280×720.

**E2E config and spec:**

- `playwright.config.ts`: 3 workers and the `dev-timed` project.
- `experiment.spec.ts`: the STOP step, and the waypoint around the launcher in step 8.

**Docs:**

- README;
- CLAUDE.md: performance numbers name their renderer; the `bench` command;
- `experiments.md`: frame rate and timing;
- `physics.md`: the empty-world step and step costs;
- `development-guide.md`: the benchmark and the E2E projects;
- this report.

**Not changed:**

- rendering: no environment map, shadows kept, no quality lowered;
- the 0.1 s cap;
- the save format;
- the UI;
- the experiment engine.

## 12. Commit

One commit on `main`: `phase 6c.1: validate gpu and simulation performance`. It contains this
report. Nothing was pushed (there is no remote).

## 13. Limitations

- **Coverage:**
  - Edge 155 only, which is Chromium with ANGLE on Direct3D 11. Chrome and Firefox were not
    measured.
  - Only this laptop's RTX 5070 Laptop GPU.
  - The AMD Radeon 610M path was not exercised: the NVIDIA GPU drives the display, and every
    `powerPreference` got it.
- **Frame-rate ceiling:** frame rates are capped by the 300 Hz display (or headless pacing).
  Headroom is shown by CPU and GPU time, not uncapped fps.
- **GPU timing:** timer-query values depend on the GPU's clock state (clocks were not pinned) and
  are not split by render pass.
- **Visible-window runs:** these benchmark projects capture the real mouse while aiming.
  - The last two visible runs were disturbed by someone using the machine: last physical input
    2 s before the check, aims off by about 10°.
  - Their final numbers therefore come from earlier undisturbed runs. `gpu-headless` reran
    cleanly and agrees with them.
  - The visible projects need an idle machine.
- **Benchmark scope:**
  - The benchmark enters through a save: the checklist starts at step 1, since it is not saved
    by design.
  - Production has no debug panel, so per-step simulation costs come from Node on the same CPU.
- **E2E suite:** it stays on SwiftShader. Its timing-sensitive specs depend on the `dev-timed`
  isolation. Suite time went from 2.0 to 2.3–2.4 min.
- **Rapier workaround:** the Rapier panic is worked around, not fixed upstream. Any Rapier
  upgrade must keep the Continue test green.
- **Test-helper duplicate:** `grab.spec.ts` keeps its own 1280×720-only aiming helper (unchanged).

## 14. Recommendation for Phase 6C.2

**Proceed: YES.** The lab is correct and fast on the real GPU, the experiment physics is proven
independent of frame rate, and the one Phase 6B bug found is fixed and guarded.

For the second experiment:

- Add its apparatus to `npm run bench`: a scenario, plus a frame-rate flight if it has a run.
- Keep the Continue-then-frames test pattern for any body an experiment drives.
- Keep environment maps off unless a GPU measurement justifies them.
- Run `npm run bench -- --project=gpu-headless` before and after, and the visible projects on an
  idle machine.
