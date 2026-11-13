# Phase 6C.3 report — run history, comparison and CSV export

Each station now keeps its finished runs as frozen records. Players can view one, compare two to
four (overlays from each run's own samples, each with its own theory) and export any as CSV.
Everything is built on the existing experiment data model: the session that ran a run keeps its
record, and the live runtime and records are read through one interface. Nothing is
re-simulated, nothing is recomputed from current settings, and nothing is saved.

```
Configure ─► Run ─► Record ─► Freeze ─► History ─► Compare ─► Export ─► analyse elsewhere
  dials      live     the run ends:     ≤ 20 per    overlays   CSV of the
             runtime  RunRecord copy    station     + theory   stored samples
```

Evidence kinds are kept apart: **unit/game-level** (Node, the real game headless), **E2E** (the
real app in headless Edge, SwiftShader software WebGL), **GPU** (benchmark on the NVIDIA GPU,
renderer string checked) and **software** (benchmark on SwiftShader).

## 1. Verdict

**PASS.** Every acceptance criterion of the brief is met and tested; the caveats are in §14.

| Criterion                                                               | Evidence                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| shared infrastructure; both experiments                                 | one `RunRecord`/`RunData`; both stations in unit, game and E2E tests        |
| immutable records; parameters and theory snapshots                      | frozen copies; written-to and changed-dials tests; 12/12 mutations          |
| current settings cannot change old runs                                 | unit (dials, new runs) and E2E (both stations, run 1 reopened)              |
| compare runs; overlays and CSV from stored data                         | the records' own buffers (tested by identity); CSV values read back exactly |
| deterministic CSV                                                       | the same file twice, in Node and from the browser download                  |
| not in the save; memory bounded                                         | save checked for run data; 20 per station, ≤ 4 MB measured                  |
| performance; existing features; tests; build; benchmark; 1280×720; docs | §9, §10, §11; `docs/experiments.md` and this report                         |

## 2. Baseline

Checked before any change:

| Item               | State                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| HEAD               | `256f7fe` phase 6c.2: add pendulum experiment (previous: `16bd417`, 6C.1)    |
| `git status`       | clean, no stash, no remote                                                   |
| `npm run check`    | PASS — 257/257 unit tests, 22 files                                          |
| `npm run test:e2e` | PASS — 11/11, 2.7 min, 3 workers                                             |
| `npm run build`    | PASS — entry 794.70 kB (gzip 211.88), CSS 5.37 kB, Rapier 4,332.82 kB (lazy) |

**Audit.** `ExperimentSession` kept only its current `ExperimentRuntime`, and RESET dropped it.
A runtime's sample buffers are sized for the longest possible run:

- pendulum: 4002 × 9 doubles, 288 kB;
- projectile: 1202 × 6 doubles, 58 kB.

New game and Continue clear every session (`Game.forgetExperiments`). The save holds only
station settings (entity states).

The results panel, graphs and table read an `ExperimentRuntime` directly. The HUD has
`pointer-events: none`, so with the mouse captured only keys and the wheel reach the panel.

## 3. Run history

**Data model.** `RunRecord` (`src/simulation/RunRecord.ts`) is a discriminated union on
`status`:

- `completed`: carries `endReason` and its results;
- `stopped`: `results: null`;
- `failed`: carries `error`, `results: null`.

Every record also holds:

- the run id, station and number;
- the definition;
- the simulated time reached;
- **a copy of the inputs that produced it** (parameters, initial conditions, apparatus inputs);
- **its theory**, evaluated once for those inputs and kept;
- **copies of its valid samples**, at their recorded length.

`RunData` is the read-only interface that the live `ExperimentRuntime` and records both satisfy.
`resultRows`, `graphFor`, `graphData` and the CSV read either, so there is no second pipeline.
There are no per-experiment history types: the definition (ids, units, symbols) carries the
experiment-specific metadata.

**Lifecycle.** `ExperimentSession` freezes a run into `history` once, at the moment it ends:

- it completes (results);
- STOP (incomplete);
- RESET while it runs (incomplete);
- leaving the scene (incomplete);
- a model failure (incomplete, with the error).

A running run is not history yet. After it ends it is both the current run (monitor, status
screen) and the newest record. RESET clears the current run and keeps the history. Dials change
only the next run's settings.

**Policy for incomplete runs.** They are kept, so useful data is never discarded, and marked
`stopped` or `failed`. They are listed and exportable, but they claim no results and cannot be
viewed or compared in the panel: only completed runs can. This is tested at the session and the
UI level.

**Bound.** `RUN_HISTORY_LIMIT` = 20 per station, oldest out first. The current run, once ended,
is the newest record, so it is never the one dropped (tested with 25 runs: #6 … #25 kept).

**Immutability.**

- The record, its inputs, results and theory, and its buffer list are `Object.freeze`d. Writes
  throw, which the tests check.
- JavaScript cannot freeze a typed array's contents. So the record owns copies in their own
  memory, which no code writes to. The tests check:
  - its buffers are not the run's;
  - they are exactly the recorded size;
  - a write into the run's buffer does not reach the record;
  - new runs, dial changes, graphs, tables, comparisons and exports leave every value
    bit-identical.
- Views get the record's own buffers; nothing is copied or transformed per frame.

## 4. Comparison

In the results panel (E at the monitor), the run list sits beside the results, newest first.

Each row shows:

- the run's settings, from its own inputs: "#2 · L 1.5 m · θ₀ 30 ° · g Earth";
- its first two measured quantities ("T 2.5 s · θmax 0.5236 rad"), or how it ended;
- badges: `current`, or `stopped`/`failed`;
- a checkbox (completed runs only) and a **CSV** button.

| Ticked | Shown                                                                                       |
| ------ | ------------------------------------------------------------------------------------------- |
| none   | the current run, live (as in 6C.2)                                                          |
| one    | that run instead, badged `recorded`, with the dials' present settings named for contrast    |
| 2–4    | a comparison: legend, table, overlays (the fifth box is disabled: "Compare at most 4 runs") |

The comparison:

- **Legend:** names each run by the settings that differ ("#1 · L 1 m"), with its colour and
  dash style; runs are never told apart by colour alone.
- **Table:** each run's settings and every result, the measured value with **that run's own
  theory** beneath it.
- **Overlays:** the definition's new `compare` list chooses graphs that mean something for each
  experiment:
  - projectile: trajectory and height–time;
  - pendulum: θ–t, ω–t, the phase portrait, and total energy (a series picked from the
    three-series energy graph).
- **Theory lines:** each line is the run's stored samples. Where the graph has a theory mark,
  each run gets a vertical line at its own predicted value (range, exact period), from its
  record, never from the current dials.

Content validation rejects a `compare` entry for a missing graph, a series the graph does not
plot, or a multi-series graph without a series.

**Mouse and keyboard.** Like the rest of the HUD, the panel lets the mouse through to the view,
except on the run list.

- **With the mouse free (Esc):** click the boxes and buttons; click the view to look around
  again. The panel is laid out so the screen centre never falls on a control.
- **Keyboard:** Tab, Space and Enter work on the list, also while the mouse is captured.
- **Wheel:** scrolls the results.

## 5. CSV

`src/simulation/csv.ts` builds the file from a `RunRecord` only, and the browser's own download
saves it (Blob, `<a download>`). There is no dependency and no backend.

| Part      | Content                                                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| file name | `simlab-pendulum-run-003.csv`, `simlab-projectile-motion-run-001.csv` (letters, digits, hyphens)                                                                                                    |
| metadata  | `#` lines: experiment and model, run and station, status, parameters and inputs with units, theory values, results (each with the theory it is compared with), sampling, one description per column |
| header    | `time_s` and every measurement: `x_m,y_m,vx_m_s,vy_m_s,speed_m_s`, or `theta_rad,theta_deg,omega_rad_s,alpha_rad_s2,x_m,y_m,kinetic_J,potential_J,energy_J`                                         |
| rows      | one per recorded sample, every one                                                                                                                                                                  |

**Numerical integrity.**

- Every value is written in JavaScript's shortest round-trip form, so it reads back as exactly
  the stored double (tested value by value).
- Nothing is resimulated, interpolated or rounded.
- One conversion is added and labelled: a degrees column for measurements in radians
  (`theta_deg` = θ × 180/π).
- A completed run's last row is its end (the landing: y = 0, x = the measured range).
- A stopped run says "incomplete; no measured results" and lists none.

**Format.** CRLF line ends (RFC 4180), UTF-8, ASCII column names. There is no export time, so a
run always exports to the same file: tested in Node and on the downloaded files.

## 6. Projectile

At the desk (Continue from a save with a ball loaded), the E2E runs:

- **Run 1:** v₀ 6 m/s, 45°.
- **Run 2:** θ 30°.

It then checks:

- the monitor lists #2 (`current`) and #1 with "Range 4.187 m";
- ticking #1 shows it `recorded`, with range theory = measured = 4.187 m;
- ticking #2 compares them: two trajectory and two height–time lines, theory marks at 4.187 and
  3.992 m (each run's own), legend "#1 · θ 45 °", "#2 · θ 30 °";
- **CSV** of run 1: `simlab-projectile-motion-run-001.csv`, the header above, as many rows as the
  graph's samples, first row `0,0,0.59`, last row at the theoretical flight time with x = the
  range and y = 0, identical on a second export;
- then v₀ is raised to 10 m/s at the desk, and run 1 is opened again: still v₀ 6 m/s, 45°,
  9.81 m/s², range 4.187 m, with "The dials now read v₀ 10 m/s · θ 30 ° · g Earth".

## 7. Pendulum

From a stand point where its dials, RUN, RESET and the monitor are all in reach, the E2E runs
L 1 m and then L 1.5 m (θ₀ 30°, Earth). It then checks:

- both are listed and compared;
- θ–t, ω–t, phase and total energy each show two lines;
- the θ–t marks sit at each run's own exact period (2.041 s and 2.500 s, to 9 digits against
  the period written out in the test);
- the table shows "theory 2.041 s" and "theory 2.500 s";
- **CSV** of run 2: `simlab-pendulum-run-002.csv` with θ in rad and deg, the first θ exactly
  30° in radians, the last row at three periods;
- then L 0.5 m and the Moon on the dials, and run 1 opened again: L 1 m, θ₀ 30°, 9.81 m/s²,
  exact period 2.041 s and small-angle 2.006 s, "The dials now read L 0.5 m · θ₀ 30 ° · g Moon".

## 8. Persistence

| Saved (unchanged format, version 2)           | Not saved                                    |
| --------------------------------------------- | -------------------------------------------- |
| station settings (`param.*`), the loaded ball | runs, run history, picks, checklist progress |

The history lives in the sessions for the play session. It survives scene changes and leaving
the room. New game, Continue and a reload start without it, as runs always did.

A game-level test autosaves after runs at both stations and checks the save:

- it holds no run id, record, sample, theory or result, and stays under 4 kB;
- after Continue, both histories are empty while the dials are restored.

## 9. Performance

**The simulation is not slowed.** The runtime steps exactly as before. History adds one copy
of a run's samples when it ends: 44 kB for a pendulum run at 1 m, 6–34 kB for a projectile.
There is no work per frame or per step. The run list is rebuilt only when runs or picks change.
The 4 Hz live refresh of open results now skips recorded views, which do not change.
Comparison graphs are built once per change of selection, from the records' own buffers.

**Memory is bounded.** At most 20 records per station hold only their recorded samples:

| Case                                         | Samples | Record | 20 records |
| -------------------------------------------- | ------- | ------ | ---------- |
| pendulum, L 1 m, 30°, Earth (typical)        | 614     | 44 kB  | 0.88 MB    |
| pendulum, L 3 m, 60°, Moon (longest allowed) | 2754    | 198 kB | 3.97 MB    |
| projectile, 8 m/s, 45°, Earth                | 126     | 6 kB   | 0.12 MB    |
| projectile, 5 m/s, 45°, Moon                 | 454     | 22 kB  | 0.44 MB    |

Without compacting, every record would keep the run's full buffers (288 kB pendulum, 58 kB
projectile), so 20 pendulum records would take 5.8 MB.

**GPU** — `gpu-headless`: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)
Direct3D11 vs_5_0 ps_5_0, D3D11)`, 1280×720, pixel ratio 1.00, GPU timer available. History
closed is every scenario except the last two rows:

| Scenario                             | fps   | frame mean / p95 / max (ms) | CPU mean / p95 (ms) | GPU mean / p95 (ms) | Draws |
| ------------------------------------ | ----- | --------------------------- | ------------------- | ------------------- | ----- |
| range: idle                          | 300.0 | 3.33 / 3.40 / 3.8           | 0.39 / 0.60         | 2.01 / 2.75         | 71    |
| range: interacting                   | 300.0 | 3.33 / 3.40 / 3.8           | 0.36 / 0.60         | 2.01 / 2.80         | 63    |
| range: running                       | 298.8 | 3.35 / 3.40 / 6.7           | 0.44 / 0.70         | 2.13 / 2.77         | 72    |
| range: after landing                 | 300.0 | 3.33 / 3.40 / 3.8           | 0.39 / 0.60         | 2.07 / 2.78         | 74    |
| pendulum: idle                       | 300.0 | 3.33 / 3.40 / 3.6           | 0.46 / 0.70         | 2.00 / 2.73         | 82    |
| pendulum: swinging                   | 300.0 | 3.33 / 3.40 / 3.8           | 0.44 / 0.70         | 2.09 / 2.83         | 82    |
| pendulum: after the run              | 300.0 | 3.33 / 3.40 / 3.7           | 0.44 / 0.70         | 2.06 / 2.75         | 82    |
| **history closed** (monitor in view) | 300.0 | 3.33 / 3.40 / 3.8           | 0.35 / 0.60         | 1.92 / 2.78         | 62    |
| **history open: 2 runs compared**    | 300.0 | 3.33 / 3.40 / 3.7           | 0.32 / 0.50         | 1.98 / 2.80         | 62    |

- **Matches Phase 6C.2** (range CPU 0.36–0.38 ms, GPU 1.99–2.12 ms; pendulum CPU 0.43–0.45 ms,
  GPU 2.01–2.10 ms) within run-to-run noise. Draw calls are identical.
- **One long frame.** The "running" row's 6.7 ms frame is a single one, also seen once in 6C.1;
  its p95 is 3.40 ms.
- **The new A/B scenario** measures the same view, two pendulum runs done, with the history
  closed, then open with them compared. It shows no measurable cost: same fps, same draw calls
  (the panel is DOM/SVG, not WebGL), CPU and GPU time within noise.
- **The frame-rate sweep** gave identical projectile results at 300, 60, 30, 20, 15, 10 and
  5 fps: T 4.526 s, R 16.001 m, H 4.448 m, v 5.188 m/s, 454 samples. Watching took 4.93–5.02 s
  at 10 fps and above, 9.23 s at 5 fps.

**Software** — `software`: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)
(0x0000C0DE)), SwiftShader driver)`, 1280×720. One run each:

