# Phase 6C.2 report — the pendulum, a second experiment on the shared engine

The simple pendulum is the second complete experiment: a pendulum bay north of the Physics Lab
with a stand, desk, status display, results monitor and instruction board, run by the same
sessions, runtime, events, controls, results panel and saving as projectile motion. The model
solves the nonlinear equation θ'' = −(g/L) sin θ with RK4; the results compare the measured
period with both the small-angle formula (shown as an approximation) and the exact period. The
engine was generalized only where the pendulum hit a launcher assumption (§2).

Evidence kinds are kept apart: **unit/game-level** (Node, the real game headless), **E2E** (the
real app in headless Edge with SwiftShader software WebGL), **GPU** (benchmark on the NVIDIA GPU,
renderer string checked) and **software** (the benchmark on SwiftShader).

## 1. Baseline commit

Checked before any change:

| Item               | State                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| HEAD               | `16bd417` phase 6c.1: validate gpu and simulation performance, as reported      |
| `git status`       | clean, no stash, no remote                                                      |
| `npm run check`    | PASS — 224/224 unit tests (20 files)                                            |
| `npm run test:e2e` | PASS — 10/10, 2.4 min, 3 workers                                                |
| `npm run build`    | PASS — entry chunk 777.22 kB, CSS 5.37 kB, Rapier 4,332.82 kB (lazy)            |
| Rapier protection  | the empty-world first step in `PhysicsSystem.createWorld` and its Continue test |

## 2. Architecture audit

What the 6B engine already shared without change: `ExperimentRuntime` (fixed-step accumulator,
sampling on simulated time, min/max/final results, failure on non-finite state),
`ExperimentSession` (states, parameters, dial stepping and presets, start refusals),
`ExperimentSystem` and its events, the `parameter-dial`, `experiment-control`,
`results-display` and `instrument` behaviours, the save format (entity states `param.<id>`),
`PhysicsSystem`, interaction, scenes.

What assumed a launcher, and the smallest change made for each:

| Found                                                                              | Change                                                                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `StationSystem` handled one kind of station (ball, `PoseDriver`, lane and ceiling) | stations and views are a union by kind: `launcher` (unchanged behaviour) or `pendulum`         |
| content validation accepted only items with `launcher` geometry as a station       | `launcher` or `pendulum` geometry (`checkStation`)                                             |
| the HUD objective and debug line showed the scene's first station                  | `activeStation()` is the station in the player's room (else the first); HUD refreshes on entry |
| checklist milestone `adjusted` meant any dial                                      | optional `parameter` (`adjusted:<id>`), and a new `reset` milestone                            |
| the monitor drew the first graph with the landing range hard-wired                 | definition `monitor` graph; graph `mark` names the prediction drawn on its axis                |
| the status display and results panel showed the launch height as a special case    | definition `inputs` give symbol and unit for any initial condition shown                       |
| axis labels from ids; several series always labelled "v"                           | measurement and result `symbol`s; graph `yLabel` for a shared axis                             |
| the results footnote was projectile text; the column said "Error"                  | definition `note`; the column says "Difference" (a theory may be an approximation)             |
| the debug line printed the projectile's `R=`                                       | the first measurement live and every result once completed                                     |
| the completion notice listed every row (one measured period would appear twice)    | `resultSummary`: each measured quantity once, by symbol (shared with the monitor)              |
| four graphs do not fit a 720-pixel window, and the wheel never reached the panel   | the wheel scrolls the open results while the pointer is locked                                 |

`ExperimentRuntime` gained only a model check (an unknown graph `mark` is rejected at boot). No
new dependency, no new event, no save format change, no replacement of the engine.

## 3. Pendulum model and numerical integration

`src/simulation/models/pendulum.ts`, model id `mechanics.pendulum`, pure and deterministic (no
three.js, DOM or Rapier). Inputs in SI except θ₀, which the dial gives in degrees and the model
converts once in `init`. State (`Float64Array`, 16 slots): θ, ω, α, x, y, speed, Eₖ, Eₚ, E,
clock, and the event bookkeeping (crossings, first/last crossing, turns, last turn, period).

