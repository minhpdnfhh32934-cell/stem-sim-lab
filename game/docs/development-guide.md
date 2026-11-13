# Development guide

## Setup

Requirements: Node ≥ 22.12 (tested with 24.21), Microsoft Edge (for E2E tests).

```bash
npm install
npm run dev
```

Open http://localhost:5173, choose a character, **New game**. Click the view to capture the mouse.

## Commands

| Command            | What it does                                                                |
| ------------------ | --------------------------------------------------------------------------- |
| `npm run dev`      | Vite dev server (debug panel on, debug logging)                             |
| `npm run build`    | Typecheck + production build to `dist/` (debug panel off)                   |
| `npm run check`    | Typecheck + ESLint (incl. layer boundaries) + Prettier check + unit tests   |
| `npm test`         | Unit/integration tests (Vitest, Node, headless game)                        |
| `npm run test:e2e` | Playwright in headless Edge (software WebGL): dev server + production build |
| `npm run bench`    | Physics Lab frame-time benchmark, production build, real GPU (Phase 6C.1)   |
| `npm run format`   | Prettier write                                                              |

## Tests

- **Unit/integration** (`src/**/*.test.ts`): most gameplay tests boot the _real_ game headless
  with `bootTestGame()` and drive it with `placePlayer`, `lookAt`, `game.input.press(...)`,
  `game.update(dt)` (`src/game/testing.ts`). Use `flush()` after anything that loads a scene
  asynchronously.
- **Physics** (`src/physics/*.test.ts`): the real Rapier WASM runs in Node. `PhysicsSystem.test.ts`
  has an isolated harness (fixture room, bench, ball) driven exactly like `SceneManager` drives
  physics, plus game-level checks on the Physics Lab. Rapier uses 32-bit floats: compare positions
  with tolerances (≈1e-4 m, contact stops ≈2 mm), never exactly. `physicsLoading.test.ts` replaces the
  loader with a controllable mock: no Rapier at boot, one load, failure and retry, dispose while
  loading.
- **Hold** (`src/gameplay/interaction/hold.test.ts`): grab/hold/drop/throw against the real game
  and Rapier — refusals, steady hold, walls and bench, player unaffected, scene change, despawn,
  stuck release, saving while holding, line of sight.