| Scenario                         | fps  | frame mean / p95 / max (ms) | CPU (ms) | SwiftShader "GPU" (ms) | Draws |
| -------------------------------- | ---- | --------------------------- | -------- | ---------------------- | ----- |
| range: idle                      | 50.4 | 19.83 / 23.40 / 23.4        | 1.19     | 16.65                  | 71    |
| range: interacting               | 45.2 | 22.11 / 26.60 / 40.0        | 1.09     | 18.97                  | 63    |
| range: running                   | 38.6 | 25.93 / 46.70 / 50.0        | 1.24     | 23.06                  | 72    |
| range: after landing             | 48.7 | 20.52 / 23.40 / 26.7        | 1.04     | 17.35                  | 74    |
| pendulum: idle                   | 50.1 | 19.96 / 23.40 / 23.4        | 1.40     | 16.71                  | 82    |
| pendulum: swinging               | 43.7 | 22.90 / 30.00 / 33.3        | 1.47     | 18.51                  | 82    |
| pendulum: after the run          | 50.5 | 19.79 / 23.40 / 23.5        | 1.19     | 16.55                  | 82    |
| history closed (monitor in view) | 46.3 | 21.62 / 26.60 / 29.9        | 0.89     | 18.51                  | 62    |
| history open: 2 runs compared    | 45.4 | 22.02 / 26.60 / 170.0       | 0.85     | 18.43                  | 62    |

