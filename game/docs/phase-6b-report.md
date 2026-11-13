# Phase 6B report — First physics lab: experiment engine and projectile motion

The first complete laboratory experiment, built on a reusable experiment engine. In the Physics
Lab's new projectile range the player reads the instructions, takes a ball from the cart, loads
it into the launcher, sets v₀, θ and g on the desk dials, presses RUN and watches the ball fly a
trajectory computed by a deterministic model. The landing, the trail, the monitor graph and the
results panel (theory, measurement, error, three graphs) all come from that same run. STOP keeps
the data so far, RESET reloads the ball, and the configuration survives leaving and Continue.

## 1. Verdict

**PASS**, with the caveats below. Every objective of the brief is implemented within the existing
architecture and verified. The checks:

- **Unit tests:** 223/223 (+53).
- **Mutation checks:** 10 deliberate bugs, each caught by the unit suite and then restored.
- **End to end:** the full experiment workflow in a real browser, including leaving through the
  doors and coming back. The whole E2E suite passes 10/10.
- **Production build:** passes; Rapier still loads lazily.

Caveats:

- **No GPU was tested.** All rendering ran in headless Microsoft Edge with software WebGL
  (SwiftShader). Visual quality and frame rates on a real GPU are unverified (§17).
- **Three changes came out of verification** rather than the plan (§17):
  - the reflection environment map was removed for performance;
  - the physics catch-up cap went from 5 to 6 steps;
  - Playwright runs 4 workers instead of 7.

## 2. Baseline (before any change, HEAD `fa94279`, Phase 6A)

| Command            | Result                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `npm run check`    | PASS — 170/170 unit tests (15 files)                                                        |
| `npm run test:e2e` | PASS — 9/9 (8 dev + 1 production), 1.5 min                                                  |
| `npm run build`    | PASS — entry 725.69 kB (gzip 191.31), CSS 3.80 kB, Rapier chunk 4,332.82 kB (gzip 1,669.31) |

What existed:

- **Phase 1 experiment pipeline:** `ExperimentDefinition` (data), `SimulationModel` (pure code),
  `ExperimentRuntime` (fixed-step runs, samples, results) and `ExperimentSystem`. It ran one-shot
  free-fall runs from a console, with:
  - no sessions or parameter changes in the world;
  - no theory to compare with and no graphs;
  - no stop or reset.
- **Physics Lab:** one room with a bench, a steel ball, the console, a lamp and a door. It had
  5 entities, 7 bodies and 12 colliders.
- **Rendering:** flat lighting (hemisphere and sun, no shadows) and a single matte look for every
  item.

## 3. Architecture decisions

1. **Extend, do not replace, the Phase 1 engine.** Definitions, models and the runtime keep their
   roles. A session layer sits on top. The free-fall console still works, as a one-shot session.
2. **Sessions are pure.** `ExperimentSession` holds the rules: parameters with validation, the
   states, starting, STOP and RESET. It has no events and no game dependencies.
   `ExperimentSystem` owns the sessions and publishes every transition.
3. **Theory comes from the model.** A model may offer closed-form `predictions`, and a result
   names the prediction it is compared with (`theory`, checked at boot). No formula lives in the
   UI.
4. **One rule authority per apparatus.** `StationSystem` is the only place that decides what a
   station allows. It plugs into interaction as an action guard, exactly like `ProcedureSystem`.
   The apparatus behaviours (launcher, dials, buttons, monitor) only send commands.
5. **The model owns the projectile in flight.** The `PoseDriver` port lets the station ask physics
   to take the body out of the Rapier simulation. The station then sets its pose from the model
   state and hands the body back at rest when the run ends. Gameplay never touches Rapier, and
   the scientific result is never altered by game physics.
6. **One source of truth per run.** The ball pose and the trail use the same mapping
   (`StationView.toWorld`). The graphs, the measured results and the monitor read the run's own
   buffers. Nothing is recomputed, smoothed or invented for display.
7. **Configuration is world state, runs are not.** Parameters and the loaded ball are entity
   states, so they are saved with the world. Runs are deterministic and are not saved (§9).
8. **A new room instead of a bigger lab.** The projectile range (26 m × 8 m × 6 m) joins the lab
   through an opening in its south wall. A useful lane needs about 20 m, and enlarging the lab
   would have moved the geometry that the Phase 2–3 physics and grab tests are built on.