- **World guards (W0)**: `src/world/layout.ts` holds pure layout predicates P1-P8 (rooms of a
  scene apart, openings passable, solids and wall/ceiling fixtures inside their rooms, apparatus
  anchors inside, dynamic bodies starting free, no solid in a doorway passage, every room
  reachable), used only by tests: `layout.test.ts` proves the shipped content passes them (it
  prints each rule's tightest margin) and that 20 malformed fixtures and boundary pairs fail them;
  scene reachability and door arrivals are checked there with `routeBetween`. `layoutSweep.test.ts`
  walks the real game in real Rapier: every spawn stands, every doorway is crossed both ways,
  the wall beside each doorway blocks, and every scene's body/collider count matches
  rooms + solids + 1 / room slabs + solids + 1. `src/platform/render/WorldRenderer.test.ts` pins
  the current lighting and sun-shadow fit per scene (built without WebGL) and records, as facts,
  the five room corners outside the sun's shadow box (three floor corners of the range and bay);
  `apparatusExtents.test.ts` keeps each drawn apparatus inside its room. A content change that
  moves these numbers updates them deliberately, with the reason.
- **Procedures** (`src/gameplay/procedure/ProcedureSystem.test.ts`): the cleanroom entry against
  the real game — every step in order, out-of-order refusals with reasons, the door gate (also
  with PPE taken off again), timed steps cancelled by looking away or leaving, repeated actions,
  the wardrobe container rule, save/continue mid-procedure, new game reset. Procedure content
  validation is in `src/game/content.test.ts`, the v1→v2 save migration in
  `src/persistence/persistence.test.ts`, the PPE cabinet's open collider in
  `src/physics/PhysicsSystem.test.ts`. Phase 6A adds: the exit door (PPE refused, reset on
  leaving, no reset when nothing was done), live status, the return from the hub, an edited save
  with stray step ids, an interrupted timer that never resumes, and save/continue after
  de-gloving.
- **Doors** (`src/world/arrival.test.ts`): the arrival resolver and solid-footprint check, then
  every shipped door against the real game and Rapier — arrival exactly at the resolved point and
  yaw, physics keeps the player there (not pushed out of anything), grounded, the door come through
  not targeted, walking works at once; four round trips land on identical spots; the developer
  jump uses the spawn; Continue restores an arrival. Arrival and spawn validation in
  `src/game/content.test.ts`.
- **Experiments** (Phase 6B): `src/simulation/models/projectile.test.ts` checks the model against
  closed forms (45°/0°/90°, launch height, g and v² scaling, complementary angles), theory = run,
  sample consistency, bit-identical determinism and frame-rate independence;
  `src/simulation/ExperimentSession.test.ts` the states, parameter validation and stepping, start
  refusals, STOP/RESET and the system's events; `src/gameplay/experiment/StationSystem.test.ts` the
  whole station against the real game and Rapier (load, dials, RUN with the ball following the
  model, landing at the theoretical range, STOP/RESET, refusals with reasons, grab guards, save and
  Continue, leaving mid-run); `src/platform/ui/plot.test.ts` and `results.test.ts` the axes and
  the results table (no measured value before completion). Content checks for stations and the
  checklist are in `src/game/content.test.ts`. Phase 6C.1 adds the same flight through the whole
  game loop at 300 … 10 fps and with jitter (bit-identical, real-time pace) and Continue → RUN.
  Phase 6C.2: `src/simulation/models/pendulum.test.ts` checks the pendulum against tabulated
  values of K (T/T₀ at 30° and 60°), the small-angle limit with its θ₀²/16 correction, crossings
  and turning points at T/4, T/2, 3T/4, the run ending at release after three periods, exact
  mirror symmetry, α = −(g/L) sin θ, energy conservation, T ∝ √(L/g), the amplitude from ω₀,
  theory = run, determinism, frame independence and the range extremes;
  `src/gameplay/experiment/PendulumStation.test.ts` the station in the real game (ready at once,
  dials and their checklist steps, refusals with reasons — the stand's limits through modified
  content —, the bob drawn at the model angle with no physics body, STOP/RESET, the same run at
  300 … 10 fps and with jitter, Continue with a loaded launcher beside it, leaving mid-run, the
  station of the player's room, both stations running at once). Phase 6C.3:
  `src/simulation/RunHistory.test.ts` the history lifecycle (recorded once when a run ends:
  completed, stopped, cut short by RESET, failed; RESET keeps it; frozen copies no later dial or
  run changes; the 20-run bound, oldest out first, never the current run; measured memory);
  `src/simulation/csv.test.ts` the export (metadata, header, every sample reads back exactly,
  the degrees column, deterministic, stopped runs marked, safe names); `results.test.ts` picking
  runs, the per-experiment overlays drawn from the records' own buffers, each run's own theory
  marks, labels, and that views never write to a record; `StationHistory.test.ts` the history
  through the real game (both stations, scene changes, not in the save, empty after Continue).
  Phase 6C.4: `src/simulation/measurement.test.ts` the reading model (nearest multiple, exact
  multiples, just below and above half-way, ties away from zero also where binary rounding hides
  them, negatives, zero never −0, invalid resolutions and values refused, u = d/√12 against the
  RMS of real rounding errors and d/2 against the largest, two significant digits) and readings
  of runs (from the run's own result and d, unrounded result, frozen d, two resolutions with
  identical physics, none for incomplete runs, the resolution never a model input); `csv.test.ts`
  the measurement lines; `content.test.ts` the instrument validation; `StationHistory.test.ts`
  the resolution saved, defaulted for older saves and refused out of range. Phase 6C.5:
  `StationHistory.test.ts` "Read the results" with no current run (after RESET, after a scene
  change, refused with no runs and after Continue) at both stations; `results.test.ts` the
  desk screen's measured results column and the footer's list of the run's own settings.
- **Notices** (`src/platform/ui/NoticeQueue.test.ts`): keyed replacement, coalescing, the bound,
  priority eviction, durations, expiry and withdrawal.
- **E2E** (`e2e/`, shared helpers in `e2e/support.ts`): `transitions.spec.ts` goes Preparation
  Room ⇄ Teacher Room three times and checks the exact arrival position and facing each time;
  `preparation.spec.ts` also covers the refused-then-fixed entry, Continue at the hub arrival,
  the way back, de-gowning, the refused and then allowed exit, and the reset. The real app in a
  real browser — boot, menu, walking, door interaction, scene
  jump, save/continue after reload, running the free-fall experiment from its console, and
  physics (bench blocks the player, the steel ball rests on the bench, body/collider counts stay
  constant across scene changes), `grab.spec.ts`: aim with the mouse, inspect with F, grab with
  E, carry, drop onto the bench, throw at the wall with the left mouse button, and
  `world.spec.ts`: the doorway is drawn open (a screen pixel through it differs from the wall
  beside it), the player walks through it into the cleanroom corridor and back, the wall beside
  it blocks, counts stay constant across scene changes. `preparation.spec.ts`: the hub door refuses entry with the
  next instruction; then the whole cleanroom entry played with mouse and keyboard (refusals
  shown, wardrobe, PPE, faucet and water, soap, four timed rubs, rinse, towels, sanitizer,
  gloves), entering the hub, the v2 autosave contents, and Continue after a reload. Playwright projects: `dev` (Vite dev server, debug panel),
  `dev-timed` (the same server; see below) and `production` (`npm run build` + `vite preview`; checks the menu loads without Rapier, the
  Rapier chunk arrives on New game, and physics-driven movement works — by sizes and behaviour,
  not file names; `renderer.production.spec.ts`: the menu loads without three.js, the renderer's
  chunk arrives with Rapier for the first world and only once, and a failed download keeps the
  menu, says why and lets New game try again without a reload). `canvas.spec.ts` (Phase C2): the
  page's one canvas has no WebGL context until the first world, then the renderer's; without
  WebGL the boot stops at the systems stage and the canvas leaves with the page. `experiment.spec.ts` (Phase 6B) plays projectile motion end to end with
  keyboard and mouse: through the lab's south opening into the range, read the board, take a
  ball, load it, set v₀ and g on the dials, RUN, watch it land at the theoretical range, open the
  results (theory = measured, three graphs with > 400 samples), change θ, RUN refused until
  RESET, run again, STOP mid-flight, then leave through the doors and come back with the
  configuration kept; it saves `experiment-1-lab-overview.png` … `experiment-6-results.png`.
  `pendulum.spec.ts` (Phase 6C.2) plays the pendulum without the developer jump: Continue from a
  save in the Physics Lab, walk through the north opening into the bay, read the board, set L, θ₀
  and g, RUN and see θ cross to the far side, the exact period on the debug line and in the
  notice, the results (exact period = measured, the small-angle row 1.74 % off at 30°, four
  graphs, the wheel scrolling them under pointer lock), θ₀ changed with RUN refused until RESET,
  STOP mid-swing, out through the doors to the hub and back, then reload and Continue with the
  dials kept; it saves `pendulum-1-bay.png` … `pendulum-6-results-scrolled.png`.
  `history.spec.ts` (Phase 6C.3), at both stations through Continue: two runs, both listed; one
  ticked to view it, both to compare (overlays with each run's own theory mark, the comparison
  table); a run exported and the downloaded CSV read back (header, every sample, the same file
  twice); the dials changed and the first run opened again with its own settings and theory; it
  saves `history-1-projectile-runs.png` … `history-5-pendulum-run1-later.png` (one at 1699×935).
  The 6C.3 closure tests in the same file compare three and four runs at both stations (the fifth
  refused, one dropped, later dials changing nothing drawn), tick runs with the keyboard alone,
  check the real Escape key, re-capture and keys with fields focused, and the layout at 720, 600
  and 430 px and 1280×480; see [phase-6c3-closure-report.md](phase-6c3-closure-report.md).
  Playwright's Escape reaches the page (it opens the pause menu, Phase P1) but does not make
  headless Edge release the pointer, so tests release it with `document.exitPointerLock()` — which,
  while playing and with no results panel open, pauses the game. Since the pause dialog sits in the
  middle of the window (Phase P3.1), `captureAt` (used by `Aim.to`) resumes with Enter on the
  focused Resume button (a key press is the gesture pointer lock needs) with the mouse at the
  centre, and puts Tab's starting point back on the scene, as a click there would; it clicks the
  view only when no dialog shows. `pause.spec.ts` covers the pause menu itself, its layout at 1280, 430
  and 360 px, keyboard focus and reduced motion. `pointer-lock.spec.ts` replaces the browser's
  pointer lock with a stand-in whose grant the test makes, so a lock granted after Esc (a race real
  timing only shows now and then) is given back at once and the pause menu keeps the mouse.
  `measurement.spec.ts` (Phase 6C.4), at both stations through Continue: the resolution dial set
  to 0.1, a run, the dial set to 0.001, the same run again; each run's reading, d, u and d/2 and
  the assumptions in the panel; the comparison with each run's own d, reading and u and identical
  lines; both CSVs with identical samples and their own measurement lines; then a reload and
  Continue bringing the dial back but no runs. It saves `measurement-1-projectile-run-2.png` …
  `measurement-5b-pendulum-compare-1699x935.png`. The results-panel helpers (`dial`,
  `openResults`, `freeMouse`, `exportRun`, `readCsv`, `shot`, `expectStation`) live in
  `e2e/support.ts`. `results-view.spec.ts` (Phase 6C.5), at both stations through Continue: the
  monitor refused with no run, opened on the current run, and opened after RESET on the kept run
  (ticked, read as recorded); refused again after a reload and Continue. It also saves the desk
  screens with dials turned after a run at 1280×720, 1699×935 and 430×860 (`desk-*.png`).
  Screenshots land in `test-results/` (git-ignored). Headless Edge renders with
  software WebGL (SwiftShader), so no GPU is exercised. Software WebGL is CPU-bound, so the suite
  limits parallel browsers: **3 workers** (Phase 6B: 7 → 4; Phase 6C.1: 4 → 3, after a laptop
  warmed by long runs failed specs at 4 that pass alone). The specs that hold a key for a fixed
  time and check the distance walked (`game.spec`, `grab.spec`) are the `dev-timed` project:
  they start after the `dev` project and run one at a time, so nothing shares the CPU with them.
  GPU resources (W0): `e2e/webgl.ts` counts live WebGL objects per context and the draw calls of
  one frame (an init script; the boot check's released context is reported apart);
  `resources.spec.ts` walks real doors lab → hub → lab four times and requires every count after
  the warm-up trip to repeat exactly (a leak fails it); `draw-calls.spec.ts` records draws and
  live objects at named views (scene spawns, the range lane, the pendulum; three views also at Low
  and High) and requires two readings 10 frames apart to match. Neither asserts absolute numbers:
  the W0 report holds the baselines, which are SwiftShader counts, never GPU timings.
- **Benchmark** (Phase 6C.1, `npm run bench`, `playwright.bench.config.ts`, `e2e/*.bench.ts`; not
  part of `test:e2e`): the production build's projectile range reached through Continue with a
  save of a player at the desk, frame times recorded in the page (interval, main-thread time,
  GPU time by `EXT_disjoint_timer_query_webgl2`, draw calls) for idle, interacting, running and
  after landing. Projects: `gpu` (a visible Edge window, real GPU, 1280×720), `gpu-native`
  (maximized, the display's resolution and pixel ratio), `gpu-headless` (real GPU, no window),
  `software` (SwiftShader, as in E2E). A GPU project fails if WebGL reports a software renderer.
  `gpu-headless` also runs the Moon example with the game given 1 browser frame in n (60, 30, 20,
  15, 10 and 5 fps, divisors from the measured rate), each run fresh from the save, and checks
  the results panel is identical. Phase 6C.2 adds the pendulum bay as its own scenario (idle at
  the desk, swinging, after the run; save with L 1.5 m, θ₀ 30°). Phase 6C.3 adds the run
  history closed and open with two pendulum runs compared, from the same stand and view. The visible windows capture the
  mouse while aiming: run them
  on an idle machine (`--project=gpu-headless` is safe meanwhile). `BENCH_FRAME_CAP=30|60|90|120`
  runs the physics-lab scenario under the game's frame-rate cap (Phase P3.4), `BENCH_GRAPHICS=low|medium|high`
  under a graphics quality (Phase P3.5); the recorder counts
  only frames the game drew (a capped game skips display frames without a draw call). Results: stdout and
  `test-results/*/bench.json`, `flights.json`, screenshots (the next run clears them).
  **Known defect (found in W0, not fixed):** the recorder binds the first `webgl2` context
  (`physics-lab.bench.ts:118`); since Phase C2 that is the renderer host's boot check on a detached
  canvas, released at once, so no draw is counted and the scenarios cannot record frames. Until it
  is fixed (a one-condition change to an existing e2e file, which needs approval), report
  `npm run bench` as NOT RUN with this reason.
- **Mutation checks** (Phase 6B, by hand): break one thing, run `npx vitest run`, confirm it
  fails, restore. The ten used (gravity ignored, degrees as radians, the same-height range
  formula, velocity ignored, no reset, sample times 1 % off, floor contact not solved in the step,
  STOP doing nothing, lane limit ignored, physics writing back driven poses) are listed with
  their results in [phase-6b-report.md](phase-6b-report.md#13-mutation-tests). Phase 6C.2's nine
  (pendulum model, station, and the Rapier first step on the pendulum's Continue path) are in
  [phase-6c2-report.md](phase-6c2-report.md#11-regression-results); Phase 6C.3's (run history,
  CSV, comparison) in [phase-6c3-report.md](phase-6c3-report.md#10-tests).
- Simulation models are tested against analytic solutions, not snapshots.

Never weaken a test to make it pass; never mock a model and call the result verified.

## Conventions

- Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Game logic stays headless: no `three`, no DOM outside `src/platform` (ESLint enforces it).
- No singletons/globals; dependencies are passed from `Game.ts`.
- Subscriptions and DOM listeners always go through `Disposables` and are released in `dispose()`.
- No per-frame allocation in hot paths (reuse vectors, as `InteractionSystem` does); no per-frame
  logging.
- Comments explain _why_. Known limits are marked `shortcut: <limit>, <when to upgrade>`.
- SI units in data and code, except chemistry's mL and mol/L (`CLAUDE.md`).
- Interface styles (`src/platform/ui/styles.css`, Phase P3.2) take their colours, type sizes,
  spacing, radii, shadows and focus from the tokens at the top of the file (`:root`); a new value
  goes there first, not into a rule. Buttons are `menu-button` everywhere — secondary by default,
  `primary` for a view's main action, `caution` for leaving or losing something — with one focus
  look (`--focus-ring` and `--focus-halo`) and no transition under reduced motion. The results
  panel keeps its own instrument styling, and the 3D scene's colours are its materials, not these
  tokens.

## Add a system

1. Implement `GameSystem` (`id`, optional `init/update/dispose`) with a typed deps object.
2. Declare any new events in `src/game/GameEvents.ts`.
3. Construct it in the `Game` constructor and add it to the runner at the right point in the
   update order (or return it from `platformSystems` in `main.ts` if it needs the browser).
4. If it owns persistent data: add a `GameState` section and follow
   [persistence.md](persistence.md#changing-the-save-format).
5. Test it through `bootTestGame()`; check it releases its listeners on dispose.

Other recipes: items, rooms, scenes, experiments in [data-model.md](data-model.md); behaviours
in [interaction.md](interaction.md).

## Debugging

- **F3** toggles the debug panel (dev builds): state, FPS, focus, listener counts, system
  statuses, latest experiment, the active station (`Station:` state, parameters, run time, range,
  checklist step), driven bodies, scene jump.
- Browser console shows channel-tagged logs (`[Scenes] Scene "physics-lab" loaded (5 entities)`).
- Content errors appear at boot with the JSON path of every problem.
- Saves live in `localStorage` under `simlab.save.slot-1` (and `.backup`); delete them to reset.

## Verification before finishing a task

```bash
npm run check
npm run build
npm run test:e2e
```

Record the real results (pass/fail, with the command) in the task report.