- **The range and pendulum rows match Phase 6C.2's software run** (51.1/45.4/38.8/49.6 and
  51.4/43.7/51.5 fps).
- **Opening the comparison costs about 0.4 ms a frame in software** (2 %), with the same p95.
- **A single 170 ms frame** starts the open measurement. Most likely it is the first
  rasterisation of the comparison overlay in software (the GPU run has no such frame:
  max 3.7 ms). It was not investigated further.

**Not run:** the visible-window `gpu` and `gpu-native` projects. They capture the mouse while
aiming, and the machine was in use. `gpu-headless` renders on the same NVIDIA GPU, as its
renderer string shows.

## 10. Tests

| Command                                                                    | Result                                                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run check`                                                            | PASS — **280/280** unit tests, 25 files (baseline 257; +23)                                           |
| `npm run test:e2e`                                                         | PASS — **13/13** (the 11 earlier specs + 2 in `history.spec.ts`), 3.5 min, 3 workers                  |
| `npm run build`                                                            | PASS — entry 806.27 kB (gzip 215.89; +11.57 kB), CSS 8.25 kB (+2.88 kB), Rapier 4,332.82 kB unchanged |
| `npx playwright test -c playwright.bench.config.ts --project=gpu-headless` | PASS — 4/4 (frame times, pendulum, history closed/open, frame-rate sweep), 2.1 min                    |
| `npx playwright test -c playwright.bench.config.ts --project=software`     | PASS — 3/3, 1 skipped (the sweep runs on `gpu-headless` only), 1.4 min                                |
| `gpu`, `gpu-native` bench projects                                         | NOT RUN (§9)                                                                                          |
| Mutation checks (`npx vitest run <file>` per mutation)                     | **12/12 caught**                                                                                      |

**New unit and game-level tests (+23, 257 → 280):**

| File                                             | Tests | Covers                                                                                                                                               |
| ------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/simulation/RunHistory.test.ts`              | 8     | see below                                                                                                                                            |
| `src/simulation/csv.test.ts`                     | 5     | projectile and pendulum files (metadata, header, every value read back exactly, degrees column, landing row), determinism, a stopped run, safe names |
| `src/platform/ui/results.test.ts`                | +6    | see below                                                                                                                                            |
| `src/game/content.test.ts`                       | +2    | the shipped `compare` lists; a missing graph or series, or several series, rejected                                                                  |
| `src/gameplay/experiment/StationHistory.test.ts` | 2     | see below                                                                                                                                            |