9. **No chart dependency.** The graphs are about 100 lines of hand-written SVG
   (`ResultsPanel.ts` + `plot.ts`), as the brief asked.
10. **Lighting is per scene.** `lighting: "enhanced"` is set only on the Physics Lab. Every other
    scene renders exactly as before.

## 4. Experiment engine

The full description is in [experiments.md](experiments.md).

- **Definition (data):**
  - parameters gain `symbol`, `step` and `presets`;
  - results gain `theory`;
  - new `graphs` (series must be "time" or measurements);
  - new `procedure`, a checklist whose steps are done on milestones: `inspected{item}`,
    `loaded`, `adjusted`, `completed`, `viewed`.

  Boot validation also covers duplicate ids, presets outside the range and unknown predictions.

- **Model contract:** `predictions` and `predict(inputs)` are optional. `step` may return less
  than `dt` to stop exactly at an event.
- **`ExperimentRuntime`:**
  - `value(variable)` and `theory()`;
  - apparatus inputs (the launch height) can override initial conditions.
- **`ExperimentSession` states:** `idle → configured (apparatus ready) → running → completed`,
  or `running → stopped`; RESET goes back to `configured`/`idle`.
- **Refusals return a reason:** a run in progress, a run to reset first, an apparatus not ready,
  a parameter out of range, a change while running.
- **Dial steps:** dials step on the parameter's grid without float drift, or through presets
  (g: Moon 1.62, Mars 3.71, Earth 9.81, Jupiter 24.79 m/s²).
- **Events:**
  - existing ones gain `sessionId`: `ExperimentStarted`, `ExperimentCompleted`,
    `ExperimentFailed`;
  - new: `ExperimentStateChanged`, `ExperimentParameterChanged`, `ExperimentCommand`,
    `ExperimentStationChanged`, `ExperimentResultsViewed`;
  - `ObjectReleased` gains the reason `placed`.

  There is no per-sample event: views read the buffers when they repaint.

- **Run outcomes:** a model that fails still ends as `failed` with its reason, never as a result
  (tested).

## 5. Projectile model (`kinematics.projectile`)

**Inputs:** v₀ (m/s), θ (degrees, converted in the model), g (m/s²) and the launch height h, which
the apparatus supplies: 0.62 m muzzle − 0.03 m ball radius = 0.59 m.