- **Equation:** θ'' = −(g/L) sin θ, nonlinear; no small-angle approximation in the model.
- **Integrator:** classical fourth-order Runge–Kutta on the definition's fixed 1 ms step, into a
  module scratch array (no allocation per step). No library: RK4 is twelve lines, and at the
  stiffest setting (L 0.25 m, Jupiter, ω ≈ 10 rad/s, ω·h ≈ 0.01) its error is far below what the
  results show (§4).
- **Derived values** each step: α, x = L sin θ, y = 2L sin²(θ/2) (1 − cos θ without
  cancellation), speed = L|ω|, Eₖ = ½mL²ω², Eₚ = mgy, E.
- **Events inside a step:** a zero crossing (θ changes sign) and a turning point (ω changes
  sign; the release from rest is not one) are located by linear interpolation, accurate there
  because θ'' ≈ 0 at a crossing and ω'' ≈ 0 at a turning point.
- **Period measured** from the crossings, half a period apart: T = 2 (t_last − t_first)/(n − 1).
- **End of the run:** at the sixth turning point, three full oscillations. That step is
  shortened to the turning point, so the run ends exactly there and the bob is back at release.

Validated in `pendulum.test.ts` (15 tests) against references written independently of the model:

| Check                                                | Reference                                   | Agreement                |
| ---------------------------------------------------- | ------------------------------------------- | ------------------------ |
| K(k) by the arithmetic–geometric mean                | published K(0.5), K(1/√2)                   | 13 digits                |
| 1° swing                                             | T₀ = 2π√(L/g); T₀(1 + θ₀²/16)               | < 3·10⁻⁵; 9 digits       |
| 30° and 60° swings                                   | tabulated T/T₀ = 1.0174087976, 1.0731820071 | 7 digits                 |
| first crossing, first turning point, second crossing | T/4, T/2, 3T/4                              | 7 digits                 |
| end of run                                           | t = 3T, θ = θ₀, ω = 0                       | 6–7 digits, \|ω\| < 10⁻⁶ |
| release at −40° vs +40°                              | exact mirror image                          | every sample sums to 0   |
| α at every sample                                    | −(g/L) sin θ                                | 12 digits, α·θ ≤ 0       |
| energy over three periods at 60°                     | E₀ = mgL(1 − cos θ₀)                        | drift < 10⁻⁹ of E        |
| range extremes (0.25 m Jupiter, 3 m Moon, ±5°, 60°)  | E₀; exact period                            | drift < 10⁻⁸; 6 digits   |
| Moon vs Earth, 0.25 m vs 1 m                         | T ∝ √(L/g)                                  | 9 digits                 |
| release with ω₀ = 1.5 rad/s                          | θmax from energy                            | 6 digits                 |
| same inputs twice; any cut of time into frames       | bit-identical                               | exact                    |

## 4. Theory calculations and their limitations

`predict()` gives closed forms, never fitted to the run. With k = sin(θmax/2), where
sin²(θmax/2) = sin²(θ₀/2) + ω₀²L/(4g):

| Result (row)             | Theory                          | Measured                   |
| ------------------------ | ------------------------------- | -------------------------- |
| Period vs small-angle T₀ | T₀ = 2π√(L/g) — **approximate** | period from zero crossings |
| Period vs exact theory   | T = 4√(L/g)·K(k)                | the same measured period   |
| Amplitude θmax           | 2 asin k                        | largest θ of the run       |
| Maximum bob speed        | 2√(gL)·k                        | largest L\|ω\|             |
| Energy at the end        | 2mgLk²                          | E when the run ends        |

- **The small-angle formula is labelled as an approximation**: the row compares the measured
  period with T₀ and shows the gap (1.74 % at 30°, 7.32 % at 60°), and the note under the table
  says T₀ is exact only as θ₀ → 0, with the exact period beside it. The renamed "Difference"
  column does not call that gap an error.
