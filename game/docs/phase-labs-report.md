# Phase Labs — physics, chemistry and biology stations

The three laboratories now hold 14 playable experiment stations (4 existing, 10 new): each has its
equipment, dials, a deterministic model checked against a reference solution, results with units,
classes, history, reset, a checklist, a results panel with analysis and CSV, English and
Vietnamese. A shared body-less "bench" station kind and a lazy-loaded lab pack carry them, so the
menu stays under its JavaScript budget. Nothing is committed yet (see §9).

## 1. Verdict

**PARTIAL.**

- Automated verification passes (§6): typecheck, lint, 2247 unit tests, the production build and
  the full e2e suite (84 tests, 40 specs, including one spec per new experiment).
- GPU bench: every frame-time scenario holds 294–300 fps (the 300 Hz vsync ceiling). The one
  failing bench test, "the same flight at every frame rate" (failing since the lighting phase),
  is fixed: a harness bug, not a game bug (§6).
- Pending: real-display QA on the RTX 5070 Laptop at 2560×1600, 300 Hz (§8). No new apparatus,
  desk screen or lighting change has been seen by a person. Headless screenshots are not a
  substitute.
- 14 of the 32 experiments the phase listed are not implemented yet (§5); they stay Planned and
  are not shown. Under the user's updated priorities (disk size soft, Low-end runtime and
  completeness hard) they are being built now.

## 2. What was built

### Shared framework

- **Bench stations** (`item.geometry.bench: { model, top }`, `StationSystem` kind `bench`): a
  station with no physics body whose apparatus is drawn by a registered model
  (`src/platform/render/bench/registry.ts`, `BENCH_MODELS`) from the run's live sample
  (`BenchPose.sample`, every model variable, refilled in place). No per-id branching.
- **Lab pack** (`src/game/labPack.ts`, `src/content/experiments/<id>.json` gathered by
  `import.meta.glob`): experiment definitions and models load with the first world scene or the
  catalog, validated and cross-checked before use (`addLabContent`). The results panel is lazy too.
  An ESLint rule forbids a static import of the pack.
- **Instrument units** extended to m, s, mL, g, N, V, A, °C, °, pH, mol/L; result `classes`
  (labels by threshold); `"desk": false` inputs (constants in the results and CSV, not on the
  desk); `slope.intercept` (the analysis theory line y = a·x + b when the model predicts b).
- **Predict guard:** a model whose `predict` throws refuses the run with a reason
  (`station.cannotRun`), never shows a result.
- **Vite cache fix** (`vite.config.ts`): modules using `import.meta.glob` are kept out of Vitest's
  transform cache, which otherwise missed newly added experiment files.
- **Rule change (CLAUDE.md):** biology wet-lab experiments may use mL, mol/L and g, microscopy µm
  and mm, like the chemistry exception. Decided by the Lead; the user should confirm.

### Stations

| Lab       | Experiment                                               | Model                            | Apparatus            | Room / place                    |
| --------- | -------------------------------------------------------- | -------------------------------- | -------------------- | ------------------------------- |
| Physics   | Ohm's law (series / parallel)                            | `electric.dc-circuit`            | `circuit-board`      | projectile-range, north wall    |
| Physics   | Refraction (incl. TIR)                                   | `optics.refraction`              | `ray-optics-board`   | projectile-range, north wall    |
| Physics   | Inclined plane (friction, energy)                        | `mechanics.incline`              | `incline-ramp`       | projectile-range, north wall    |
| Chemistry | Acid–base titration                                      | `acid-base.titration` (extended) | `titration-stand`    | chemistry-lab, west island      |
| Chemistry | Reaction rate (order, Arrhenius)                         | `chemistry.first-order-kinetics` | `colorimeter`        | chemistry-lab, north wall bench |
| Chemistry | Heating curve                                            | `thermal.heating-curve`          | `hot-plate`          | chemistry-lab, by the fume hood |
| Biology   | Microscope (onion, cheek cells, Elodea; stains; 40–400×) | `biology.microscope`             | `digital-microscope` | biology-lab, south-east         |
| Biology   | Osmosis                                                  | `biology.osmosis`                | `osmosis-rack`       | biology-lab, west wall          |
| Biology   | Enzyme activity                                          | `biology.enzyme-kinetics`        | `gas-syringe-rig`    | biology-lab, north wall bench   |
| Biology   | Photosynthesis                                           | `biology.photosynthesis`         | `pondweed-lamp`      | biology-lab, lab bench          |

Existing physics stations (free fall, projectile, pendulum, Hooke's law) are unchanged in place
and behaviour. Topics: 12 (physics 5, chemistry 3, biology 4); every experiment is in one.

Each experiment's principle, reference solution, dials, results and limits are in
`docs/experiments.md`.

## 3. Scientific checks

- Every model has a unit test against an analytic or hand-worked solution, independent of the
  model code; every station has a station test that drives `InteractionSystem` (dials, RUN),
  re-derives the theory independently and walks the checklist, history and RESET.
- The biology review ran every preset combination through `predict` and the runtime (180 osmosis,
  256 enzyme, 240 photosynthesis, 405 microscope): none refused, every run ends before its limit.
- All models are labelled teaching models with illustrative constants where they are; no noise is
  added; measured values are never adjusted.

## 4. Measurements

### Bundle (production build, `menu-js.mjs`)

| JavaScript           | Phase start | After INF-1 (lab pack) |     Now |
| -------------------- | ----------: | ---------------------: | ------: |
| Menu (guard 500,000) |     498,449 |                430,629 | 495,185 |
| Lab pack chunk       |           — |                 33,423 | 185,746 |

Headroom is now 4,815 B. Any further experiment needs more content moved out of the menu chunk
first (items and rooms are still core content; see the INF-1 notes in `docs/data-model.md`).

### Draw calls (SwiftShader, not a GPU result)

`e2e/draw-calls.spec.ts`, ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader
driver), medium quality unless named:

| View                   | draws | Programs | Buffers |
| ---------------------- | ----: | -------: | ------: |
| physics-lab/spawn      |   645 |       19 |     797 |
| physics-lab/range-lane |   556 |       19 |     698 |
| physics-lab/pendulum   |   448 |       15 |     561 |
| chemistry-lab/spawn    |   194 |       17 |     381 |
| biology-lab/spawn      |   225 |       14 |     408 |
| simlab-hub/spawn       |   179 |        9 |     444 |

No draw-call budget was changed. The views above were not measured at the phase start, so there
is no before/after on the same spec; the new lab stations draw their apparatus with instanced
parts (12 instanced meshes per lab visit in the biology lab).

### GPU bench (`npm run bench`, production build)

ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58) Direct3D11 vs_5_0 ps_5_0, D3D11),
visible window, power plan Turbo. The display runs at 300 Hz, so 300 fps is the vsync ceiling.

| Project (size)               | Scenario                      |   fps | frame p95 | cpu mean | gpu mean | draws |
| ---------------------------- | ----------------------------- | ----: | --------: | -------: | -------: | ----: |
| gpu (1280×720)               | range idle                    | 300.0 |   3.40 ms |  1.74 ms |  2.61 ms |   556 |
| gpu (1280×720)               | ball in flight                | 294.8 |   3.50 ms |  1.79 ms |  2.55 ms |   556 |
| gpu-native (2548×1402, ×1.5) | range idle                    | 300.0 |   3.40 ms |  1.88 ms |  3.03 ms |   558 |
| gpu-native (2548×1402, ×1.5) | ball in flight                | 294.0 |   3.50 ms |  1.92 ms |  3.10 ms |   558 |
| gpu-native (2548×1402, ×1.5) | pendulum swinging             | 300.0 |   3.40 ms |  1.50 ms |  2.96 ms |   448 |
| gpu-native (2548×1402, ×1.5) | history open, 4 runs compared | 300.0 |   3.40 ms |  1.36 ms |  3.04 ms |   411 |

The bench covers the physics lab only; the chemistry and biology labs have no GPU bench scenario.

### The 500,000-byte menu guard (audit)

`e2e/renderer.production.spec.ts:29` was added in C2.3 (`a8ab246`), when three.js left the menu
chunk (971,540 → 384,416 bytes). Its comment says what it protects: "the game without three.js".
It is an architectural safety guard against the renderer (≈590 KB) being pulled back into the menu,
not a content budget; `e2e/production.spec.ts` keeps a looser 1,000,000-byte check. It is kept
unchanged. Experiment content no longer has to fit under it: lab-level content loading (in
progress) takes stations out of the menu chunk. If a deliberate change is ever wanted, any limit
below the menu size plus three.js (≈ 1,085,000 bytes today) still catches what it was made for.

## 5. Not implemented (Planned)

From the phase's list, these are not built and are not shown in the game:

- Physics: conservation of mechanical energy as its own station (the inclined plane's energy
  analysis covers part), collision / momentum, uniform circular motion, density / buoyancy,
  electrical power, reflection, converging lens.
- Chemistry: pH measurement as its own station (the titration has a pH meter), dilution,
  solubility, precipitation / qualitative analysis, separation techniques.
- Biology: transpiration, genetics / inheritance.

The binding constraint for more stations is the menu budget (§4), then floor space in the
chemistry and biology labs.

## 6. Verification

| Command                  | Result                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`       | PASS                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npx eslint .`           | PASS                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npx prettier --check .` | FAIL: `package.json` only (the user's uncommitted `dev:lan` line has no final newline; left untouched)                                                                                                                                                                                                                                                                                                                |
| `npx vitest run`         | PASS, 119 files, 2247 tests (`frameCap.test.ts` can time out at 5 s under a full parallel run; passes alone)                                                                                                                                                                                                                                                                                                          |
| `npm run build`          | PASS                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npx playwright test`    | PASS, 84/84, 17.6 min, SwiftShader, Edge, power plan Turbo                                                                                                                                                                                                                                                                                                                                                            |
| `npm run bench`          | 12 passed, 3 skipped, 1 failed: "the same flight at every frame rate" (gpu-headless), failing since the lighting phase. Fixed (see below); `npx playwright test -c playwright.bench.config.ts --project=gpu-headless -g "same flight"`: PASS twice in a row, every rate from 5.1 to 298.6 fps gives T 4.526 s, R 16.001 m, H 4.448 m, v 5.188 m/s, 454 samples, on ANGLE (NVIDIA GeForce RTX 5070 Laptop GPU, D3D11). |

**The bench fix.** The bench's frame recorder withholds display frames from the game (`limit(n)`:
the game gets 1 frame in n). It fixed the count when the game requested a frame, so after the
1-in-59 run, `limit(1)` did not free the callback already waiting: the game's next frame came about
200 ms later. In that gap the test freed and re-captured the mouse before the game had seen the
pause, and the look movement was dropped. The recorder now counts against the current `limit` at
each display frame (`e2e/physics-lab.bench.ts`). No timeout or assertion was changed.

So `npm run check` as one command fails on the format step until `package.json` gets its newline.

## 7. Known limitations

- Nothing new has been seen on a real display (apparatus, desk screens, labels, lighting).
- A projectile that lands and rolls north can reach the new physics desks (1.3 m from the lane).
- Ohm's law and the enzyme experiment have no instrument resolution (all four dials are taken).
- Refraction draws the water as a solid block, not a tank.
- The default heating run takes 177 s of real time.
- Walking to the projectile's landing spot can make the circuit station the nearest one.
- Some apparatus tests still keep their own copy of draft content.

## 8. Real-display QA checklist (RTX 5070 Laptop, 2560×1600, 300 Hz)