**Variables:** x, y (the ball's lowest point above the floor), vx, vy and speed.

**Predictions:**

- flight time: T = (v₀ sin θ + √((v₀ sin θ)² + 2gh)) / g
- range: R = v₀ cos θ · T
- maximum height: H = h + (v₀ sin θ)²/2g
- impact speed: √(v₀² + 2gh)

**Integration:** each 1 ms step is exact for constant acceleration. The floor contact is solved
inside the step (`timeToLand`), so landing happens at the exact time and place.

**Accuracy:** flight time, range and impact speed equal the closed forms to floating point. The
maximum height is the highest stepped state, at most g·dt²/8 below the apex (1.2 µm on Earth).
No noise is added. The "error" column therefore measures the numerical method, and it says
"< 0.01 %" rather than a forced 0.

**Verification** (unit tests):

- 45° at 12 m/s on Earth from the floor: T 1.730 s, R 14.68 m, H 3.67 m;
- 0° from a height falls for √(2h/g);
- 0° from the floor lands at once without failing;
- 90°: T = 2v/g, R = 0;
- ratios: the Moon's range and time are 9.81/1.62 of Earth's, range scales with v², and
  complementary angles give equal range;
- the general formula from a height;
- theory equals the run for every result;
- samples are consistent;
- the same inputs give bit-identical samples;
- any split of real time into frames gives the same run.

**In the real app** (E2E): v₀ 5 m/s, θ 45°, Moon gravity gives:

- T 4.526 s
- R 16.001 m (theory 16.001 m)
- H 4.448 m
- impact 5.188 m/s

At θ 30° the range is 14.319 m, which matches the closed form computed independently in the test.

**Limits:**

- **Parameter ranges:** v₀ 1–15 m/s (0.5 steps), θ 0–90° (5° steps), g 1–25 m/s².
- **Space limits:** the station refuses a shot that would land beyond its 21.6 m lane or rise
  above the hall's 5.7 m ceiling, with the reason. The ideal model has no walls, so such a run
  could not be shown honestly.

## 6. Physics Lab changes

**Layout:** the projectile range room is new, joined to the lab by an opening in its south wall
(2 m wide, 2.6 m high). It contains:

- the launcher, with a barrel that turns with θ;
- an equipment cart with three projectile balls;
- the control desk, with three dials (v₀, θ, g), RUN (green), STOP (red), RESET (amber) and a
  station status screen;
- the results monitor on the wall (a live trajectory graph);
- an instruction board;
- signs, including an equation banner;
- four ceiling light panels;
- a floor measuring tape: a mark every 0.5 m, numbered every metre, zero at the launch point.

**Run feedback:** a trajectory trail and an amber landing marker appear during a run.

**Scene counts:**

| Count     | Before | After                |
| --------- | ------ | -------------------- |
| Entities  | 5      | 29 (9 lab, 20 range) |
| Bodies    | 7      | 14                   |
| Colliders | 12     | 28                   |

The Phase 2–3 specs' expectations were updated deliberately.

**Visual upgrade** (Physics Lab only):

- sun shadows: PCF, 1024² map, the shadow camera fitted to the scene's rooms, received by floors
  and objects;
- ACES filmic tone mapping;
- material presets `matte`, `satin`, `metal`, `glass` and `light`, where `light` is emissive;
- painted canvas signs and labels;
- live canvas screens.

## 7. Interaction

**Controls:**

- E on a ball grabs it.
- Holding a ball while looking at the launcher, E shows and performs "Load into the launcher".
  This works through the new `withHeld` actions: while holding, only targets that can take the
  held object are focusable, and E falls back to dropping otherwise.
- E and F raise and lower a dial.
- E presses RUN, STOP or RESET.
- E on the monitor opens the results; looking away closes them.
- F inspects.

**Refusals:** every refusal is a guard reason, shown under the prompt before pressing and as a
warning notice after. Examples:

- "Load a projectile ball into the launcher first."
- "Press RESET before the next run."
- "Out of range: it would land 23.5 m away, beyond the 21.6 m lane. Lower v₀, or change θ or g."
  (v₀ 15 m/s, 45°, Earth)
- "Stop the run before changing its parameters."
- "It is in flight."
- "It is loaded: take it out of the launcher first."
- "No results yet: run the experiment first."

## 8. UI and graphs

- **HUD objective:** follows the experiment's checklist ("Step n of 5" and the instruction).
  When every step is done it reads "Try other values: change a dial, press RESET, then RUN."
- **Notices:**
  - run started;
  - results summary on landing;
  - "Stopped at t = … s: the data so far is kept. RESET to start again.";
  - refusals.
- **Station status screen** (desk): state, the parameters, h, t, the results, and either the
  next step or the reason RUN is refused.
- **Results monitor** (wall): a live trajectory graph with the results line and the theoretical
  landing point marked.
- **Screen repaints:** on every station change, and at 10 Hz while running.
- **Results panel** (E on the monitor):
  - run number and status;
  - the run's own inputs, including h;
  - a table of theory, measured and error with three decimals;
  - three SVG graphs from the run buffers: height against time, the trajectory (y against x),
    and vx, vy and speed against time with a legend;
  - a footnote on what theory and measurement mean.

  Measured values appear only for a completed run; a stopped run shows "—". While a run is in
  progress the panel refreshes at 4 Hz.

- **Debug panel:** a `Station:` line with state, parameters, run time, range and checklist step.
  Driven bodies are marked as such.

## 9. Save/load decision

The save format is unchanged (still version 2).

**Saved,** as entity states of the launcher:

- the dial values `param.velocity`, `param.angle` and `param.gravity`;
- which ball is loaded (`loaded`).

Continue restores the dials and puts the loaded ball back into the launcher. A value outside its
parameter's range is ignored.

**Not saved:**

- runs (samples and results);
- the checklist.

A run is deterministic, so the same configuration reproduces it exactly, and saving thousands of
samples would bloat every save.

**Leaving the scene** stops a running run but keeps its data for the session. A new game or
Continue starts without sessions.

All of these cases are tested (§12).

## 10. Files added

| File                                                | Purpose                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/simulation/ExperimentSession.ts` (+ test)      | Session states, parameters, runs (pure)                                             |
| `src/simulation/models/projectile.ts` (+ test)      | Projectile model and its closed-form predictions                                    |
| `src/gameplay/experiment/StationSystem.ts` (+ test) | Station rules, commands, projectile pose, checklist, `StationView`                  |
| `src/gameplay/experiment/behaviors.ts`              | `launcher`, `parameter-dial`, `experiment-control`, `results-display`, `instrument` |
| `src/platform/render/ExperimentView.ts`             | Canvas screens, trail, landing marker, measuring tape                               |
| `src/platform/ui/ResultsPanel.ts`                   | Results table and SVG graphs                                                        |
| `src/platform/ui/plot.ts`, `results.ts` (+ tests)   | Axis ticks and scales; table rows, graph data, error formatting                     |
| `e2e/experiment.spec.ts`                            | The full workflow in the real app, with screenshots                                 |
| `docs/experiments.md`, `docs/phase-6b-report.md`    | Experiment guide, this report                                                       |

## 11. Files modified

- **Simulation:**
  - `experiment.ts`: schema;
  - `SimulationModel.ts`: predictions;
  - `ExperimentRuntime.ts`: value, theory, overrides;
  - `ExperimentSystem.ts`: sessions and events;
  - `models/index.ts`.
- **Game:**
  - `GameEvents.ts`: new events;
  - `Game.ts`: StationSystem wiring; sessions forgotten on new game and Continue;
  - `content.ts`: station and checklist validation.
- **Gameplay:**
  - `item.ts`: `launcher`, `material`, `label`, `screen`;
  - `interaction/InteractionSystem.ts`: `withHeld` and `place()`;
  - `interaction/behaviors.ts`: `heldEntity`, station refs;
  - `interaction/hold.ts`: the `PoseDriver` port.
- **Physics and config:**
  - `PhysicsSystem.ts`: drive and stopDriving, the `driven` flag;
  - `src/core/config.ts`: `maxSubSteps` 6.
- **World:** `definitions.ts` (scene `lighting`).
- **Platform:**
  - `WorldRenderer.ts`: lighting modes, shadows, materials, labels, barrel, screens;
  - `Hud.ts`: checklist objective, results panel, notices;
  - `DebugPanel.ts`;
  - `styles.css`.
- **Content:** `experiments.json`, `items.json`, `rooms.json`, `scenes.json`, `laboratories.json`.
- **Tests updated for deliberate changes:**
  - `Game.test.ts`: the system list;
  - `PhysicsSystem.test.ts`: lab counts, the substep cap, a driver test;
  - `hold.test.ts`: entity count;
  - `content.test.ts`: new checks;
  - `e2e/game.spec.ts`, `e2e/grab.spec.ts`: the body and collider count strings.
- **Config:** `playwright.config.ts` (`workers: 4`).
- **Docs:** listed in §18.

## 12. Tests

| Command            | Result                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `npm run check`    | PASS — typecheck, ESLint (layer rules), Prettier, **223/223** unit tests in 20 files (was 170 in 15) |
| `npm run test:e2e` | PASS — **10/10** (9 dev + 1 production), 1.9 min, 4 workers                                          |
| `npm run build`    | PASS — sizes in §16                                                                                  |

New unit tests (+53):

| File                        | Tests | Covers                                                                                                                                                                             |
| --------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectile.test.ts`        | 12    | closed forms, parameter dependence, theory = run, samples, determinism, frame independence                                                                                         |
| `ExperimentSession.test.ts` | 14    | states, STOP/RESET, start refusals, parameter validation and stepping, events, failure path, new game                                                                              |
| `StationSystem.test.ts`     | 13    | binding and mirroring, loading, the run against theory, STOP/RESET, unloading, dials, refusals, grab guards, checklist, leaving mid-run, Continue, new game — real game and Rapier |
| `plot.test.ts`              | 5     | tick steps, flat data, buffer extent, labels, scales                                                                                                                               |
| `results.test.ts`           | 3     | the table, no measurement for a stopped run, graphs from the run buffers                                                                                                           |
| `content.test.ts`           | +5    | shipped projectile content, malformed definitions, unknown theory, station controls, checklist items                                                                               |
| `PhysicsSystem.test.ts`     | +1    | a driven body is out of the simulation and comes back at rest                                                                                                                      |

## 13. Mutation tests

Each mutation was applied by exact string replacement, the full unit suite was run
(`npx vitest run`), and the file was restored in a `finally`. The restored file's SHA-256 was
compared with the original. All files came back byte-identical, and `git status` afterwards showed
no change to the simulation sources.

| #   | Mutation (file)                                               | Failed tests | Caught by (examples)                                |
| --- | ------------------------------------------------------------- | ------------ | --------------------------------------------------- |
| 1   | Model ignores g, always 9.81 (`projectile.ts`)                | 2            | gravity ratio (Moon); theory = run                  |
| 2   | Degrees used as radians: `DEG = 1` (`projectile.ts`)          | 14           | 45°/90° closed forms; results table                 |
| 3   | Theory uses the same-height range v²sin2θ/g (`projectile.ts`) | 1            | theory = run                                        |
| 4   | Model ignores v₀, always 8 m/s (`projectile.ts`)              | 8            | 45° closed form; 0° from a height; results table    |
| 5   | RESET keeps the run (`ExperimentSession.ts`)                  | 7            | state cycle; STOP then RESET; reset while running   |
| 6   | Sample times 1 % off (`ExperimentRuntime.ts`)                 | 2            | sample interval; sample consistency                 |
| 7   | Floor contact not solved inside the step (`projectile.ts`)    | 13           | closed forms; results table                         |
| 8   | STOP does nothing (`ExperimentSession.ts`)                    | 5            | stopped keeps data; parameter changes; station STOP |
| 9   | Lane limit ignored (`StationSystem.ts`)                       | 1            | RUN refusals                                        |
| 10  | Physics writes back driven poses (`PhysicsSystem.ts`)         | 3            | loading; STOP/RESET at the station; the driver test |

**Result: 10/10 caught.** Mutations 1–6 are the six the brief asked for: wrong gravity, wrong
angle conversion, wrong range formula, removed reset, velocity ignored, corrupted sampling.

## 14. E2E evidence

**`e2e/experiment.spec.ts`** plays the experiment with keyboard and mouse in headless Edge. Each
step is checked through the HUD, the debug panel and the results panel's DOM.

**Setup:** the developer jump to the Physics Lab (the clean-area entry and the doors are covered by
`preparation.spec.ts` and `transitions.spec.ts`).

1. Walk through the south opening into the range. The debug panel shows the room change.
2. Read the board: the checklist advances to step 1/5.
3. Grab `ball-2` and load it: the prompt shows "Load into the launcher" and the station becomes
   `configured`.
4. Lower v₀ to 5 m/s (F ×6) and step g to the Moon (F ×2), checked on the station line.
5. RUN. The station is `running` with t visible mid-flight, then `completed` with
   R = 16.001 m, equal to the closed form the test computes itself. The results toast appears.
6. Open the monitor:
   - the heading reads "run 1 (completed)";
   - Range theory = measured = 16.001 m, with error "< 0.01 %";
   - three graphs, more than 400 samples each;
   - axis labels and three velocity series.
7. Set θ to 30°. RUN is refused with "Press RESET before the next run.". RESET, then RUN gives
   R = 14.319 m.
8. RESET, RUN, then STOP mid-flight: the station is `stopped` and the notice "Stopped at t =" is
   shown. RESET returns it to `configured`.
9. Leave through the real doors (lab → hub → lab). The configuration is still v₀ 5, θ 30, g 1.62.
   No page errors.

**Runs** (all PASS):

| Run                                    | Result         |
| -------------------------------------- | -------------- |
| `experiment.spec.ts` alone             | passed twice   |
| Full suite                             | 10/10, 1.9 min |
| Full suite, earlier run with 4 workers | 10/10, 2.0 min |

**Found and fixed during verification.** The first full run with the shadowed lab failed 3 older
specs: `game.spec` free-fall walk, `game.spec` bench, and `grab.spec`. All three walk for a fixed
time. With 7 software-rendered browsers at once, the lab rendered at 10–15 fps:

- physics caught up at most 5 × 1/60 s per frame, so below 12 fps the game ran in slow motion;
- the player stopped short, and in `grab.spec` the ball was dropped onto the lamp and rolled off
  the bench.

The specs' assertions were not changed. The fixes are in §17.

## 15. Screenshots

The six experiment screenshots are saved by `experiment.spec.ts` to `test-results/` (git-ignored;
each E2E run regenerates them). All were inspected after the final run: software rendering at
1280×720, HUD visible, debug overlay hidden.

| File                            | Shows                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `experiment-1-lab-overview.png` | The range from its entrance: board, light panels, equation banner, tape, step 1 objective      |
| `experiment-2-setup.png`        | Loaded launcher with the barrel at 45°, its floor shadow, tape, the loaded-ball guard reason   |
| `experiment-3-running.png`      | Ball near the apex, trail, live monitor graph, "Running" notice                                |
| `experiment-4-landed.png`       | Full trail down to 16 m on the tape, results notice, monitor graph                             |
| `experiment-5-monitor.png`      | Results monitor: trajectory, results line, theoretical landing tick, "Read the results" prompt |
| `experiment-6-results.png`      | Results panel: inputs, theory / measured / error, three graphs, checklist complete             |

## 16. Bundle

Production build (`npm run build`):

| Chunk                      | Phase 6A                    | Phase 6B                    | Change                |
| -------------------------- | --------------------------- | --------------------------- | --------------------- |
| Entry JS (three.js + game) | 725.69 kB (gzip 191.31)     | 777.20 kB (gzip 207.00)     | +51.5 kB (gzip +15.7) |
| CSS                        | 3.80 kB (gzip 1.36)         | 5.37 kB (gzip 1.84)         | +1.6 kB               |
| Rapier (lazy)              | 4,332.82 kB (gzip 1,669.31) | 4,332.82 kB (gzip 1,669.31) | unchanged, still lazy |

The increase is game code and content: engine, station, views, results panel and the new
items/rooms JSON. No dependency was added and no chunk was added. `production.spec.ts` still
proves the menu loads without Rapier.

## 17. Performance

**Measured:** steady frame rate in one headless Edge with SwiftShader at 1280×720. Frames were
counted with `requestAnimationFrame` for 6 s after jumping to the Physics Lab. These are
**software-rendering numbers, not GPU numbers.**

| Physics Lab configuration                                     | Steady fps | Worst frame on entry |
| ------------------------------------------------------------- | ---------- | -------------------- |
| Hub, for reference (basic lighting)                           | 62.6       | —                    |
| Basic lighting (no shadows), both rooms                       | 58.3       | 110 ms               |
| First version: shadows + PMREM environment reflections + ACES | 16.3       | 837 ms               |
| Without the environment map                                   | 40.0       | 160 ms               |
| **Final:** shadows received by floors and objects only        | **44.0**   | 170 ms               |

Variants measured to find the cost (all with the environment map unless noted):

| Variant                                            | Steady fps |
| -------------------------------------------------- | ---------- |
| No shadows                                         | 18.8       |
| No tone mapping                                    | 16.5       |
| Without the environment map: 512² shadow map       | 41.3       |
| Without the environment map: shadow map drawn once | 42.5       |
| Without the environment map: hard (basic) shadows  | 49.3       |

The environment map was by far the largest cost, so it was removed. Metal is now half metallic so
that it still reads without reflections. PCF shadows were kept, at about 5–8 ms per frame in
software.

Changes made because of these measurements:

1. **Environment map removed.**
2. **Walls and ceilings no longer receive shadows.** The high sun met them at a grazing angle,
   which only produced streaks under the wall board.
3. **Physics `maxSubSteps` raised from 5 to 6.** The catch-up cap now equals the frame loop's
   0.1 s cap, so the game stays real-time down to 10 fps instead of 12. The step costs
   0.06–0.22 ms, so the extra step is negligible.
4. **Playwright `workers: 4`.** Software WebGL is CPU-bound, and 4 workers finish as fast as 7
   did.

**Simulation cost:**

- a 4.5 s flight is about 4,500 model steps of 1 ms, about 17 per 60 Hz frame (not profiled
  separately);
- sample buffers are preallocated: 1,202 samples × 6 series per run, about 58 kB;
- the trail buffer is 14 kB;
- the canvas screens repaint at 10 Hz and the results panel at 4 Hz, only while a run is in
  progress.

## 18. Documentation

- **New:** [experiments.md](experiments.md): the engine, the projectile model and its accuracy,
  playing it, save rules, and adding an experiment.
- **README:** status, flow and controls.
- **CLAUDE.md:** experiment rules (StationSystem authority, PoseDriver, one source of truth, no
  invented values, runs not saved).
- **architecture.md:** layers, systems table (`stations`), frame order, the run data flow,
  decisions 9–10, entry size.
- **data-model.md:**
  - the experiment schema additions;
  - item `material`, `label`, `screen` and `launcher`;
  - scene `lighting`;
  - the degree exception to SI.
- **physics.md:** experiment-driven bodies, the substep change, the bundle table, a limitation.
- **interaction.md:** `withHeld`, `place()`, the station guard and the apparatus behaviours.
- **persistence.md:** what a station saves and what it does not.
- **development-guide.md:** the new tests, `experiment.spec`, mutation checks and the worker limit.

## 19. Commits

Local commits on `main`, following the repository's `type(simlab): …` convention. **Nothing was
pushed.**

1. `8697688` feat(simlab): experiment sessions and projectile motion model
2. `5f3af83` feat(simlab): projectile station gameplay in the Physics Lab
3. `9f477cd` fix(simlab): keep play real-time on slow software rendering
4. `93620e9` feat(simlab): projectile lab presentation: lighting, screens, trail and results
5. docs(simlab): Phase 6B documentation and report (contains this report)

Commit 3 was checked on its own in a temporary worktree: typecheck, ESLint and 215/215 unit tests.
Commit 2 passed `npm run test:e2e` 9/9 just before it was made. Commits 4–5 are the verified final
state (§12).

## 20. Known limitations

- **No GPU verification** (SwiftShader only). Shadow quality, tone mapping and frame rate on real
  hardware are untested.
- **Ideal model:**
  - no air resistance, spin or bounce;
  - the ball passes through everything in flight, the player included;
  - shots the room cannot contain are refused rather than simulated into a wall.
- **The error column is numerical, not experimental.** The "measurement" is the same physics
  integrated numerically, so it agrees with theory by construction. There is no instrument or
  measurement-uncertainty model yet.
- **Fixed launch height** (0.59 m). Dials step on a grid; values cannot be typed.
- **Runs are not saved, and only the current run is kept.** RESET discards it, so runs cannot be
  compared side by side.
- **Specs that walk for a fixed time** (`game.spec`, `grab.spec`) need at least about 10 fps in
  the Physics Lab. On a slower machine they can run in slow motion again.
- **Small display issues:**
  - the monitor and the results notice show 4 significant figures ("Range 16 m"); the panel
    shows three decimals;
  - degrees are shown with a space ("45 °").
- **`experiment.spec` setup:** it reaches the lab by the developer scene jump. The doors are
  exercised only for the leave-and-return.

## 21. Technical debt

- **Projectile-specific code:** the station's apparatus geometry (`item.launcher`) and
  `ExperimentView`'s trail and tape are projectile-specific. A second apparatus (pendulum,
  inclined plane) should generalise them from two real cases, not now.
- **Two ways to start a run:** the free-fall console (`ExperimentRequested`, one-shot) and
  stations. Fold the console into a station when free fall gets an apparatus.
- **`ResultsPanel` rebuilds its DOM** on each refresh (4 Hz while running). This is fine at this
  size.
- **Manual checks:** the mutation checks and the frame-rate probe are manual (scripts kept out of
  the repository). Automating them would need a mutation tool and a performance budget.
- **Duplicated coordinates:** E2E target coordinates duplicate content positions; layout changes
  must update `experiment.spec.ts`.

## 22. Recommended Phase 6C

A **second physics experiment on the same engine**, such as a simple pendulum or an inclined
plane. It would prove the engine's reuse and generalise the apparatus geometry and the station
view from two real cases. Alongside it:

1. **Run history:** keep the last few runs per station, overlay them in the graphs and tabulate
   them (the learning value of varying one parameter).
2. **CSV export** of a run's samples.
3. **An optional, clearly labelled measurement model:** instrument resolution and timing
   uncertainty, so the error column can show something experimental.
4. **A check on a real GPU,** with a graphics setting for shadows.