- **Ideal pendulum only:** point bob, massless rigid rod, rigid pivot, no friction or air drag,
  so no damping. Measured means simulated: no instrument noise or uncertainty is modelled (out of
  scope in this phase).
- **Interpolated events:** crossing and turning times carry the linear-interpolation error,
  well below the 7 digits the tests check.
- **K(k) at k → 1** is infinite: a swing over the top has no period, and RUN refuses it.

## 5. Station design

**Pendulum bay** (`rooms.json`): a 10 m × 8 m room north of the Physics Lab, through a new 2 m
opening in the lab's north wall (x −4 … −2), signed "PENDULUM BAY", with two ceiling lights. It
is in the Physics Lab scene with the lab and the projectile range.

| Part              | Where                  | What                                                                         |
| ----------------- | ---------------------- | ---------------------------------------------------------------------------- |
| stand (apparatus) | centre, z −8.6         | base, two posts, crossbar, axle, pivot 3.6 m up; swings in its x–y plane     |
| protractor, scale | behind the swing plane | 5° ticks, figures every 15°; 0.1 m marks, figures every 0.5 m from the pivot |
| rod and bob       | from the pivot         | rod drawn at length L, 0.5 kg brass bob (r 6 cm)                             |
| control desk      | east, z −5.9           | dials L, θ₀, g; RUN, STOP, RESET; the status display                         |
| results monitor   | east wall              | live θ–t with the exact period marked; E opens the results                   |
| instruction board | west wall              | the four steps                                                               |
| banner            | north wall             | θ'' = −(g/L) sin θ, small angles: T₀ = 2π√(L/g)                              |