What `RunHistory.test.ts` checks:

- recorded once when it ends, as frozen copies;
- stopped kept as incomplete;
- RESET while running recorded as stopped;
- failed kept with its error;
- RESET keeps the history;
- dials, a new run and theory never change a record;
- the 20-run bound, oldest first, the current run kept;
- memory: compact copies, under 4 MB for 20 of the longest runs.

What the new `results.test.ts` tests check:

- picking: one, none, another, two, at most four;
- per-experiment overlays drawn from the records' own buffers;
- each run's own theory marks, after the dials change;
- labels and outcomes;
- a record reads like its live run;
- views never write to a record.

What `StationHistory.test.ts` checks:

- both stations through their real controls;
- scene changes keep the history (the very records);
- leaving mid-run is recorded as stopped;
- the save holds no run data;
- Continue starts empty with the dials restored.

**Existing tests:** all 257 pass unchanged; the projectile and pendulum physics tests are not
touched. `pendulum.spec.ts` now gets its save and Continue from `e2e/support.ts` (same steps).

**Mutation checks**, each applied alone, the named tests run, the file restored byte-identical:

| Mutation                                               | Caught by                   |
| ------------------------------------------------------ | --------------------------- |
| record shares the run's buffers (a view, not a copy)   | 2 history tests (see below) |
| record keeps the live inputs object                    | 1 history test              |
| record recomputes theory on every read                 | 1 history test              |
| a stopped run not recorded                             | 1 history test              |
| RESET clears the history                               | 7 history tests             |
| eviction drops the newest                              | 1 history test              |
| no bound                                               | 2 history tests             |
| CSV rounds to 6 decimals                               | 2 CSV tests                 |
| CSV drops the last sample                              | 3 CSV tests                 |
| CSV stamps the export time                             | 2 CSV tests                 |
| comparison marks every run with the first run's theory | 1 results test              |
| picking without a limit                                | 1 results test              |