For each new station: walk to it, read the instruction board, turn every dial, RUN, watch the
apparatus move, read the desk screen (rows clipped with "…", no overlap), open the monitor and the
results panel, check the graph's dashed theory line, RESET. Then per lab: equipment readability,
clipping, z-fighting, collisions with desks, prompts, lighting and shadows, Low / Medium / High,
English and Vietnamese.

## 9. Next step

1. The user's real-display QA (§8); fix what it finds.
2. Add the final newline to `package.json` (the user's line) so `npm run check` passes.
3. One commit, "feat(labs): complete physics chemistry and biology experiments"; no push.

## 10. Wave 2 — subject workspaces (2026-11-01)

Chemistry and Biology no longer use the Physics desk. The seven shipped chemistry and biology
experiments open their own workspace from the apparatus (E: "Work at the bench"), and the 69 desk,
dial, button, display and monitor placements of those stations are removed. Design:
`docs/experiment-ux-architecture.md`, `docs/experiment-workspace-design.md`.

**Verdict: PASS WITH LIMITATIONS.** The runtime works in the real app (e2e walks up, presses E,
sets up with clicks, runs, reads and exits for all seven). Not seen on a real GPU display yet.

| Experiment     | Presentation   | Setup in the workspace                                        |
| -------------- | -------------- | ------------------------------------------------------------- |
| titration      | 2d-workspace   | clamp, NaOH into the burette, pipette HCl solution, indicator |
| reaction-rate  | 2d-workspace   | flasks, cuvette into the colorimeter                          |
| heating-curve  | bench-embedded | panel beside the hot plate in the live lab                    |
| microscope     | microscopy     | onion only: slide, specimen, stain, coverslip; then the stage |
| osmosis        | 2d-workspace   | none in the spec                                              |
| enzyme         | 2d-workspace   | none in the spec; activity scatters from run records          |
| photosynthesis | observation    | none in the spec                                              |

Contract additions: hidden inputs; answers checked, never shown (`checkAnswer`: correct when
|x − truth|·R ≤ |x|·d/2, R and d the run's reading and resolution); no theory column or marks in
an experiment with a hidden input (it would give c_a back); setup steps `when` (per specimen) and
`locks` (a done step locks its parameter until Clear bench, enforced by `StationSystem`); integer
results; records-only scatters. Electrical power is back to its spec (P = U·I, no calorimeter). The user accepted the three Lead
decisions on 2026-11-01: no theory with a hidden input, that answer rule, and cheek-cell and Elodea
stains kept as prepared slides.

Lead fixes after the agents: the leftover `power-dial-thermometer` placement (it broke the lab
pack), the Hud opening a second results panel over a workspace, F3 blocked in workspace fields,
biology pieces not redrawing a local toggle after a run (Measure showed no count), an invalid SVG
`transform="none"`, stage text unreadable on the light lab stages, the bench-embedded card under
the runs panel.

Verification (renderer: SwiftShader, Microsoft Edge, headless):

- `npm run check`: PASS (166 files, 2899 tests, 1 skipped). `npm run build`: PASS, menu JS
  413,528 B (guard 500,000); `WorkspaceHost` is its own lazy chunk (99 kB JS, 22 kB CSS).
- `npm run test:e2e`, full: PASS, 91 of 91 (dev, dev-timed and production), 19.9 min. Earlier full
  runs this wave failed the titration spec 3 times out of 3 at the cold catalog ("Loading the
  experiments…" past 5 s while three workers compile the lab pack): the spec now waits for the
  catalog's `aria-busy="false"` first. The projectile spec failed once (FLAKY: its 3.3 s flight
  ended before STOP at 22 fps) and passed in the other runs.

Limitations and gaps:

- SPEC GAP: cheek-cell and Elodea preparation (shown as prepared slides, stain choice kept and
  flagged); which stain each specimen allows; illumination (the lamp is an indicator); pH probe in
  the titration; stock concentrations (reaction rate); balance and freezer (heating curve).
- UX DEVIATION: the titration bench is a grid of piece cards, not an assembled stand; no library
  rail or notebook drawer below 1280 px; heating-curve panel holds all pieces in one card; no
  Elements tab (`elements.json` unused).
- With the theory column withheld, the titration's indicator-error comparison is not shown.
- The hidden value 0.085 stays in the definition JSON the browser downloads (never in the UI).
- Not done: spec review of the 14 newer physics models; the seven drafted chemistry and biology
  experiments; draw-call budgets and the GPU bench after wave 2.
- Real-display QA (§8) also covers each workspace: layout at 1280×720 and 2560×1600, contrast,
  focus and Esc order, Vietnamese.

## 11. Physical lab — vertical slice: dilution by hand, and render quality (2026-11-01)

The user redirected Chemistry and Biology from the wave-2 2D workspaces to a physical 3D lab
(objects picked up, carried, set down, poured, mixed, measured), plus a root-cause pass on visual
quality. Design: `docs/physical-lab-architecture.md` (Lead decisions §6, with the 2026-11-01
amendment accepting `workspace.drive`), `docs/render-quality-audit.md` (§12 holds the measured
A/B tables). The first experiment migrated is **dilution** (spec §12), presentation
`physical-lab`. The wave-2 workspaces stay until each experiment migrates.

**Verdict: PASS WITH LIMITATIONS** for the slice: played by hand in the real app (e2e), measured on
the real GPU. Not seen by the user on the 300 Hz display yet (Manual RTX 5070 QA: NOT RUN).

### What exists

- **Containers and liquids** (`simulation/liquid.ts`): integer microlitres per material id; a
  container never stores a concentration. `StationSystem` is the only writer of container state
  (transfer, set-down, invert, clear/restock); `LiquidSystem` only detects (held tilt, spout ray
  to a receiver, capture radius). Pours are refused with a reason (closed, full to the mark, wrong
  receiver, step not reached) and move nothing.
- **Holding** (`gameplay/interaction`, `physics`): upright glassware is set down at the aim (E),
  refused on a surface that is not level, tilted to pour (R or RMB held), turned over when
  stoppered; physics (Rapier) moves every body; a body let go through a scene change goes home.
- **Driven runs** (`ExperimentRuntime`): the run starts at the first accepted µL, is fed the
  flask's volume, has no time limit, pauses when the pour stops, and completes at the mark by the
  model (`'model'`). Refused feeds fail on the next tick (reported and recorded).
- **Save v4**: container poses and contents (`world.objects`, `world.containers`), v3→v4
  migration, sanitize (poses, tilt, contents over the mark, half-filled measured pipettes).
- **Content**: `experiments/dilution.json`, reagent cabinet with 13 glass items (4 stocks, 4
  flasks, 4 pipettes, wash bottle), tile, pipette rack, `dilution-colorimeter`, topic `solutions`.
- **Render quality** (audit F1–F14): close-inspection view (C held), sharper screens (1600 px/m on
  Medium/High, Low 640), glass sheen on High, contact shadows for physical-lab containers, 2048
  shadow maps and anisotropy 16 on High, metal tags, first-use materials compiled at load.

### Interaction proof (real app, e2e, SwiftShader)

`e2e/physical-lab.spec.ts` plays, from a save in the Chemistry Lab (no developer jump): open the
cabinet → take the 20 µmol/L bottle → a refused set-down on the bench front ("That surface is not
level.") → bottle on the bench → 50 mL flask on the tile → pipette filled from the bottle (stock
150,000 → 145,000 µL) and delivered (flask 5,000 µL) → wash bottle squeezed over the neck: the run
starts, letting go pauses it (flask + bottle = 505,000 µL), at the mark the flow stops ("It is full
to the mark.", run completed by the model) → stopper in, flask turned over (`mixed`), stopper out →
sample tilted into the cuvette (flask + cuvette = 50,000 µL) → C₂ = 0.0000020 mol/L on the results
panel, 0.00 % from C₁V₁/V₂ → Clear the bench. Screenshots: physical-lab-1…5 in `test-results/`.

### Measurements (real GPU)

Renderer: ANGLE (NVIDIA GeForce RTX 5070 Laptop GPU, Direct3D11), `gpu-native` (maximized Edge),
2549×1403 at pixel ratio 1.5 (Low: 1699×935), FPS cap none (the display's 300 Hz vsync).

- **High regression found and fixed.** With a run going, High fell from 292.8 fps (checkpoint
  `labs-12-wave2`) to 190 fps, p95 36.6 ms: each repainted screen canvas was uploaded into an sRGB
  texture, ~35 ms per upload in ANGLE. Screens now upload as plain RGBA8 and decode sRGB in the
  shader (three's `DECODE_VIDEO_TEXTURE`). After: High 297.6–300.0 fps, p95 3.40 ms; Medium 300.0;
  Low 299.9 (A/B table in the audit §12).
- **Per lab, High** (`e2e/labs.bench.ts`, new): Chemistry at the dilution bench 300.0 fps, p95 3.40
  ms, 188 draws, 58.3k triangles, CPU 1.05 ms, GPU 2.90 ms; squeezing to the mark 299.1, 122 draws;
  titration running 298.5, 201 draws; Biology at the microscope 300.0, 84 draws, 33.0k triangles;
  hub 300.0, 179 draws, 76.6k triangles; Physics Lab running 299.2, 894 draws. Live WebGL objects
  (Chemistry): 437 buffers, 22 textures, 20–23 programs; JS heap 31–80 MB (GC timing). Medium and
  Low hold ~300 fps on every steady row.
- **One-off hitches.** First pour and first Observe compiled shaders late (9.6 ms; 69.6 ms on
  Low): fixed, hidden meshes and later materials now compile at load or attach. Not fixed: opening
  a 2D workspace (~50 ms), observing in the microscope workspace (80–90 ms) and starting a titration
  in the workspace (~20 ms) are Chromium compiling 2D raster shaders the first time on the GPU
  thread shared with WebGL; Chromium caches them per profile, so a player meets them once per
  profile, browser or driver update (the bench uses a fresh profile every run). The only fix found
  (CPU-drawn eyepiece) changes pixels: user decision.
- **Resources.** A late texture after arriving in the hub (labels uploaded in idle time for labs
  never visited) is fixed: `labelPlane` no longer pre-uploads.
- **Bundle.** Menu JS 452,990 B (guard 500,000; wave 2: 413,528). The growth is game code
  (liquids, saves, holding, HUD); content stays in the lazy lab pack.

### Verification

- `npm run check`: PASS (181 files, 3047 tests, 1 skipped).
- `npm run build`: PASS.
- `npx playwright test e2e/physical-lab.spec.ts`: PASS alone, three times.
- Full `npx playwright test`: PASS, 93 of 93 (warm-up, dev, dev-timed, production), 20.1 min.
  Earlier full runs this phase failed one or two of the first three specs at a cold dev server
  (canvas, analysis, draw-calls; each passed alone): the new `warmup` project
  (`e2e/warmup.setup.ts`) compiles every module once before the dev specs; it asserts nothing about
  the game. Also fixed on the way: the save-version expectation (v4, intended), `Aim.to` turning
  the long way round (a held flask swept into the open cabinet door), the spec standing past the
  hold's reach for the sample pour (`MAX_DROP` 0.5 m), the late hub texture above.
- `npm run bench` (physics) and `e2e/labs.bench.ts` (labs): PASS on the real GPU; the labs bench's
  aiming failed several times when another application took the mouse (a game was running).

### SPEC GAP, SPEC DEVIATION, open decisions

- SPEC GAP (labelled in data and `docs/experiments.md`): the cabinet (user direction); bookkeeping
  volumes (stock 150 mL, wash bottle 500 mL, cuvette 2.7 mL); glassware sizes and masses; pour
  rates and capture radii (provisional aim help); cuvette sampling method; one inversion = mixed;
  no overflow, meniscus or pipette technique; stirring with a rod (no spec host).
- SPEC DEVIATION: 0 new. Open from before (user decisions pending): D1 titration overshoot, D2 no
  cooling, D4/D5 cell structures, D6 onion without stain.
- Lead amendment recorded: `workspace.drive` (second optional schema field).
- Known: a part-filled flask after Continue is drawn clear; the objective panel counts from the
  first unfinished step, so skipping the board leaves it at 0/9 (all stations, pre-existing);
  `finish()`/`'player'` has no caller yet (titration's driven mode will need its own analysis code);
  bench glass on the benches gets no contact shadow; physics-lab main-thread time is at p95 3.4 ms,
  right at the 300 Hz budget.

### Next step

User's real-display QA of the slice and the render changes (glass on High, screens at a distance,
inspect view, contact shadows), and decisions on the CPU-drawn eyepiece and D1–D6. Then the
Chemistry migration (titration driven, physical), Biology (microscope as a 3D instrument).

## 12. Graphics fidelity — equipment recognition, markings, glass, light switch (2026-11-02)

The user's "GRAPHICS QUALITY + 3D ASSET FIDELITY + LABORATORY VISIBILITY" task, done by one agent,
sequentially. Audit, plan and what was done: `docs/graphics-fidelity-audit.md`. The physical
dilution slice (§11) is unchanged in behaviour: container state, liquid conservation, the pour
model, `StationSystem`, `LiquidSystem`, save v4 and the dilution model are untouched; two data
changes touch interaction geometry and are tested end to end — the wash bottle's spout moved to its
nozzle tip (held ahead of the view), and the pipettes' profiles became bulb pipettes holding V
exactly at their mark.

**Verdict: PASS WITH LIMITATIONS.** Models, print, labels, glass edge, meniscus and the physical
light switch are in and verified by tests and by 2560×1600 screenshots (SwiftShader: looks only).
High holds 300 fps at the panel's native 2560×1600 in every lab (A/B against labs-13 below,
`docs/graphics-fidelity-audit.md` §7). MANUAL DISPLAY QA: NOT RUN.

Verification:

- `npm run check`: PASS (182 files, 3067 tests, 1 skipped).
- `npm run build`: PASS, menu JS 453,485 B (guard 500,000).
- `npx playwright test` (SwiftShader, Microsoft Edge): 86 passed, 3 failed, 4 did not run (their
  files' failures), 20.8 min, with the game running alongside. The three — `production.spec.ts`,
  `renderer.production.spec.ts` (the menu still "Loading…" after 5 s) and `doors.spec.ts` (one
  walking sample 1.28 against ≤ 1) — then passed alone: `npx playwright test e2e/production.spec.ts
e2e/renderer.production.spec.ts e2e/doors.spec.ts`, 8 of 8. FLAKY under load, not PASS.
- `e2e/physical-lab.spec.ts` (the dilution by hand) passed in that full run.

Limitations: only the Chemistry Lab has a light switch; the rocker does not show its position (the
room's light does); the 2D workspaces, Biology and the remaining apparatus were out of scope; print
and label sizes, cap and nozzle sizes are implementation assumptions.

Benchmark (`npm run bench` tooling; `BENCH_GRAPHICS=high npx playwright test -c
playwright.bench.config.ts --project=gpu-fullscreen e2e/labs.bench.ts e2e/physics-lab.bench.ts`,
with and without `BENCH_UNCAPPED=1`). Renderer: ANGLE (NVIDIA GeForce RTX 5070 Laptop GPU,
Direct3D11). Display 2560×1600 (reported 2561×1601: 1707×1067 CSS px × 1.5), the window fullscreen
through CDP, render 2561×1601 px, DPR 1.5, game FPS cap none, High. Baseline: `labs-13` extracted
and run with the same bench files, the four runs interleaved. A windowless Roblox process stayed
resident with 0 % GPU (Windows GPU counters) and about 0.1 core.

| Scene (High, fullscreen)    | vsync on: new / labs-13 (fps, 1 % low) | uncapped: new / labs-13 (fps; frame ms) | draws new / labs-13 |
| --------------------------- | -------------------------------------- | --------------------------------------- | ------------------- |
| Chem: bench + cabinet, idle | 300.0 (285) / 300.0 (285)              | 1019 (0.98) / 1198 (0.83)               | 200 / 185           |
| Chem: at the tile           | 300.0 (285) / 300.0 (286)              | 1114 (0.90) / 1372 (0.73)               | 153 / 134           |
| Chem: squeezing to the mark | 299.4 (242) / 299.7 (258)              | 1338 (0.75) / 1454 (0.69)               | 126 / 118           |
| Chem: titration running     | 298.0 (170) / 298.2 (179)              | 780 (1.28) / 803 (1.25)                 | 213 / 199           |
| Bio: at the microscope      | 300.0 (286) / 300.0 (286)              | 1408 (0.71) / 1422 (0.70)               | 84 / 84             |
| Hub: idle                   | 300.0 (284) / 300.0 (285)              | 1076 (0.93) / 1073 (0.93)               | 177 / 177           |
| Physics: ball in flight     | 300.0 (283) / 299.6 (254)              | 346 (2.89) / 372 (2.69)                 | 882 / 882           |

The Chemistry Lab costs 0.06–0.17 ms more per frame uncapped (CPU: the fittings' ~15–19 more draws;
GPU time within 0.05 ms), still above 1000 fps where the physics run is ±5 % noise between runs
(an earlier windowed pair read the other way). The Physics Lab, unchanged, is the scene closest to
the budget: ~350 fps uncapped. Pre-existing in both builds: 50–90 ms one-off frames opening a 2D
workspace (Chromium's first raster, §11), and, uncapped only, 50–150 ms game-frame stalls in the
Biology Lab and hub (`FrameRequestCallback`), not seen with vsync on. Chemistry memory: GL buffers
433 → 494, textures 21 → 33 (labels and print), programs 23 → 25.

## 13. Phase A — outlines, guided tasks and the floor path (2026-11-02)

Phú's direction: every experiment is done in 3D; 2D only to set instrument parameters and to read
and analyse results; while a tool is held, everything it can act on now glows; a lab offers guided
tasks on the right, and a chosen task draws a path on the floor to each step until it is done or
cancelled. Contract (approved, with its amendments): `docs/phase-a-guided-tasks-contract.md`.
Built on the dilution, the one experiment already physical.

**Verdict: PASS WITH LIMITATIONS.** Everything in the contract runs in the real app (e2e, by
hand) and holds High's 300 fps at native 2560×1600 on the RTX 5070. MANUAL DISPLAY QA: PASS (Phú,
2026-11-02, after the fixes of §13.1).

What exists:

- `gameplay/lab/HeldTargets.ts`: what the held object can act on now, asked of the rules
  (`InteractionSystem.usableTargets`; `StationSystem.pourBlock` and `setDownBlock`, the pure halves
  split out of the pour and set-down rules, which call them and then commit or remember).
- `render/outlines.ts`: a stencil mask and a pushed-out shell per outlined mesh (2 draws), white-cyan,
  pulsing at 1 Hz, every preset, at most 12; the renderer now has a stencil buffer.
- `gameplay/task/` (`task.ts` schema, `TaskSystem`, `TaskGuide`), `content/tasks.json` (three Chemistry
  Lab tasks: "Dilution by hand", "Get to know the glassware", "The light switch", EN + VI),
  cross-checked when the lab pack loads; events `TaskStarted`, `TaskStepCompleted`, `TaskCompleted`,
  `TaskCancelled`.
- `world/navGrid.ts`: the walkable grid (0.1 m, static obstacles grown by 0.35 m), A*, legs
  straightened; `render/floorPath.ts`: chevrons gliding along the way (one instanced draw).
- `platform/ui/TaskPanel.ts`: the panel on the right, **T** for the list (the mouse freed), Stop
  following; the lab's objective checklist docks under it and gives way to a followed task's step.
- Save v5: `progression.tasks`, migration v4 → v5 and its tests.

Verification:

- `npm run check`: PASS (185 files, 3084 tests, 1 skipped).
- `npm run build`: PASS, menu JS 470,556 B (guard 500,000; 453,485 before Phase A).
- `npx playwright test e2e/guided-task.spec.ts`: PASS (choose, path, the cabinet opened moves the
  task on, a wrong object leaves it waiting while the held flask outlines its seat, stop, the light
  switch task done).
- Full `npx playwright test`: PASS, 94 of 94 (warm-up, dev, dev-timed, production), 20.4 min. An earlier full run failed only `preparation.spec.ts` on its save-version expectation (4, now 5: intended, changed with a comment) and passed alone after it.
- GPU A/B (`gpu-fullscreen`, High, against `69f15d2` with the same bench tooling; ANGLE NVIDIA GeForce
  RTX 5070 Laptop GPU D3D11; 2561×1601 render, DPR 1.5, fullscreen; no other GPU application):

| Scene                              | vsync new / 69f15d2 | uncapped new / 69f15d2 (ms) | draws new / 69f15d2 |
| ---------------------------------- | ------------------- | --------------------------- | ------------------- |
| Chem: same view, cabinet open      | 300.0 / 300.0       | 1.01 / 0.99                 | 200 / 200           |
| Chem: guided task (path + outline) | 300.0 / —           | 1.06 / —                    | 204 / —             |
| Chem: wash bottle held (outline)   | 300.0 / 300.0       | 0.76 / 0.74                 | 127 / 125           |
| Chem: squeezing to the mark        | 299.4 / 299.4       | 0.85 / 0.79                 | 128 / 126           |
| Bio: at the microscope             | 300.0 / 300.0       | 0.73 / 0.74                 | 84 / 84             |
| Hub: idle                          | 300.0 / 299.8       | 0.99 / 0.98                 | 177 / 177           |
| Physics: ball in flight            | 300.0 / 300.0       | 2.95 / 2.91                 | 882 / 882           |

A guided task costs 0.05 ms a frame against the same view without one in the same run (budget
0.1 ms) and 4 draws; an outline 2 draws. The pre-existing workspace stalls (50–85 ms opening a 2D
workspace) and, uncapped only, the 50–150 ms Biology/hub frame stalls are unchanged in both builds.

Limitations:

- Amendments (contract §12): the four single-tool tasks became "Get to know the glassware" and "The
  light switch" (the station's rules require the procedure's order); an outline is 2 draws.
- The outline follows only the outlined object's largest part.
- Tasks exist only in the Chemistry Lab; paths stay within the task's lab (no doors).
- The menu bundle is 29 KB under its guard: the next large system should go into a lazy chunk.

### 13.1 Fixes after Phú's display QA (2026-11-02)

Phú: clear liquid in a held vessel all but vanished against a dark background; the white-cyan glow
was hard to see and hard to find.

- Liquid (`render/looks.ts`, `ContainerView.ts`), look values only (the colour stays the model's,
  `transmit`; levels only from the volume): the body adds a little of the room's diffuse light, as a
  filled vessel bends the lit room to the eye (`LIQUID_FILL` 0.12, tinted by the filter's own colour),
  plus its Fresnel edge (`LIQUID_RIM` 0.6·(1 − |n·v|)²); the filter takes a little more at the edge
  (`LIQUID_EDGE` 0.72) so it reads on a light background too. The meniscus is a band round the wall
  as tall as water's capillary length (2.7 mm), light on top, dark below: the flat ring it replaces
  vanished when seen edge-on. One more draw per filled vessel (the lit pass).
- Outline (`render/outlines.ts`, contract §12.4): amber with a dark band inside, drawn over the scene
  (not added light), on smoothed normals (the box corner notches are gone), pulse ≥ 80 %; a small
  turning diamond over each outlined object, about constant on screen, larger over a task step's
  object, faint behind other things. 3 draws per outlined mesh, 2 for all markers.
- `TaskSystem`: finishing a task's last step no longer writes a step past the end (it logged a false
  "not in the content: dropped" warning to whatever read the task on that event).

Verification:

- `npm run check`: PASS (185 files, 3088 tests, 1 skipped).
- `npm run build`: PASS.
- Full `npx playwright test`: PASS, 94/94 (21.7 min).
- Look check (temporary spec, not kept): a 50 mL flask of water held against the dark results
  monitor and a light wall, SwiftShader, DPR 2, High and Low, with the new liquid terms off and on:
  off, the water was indistinguishable from the empty glass on the dark monitor; on, the body and the
  level band show on both backgrounds. SwiftShader images, not GPU results.
- MANUAL DISPLAY QA: PASS (Phú, 2026-11-02).
- GPU A/B (run after Roblox was closed: `gpu-fullscreen`, High, ANGLE NVIDIA GeForce RTX 5070 Laptop
  GPU D3D11, 2561×1601, DPR 1.5; against the Phase A run of §13 with the same bench, before the
  fixes): vsync 300 fps in every row as before. Uncapped, the Chemistry Lab views take 5 more draws
  (the liquid's lit pass, one per filled vessel) at the same frame time within noise (cabinet open
  1.02 against 1.01 ms); the guided-task row 1.16 against 1.06 ms and 212 against 204 draws (the
  third outline draw, the markers, the liquids). Against the same view without a task that is
  0.14 ms, over the contract's 0.1 ms budget (one run, not repeated); still far inside 3.33 ms.
  Biology and hub unchanged (they hold no filled vessel).

## 14. Phase B — the titration by hand (2026-11-02)

Contract: `docs/phase-b-chemistry-contract.md` (approved, decisions §12: D1 the player closes the tap
and records, overshoot possible; D2 the tap open or shut at the model's 0.25 mL/s; D3 the heating
curve keeps its 3D bench and gets a guided task; D4 the reaction rate stays 2D, blocked by SPEC GAP
G15).

**Verdict: PASS WITH LIMITATIONS.** The titration is done by hand in the real app (e2e) and by the
game-level test; High holds 300 fps with the tap running. MANUAL DISPLAY QA: NOT RUN.

What exists:

- `acid-base-titration.json`: `presentation: "physical-lab"`; pieces (tile, acid and base bottles,
  dropper) and pipette materials (V_a by the pipette's size, as the dilution's V₁); the clamp step
  `by: "clamp"`; the flask onto the tile; `drive {place: burette, onto: flask, feed: added, rate:
flowRate}`; the note and the instrument's `excludes` corrected for D1 (overshooting shows in the
  reading); the result "pH in the flask at the reading"; the procedure for the bench.
- Schema: `container.drops` (a dropper bottle; SPEC GAP: no drop volume in any definition, 0.05 mL
  as the 2D rig draws, no model reads it), `container.tap` (a burette's stopcock, no rate of its own),
  `item.clamps` (a clamp that holds a vessel off any surface), setup step `by: "clamp"`, drive `feed`
  and `rate`, a task step's setup `or` (one of the per-material steps).
- `titrationModel.driven`: the same closed form at any V ≥ 0, never ending by itself.
- `StationSystem`: the clamp (the vessel held by the pose driver, upright, at the clamp; `holding`
  on the stand, `clamp` on the vessel; restored on load), the tap (open/close; rate·dt in whole µL,
  committed as a pour: its first µL starts the driven run, each feeds the base added; refused or
  empty, it closes), "Record the reading" (`finish`: end reason `player`), drops, the burette taken
  out of the clamp (refused mid-run). The clamp's actions work from the stand (the burette stands in
  its aim box): E opens or closes the tap, F records (or takes the burette out). A pour finds a
  clamped vessel's mouth (it has no collider while held: `LiquidRules.clamped`).
- Items `tit-*` (retort stand, 50 mL burette 0.6 m with 9 mm per mL, 250 mL conical flask, 10/20/25
  mL pipettes, HCl, three NaOH bottles, two indicator dropper bottles), 16 placements on the west
  island between its stools, the results monitor on the west wall; the 2D `titration-stand` rig stays
  in the code (the content's way back, contract §10) and in the 2D workspace tests' fixtures.
- Rendering: `retort-stand` bench model (foot, rod, boss, clamp, tile: no glass); the burette's scale
  (0.1 mL marks, numbered every mL, two 1024-texel bands), stopcock and key (open/shut by the tap);
  the conical flask's print; the dropper bottle's amber and teat; the indicator's colour at the run's
  pH (`LiquidAppearance.transmittance`, the 2D rig's `indicatorTint`); a thin stream from the tip.
- Tasks: "Titration by hand" (16 steps) and "The heating curve" (3 steps), EN + VI.

Verification:

- `npm run check`: PASS (185 files, 3090 tests, 1 skipped).
- `npm run build`: PASS.
- `src/game/titrationBench.test.ts` (real Rapier, shipped content): set up by hand in the
  definition's order; closed at the colour change, V_end ≥ the model's endpoint and within two ticks
  of flow (8.3 µL), the burette's loss equal to what the model was fed; overshoot by 1 mL gives a
  larger reading and a pH above 10; tap refused before the bench is ready, the burette held mid-run;
  no `acidConcentration` or 0.085 in the world state or the bottles' text; Clear the bench.
- `npx playwright test e2e/titration-physical.spec.ts`: PASS (the bench by hand in the real app,
  tap closed at the endpoint read from the burette's µL, V_end within 0.15 mL).
- Full `npx playwright test`: PASS, 94/94 (21.5 min). An earlier full run had 3 failures: two
  expectations Phase B changed (5 tasks; the debug Containers list, now the active station's first)
  and `preparation.spec.ts` (a door walk in the preparation room, untouched by Phase B), which passed
  on its own and in the final run: FLAKY once, not counted as a pass. `titration-physical.spec.ts`
  also passed with `--repeat-each=2`.
- GPU (`gpu-fullscreen`, High, ANGLE NVIDIA GeForce RTX 5070 Laptop GPU D3D11, 2561×1601, DPR
  1.5; no other GPU application): vsync 300 fps in every Chemistry row, 299.6 with the tap running.
  Uncapped: the bench ready 1.35 ms (233 draws), the tap running 1.67 ms (p95 2.60; 234 draws; the
  results monitor's live graph uploads a texture on 43 % of frames, max 0.4 ms) against the old
  workspace rows' 1.16–1.49 ms at 218 draws: +16 draws, inside the contract's +20. The other
  Chemistry views +5 draws (the bench's glass in view) and +0.03–0.11 ms against §13.1's run.

Limitations:

- The burette is filled above the eye (its mouth 1.68 m up, as a real 50 mL burette on a bench):
  the player stands back about a metre and looks a little up; a held bottle swept round at eye
  height can catch on the stand's rod.
- The flask on the tile is inside the stand's aim box: it is taken off again only after "Clear the
  bench" (or by aiming past the stand).
- The HUD objective counts from the first unfinished step (pre-existing): skipping the board leaves
  it at step 1.
- SPEC GAP: drop volume (0.05 mL, drawing only); the burette's filling funnel is not drawn (its mouth's
  capture radius stands for it); the reaction rate stays 2D (G15); the heating curve's ice is not a
  physical object (G18).
- Removed: `AcidBaseTitrationStation.test.ts` and `e2e/acid-base-titration.spec.ts` (the shipped 2D
  titration), replaced by `src/game/titrationBench.test.ts` and `e2e/titration-physical.spec.ts`.

### 14.1 Fixes after Phú's first look (2026-11-02)

Phú: every task must guide each step in detail and highlight the object to use; the flask under
the burette did not seem to fill or change colour; with the lights off, ordinary things still lit.

- **Tasks.** "The heating curve" is now six steps, each a setting the player makes (m 0.05 kg,
  T₀ −20 °C, P 800 W: presets other than the defaults, so no step passes by itself), RUN, the
  results; a new task "The rate of a reaction" leads its 2D workspace (SPEC GAP G15) through the
  water bath at 35 °C, the dye, the NaOH, the cuvette, RUN and the results; the titration's tap
  steps say what to watch and how long it takes. Every step of every task names at least one
  placed object, outlined (a test checks it). Six tasks in the Chemistry Lab.
- **The flask under the burette.** Measured in the headless renderer (`ContainerView`'s drawn level
  and colour): the level rises from 4.7 to 9.6 mm above the flask's floor for the 21 mL of base, and
  the colour turns pink between 21.00 and 21.50 mL (84–85 s at 0.25 mL/s), as the model gives it. A
  250 mL conical flask (82 mm across inside) holds 25 mL as a 5 mm layer: that is the real geometry,
  not a fault. What was missing was the guidance: the tap step now says it takes from under half a
  minute to about three minutes across the presets (never this acid's endpoint: c_a stays hidden),
  to watch the burette's level fall (9 mm per mL), and that the colour changes within a second or
  two near the end.
- **Lights off.** Measured in the dark Chemistry Lab (High): the scene's environment light and the
  room reflection on metal and glass sheen kept their full intensity; enamel print, volume marks, the
  burette's scale and the hot plate thermometer's spirit were unlit materials (bright at any light).
  Now the environment intensity and every reflection (`Finishes.dim`) follow the room's light share
  (0.12 when off), and the print, marks, scale and spirit are lit materials. What stays bright in the
  dark: the instruments' indicator lamps and screens, and the guidance aids (outlines, markers,
  floor path), on purpose. Glassware on High is a multiplying filter (its colour is a factor, not a
  light): it darkens with what is behind it.

Verification:

- `npm run check`: PASS (185 files, 3094 tests, 1 skipped); new: the light switch dims the
  environment and every reflection and gives them back; print, marks, scale and spirit lit; the
  heating-curve and reaction-rate tasks completed step by step; every task step's objects placed.
- Full `npx playwright test`: PASS, 94/94 (21.0 min). The run before had 8 failures, all scenes not
  loading in time or door-walk timing tolerances in specs Phase B does not touch; all 13 passed on
  their own: FLAKY under load, not counted as a pass; the full run was repeated clean.
- GPU (same setup as §14): vsync 300 fps in every Chemistry row (299.4–300.0); uncapped, the tap
  running 1.59 ms (234 draws), the other Chemistry rows 0.75–1.27 ms, within noise of §14.
- Lights off on a real display: NOT RUN (for Phú's eyes).

### 14.2 The burette filled below the eye (2026-11-02)

Phú: pouring into the clamped burette was too hard, its mouth too high (1.68 m, above the eye).
Phú chose to lower the clamp to fill it (a real lab fills a burette below the eye: NaOH splashes).

- The stand's clamp slides on its rod (`clamps[].lowered`): it starts low (the burette's tip just
  over the tile, its mouth at 1.53 m, 10 cm below the eye) and is raised 0.15 m to titrate
  ("Raise the clamp", E at the stand). A new setup step `raise` (`by: "raise"`) comes after the
  fill and before the tile: the flask goes under the tip only once it is raised; raising before
  the burette is filled is refused with the fill's own reason; lowering is refused during a run
  or with the flask on the tile, and makes the raise to do again; Clear the bench lowers it.
  The clamp is drawn moving (the `retort-stand` rig, from the stand's `clampRaised` state).
- The burette's mouth takes a pour 3.5 cm from its centre (was 2.5): the filling funnel of the
  definition (DEF), not drawn — an AFFORDANCE, no number changes.
- The pour still needs the player about a metre back (a held object is 1 m from the eye); the
  bottle's lip is over the mouth looking straight ahead or a little up.

Verification: `npm run check` PASS (185 files, 3095 tests, 1 skipped; new: low to fill, the raise
refused before the fill, raised 0.15 m over the tile, lowered again). `titration-physical.spec.ts`
and `guided-task.spec.ts`: PASS ×2 each. Full `npx playwright test`: **NOT CLEAN** — two runs, each
89 passed, 1 failed, 4 did not run: first `guided-task.spec.ts` missed the light switch's focus
(then PASS 3/3 alone), then `draw-calls.spec.ts` (Biology, medium) stayed on the menu (its scene
did not load in time; then PASS alone, all its draw-call checks). Both FLAKY under a full run, in
parts this change does not touch; not counted as a pass. The last clean full run (94/94) is §14.1's,
before the clamp. GPU: not re-measured (the clamp rig adds three draws at the stand).

Next: Phase L, the three labs twice as large — contract `docs/phase-l-lab-rooms-contract.md`
(DRAFT, decisions D1–D3 for Phú).

## 15. Phase L — the three labs twice as large (2026-11-03)

Phú: the rooms should be about twice as large. Decisions (contract `docs/phase-l-lab-rooms-contract.md`
§12): all three labs, floor area ×2, the wall with the hub door stays, a new arrangement drawn per
lab (plans approved by Phú), old saves migrated (v6).

- **Rooms.** Chemistry 14 × 11.4 m (x −7…7, z −7.4…4; the south wall with the hub door stays),
  Biology 14 × 11.4 m (x −9…5, z −5.7…5.7; the east wall stays), Physics 14 × 11.4 m (x −5…9,
  z −5.7…5.7; the west wall stays). The projectile range moved 1.7 m south and the pendulum bay
  1.7 m north with the lab's walls; their insides are unchanged. Hub, campus and doors unchanged.
- **Arrangement** (the approved plans): Chemistry — the dilution bench at (0, −4.8) with the reagent
  cabinet behind it on the north wall (doors facing south), the titration island west and a free
  island east, the reaction-rate bench and the fume hood on the north wall, the heating bench east,
  the sink bench on the west wall, the shelves and safety cabinets on the walls. Biology — the
  photosynthesis bench west, the microscopes' wall bench and the enzyme rig on its own bench (new
  `enzyme-bench`) on the north wall, the microscope island in the middle, the osmosis bench on the
  west wall, the digital microscope on the south wall. Physics — the bench in the middle (1.5, 0),
  the free-fall and spring desks east with their tower and stand in the corners, the monitors on
  the east wall. Every station's apparatus, board and monitor moved with its bench (rigidly).
- **Light.** The key light of each lab now hangs over the room's centre: its cone must reach every
  corner at bench height (75° half-angle; the old positions left the far corners out, a test caught
  it). Chemistry and Biology have a key and four fills, Physics a key and two fills, each with its
  housing; the ceiling returns moved off the centre. The hub and any lab together use all six
  non-key slots of the renderer's pool (was five).
- **Saves (v6).** `SAVE_VERSION` 6. The migration from v5, in the labs' rooms (the three labs, the
  range and the bay): moved containers go back to their places (their contents kept), the benches
  are cleared (what sits where, clamps, taps, a loaded ball, setup steps; dials kept), and a player
  inside a lab stands at its hub door (its scene spawn). Outside the labs nothing changes. Test:
  `persistence.test.ts` (a v5 save in the Biology Lab with a clamped burette, an open tap, a loaded
  launcher, a moved flask; and the same player in the hub, untouched).
- **Tests.** Unit tests moved to the new places by the same rigid moves (scratch scripts, every
  move listed); a few re-routed by hand: the bench half of the wall test in `hold.test.ts` starts a
  new game (the ball no longer follows a 6 m jump back), the microscope is grabbed from its west
  side (the photosynthesis lamp stands east of it), the controller's settle on the floor is checked
  to ±2 mm in `residency.test.ts` (it varies with position by up to 0.9 mm: measured). e2e: the
  fixture save (`labSave`) is now version 6 (an older save would be moved to the door by the
  migration), every stand and target moved; walks re-routed round the new benches (the dilution
  cabinet behind its bench: a step back before turning with a glass; the heating board east of its
  bench; the photosynthesis bench round its west end).

Verification:

- `npm run check`: PASS (185 files, 3096 tests, 1 skipped).
- Full `npx playwright test` (SwiftShader): first run 87 passed, 3 failed, 4 did not run —
  `pause.spec.ts` still read the old desk position; `settings.spec.ts`'s ceiling view sampled where
  a lamp no longer hangs (now aimed at the key light: 2.5 m right, 3 m ahead, as before); and
  `guided-task.spec.ts` could not focus the light switch with the flask in hand. That one was never
  a timing flake (§14.2): while an object is held, only what takes it can be focused; on the old
  route the flask was probably let go on the way (not verified). The test now sets the flask back
  on its shelf first. The three alone: PASS 9/9. Second full run: **PASS, 94/94 (22.2 min).**
- GPU (`npm run bench`: ANGLE NVIDIA GeForce RTX 5070 Laptop GPU, Direct3D11; projects gpu
  1920×1080, gpu-native 2549×1403 DPR 1.5, gpu-fullscreen 2561×1601 DPR 1.5; default graphics,
  vsync on): every Chemistry, Biology and hub row at 299.4–300.0 fps (1 % low 223–286), except the
  rows that open the microscope's 2D workspace (287–294 fps, 1 % low 52–95, single frames up to
  90–100 ms as the panel opens; not compared with a pre-Phase L run). Draws: Chemistry 147–270,
  Biology 78–150, hub 177–179. Bench: 29 passed, **2 failed**, 4 skipped — "run history closed and
  open" (Physics, pendulum bay) in gpu-native and gpu-fullscreen: aiming at the L dial landed on the
  desk beside it. Rerun alone: gpu, gpu-native, gpu-headless, software PASS; gpu-fullscreen FAIL
  again. The bay moved rigidly (the stand, dial and desk keep their places relative to each other),
  so this looks like aim precision at DPR 1.5 rather than the layout, but it was not run against a
  pre-Phase L build: **open, not counted as a pass**. Uncapped A/B against the committed build:
  NOT RUN.
- Screenshots: GPU, High, fullscreen (`labs.bench.ts`: `chem-overview`, `chem-task`,
  `bio-idle`, `hub-idle`, …) and SwiftShader (`doors-*-inside`, the Physics Lab's only view); in
  the session scratchpad, not in the repository.
- On a real display (Phú): NOT RUN.

Known limitations:

- The bench's run-history test fails in gpu-fullscreen (above), cause not proven.
- No uncapped A/B against the committed build: the larger rooms' cost (one more fill light in
  Chemistry and Biology, larger rooms in view) is unmeasured beyond "300 fps with vsync".
- The v6 migration names the rooms it clears and each lab's spawn as they are in v6 (a migration
  is frozen history); a later layout change needs its own migration.
- The player capsule settles 0–0.9 mm below the floor depending on where it stands (measured).
- In the Physics Lab the desk-to-apparatus distance grew (free-fall desk to tower 3.4 m, was 2.5 m).

Next: Phú's display QA of the three larger labs; then commit (Phase B, §14.1, §14.2 and Phase L
are all uncommitted).

### 15.1 Fixes after Phú's look at the larger labs (2026-11-03)

Phú: pouring into the burette was still too hard (proposed: stand it on the floor to fill it, then
lift it into the clamp); with the Chemistry Lab's lights off, the room was dark from inside but lit
again seen from the hub through its door. Decisions (Phú): the burette filled on the floor; the
avatar, mirrors and hand animations become Phase H (a contract after this is committed).

- **The dark room seen from outside.** Cause: the indirect light — the hemisphere ambient, the
  environment light and the reflections on metal and glass — was global and followed the room the
  player stood in; from the lit hub it came back on everything, the dark lab included. Now each
  mesh of a dark room takes its indirect light at 0.12 through an ambient-occlusion map (a black
  1×1 texture, `aoMapIntensity` 0.88): in place where its material is drawn only in dark rooms, on a
  dark twin where a lit room draws the same material. The lamps (direct light) are already per
  room. Low's sun and fill (direct, of no room) still dim where the player stands. Applied on
  events only (a switch, a scene built, a view added in a dark room), never per frame; nothing
  changes while every room is lit. `Finishes.dim` is gone. Shortcut: decor is batched per scene, so
  a scene of several rooms would keep its decor lit; exact while only one-room scenes have a
  switch (the Chemistry Lab).
- **The burette filled on the floor** (SPEC DEVIATION, an affordance: a real lab fills a burette
  lowered below the eye through a funnel, not standing on the floor). The setup is now fill, then
  clamp: clamping an empty burette is refused with the fill's reason. The clamp no longer slides
  (`lowered` removed from the stand's data; the raise step and the "Raise the clamp" task step are
  gone): it holds the burette at its working height, the tip over the tile. Standing on the floor
  the 0.6 m burette's mouth is 0.6 m up, below the lowest hold (0.87 m from the eye's 1.63 m): the
  player looks down, the tipped bottle's lip is over the mouth and the stream falls into it. The
  task "Titration by hand": take the burette, stand it on the floor, take a NaOH bottle, fill, take
  the burette again, clamp, then as before.
- **Setting glass down on the floor** did not work for round glass: the overlap test's tolerance
  grows with the other shape, and the floor (one box for the whole room) counted a cylinder 0.5 mm
  above it as touching ("no room"). The overlap is now tested 2 mm above the resting place; the
  other checks are unchanged.

Verification:

- `npm run check`: PASS (185 files, 3097 tests, 1 skipped); new: the light switch's room dark per
  room at every preset (Low, Medium, High), the lab dark and the hub lit when the lab is attached
  from the hub with its lights off, and lit again; the burette stood on the floor at 0.6 m, refused
  in the clamp while empty, filled to its mark, clamped at the working height; the 2D titration
  workspace in the same order.
- `titration-physical.spec.ts` (with `guided-task.spec.ts`): PASS (the floor fill in the real app:
  the burette set down on the floor, filled from above to 50 000 µL, clamped, then the run).
- Full `npx playwright test`: **PASS, 94/94 (22.5 min)**, first run.
- GPU: NOT RUN — no bench view has a room's lights off; the change does nothing while every room is
  lit. The first switch-off compiles the dark materials' shader variants (a one-time hitch, not
  measured).
- On a real display (Phú): NOT RUN.

Known limitations: the clamp-sliding code (raise and lower) stays in `StationSystem` and the
clamp behaviour, unused by the content now (a candidate for deletion); the decor shortcut above;
the first switch-off's shader compile.

Next: Phú's display QA (the three larger labs, the light switch seen from the hub, the burette on
the floor), then commit Phase B and Phase L; then the Phase H contract (the body, male and female,
seen in shadows and mirrors; objects held in the hands; the lean for precise work; the coat taken
off and put in the locker, and the other hand animations).

## 16. Phase H-1 — the body, its shadow, mirrors, the hands (2026-11-03)

Contract `docs/phase-h-body-hands-contract.md` (APPROVED, decisions §12). Phú asked for a whole
body seen in shadows and mirrors, male and female told apart, then gave reference images for the
style (a stylised 3D look: not copied, kept "attractive for the female, masculine for the male").

- **The body** (`render/body/BodyModel.ts`): one skeleton of 18 bones, rigid-skinned parts merged
  into one skinned mesh per surface and layer, built in code from the character's data — height,
  shoulder, waist and hip widths, the bust (`bustM`), hair style (`spiky`, `bob`, …), eye colour,
  drawn lashes, rosy cheeks and a smile (`blush`), clothes (`clothes`: top, bottom, shoes, accent,
  a tie or a trimmed collar, a dress over tights). No shape reads `gender`. A large stylised head
  (0.155 of the height), big eyes (white, iris, pupil, highlights), hair in locks; a knee-length
  lab coat open at the front (lapels, pockets), goggles and face shield, each shown only while
  worn; the bust shaped into the chest's front (two soft rises curving in to the waist).
- **Seen**: the head on a layer the player's camera never draws (`SELF_LAYER`); looking down shows
  the torso, legs, shoes and coat. The shadow comes from two shadow-only meshes (the body's, the
  coat's), one draw each per shadow map, replacing the invisible cylinder.
- **The hands**: the first-person box hands are retired; the body's own arms are the hands, by
  two-bone IK. Idle, they hang relaxed and swing as the player walks; looking down at them (pitch
  past 0.35 rad, fully at 0.8) they come up before the waist, palm up; acting out a motion (the
  hand-hygiene steps, raised after disinfection) they reach `HandsView`'s poses as before (it still
  computes them, no longer draws them). The hands in view are the hands in the mirror.
- **Mirrors** (`render/mirrors.ts`): a reflection (three's Reflector) over the glass of every mirror
  prop, at the preset's scale of the drawing buffer (`mirrorScale`: High 1, Medium 0.5, Low 0 — the
  glass alone), drawn only in view and within 6 m. A full-length mirror in the preparation room
  (`full-length-mirror`, west wall); the teacher's washroom mirror reflects too.
- **Walking**: the legs step with the drawn speed, the arms swing opposite, the head follows the
  view's pitch.

Verification:

- `npm run check`: PASS (187 files, 3109 tests, 1 skipped); new: the body's proportions from the
  data, the characters told apart by data, what is hidden from the player's own eyes, the coat
  shown only while worn, the wrists at the drawn hands (posing) or before the waist (looked at),
  idle hands hanging, mirrors per preset, placed over the glass, seeing the whole body.
- `mirror.spec.ts` (new, High under SwiftShader): the reflected shirt in front of the mirror, the
  room once stepped aside: PASS.
- Full `npx playwright test` (Edge, SwiftShader): first run 89 passed, **2 failed** (analysis, canvas:
  both stuck on the main menu), 4 did not run; the two failed specs and `mirror.spec.ts` rerun alone
  twice: 9/9 PASS; second full run: **95/95 PASS** (22.8 min). The first run's two failures are
  counted as flaky, not as passes.
- GPU A/B (`labs.bench.ts`, gpu-fullscreen, High, vsync off, uncapped; ANGLE NVIDIA GeForce RTX 5070
  Laptop GPU, Direct3D11, 2561×1601 DPR 1.5): the committed build (b52938d, extracted to the
  scratchpad) and this build interleaved, three runs each. Frame time (ms), base runs / new runs:

  | Row                              | base 1 / 2 / 3     | new 1 / 2 / 3      |
  | -------------------------------- | ------------------ | ------------------ |
  | chem: bench + cabinet, idle      | 1.02 / 1.05 / 1.03 | 1.05 / 1.37 / 1.09 |
  | chem: wash bottle over the flask | 1.13 / 1.09 / 1.07 | 1.17 / 1.52 / 1.15 |
  | chem: titration bench (stand)    | 1.68 / 1.56 / 1.72 | 1.69 / 2.44 / 1.64 |
  | chem: titration tap open         | 2.01 / 2.10 / 2.09 | 2.16 / 2.66 / 2.12 |
  | bio: room idle                   | 0.74 / 0.89 / 0.73 | 0.72 / 0.94 / 0.72 |
  | bio: observing (workspace open)  | 0.84 / 0.91 / 0.85 | 0.82 / 0.89 / 0.82 |
  | hub: idle                        | 0.91 / 1.02 / 0.91 | 0.89 / 1.09 / 0.89 |

  New run 2 was slower in every Chemistry row (+0.3–0.8 ms, CPU and GPU alike) and the third pair
  did not repeat it: read as the laptop's state during that run, not the change. Runs 1 and 3: the
  body costs about 0–0.08 ms a frame, +1 draw and +10.1k triangles in view, and one small texture
  upload every frame (the skeleton's bone matrices; ≤ 0.4 ms). No mirror in any bench view: the
  preparation room facing the mirror (the contract's row) is **NOT RUN**, nor vsync-on 300 fps
  rows.

- On a real display (Phú): NOT RUN (the look was reviewed on SwiftShader screenshots).

Known limitations: rigid parts (no blended joints); a hand-hygiene step's foam is no longer drawn
(the box hands carried it); the arms can pass into a bench or a wall when the hands come up close to
one (H-2's clearance); a mirror shows only what faces it (the body always turns with the view);
the lapels read as flat panels from above.

Next: Phú's display QA of H-1, then the commit; then H-2 (objects held in the hands, the new reach,
the lean).

## 17. Phase H-2 — held in the hands, an arm's reach, the lean (2026-11-03, night)

Contract `docs/phase-h-body-hands-contract.md` H5 and H6 (decisions D1, D3, D4). Built on top of
H-1, which is still uncommitted (Phú's display QA first); Phú asked for the next parts to go on
overnight ("Khi hoàn thành xong cứ làm tiếp các phần sau").

- **Grips** (`item.grip`, data): where the right hand closes on an item (`at`, its frame), the hand's
  distance from that axis (`radius`; default its half width across the view), the left hand too
  for long or heavy items (`other`: D1), and the fingers' pose (`wrap` or `pinch`). Given to the
  volumetric flasks (by the neck), the conical flask (neck), the pipettes (pinched near the top),
  the burette (both hands, the right above the left) and the microscope (both hands, its sides);
  every other carried item is wrapped at its centre. Drawn only: no rule or model reads it
  (checked at load: inside the item's box, only on carried items).
- **The hands hold it**: the body's arms reach the held object where it is drawn, by two-bone IK;
  the palm across from its axis on the view's side, the fingers ahead round its front, the thumb up
  its axis, the axis in the fingers' roots; a shoulder comes forward up to 5 cm for a grip just past
  the arm. The free hand hangs. Each finger and the thumb bend at two joints (D4: 20 new bones),
  curled round the object by its radius (a neck makes a fist, a bottle an open wrap) or pinching.
- **An arm's reach** (`holdReach`, `player.holdDistance` 0.45 m, was 1 m): looking ahead the held
  object is 0.45 m from the eye; looking down the arm reaches 0.1 m further and the player stoops
  (`STOOP` 0.55 m along the view at the hold's lowest, an AFFORDANCE), so the hold reaches 1.1 m
  along the view there — still a burette standing on the floor; looking up it comes 0.1 m nearer.
  A bulky object is held clear of the player (`heldClearance`: the capsule's radius, its half
  width and 2 cm — the microscope at 0.6 m), the same rule the inventory's take-out checks.
- **The lean** (`player.lean`, `gameplay/player/lean.ts`; D3): while pouring (R held with
  something in hand) or looking closely (C) the eye moves 0.25 m in along the view (never up), and
  stoops with what it holds as above; the held object stays where it is held (the eye comes to it,
  never closer than 0.25 m), so aiming is unchanged. A clearance probe (the physics ray, the held
  object and the player excluded) stops the head 0.15 m short of a wall, shelf or bench. Eased
  (0.12 s), not saved, 0 at once at a workspace or outside play. The body bends to it: the back
  bows so the eye comes forward, the knees give for the rest, the feet stay on the floor (leg IK).
- **Layout** (SPEC DEVIATION from Phase L's approved positions, for the reach): the dilution tile
  moved from 0.6 m to 0.28 m in from the bench front (z −5 → −4.68) and the colorimeter with it
  (−0.35, −5 → −0.3, −4.66): at 0.91 m and 0.99 m from a player pressed against the bench they
  were out of any arm's reach. The test-only fixture's colorimeter and stock bottle moved the same
  way. Saves with a flask on the old tile spot keep its pose (not migrated: see limitations).

Verification:

- `npm run check`: PASS (188 files, 3117 tests, 1 skipped); new: the hold's reach by pitch and
  its inverse, the lean (working, stooping, never closer than 0.25 m to what is held, stopped by the
  probe, upright at a workspace), the right hand on a bottle from any view, the burette in both
  hands, a pipette pinched, the body bowing and crouching with its feet on the floor. Tests that aimed
  with a 1 m hold now aim with `holdReach`/`holdPitch` (the Game-level dilution, titration and
  physical-lab fixtures, physics, inventory, doors).
- Found and fixed on the way: the body stood at the last dynamic object drawn (its feet shared a
  scratch array with the dynamic bodies once the body was posed after them — the mirror e2e caught
  it); fingers that sank into a held bottle (their curl is now the chord of the circle they follow
  round it); per-frame allocations in the pose (closures, arrays).
- e2e (Edge, SwiftShader): `mirror` and `physical-lab` PASS after the fixes (run alone); the
  physical-lab spec now aims by the range from where the player stands (walking taps at ~13 fps
  were too coarse for the 15 mm cuvette), and strafes from the tile to the cuvette instead of
  turning round (a held flask was let go on that turn — cause not proven).
- Full `npx playwright test`: run 1 (before the fixes above) 86 passed, 2 failed (mirror,
  physical-lab), 1 did not run; run 2: 92 passed, **3 failed** — grab (dev-timed: one more 1 m aim,
  fixed) and both production specs (the "Preparation Room" notice not seen within 5 s); run 3
  (dev + dev-timed + production): 90 passed, **2 failed** — the same two production specs. Alone,
  the production project passes 3/3 (22 s). Under the full run's load the notice appears after the
  5 s wait (it is on the page in the failure snapshot): **flaky, not counted as a pass**, cause not
  proven (H-1's full run passed them; a slower first world load under load is suspected).
- GPU A/B (`labs.bench.ts`, gpu-fullscreen, High, uncapped; ANGLE NVIDIA GeForce RTX 5070 Laptop
  GPU, Direct3D11, 2561×1601 DPR 1.5), committed build b52938d against H-1 + H-2, interleaved, two
  runs each. Frame time (ms), base 1 / 2 against new 1 / 2: chem idle 1.03 / 1.02 against 1.09 /
  1.11; wash bottle held over the flask 1.08 / 1.12 against 1.12 / 1.17 (the bottle now in the
  hand); titration stand 1.55 / 1.63 against 1.64 / 1.78; tap open 1.92 / 1.91 against 2.03 / 2.22;
  Biology rows within 0.03; hub 0.93 / 0.92 against 0.91 / 0.90. The body with its fingers: +14.3k
  triangles, +1–2 draws. The "at the tile" row is not comparable (the tile and the stand moved).
  The preparation room facing the mirror and vsync-on 300 fps rows: NOT RUN.
- On a real display (Phú): NOT RUN.

Known limitations: the hand cannot quite reach an object held looking steeply up (the hold is
0.35 m out at the eye's height plus 0.27 m: the arm falls a few cm short) or a bulky one (the
microscope at 0.6 m, both hands a little short); the grip is placed across the view, not round
each item's true shape (a cylinder's box at an angle may leave a 1 cm gap); the lean's probe is a
single ray (a shelf edge beside it is not seen); the hold's distance is not saved (nothing is: it is
derived); a save made with a flask seated on the dilution tile before the move keeps it 0.32 m
behind the new tile with its `seat` state (start the experiment again with Clear the bench).

Next: Phú's display QA of H-1 and H-2 together (the body, the hands holding a bottle, a pipette
and the burette, the lean while pouring and looking closely, the stoop to the floor burette),
then the commits; then H-3 (the actions).

### 17.1 The pour assist (Phú, 2026-11-04)

Phú: filling the burette still meant aiming to the centimetre; with the bottle near, the person
should reach out and pour. AFFORDANCE (`POUR_REACH`, `POUR_AIM`, `POUR_GAP` in
`gameplay/interaction/hold.ts`): pouring (R held) with a vessel's mouth within 1.2 m of the eye and
about 11° of the view, the interaction system asks physics to hold the spout 5 cm over that mouth
(`ObjectHolder.setSpoutAt`; the body is driven there as the hold is, swept against static
surfaces, its centre kept over the mouth by its half width until it has tipped so that it never
stands on what it pours into); the eye leans in after the hand (`pourLean`: to about an arm's
length of the spout, 0.25–0.6 m); the arms follow the object as they hold it. Letting go of R, it
goes back to the hold. Only where the spout goes changes: what flows, at what rate, and whether the
pour is allowed are the pour's own rules, unchanged. It applies to every pour at a mouth (the
burette on the floor, the flask on the tile, the cuvette), not only the burette.

Verification: `npm run check` PASS (188 files, 3119 tests, 1 skipped); new: the lip taken 5 cm over
the floor burette's mouth from 0.45 m looking 8 cm aside, the burette not pushed, the eye leaning in;
looking well aside, nothing reached or poured; `pourLean`'s limits. The Game-level burette fill and
`e2e/titration-physical.spec.ts` now pour that way (stand 0.4–0.65 m off, look at the mouth, R):
titration-physical and physical-lab e2e PASS (run alone, SwiftShader). Seen in the browser (dev
server, High): the NaOH bottle reached to the floor burette's mouth and poured while R was held.
Full e2e after this change: NOT RUN. GPU: NOT RUN (no render cost added).

Known limitations: the reach is not limited by the arm (a mouth 1.2 m away is reached, the hand
falling a few cm short of the bottle there); a mouth half hidden behind another object is still
reached for (no line-of-sight test); with two mouths close together the one nearest the view's
direction wins.

### 17.2 The burette filled where it stands (Phú, 2026-11-04)

Phú closed every task and still could not pour into the burette: no rule refused it (the fill
steps have no order before them), but the burette stood 0.85 m in from the island's front edge,
1.16 m from a player at the bench — out of the hand's reach and of the pour assist's — so only the
guided task's way (stand it on the floor) worked. The burette's place moved to 0.25 m from the
front edge (−3.6, −0.85 → −3.3, −0.25: SPEC DEVIATION from Phase L's approved layout, for the
reach); filled there, from the bench front, with the pour assist. The guided task loses its "take
the burette" and "stand it on the floor" steps; its fill step says so ("stand at the bench in front
of the burette, look at its mouth and hold R"). Filling it on the floor still works.

Verification: `npm run check` PASS (188 files, 3120 tests, 1 skipped; new: the burette filled to the
mark on the bench from its front). e2e `titration-physical` and `guided-task` PASS (run alone,
SwiftShader). Full e2e: NOT RUN.

## 18. Phase H-3 — actions acted out, first part (2026-11-04)

Contract H7–H8, decision D2. Phú: "Start H-3".

- **Data** (`content/actions.json`, schema `gameplay/action/action.ts`): a sequence per action —
  what starts it (an action performed on an entity, narrowed by where its item is worn or how low
  it is; or the hold ending: set down, thrown), its seconds (at most 3), keyframes of each hand
  (at the body — x right, y a share of the height, z ahead — or at the acted-on thing; palm turned
  ahead, up, in or hanging; fingers open, gripping, a fist), the lean (a crouch), `swap` (when the
  look of what is worn changes), `place` (when the acted-on thing shows in its new place) and
  `carry` (when the item is drawn in the right hand). Checked when content loads (keys in order,
  moments within it, one trigger). No code reads a content id.
- **ActionSystem** (gameplay): plays the first sequence that matches; while it plays the player
  does not move and no input action starts (looking around stays free: D2); its lean adds to the
  eye's. The debug panel shows it (`Action:`).
- **SPEC DEVIATION** (contract H7: "changes the world's state at the sequence's keyframe"): the
  action's effect is still applied when it is performed — every rule, the procedure and the save
  see it at once — and only its look waits (`swap`, `place`); the player is held meanwhile, so
  nothing in play can tell the difference. Chosen to keep every rule and its tests unchanged;
  Phú to confirm.
- **The body plays it** (`BodyView`): the hands follow the keys by the arms' IK, eased in and out
  (0.15 s), fingers blended; the worn coat, goggles, shield or gloves stay as they were until the
  swap; the coat (any worn item, as a box of at most 0.3 m in its colour) rides in the right hand
  during `carry`; the wardrobe shows the coat back on its hook only at `place` (`WorldRenderer`).
- **Sequences in this part** (19): lab coat on (2.6 s: reached from the hook, swung on, lapels
  straightened) and off (lapels, off the shoulders, carried, hung up); goggles and face shield on
  and off (1.4 s, both hands at the face); gloves on from the dispenser (1.8 s, pulled on one hand
  then the other) and off into the waste bin (1.6 s); open and close (cabinet, wardrobe: 0.7 s);
  switch on/off, lights on/off, water on/off (0.6 s, a hand to it); picking something up off the
  floor (0.9 s, a crouch: the eye goes down 0.6 m); setting down (0.45 s); a throw's
  follow-through (0.45 s).
- **Not in this part** (contract H8, still to do): pipette fill and deliver, the dropper squeeze,
  turning a dial, the walk-through doors; pouring is the hold's own tilt (H-2) and the hand-hygiene
  steps keep their motions (`HandsView`).

Verification:

- `npm run check`: PASS (189 files, 3126 tests, 1 skipped); new: the keys sampled (eased in, along,
  out), the lean, the data's checks; in play: the coat put on and taken off (the player held for
  2.6 s, the rules seeing it at once), the floor pick-up's crouch; the body keeping the coat on
  until the swap, carrying it, then not. Tests that pressed during an action now wait for it
  (`untilIdle`; e2e `handsFree`, inside `use` and `walkThrough`).
- Full `npx playwright test` (SwiftShader): run 1 — 87 passed, **4 failed** (analysis, canvas,
  controls: stuck on the menu or loading, as in H-1's first run; preparation: an E press during an
  action — fixed); run 2 — 88 passed, **3 failed** (pendulum: the debug panel not read; physical-lab:
  no pointer lock; physics-benches: a click timed out), 4 did not run. Each of those passes alone
  (`preparation` 3/3; `analysis`, `canvas`, `controls` 6/6; `pendulum`, `physical-lab`,
  `physics-benches` 10/10): **flaky in full runs, not counted as passes**, cause not proven.
- Seen in the browser (dev server, High): the coat put back — the wardrobe shows it on its hook
  only once hung. The hands' motions themselves were not looked at (they are below the view facing
  the wardrobe; a mirror view was not set up).
- GPU: NOT RUN (one box mesh and per-frame key sampling added; no new draws when nothing is
  carried).
- On a real display (Phú): NOT RUN.

Known limitations: the motions are keyframes in the body's frame, not fitted to each wardrobe or
dispenser (a hand may pass into the cabinet's side); the coat in the hand is a box, not cloth; the
other hand rests while one acts; an action a sequence does not list plays nothing and holds
nothing.

Next: Phú's display QA of these motions (in the mirror: the preparation room's, with the
wardrobe beside it), then the commit; then the rest of H8 (pipette, dropper, dial, doors).

### 18.1 H-3, the rest of the list (2026-11-04)

- **19 more sequences** (38 in all): the pipette filled and delivered and the dropper's drops — the
  right hand keeps the held pipette or bottle, the left steadies what it goes into, the player
  leans in 0.25 m (1 s); the burette's tap opened and closed, a stopper put in and taken out, the
  burette clamped and taken out (0.6 s); a dial raised or lowered (0.3 s); a station's RUN, STOP,
  RESET and Clear buttons pressed (0.45 s); the launcher loaded and unloaded (0.5 s); a walk-through
  door opened and closed (0.5 s).
- **Taps that do not hold** (`waits: false`): a dial, a station's button and a door are pressed
  again and again; their motion plays but nothing waits (a held input would be lost, not queued),
  and the next press plays it again. Every other sequence holds the player (D2).
- **With the lab pack**: `actions.json` moved from the core content to the lab pack, which every
  world waits for — in the core it put the menu's JavaScript at 500,866 bytes, over the 500,000
  guard (`renderer.production.spec.ts`); the menu never needs it.
- Every H8 item is now acted out except pouring (the hold's own tilt, H-2) and the hand-hygiene
  steps (their motions in `HandsView`, as before).

Verification: `npm run check` PASS (189 files, 3127 tests, 1 skipped; new: every action the
contract lists has a sequence, the taps never hold the player, the pipette's fill plays with the
pipette still in hand and the player leaning in, the actions not in the menu's content). Full e2e:
run 3 — 89 passed, **2 failed** (production: the menu's bundle over its guard — fixed by the move
above; physical-lab: an E press during the stopper's motion — fixed, `handsFree` before it);
run 4 — **94 passed, 1 failed** (grab: the dropped ball 0.293 m from where it lay, against a
0.3 m check written for the 1 m hold — the check now asks only that it did not snap back,

> 0.1 m); run 5 (dev + dev-timed) — 86 passed, **2 failed** (physical-lab: a focus not reached;
> titration-physical: the burette not filled), both passing alone (3/3): **flaky in full runs, not
> counted as passes**, cause not proven. The production project alone: 3/3 PASS.

### 18.2 Every action where it really happens (Phú, 2026-11-04)

Phú, after looking: two white shapes at the bottom of the view while washing; every action must
be done as a person does it — leaning in to a working distance, the hand at the faucet's handle,
under the soap's nozzle, nothing done with the hand elsewhere; hands looked at come straight up,
not round to the left; a door opened with a black key card tapped on a reader beside it.

- **The white shapes** were the coat's sleeves: the hand-hygiene motions were posed in front of the
  camera, the hands below the view and only the forearms in it. The motions are now done at the
  basin (below).
- **Where a hand works** (`item.handAt`, data; `gameplay/action/handPoint.ts`): the faucet's handle,
  under the basin's tap, under the soap's and the sanitizer's nozzles, the towels' slot, the glove
  dispenser's opening, the bin's top; a walk-through door's card reader (on the wall beside the
  leaf, 1.1 m up, on its room's side), drawn there (`render/cardReaders.ts`). An action's keys at its
  target go there, offset in the target's own frame.
- **Leaning in to it**: while the hands work something — an action's target, or a hand-hygiene
  step's item — the player leans in until it is an arm's length (0.55 m) away, at most 0.6 m
  (`ActionSystem.lean`); the body bows and crouches with it.
- **Hand hygiene at the basin**: each step's motion (`HandsView`) is moved to its item: wetting,
  rubbing and rinsing under the tap; the soap's right hand cupped under the nozzle; drying at the
  towels; disinfection under the sanitizer's nozzle.
- **The effect when the hand is there** (`effect`): the water runs as the handle turns (0.4 s); soap
  and sanitizer come once the hand is under the nozzle (0.45 s); a towel is pulled (0.5 s); a door:
  the key card out of the pocket, held to the reader, the door opens as it touches (0.85 s), the
  hand going back as the player walks on. These actions are performed at that moment
  (`ActionSystem.defer`); the player waits only until then. The rest keep the §18 deviation.
- **Hands come up straight**: a reach goes on the straight line from where the hand hangs to its
  goal (the goal moves, the IK solves each frame), its turn eased, no longer a blend of the bones'
  turns (which swung the hand out to the side first).

Verification: `npm run check` PASS (189 files, 3127 tests, 1 skipped); tests that opened a door, or
did a hygiene step, now let the action reach its effect first (`untilIdle`). Full
`npx playwright test` (SwiftShader): **95/95 PASS** (24.2 min). Seen in the browser (dev server,
High, SwiftShader): the faucet — the player leans in, the right hand on its handle, then the water
runs and the step is done; rubbing — both arms reach into the basin under the tap; the door — its
reader beside the leaf, the right hand going to it, then the door slides open. Not seen: the key
card itself in the hand (the view stays on the door; the reader is at its edge), the soap and
towel steps, the motions in the mirror. On a real display (Phú): NOT RUN.

Known limitations: the coat's sleeves fill much of the view when both hands work low in front (the
first-person arms are the body's, at full size); readers are not darkened with a room's lights
off; a door spawned while already open would put its reader off the wall; the lean follows the
view's direction, not the target's (the player looks at what they work, as the focus needs).

### 18.3 Legs gone after a crouch; a held burette in the face when running (Phú, 2026-11-04)

- **Legs**: in the mirror, nothing under the coat. A crouch's leg IK (holding something and looking
  down) turns the thighs and shins about every axis; each frame then set only their x turn, so the
  other two stayed — the legs left folded up into the coat. The spine, thighs, shins, neck and head
  now get their whole turn every frame. Test: crouched, then upright again — straight legs, feet on
  the floor (it fails without the fix: 0.5 rad left in a thigh).
- **The burette in the face**: the hold chased its point at gap / 0.08 s, so a running player
  (4.5 m/s) left the held thing 0.36 m behind — at an arm's reach (0.45 m), 9 cm from the eye, the
  gloved fingers filling the view. It is now carried at the player's own velocity and chases only
  what is left (`PhysicsSystem.driveHeld`): running, it stays within 2 cm of its hold point (7.5 cm
  on the first step of a run). Test added.
- The two grey spheres above the head in Phú's mirror view are not the body's (its goggles and
  shield are boxes and a band): most likely the ceiling's round lights behind it, in the mirror.

Verification: `npm run check` PASS (189 files, 3128 tests, 1 skipped). Full e2e: 87 passed, **4
failed** (doors: one 1.13 m step between samples against a 1 m cap; titration-physical: the burette
not filled; both production specs), 4 did not run; all four pass alone (9/9): **flaky in full runs,
not counted as passes**. The titration fill has now failed in three full runs (passing alone each
time): to look into (the pour assist's aim, or the walk to 0.4–0.65 m, under load). Seen in the
browser: the full PPE in the mirror, legs there standing and stepping.

### 18.4 The PPE and the hand-washing acted out step by step, the hand really there (Phú, 2026-11-04)

Phú: a white patch appeared as the soap was taken; putting on the gloves, the coat and the rest
must be acted out in full (take the gloves out, pull them on, set them), all on their own.

- **The white patch**: HandsView's foam boxes (its first-person hands are only poses since H-1)
  were made visible on soaping — two white blocks at the bottom of the view. They are never drawn
  now; the foam is blobs on the body's own palms (`BodyView.foamy`), shown from the soap to the
  rinse. Test: foam only while soapy.
- **Step by step**: the coat (off its hook, held by the collar, left sleeve, swung round, right
  sleeve, lapels, smoothed, buttoned; 4.2 s) and back onto the hook (4 s); goggles and face shield
  (from the shelf, held and looked at, to the face, strap over the head, set at the temples); gloves
  (5 s: into the dispenser, one pulled out, held open, the left hand in, the cuff pulled up, the
  second, the right hand in, both cuffs set, the fingers worked in); used gloves off (peeled inside
  out, balled, the second over the first, dropped in the bin); a paper towel (pulled out, palms,
  backs, crumpled). Data: `actions.json` (`carry` is now a list of spans; `prop` glove/towel; a
  sequence may last up to 6 s).
- **Seen**: worked in front of the body, the hands were below the view (screenshots: nothing on
  screen while gloving). Keys now say where the eyes look (`look`, the view's pitch): the eyes go
  down to the hands over 0.5 s and back up after (`player.glance`, added to the view and the head,
  never to the player's own pitch; not saved). Test: at every key that looks, each hand keyed in
  front of the body is inside the view (coat on and off, gloves on and off, the towel) — the
  lapels needed the head bowed to −65…−70°.
- **The hand really there when it takes effect**: measured, the palm was 24–30 cm from the tap and
  the soap's nozzle at the moment the water ran or the soap came (the player stood ~1 m away; the
  lean alone cannot reach). Now a sequence marked `stepIn` first walks the player up to its target
  (its clock waits), stopping where the counter stops them; the hand eases out over the whole
  lead-in (it whipped out in 0.15 s); taps, soap and sanitizer last 1.7 s with the effect when the
  hand is there (0.95 s). Test (`reach.test.ts`): palm within 6 cm of the tap and of the nozzle as
  they take effect. `stepIn` is for the basin's fittings, dispensers, towels, the coat, goggles and
  shield — not doors or the wardrobe (stepped up to, the opened leaf stood between the player and
  the coat; and the wardrobe then said "Step back to close it.", as it should), not a pick-up (the
  object is in the hand at once: the step chased it — a test now forbids `stepIn` on a pick-up or
  a release).
- **Hands over the basin**: the rubbing poses turned with the eyes' pitch — looking down, the
  fingers pointed down along the view, under the forearms: only the sleeves were seen. They are
  held level now (screenshots: hands over the basin, foam in the cupped palm under the nozzle).
- Arm's length for the lean 0.55 → 0.58 m (the head less over the arm; at 0.62 the tap was
  missed by 8 cm).
- SPEC DEVIATION (affordance): the step up is a few steps' walk the player did not press for; a
  counter or a wall ends it; it gives up after 3 s.
- e2e: `preparation.spec` goes back in front of the door's middle after the gloves (the step to the
  dispenser left the walk through the door slanted, into the bin on the way back);
  `titration-physical`: R pressed again when nothing flows — seen in a screenshot, the bottle held
  upright over the burette's mouth with R down: the press landed as the mouse was being captured
  again after the aim and was missed. This was the "burette not filled" failure of §18.3.

Verification: `npm run check` PASS (190 files, 3137 tests, 1 skipped). Full e2e (before the last two
fixes): 88 passed, 3 failed (titration-physical; both production specs), 4 did not run. Production
specs pass alone (3/3): flaky in full runs, not counted. titration-physical failed alone too (3 of 5) → the R fix; after it, alone: 4/4 PASS (`npx playwright test e2e/titration-physical.spec.ts --project=dev`, four runs). No full e2e run after these two spec fixes: NOT RUN. Seen in screenshots (SwiftShader, a temporary spec, not
kept): soap in the cupped hand under the nozzle, hands over the basin, the towel between the hands,
the coat buttoned with the eyes down, gloves pulled from the dispenser.
Limitations: the sleeves are large when the head is over the arm (a 70° view, the arm close under
the eye); the gloves' colour changes on both hands at one moment; the step up walks straight (no
path round a counter).

Committed (Phú, 2026-11-05: "Commit tất cả"): d00d3a7 (code of §18–§18.4), before Phú's 300 Hz
display QA of §18.2–§18.4, which is still to be done. The H-3-only tree was checked on its own
before the commit (typecheck, lint, format, unit tests: 190 files, 3137 passed, 1 skipped).

## 19. The cleanroom entry guided: its objects outlined, a progress bar in the middle (Phú, 2026-11-10)

Phú asked: while the entry's instructions (hand washing, putting on the PPE) are shown, the objects
to use glow with an outline; steps that take time (rubbing the hands under the water, the hand
sanitizer — "rửa tay khô") show a progress bar in the middle of the screen, near the hotbar.

- **Outlined**: with no guided task followed in the player's scene, `TaskGuide` takes the scene's
  procedure's next step (`procedureItem`, `stepItem`: the item worn, whose state counts, or used)
  and outlines every entity of that item in the player's scene, as a task step's objects are (the
  amber outline and the diamond over it). No floor path: the procedure panel says where. Looked
  for again when the step (its item) or the scene's entities change. Done, nothing is outlined.
- **The progress bar**: `Hud` shows, while a timed step runs, a plate in the middle above the
  hotbar (and the hint over it): the step's instruction and a wide bar filling to its end
  (`role="progressbar"`); hidden when no step runs. The small bar in the procedure panel stays.
- The timed steps are as before: the four rubbing steps 2 s each and the sanitizer 3 s. Wetting,
  rinsing and drying stay single actions (no bar): no step's duration was changed.
- Not done: the coat inside the closed wardrobe is outlined, not the wardrobe (the outline is drawn
  where the coat is, the marker above it).

| Check                                   | Command                                                                                                                                | Result                                                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format, unit           | `npm run check`                                                                                                                        | PASS — 292 files, 3871 tests (new: the outline follows each step, nothing once done)                                                                      |
| The entry in the real app (SwiftShader) | `npx playwright test e2e/preparation.spec.ts e2e/vietnamese.spec.ts e2e/guided-task.spec.ts --project=dev --workers=1 --reporter=line` | PASS — 6 tests (6.5 min): the guide names the notice board, then the coat; the middle bar shown with "Rub your palms together.", hidden after the rubbing |

Screenshots looked at (SwiftShader): `test-results/prep-outline-board.png` (the notice board's amber
outline and the diamond over it), `prep-rubbing.png` (the basin outlined, the bar in the middle
above the hotbar). **Not seen yet on Phú's 300 Hz display.**

### 19.1 The entry made quicker (Phú, 2026-11-10: "it takes a bit too long")

- The timed steps halved: the four rubbing steps 2 → 1 s each, the hand sanitizer 3 → 1.5 s
  (`procedures.json`). The entry stays an illustrative teaching sequence, not a real hand-wash time.
- The entry's hands acted out faster (`actions.json`, every time in a sequence scaled, its shape
  kept): the coat, goggles, face shield and gloves on and off to 60 % (coat on 4.2 → 2.52 s, gloves
  on 5 → 3 s), the paper towels to 60 % (3.4 → 2.04 s); the four where the hand must be at a spot as
  it takes effect (water on and off, soap, sanitizer) to 75 % (1.7 → 1.27 s): at 60 % the palm was
  still 6.5 cm from the tap's handle when the water ran (the rule: at most 6 cm).
- Acting and waiting through the whole entry (walking aside): about 33 s before, about 20 s now.

| Check                                   | Command                                                                                                                              | Result                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format, unit           | `npm run check`                                                                                                                      | PASS — 292 files, 3871 tests (five tests' timings rescaled: the timed steps, the coat off, the buttoning) |
| The entry in the real app (SwiftShader) | `npx playwright test e2e/preparation.spec.ts e2e/inventory.spec.ts e2e/vietnamese.spec.ts --project=dev --workers=1 --reporter=line` | PASS — 7 tests (5.1 min)                                                                                  |

**Not seen yet on Phú's 300 Hz display**: whether the faster hands still read well.