- **One source of truth:** the bob has no physics body. Each frame the renderer copies the
  session's angle, `swingAngle(session)` (the run's θ, else the release angle), and its length,
  `swingLength` (the run's L until RESET), onto the drawn rod and bob, without allocating. The
  game test checks the drawn angle equals the run's θ every frame and that no physics body
  appeared or was driven.
- **Dials:** L 0.25–3 m (0.25 steps), θ₀ −60…60° (5° steps), g through Moon, Mars, Earth and
  Jupiter. L and θ₀ each tick their own checklist step; g is optional.
- **Ready at once:** nothing to load, so the session starts `configured`.
- **RUN refused, with the reason:**
  - at θ₀ = 0;
  - over the top;
  - a bob that would reach the floor;
  - a swing beyond the room.

  Only the first is reachable with the shipped stand; the other three are tested with modified
  content.

- **Checklist (6 steps):** read the board, set L, set θ₀, run, read the results, RESET and run
  again.

## 6. Run-data and graph integration

- **Samples** every 10 ms of simulated time: θ, ω, α, x, y, Eₖ, Eₚ, E (preallocated buffers).
  Graphs and results read them directly; nothing is recomputed for display.
- **Graphs (results panel):** θ–t, ω–t, the phase portrait ω against θ, and Eₖ, Eₚ and E
  against time. The monitor draws θ–t live, at most 10 times a second, with an amber tick at the
  exact period.
- **Summary line** on the monitor and the completion notice: each measured quantity once, by
  symbol, e.g. "Simple pendulum — T: 2.5 s · θmax: 0.5236 rad · vmax: 1.986 m/s · E: 0.9857 J".
  The projectile notice is unchanged ("Flight time: …", asserted by its E2E).
- **Inputs header:** L, θ₀, g, m and ω₀ (the last two from `inputs` display metadata).
- **Seen in the E2E screenshots:**
  - the θ–t sinusoid returns to 0.52 rad at the period mark;
  - the phase portrait is a closed curve;
  - Eₖ and Eₚ alternate under a flat E.

## 7. FPS-independence evidence

| Level             | Test                                                                                                                                    | Result                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| whole game (Node) | L 0.5 m, θ₀ 40°, Earth through `Game.update` at 300, 60, 30, 20, 15, 10 fps and a jittery mix (1/144, 0.1, 1/60, 0.0371, 1/300, 0.08 s) | bit-identical samples, results and end state (θ, ω, clock, crossings, turns, period); each run takes its three periods of game time (elapsed ≥ 3T, minus one frame < 3T) |
| model (Node)      | the same run advanced at once and in mixed frames from 3.3 ms to 0.1 s                                                                  | identical results and θ samples                                                                                                                                          |
| browser, GPU      | the projectile's 300 … 5 fps sweep (§9), same runtime                                                                                   | identical results at every rate                                                                                                                                          |

The pendulum adds no frame-rate coupling of its own: the model is stepped only by the runtime's
fixed-step accumulator. The drawn bob reads the state after the frame's steps. The run ends
inside a step, wherever the frame boundary falls. 0.1 s is the largest frame `main.ts`
allows, so 10 fps is the slowest real-time rate. The projectile's frame-rate tests are
unchanged.

## 8. E2E workflow

`e2e/pendulum.spec.ts` (dev project) plays the station like a player, without the developer
scene jump:

1. **Continue** from a save of a player standing in the Physics Lab (the game's own load path).
2. Walk through the north opening into the bay; the HUD shows "Simple pendulum, Step 1 of 6".
3. Read the board (Inspect).
4. At the desk: L 1 → 1.5 m, θ₀ 10 → 30°, g up to Jupiter and back to Earth (E and F).
5. RUN. θ is seen crossing to the far side on the debug line. The run completes with the exact
   period on the debug line, and the notice reads "T: 2.5 s".
6. The monitor shows θ–t. E opens the results:
   - exact period 2.500 s = measured 2.500 s, difference < 0.01 %;
   - the small-angle row shows 2.457 s against 2.500 s, a 1.74 % difference;
   - the note reads "exact only as θ₀ → 0";
   - four graphs with more than 700 samples, labelled θ (rad), ω (rad/s), E (J);
   - the energy graph starts below the window, and the mouse wheel scrolls it fully into view
     with the pointer still locked.
7. θ₀ to 20°: RUN is refused ("Press RESET before the next run."). RESET; the checklist is done.
8. RUN, STOP mid-swing ("Stopped at t = …"), RESET.
9. Out through the opening and the lab door to the hub, back in. **Reload, Continue**, walk into
   the bay: L 1.5 m, θ₀ 20°, g 9.81 are kept.
10. No console errors and no failed system.

Screenshots: `pendulum-1-bay.png` … `pendulum-6-results-scrolled.png` in `test-results/`
(git-ignored). They were inspected. Two defects found that way were fixed:

- **Bob through the scale:** the scale and protractor sat 3 cm behind the swing plane, so the 6 cm
  bob passed through the scale at negative angles. Both now sit behind it by the bob's radius
  plus 3 cm.
- **Fourth graph cut off:** the energy graph was below the window and could not be scrolled.
  The wheel now scrolls the open results.

Runs:

- the spec alone passed twice (1.6 min each);
- the full suite passed 11/11 twice (§11).

## 9. Benchmark results

`e2e/physics-lab.bench.ts` keeps the projectile scenarios unchanged and adds **"pendulum bay
frame times: idle, swinging, after the run"**: the production build is reached through Continue
with a save at the bay's desk (L 1.5 m, θ₀ 30°, Earth), RUN, and the completion notice checked
against the period written out in the test.

**GPU** — `gpu-headless`: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)
Direct3D11 vs_5_0 ps_5_0, D3D11)`, 1280×720, pixel ratio 1.00, GPU timer available:

| Scenario                    | fps   | frame mean / p95 / max (ms) | CPU mean / p95 (ms) | GPU mean / p95 (ms) | Draws |
| --------------------------- | ----- | --------------------------- | ------------------- | ------------------- | ----- |
| range: idle                 | 300.0 | 3.33 / 3.40 / 3.6           | 0.36 / 0.60         | 1.99 / 2.76         | 71    |
| range: interacting          | 300.0 | 3.33 / 3.40 / 3.6           | 0.36 / 0.50         | 2.01 / 2.79         | 63    |
| range: running              | 300.0 | 3.33 / 3.40 / 3.8           | 0.38 / 0.60         | 2.12 / 2.88         | 72    |
| range: after landing        | 300.0 | 3.33 / 3.40 / 3.8           | 0.38 / 0.60         | 2.05 / 2.75         | 74    |
| **pendulum: idle**          | 300.0 | 3.33 / 3.40 / 3.5           | 0.44 / 0.70         | 2.01 / 2.72         | 82    |
| **pendulum: swinging**      | 300.0 | 3.33 / 3.40 / 3.5           | 0.45 / 0.70         | 2.10 / 2.83         | 82    |
| **pendulum: after the run** | 300.0 | 3.33 / 3.40 / 3.6           | 0.43 / 0.60         | 2.07 / 2.74         | 82    |

The pendulum bay holds the display's 300 fps, with about 0.45 ms of CPU and 2.1 ms of GPU time
per 3.33 ms frame. The 300 fps is the display rate, so headroom shows in the CPU and GPU times,
not in uncapped fps.

The frame-rate sweep (`gpu-headless`) gave identical projectile results at every rate the game
was given:

- 300, 60, 30, 20, 15, 10 and 5 fps;
- T 4.526 s, R 16.001 m, H 4.448 m, v 5.188 m/s, 454 samples each;
- 4.60–5.02 s to watch at 10 fps and above, 9.24 s at 5 fps.

**Cost of the bay to the range, measured** against Phase 6C.1's `gpu-headless` numbers:

- **Draw calls:** 51 → 71 idle, +20 in every range scenario. The sun's shadow camera is fitted
  to all rooms of the scene, and the shadow pass draws every caster in it, whatever the player
  looks at. The bay adds about 20 casters: the stand, the desk and its controls, screens, the
  board and the rig.
- **CPU:** +0.06–0.08 ms per frame.
- **GPU time:** unchanged within noise (1.99–2.12 vs 2.07–2.17 ms).
- **Shadow resolution in the range:** unchanged. The shadow camera keeps its 15 m half-extent,
  because the range's 26 m length decides it.
- **fps:** still 300.

**Software** — `software`: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)
(0x0000C0DE)), SwiftShader driver)`, 1280×720:

| Scenario                | fps  | frame mean / p95 (ms) | CPU (ms) | SwiftShader "GPU" (ms) | Draws |
| ----------------------- | ---- | --------------------- | -------- | ---------------------- | ----- |
| range: idle             | 51.1 | 19.58 / 23.30         | 1.13     | 16.42                  | 71    |
| range: interacting      | 45.4 | 22.01 / 26.70         | 1.06     | 18.90                  | 63    |
| range: running          | 38.8 | 25.79 / 46.70         | 1.19     | 22.67                  | 72    |
| range: after landing    | 49.6 | 20.15 / 23.30         | 1.00     | 16.96                  | 74    |
| pendulum: idle          | 51.4 | 19.44 / 23.30         | 1.29     | 16.20                  | 82    |
| pendulum: swinging      | 43.7 | 22.91 / 30.00         | 1.42     | 18.52                  | 82    |
| pendulum: after the run | 51.5 | 19.40 / 23.30         | 1.17     | 16.17                  | 82    |

Software rates vary with the laptop's state: Phase 6C.1 measured 34–47 fps for the same range
scenarios. These are one run each.

**Not run:** the visible-window projects `gpu` and `gpu-native`, because they capture the mouse
while aiming and the machine was in use. They were not needed for a GPU result: `gpu-headless`
runs on the same NVIDIA GPU, and its renderer string proves it.

## 10. GPU/software rendering distinctions

| Evidence                                  | Renderer                                          | Counts as GPU validation |
| ----------------------------------------- | ------------------------------------------------- | ------------------------ |
| unit and game-level tests                 | none (Node, headless game)                        | no                       |
| E2E (`npm run test:e2e`)                  | SwiftShader (`--use-angle=swiftshader`)           | no                       |
| `npm run bench -- --project=gpu-headless` | NVIDIA GeForce RTX 5070 Laptop GPU, D3D11 (ANGLE) | **yes**                  |
| `npm run bench -- --project=software`     | SwiftShader                                       | no                       |