The first was **missed** on the first pass. A `subarray` view has the same values, length and
`byteLength`, yet it keeps the run's whole buffer (288 kB for a pendulum) alive and shares its
memory. The test now checks that the record's buffer is its own and exactly the recorded size,
and that a write to the run's buffer does not reach it; the mutation is caught by 2 tests.

The two UI defects in §11 were caught by the E2E. The fixes were checked by the same specs
passing; no separate mutation runs were made for them.

## 11. Visual inspection

Screenshots from the E2E runs (`test-results/history-*.png`, git-ignored) were looked at,
not only asserted on:

- **1280×720:** projectile list; projectile comparison; projectile run 1 after the dials moved;
  pendulum comparison; pendulum run 1 after the dials moved.
- **1699×935:** the pendulum comparison. This is the CSS size of the maximized native window
  measured in 6C.1.

Found and fixed:

1. **The dev debug overlay covered the run list.** It sits bottom-left, up to 380 px wide, and
   took the clicks meant for the checkboxes (the E2E failed there). It now lets the mouse
   through, like the HUD, except on its own select and button.
2. **A ticked checkbox swallowed every game key.** `BrowserInput` treated any focused `<input>`
   as a text field, so after a click WASD, E and F3 did nothing (the E2E failed on F3). Inputs
   that keep no keys (checkbox, button) no longer count. Radio groups and selects still keep
   theirs, for the main menu's character choice.