A GPU bench project fails on purpose if WebGL reports a software renderer. Every number in §9
names its renderer. No GPU claim here rests on the E2E suite or on a browser merely launching.

## 11. Regression results

| Command                                                                    | Result                                                                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                            | PASS — **257/257** unit tests, 22 files (baseline 224; +33)                                              |
| `npm run test:e2e`                                                         | PASS — **11/11** (the 10 baseline specs + `pendulum.spec.ts`) in two consecutive full runs, 2.7 min each |
| `npm run build`                                                            | PASS — entry 794.70 kB (gzip 211.88), +17.48 kB; CSS 5.37 kB; Rapier 4,332.82 kB unchanged               |
| `npx playwright test -c playwright.bench.config.ts --project=gpu-headless` | PASS — 3/3                                                                                               |
| `npx playwright test -c playwright.bench.config.ts --project=software`     | PASS — 2/2, 1 skipped (the sweep is `gpu-headless` only)                                                 |
| `gpu`, `gpu-native` bench projects                                         | NOT RUN (§9)                                                                                             |
| Mutation checks                                                            | **9/9 caught** (below)                                                                                   |

New tests:

| File                                              | Tests | Covers                                                                                                                                                                                                                                                |
| ------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/simulation/models/pendulum.test.ts`          | 15    | the model (§3)                                                                                                                                                                                                                                        |
| `src/gameplay/experiment/PendulumStation.test.ts` | 12    | the station in the real game: readiness, dials and checklist, refusals, the bob at the model angle with no body, STOP/RESET, the run's length until RESET, the frame-rate test, Continue, leaving mid-run, the station by room, both stations at once |
| `src/game/content.test.ts`                        | +3    | the shipped pendulum; unknown monitor, input and checklist parameter; unknown graph mark                                                                                                                                                              |
| `src/platform/ui/results.test.ts`                 | +3    | axis labels; the small-angle row at 20° (0.7669 %, series to θ₀⁶); the summary                                                                                                                                                                        |

**Rapier first-step protection, on the pendulum's Continue path.** The Continue test saves the
following, then boots a new game, Continues, runs frames, presses RUN at both stations and checks
that no system failed:

- the pendulum mid-run;
- a ball loaded in the launcher;
- the player in the bay.

With the empty-world step removed, the test fails (`physics` → `failed`). Restored, it passes.

**Mutation checks**, each applied alone and then restored byte-identical
(`npx vitest run <file>`):

| Mutation                                     | Caught by         |
| -------------------------------------------- | ----------------- |
| small-angle model (α = −(g/L)θ)              | 8 model tests     |
| RK4 weights wrong                            | 10 model tests    |
| crossing time at the end of the step         | 8 model tests     |
| last step not shortened to the turning point | 1 model test      |
| exact theory replaced by T₀                  | 4 model tests     |
| bob drawn at the dial angle during a run     | 1 station test    |
| no refusal at θ₀ = 0                         | 1 station test    |
| RESET not recorded on the checklist          | 1 station test    |
| no empty first step in a new Rapier world    | the Continue test |

**Projectile unchanged:**

- every 6B/6C.1 projectile unit test passes as before; `StationSystem.test.ts` only gained a
  `view()` helper that narrows the view union to `launcher`;
- `experiment.spec.ts` passes. Its debug-line regexes changed from `R=<range>` to
  `range=<range> .*` because the line now lists every result by id. The same values are still
  asserted.

**Deliberate count changes:** the Physics Lab scene now has 17 bodies and 40 colliders (with the
bay), and `hold.test.ts` counts 44 entities. They are updated in `PhysicsSystem.test.ts`,
`hold.test.ts`, `game.spec.ts` and `grab.spec.ts`, after checking the real counts.

## 12. Changed files

New:

- `src/simulation/models/pendulum.ts` — model, `ellipticK`
- `src/simulation/models/pendulum.test.ts`
- `src/gameplay/experiment/PendulumStation.test.ts`
- `e2e/pendulum.spec.ts`
- `docs/phase-6c2-report.md`

Changed (42 files in all, with the new ones):

| Area          | Files                                                                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine        | `simulation/experiment.ts` (schema additions), `simulation/ExperimentRuntime.ts` (mark check), `simulation/models/index.ts`                                                                     |
| station       | `gameplay/experiment/StationSystem.ts` (kinds, limits, `swingAngle`/`swingLength`), `behaviors.ts` (`pendulum`), `gameplay/item.ts` (`pendulum` geometry), `game/content.ts`                    |
| views         | `platform/render/ExperimentView.ts` (rig, generic monitor and status), `WorldRenderer.ts`, `platform/ui/results.ts` (`graphFor`, `resultSummary`), `ResultsPanel.ts`, `Hud.ts`, `DebugPanel.ts` |
| content       | `experiments.json`, `items.json`, `rooms.json`, `scenes.json`, `laboratories.json`                                                                                                              |
| tests         | `content.test.ts`, `results.test.ts`, `StationSystem.test.ts`, `PhysicsSystem.test.ts`, `hold.test.ts`                                                                                          |
| E2E and bench | `e2e/support.ts`, `experiment.spec.ts`, `game.spec.ts`, `grab.spec.ts`, `physics-lab.bench.ts`                                                                                                  |
| docs          | `README.md`, `CLAUDE.md`, `docs/experiments.md`, `architecture.md`, `data-model.md`, `physics.md`, `interaction.md`, `persistence.md`, `development-guide.md`                                   |

Architecture: the layers are unchanged. Only `src/platform` touches three.js and the DOM, only
`src/physics` touches Rapier, and the model is pure. No new system, event, dependency or save
version.

## 13. Commit

One commit, `phase 6c.2: add pendulum experiment`, containing this report. The Phase 6B and 6C.1
commits are untouched. Not pushed: there is no remote.

## 14. Limitations

- **Not solid:** only the stand's base is a collider. The player can walk through the drawn
  frame, and the bob swings through anyone standing in its path. No physics body is a deliberate
  choice, for the single source of truth.
- **Ideal pendulum:** no damping, air drag, rod mass or pivot friction. ω₀ is an initial
  condition (0), not a dial. A run is always three oscillations.
- **Untestable in play:** the floor, room-width and over-the-top refusals cannot be reached with
  the shipped stand and ranges. They are tested only through modified content.
- **Not saved:** runs and checklist progress, as for the projectile.
- **Out of scope:** run history, overlay comparison, CSV export and uncertainty modelling.
- **Monitor:** draws one graph (θ–t). The others are in the results panel, which at 720 pixels
  needs the wheel to reach the fourth graph. There is no keyboard scrolling.
- **Frame-rate evidence:** the pendulum's frame-rate independence is proven at the game level
  in Node and by sharing the runtime with the projectile. There is no separate browser sweep
  for the pendulum.
- **Bench coverage:** the visible-window bench projects were not run this phase.
- **Shadow cost:** the bay adds about 20 shadow-pass draw calls (+0.07 ms CPU) to every view of
  the Physics Lab scene, the range included.
- **Bundle:** the entry chunk grew by 17.48 kB (model, station, rig and content).

## 15. Recommendation for Phase 6C.3

Proceed, on the same engine. A third experiment of a new kind should need only:

- its model;
- its geometry field;
- its case in `StationSystem`;
- its drawing in `ExperimentView`.

Candidates the brief kept out of this phase:

- run history with overlay comparison, now meaningful with two experiments;
- CSV export of the sample buffers;
- measurement uncertainty, kept apart from the deterministic model.

Before starting:

- run `gpu` and `gpu-native` on an idle machine to refresh the visible-window numbers;
- decide whether the pendulum frame should be solid. That needs colliders other than the item's
  visual box, which the item schema does not support yet.