3. **The HUD objective covered the run list's heading and hint** (top-left corner). The overlap
   with the panel already existed in 6C.2, but now it hid text. The objective steps aside while
   the results are open.
4. **The projectile's outcome line was cut off** ("Range 3.9…") once the comparison swatch
   joined it. The run column went from 330 to 360 px; the results column keeps two graphs per
   row at 1280×720.

## 12. Files changed

New:

| File                                               | What                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/simulation/RunRecord.ts`                      | `RunRecord` (frozen ended run), `RunData` (what views read), `recordRun` |
| `src/simulation/csv.ts`                            | `runCsv`, `csvFileName`, `csvColumn`                                     |
| `src/simulation/RunHistory.test.ts`, `csv.test.ts` | history lifecycle and CSV tests                                          |
| `src/gameplay/experiment/StationHistory.test.ts`   | history through the real game                                            |
| `e2e/history.spec.ts`                              | run history, comparison and CSV at both stations                         |
| `docs/phase-6c3-report.md`                         | this report                                                              |

Changed:

| Area      | Files                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine    | `simulation/ExperimentSession.ts` (history, bound, recording at the end of a run), `experiment.ts` (`compare`)                                                                                                                                          |
| content   | `experiments.json` (`compare` lists)                                                                                                                                                                                                                    |
| views     | `platform/ui/results.ts` (`RunData` readers, picking, labels, comparison graphs), `ResultsPanel.ts` (run list, recorded view, comparison, CSV download), `Hud.ts` (wheel, live refresh), `styles.css`, `BrowserInput.ts` (keys with a checkbox focused) |
| tests     | `results.test.ts`, `content.test.ts`                                                                                                                                                                                                                    |
| E2E/bench | `e2e/support.ts` (`labSave`, `continueFrom`), `pendulum.spec.ts` (uses them), `physics-lab.bench.ts` (history scenario)                                                                                                                                 |
| docs      | `README.md`, `CLAUDE.md`, `docs/experiments.md`, `architecture.md`, `data-model.md`, `persistence.md`, `interaction.md`, `development-guide.md`                                                                                                         |

**Architecture.**

- **Layers unchanged:** the records, CSV and theory snapshots are pure simulation code; the
  panel is platform code.
- **Nothing new beyond the history:** no new system, event, dependency, save version or second
  data pipeline. The physics models and `ExperimentRuntime` are unchanged.
- **`ExperimentSession` was extended, not rewritten:** a history list, a `keep()` called where
  a run can end, and a bound.

## 13. Commit

One commit, `phase 6c.3: add experiment run history and csv export`, containing this report. The
earlier phase commits are untouched. Not pushed: there is no remote.

## 14. Limitations

The untested items below were closed afterwards in the
[closure report](phase-6c3-closure-report.md): three and four runs compared, keyboard-only use,
narrow windows and the visible-window bench pass. Releasing the pointer with a real Esc key
could not be automated (BLOCKED, with evidence).

- **History ends with the play session.** New game, Continue and a reload clear it, by design
  (not saved). An exported CSV is the way to keep a run.
- **Incomplete runs cannot be viewed or compared in the panel.** Stopped and failed runs are
  listed and exported only, and they count toward the 20.
- **The bound is per station and first in, first out.** A burst of stopped runs can push
  completed ones out. Records cannot be deleted one by one (no delete was needed).
- **With the mouse captured,** the wheel scrolls the results column. At 20 runs the run list is
  taller than the panel, and its older rows are reached with Tab or with the wheel after Esc.
- **The real Esc key was not pressed by the tests.** Releasing the mouse is done with
  `document.exitPointerLock()`, as in earlier specs.
- **Untested in the browser:**
  - ticking and exporting with the keyboard alone (Tab, Space, Enter: native controls);
  - a comparison of three or four runs (the four-run limit is unit-tested);
  - the stacked layout below 760 px width (not a tested size).
- **The monitor and status screen show only the current run;** comparisons are in the results
  panel.
- **A CSV export has no wall-clock time** (deterministic by choice). Runs are told apart by
  station and number, and the number restarts with each play session.
- **Typed-array contents cannot be frozen** in JavaScript. Records rely on private copies that no
  code writes to, which the tests verify.
- **Measurement uncertainty is not modelled** (out of scope).

## 15. Recommendation

SimLab is ready for the next phase: the experimental-data workflow works end to end on both
experiments, and the engine took the change without rewrites.

For Phase 6C.4 (not started), in order of value:

1. **Measurement uncertainty,** kept out of this phase: a clearly labelled instrument model on
   the recorded samples, never on the deterministic model.
2. **Keeping runs beyond the play session,** if wanted: an explicit "export history" or an
   opt-in store separate from the save.
3. **Another experiment** on the same engine, which would also exercise the `compare` list.

Before starting, run the visible-window bench projects on an idle machine.
