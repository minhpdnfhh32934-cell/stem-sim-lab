# Phase 6C.3 closure report — history interaction validation

This closes the verification gaps the [Phase 6C.3 report](phase-6c3-report.md) listed:

- comparisons of three and four runs;
- the real Escape key and keyboard-only use;
- windows narrower than 760 px;
- the visible-window benchmark.

It is a test-and-evidence task, not a feature phase. One small usability fix came out of the
visual checks.

Status words: **PASS** means run and the acceptance criteria were met. **FAIL** means run and a
defect was found. **BLOCKED** means it could not be run because of an environment limitation.
**NOT RUN** means it was deliberately not attempted.

## 1. Starting state

| Item         | State                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| HEAD         | `df90bf4` phase 6c.3: add experiment run history and csv export, as expected |
| `git status` | clean, no stash, no remote                                                   |

## 2. Baseline before any change

| Command            | Result                                                                |
| ------------------ | --------------------------------------------------------------------- |
| `npm run check`    | PASS — 280/280 unit tests, 25 files                                   |
| `npm run build`    | PASS — entry 806.27 kB (gzip 215.89), CSS 8.25 kB, Rapier 4,332.82 kB |
| `npm run test:e2e` | PASS — 13/13, 4.7 min (284 s)                                         |

About the E2E baseline:

- **First attempt stopped by request.** It was stopped at 9/13 passed when the user asked for a
  pause; the stopped run's leftover dev and preview servers were cleared.
- **Rerun in full.** The complete rerun passed 13/13.
- **Why it was slower** (4.7 min instead of 3.5): another project's Playwright suite (AIRPATH)
  was running on the same machine at the time.

## 3. Previously unverified items

| Item                                                              | Status                              | Evidence                   |
| ----------------------------------------------------------------- | ----------------------------------- | -------------------------- |
| three runs compared — projectile                                  | **PASS**                            | §5                         |
| four runs compared — projectile                                   | **PASS**                            | §5                         |
| three and four runs compared — pendulum, all four overlays        | **PASS**                            | §5                         |
| a fifth tick refused (limit of four)                              | **PASS**                            | §5, plus a visual fix (§9) |
| dropping one run from a comparison                                | **PASS**                            | §5                         |
| a stopped run listed and exportable but never viewed or compared  | **PASS** (newly covered)            | §5                         |
| dials changed after recording leave every compared run unchanged  | **PASS**                            | §5                         |
| keyboard-only ticking (Tab, Space), mouse still captured          | **PASS**                            | §6                         |
| game keys with a ticked checkbox focused (F3, S)                  | **PASS**                            | §6                         |
| a field that keeps its keys still does (select; menu radio group) | **PASS**                            | §6                         |
| the real Escape key reaches the page                              | **PASS**                            | §6                         |
| the real Escape key **releases the pointer** (automated)          | **BLOCKED**                         | §6                         |
| pointer captured again after release; looking works               | **PASS**                            | §6                         |
| windows of 720, 600 and 430 px wide, and 1280×480                 | **PASS** (within the stated policy) | §7                         |
| visible-window benchmark (`gpu`, `gpu-native`)                    | **PASS**                            | §8                         |

## 4. Environment

| Item    | Value                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------ |
| Machine | ASUS ROG Strix G16 (G614PP), Windows 11 Home 10.0.26200, on AC power, power plan "Turbo"               |
| GPU     | NVIDIA GeForce RTX 5070 Laptop GPU; WebGL renderer `ANGLE (NVIDIA, … Direct3D11 vs_5_0 ps_5_0, D3D11)` |
| Display | 2560×1600 at 300 Hz on the NVIDIA GPU, Windows scaling 150 % (CSS 1699×935 when maximized)             |
| Browser | Microsoft Edge 155.0.4283.62, Playwright 1.63.0                                                        |
| E2E     | headless Edge with `--use-angle=swiftshader` (software WebGL), 1280×720 unless stated                  |

## 5. Three and four runs compared

The new tests are in `e2e/history.spec.ts`, which already holds the two-run tests.

**`expectCompared` helper.** Both new tests use one shared helper. It checks that the comparison
shows exactly the picked runs, in the order picked, everywhere:

- the heading;
- the legend;
- the table's columns;
- every overlay's lines;
- every theory mark.

It also checks that each run's theory mark and table values (measured and theory) equal that
run's own theory, which the test computes independently.

**Projectile** (`projectile: three and four runs compared, a fifth refused, one dropped; later dials
change nothing`):

1. **Five runs, through Continue.** One setting changes before each new run:
   - 8 m/s, 45°, Earth;
   - 30°;
   - 6 m/s;
   - Mars;
   - 60°.

   The ranges are 7.069, 6.534, 3.992, 9.324 and 8.731 m.

2. **Three runs ticked by keyboard alone:** #3, #2, #1. The heading, legend ("#3 · v₀ 6 m/s ·
   θ 30 °"), table, trajectory and height–time overlays and the three range marks all match.
3. **A fourth, #5, ticked with the mouse:** four of everything, the marks at each run's own
   range.
4. **A fifth refused:** #4's box is disabled, with the title "Compare at most 4 runs.", and a
   forced click changes nothing.
5. **#2 dropped:** #3, #1 and #5 remain, in that order, each with its own data, and #4 becomes
   available again.
6. **Dials changed afterwards** (v₀ 10 m/s, Moon) and the results opened again. Every compared
   line's drawn points and sample count, every mark, the table and the legend are **identical**
   to before.

**Pendulum** (`pendulum: three and four runs on all four overlays; usable from 1280 down to
430 px`):

1. **Four runs at θ₀ 30°:**
   - L 1 m, Earth;
   - L 1.5 m;
   - L 0.5 m;
   - L 1 m, Mars.

   The periods are 2.041, 2.500, 1.443 and 3.319 s.

2. **Runs 1–3 compared:** the θ–t, ω–t, phase and total-energy overlays each have three lines,
   and the θ–t marks sit at each run's own exact period.
3. **Run 4 added:** four lines everywhere. The legend names what differs: "#4 · L 1 m ·
   g Mars".
4. **A fifth run STOPped mid-swing** (RESET, RUN, STOP):
   - it is listed with the `current` and `stopped` badges;
   - its box is disabled, titled "Only completed runs can be viewed and compared; export it as
     CSV.";
   - its CSV (`simlab-pendulum-run-005.csv`) downloads with "# Status: stopped at …" and
     "# Results: none (the run did not complete)".

   The 6C.3 report said this exclusion was tested at the UI level. In fact only the session and
   CSV sides had tests; this closes that gap.

5. **The narrow and short windows of §7**, with four runs compared.
6. **#2 dropped, then the dials set to L 3 m and the Moon:** the drawing, marks, table and legend
   are identical to before.

**Visual check** (1280×720, plus 1699×935 for the four-run projectile comparison):

- the legend stays readable when it wraps to two lines with four runs;
- the table columns align;
- the four run styles (colour plus dash) are distinguishable;
- no theory line or axis is clipped (the x range includes every mark);
- the objective box steps aside;
- the run list and buttons take clicks.

## 6. Escape and keyboard-only use

**Real Escape: BLOCKED for the release itself.** The test captures the mouse, then presses the
Escape key with `page.keyboard.press('Escape')`:

- the page receives `keydown Escape` (counted by a listener the test installs);
- no game state changes;
- **the pointer stays captured**: `document.pointerLockElement` is still set a second later.

Playwright sends keys through the DevTools protocol, which bypasses the browser's own native Esc
handling that releases pointer lock. This is therefore an automation-environment limit, not an
application defect:

- the app neither handles nor blocks Escape (it is not a bound key, so it is never
  `preventDefault`ed);
- in a real browser, releasing the pointer on Esc is the browser's job.

No app code was added just to make the synthetic key work. Releasing on a real Esc was not
verified by an automated test; it needs a person at the keyboard.

**Capturing the mouse again: PASS.** Once released, the HUD shows its "Click to look around" hint.
A click on the view captures the mouse again, the hint hides, and the next mouse move turns the
view by the expected 0.5 rad, read back from the game.

**Keyboard-only ticking: PASS.** With the mouse still captured:

- Tab moves through the run list (each row's checkbox, then its CSV button);
- Space ticks the focused run;
- after each tick, the keyboard focus returns to the same run's checkbox;
- three runs were ticked this way, and the comparison matched (§5).

**Keys and focus: PASS.**

- **With a ticked checkbox focused, game keys still reach the game.** F3 hid and showed the
  developer overlay, and S stepped the player back. This is the regression test for the 6C.3 fix
  to `BrowserInput.isTextField`.
- **A field that keeps its keys still does.** With the developer panel's scene list (a
  `<select>`) focused, W held for 0.4 s and ArrowDown moved the player 0 m, and ArrowDown changed
  the list's value.
- **The main menu's character choice (a radio group) keeps its arrow keys.** ArrowDown moves
  the selection to the second character. If radios were ever treated like checkboxes, the game
  would swallow the arrows and this test would fail.
- **The app has no text-entry fields,** so "text field" behaviour is exercised with the select
  and the radio group.

## 7. Narrow and short windows

**Policy.** SIMLAB is a desktop, first-person game: playing needs a keyboard and a mouse (pointer
lock), and it has no touch controls. Below 760 px wide the results panel stacks: the run list on
top, at most 40 % of the panel's height, and the results below it, each part scrolling on its
own. For widths below 760 px the closure tests check **graceful degradation, not a designed
phone experience**:

- the panel stays inside the window;
- nothing is cut off for good;
- every control can be scrolled to and used.

The game itself is not claimed as playable on a phone.

Measured in the pendulum test with **four runs compared** (the widest content), at each size:

| Size     | Panel inside the window | Run boxes and CSV buttons reachable | Table's last cell and last graph reachable | Mouse ticks a run | Objective hidden | Result   |
| -------- | ----------------------- | ----------------------------------- | ------------------------------------------ | ----------------- | ---------------- | -------- |
| 720×720  | yes                     | yes (all 8)                         | yes                                        | yes               | yes              | **PASS** |
| 600×720  | yes                     | yes                                 | yes                                        | yes               | yes              | **PASS** |
| 430×860  | yes                     | yes                                 | yes                                        | yes               | yes              | **PASS** |
| 1280×480 | yes                     | yes                                 | yes                                        | yes               | yes              | **PASS** |

At 430 px the main menu also fits the window and keeps its keyboard behaviour (§6).

**Screenshots** (`closure-5-pendulum-4-runs-*.png`, inspected):

- **720 and 600 px:** the stacked panel shows the run list on top (a few rows at a time,
  scrolling) and the results below, with the graphs one per row.
- **430 px:** the same layout at about 370 px of graph width; legends and labels stay legible.
- **1280×480:** the two columns remain, each scrolling within the 360 px panel height.

**One defect at 430 px.** The HUD hint ("Click to look around · WASD move · … · Esc release
mouse") was a single unbroken line wider than the window, cut off at both edges. It is the
instruction for getting the mouse back, so it now wraps (§9). The narrow-window loop asserts the
hint lies inside the window at every size. With the old rule restored, the test fails: the hint
starts at x = −58 px.

## 8. Visible-window benchmark

**Run: PASS** — `npm run bench`, all four projects (built before both CSS fixes of §9 — the dimmed fifth checkbox and the wrapping hint — which
change nothing it measures: its four-run view has no disabled box, and the hint fits at its sizes), 13 passed and 3 skipped, 7.5 min (13:47–13:55).

- **Safe to run:** before starting, the user had been idle 921 s (`GetLastInputInfo`), and no
  other test run was active.
- **Capture:** the visible `gpu` (1280×720) and maximized `gpu-native` (2548×1402 at pixel
  ratio 1.50) windows captured the mouse only while aiming. They were not interrupted and closed
  when done. No pointer lock was left behind.
- **Skipped by design:** the frame-rate sweep is `gpu-headless` only, so it is skipped on the
  other three projects.

**History closed vs open,** from the same stand point and view in each project (new: four runs
compared):

| Project (renderer)                         | Closed fps / GPU ms | 2 runs compared | 4 runs compared | Draws |
| ------------------------------------------ | ------------------- | --------------- | --------------- | ----- |
| `gpu` (RTX 5070 Laptop), 1280×720          | 222.6 / 2.41        | 223.7 / 2.35    | 223.9 / 2.42    | 62    |
| `gpu-native` (RTX 5070 Laptop), 2548×1402  | 223.2 / 2.45        | 224.3 / 2.51    | 222.8 / 2.45    | 62    |
| `gpu-headless` (RTX 5070 Laptop), 1280×720 | 225.1 / 2.35        | 223.7 / 2.41    | 226.7 / 2.33    | 62    |
| `software` (SwiftShader), 1280×720         | 45.6 / 18.76        | 43.5 / 18.77    | 44.9 / 18.74    | 62    |

- **CPU time:** 0.31–0.35 ms in every GPU row; 0.99–1.00 ms in software.
- **Opening the history, even with four runs compared, costs nothing measurable on the GPU:** the
  same fps, GPU time within noise, the same draw calls (the panel is DOM/SVG, not WebGL).
- **In software,** the comparison costs about 1 ms a frame (2–4 %), and the first frames after
  opening include one long frame: 250 ms with 2 runs, 90 ms with 4. Most likely this is the first
  rasterisation of the SVG overlay; the GPU runs have no such frame.

**The absolute rate changed, and not because of the code.** Every GPU scenario in this run
settled at about 220 fps (4.5 ms frames, GPU time 2.2–2.8 ms), including the projectile scenes,
whose code is unchanged. The headless 6C.3 bench at 13:19 had shown 300 fps (3.33 ms, GPU about
2.0 ms) for the same scenes.

- **Checked and ruled out:** AC power at 100 %, the "Turbo" plan, a 300 Hz display, and a 60 min
  display timeout.
- **The cause was not found.** It is uniform across all projects and scenarios, and the closure
  changed no rendering code (one CSS opacity line), so it is environmental. It does not affect
  the A/B above, which compares within each run.
- **Frame-rate sweep** (`gpu-headless`; divisors from the measured 224.5 fps base): identical
  results at every rate — T 4.526 s, R 16.001 m, 454 samples.

## 9. Defects found and fixed

| Defect                                                                                                                     | Found by                                | Fix                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| With four runs compared, the disabled fifth checkbox looked like an enabled one; the reason showed only as a hover tooltip | visual check of the four-run screenshot | `.results-run-box:disabled` dimmed to 0.35 opacity (`styles.css`); the E2E asserts it |

| At 430 px the HUD hint (how to get the mouse back) ran off both edges of the window | screenshot at 430×860 | `.hud-hint` sized to its content up to the window width less 32 px, wrapping when narrower (`styles.css`); the E2E asserts it stays inside the window at 720, 600, 430 px and 1280×480 |

No other defect was found. One test-order mistake of my own was corrected during the closure. The
projectile test stepped the player back with S, then reopened the monitor from 2.5 m, beyond the
2.2 m reach; the test now walks back to its stand point first. That was not an app defect.

## 10. New regression tests

| Test (`e2e/history.spec.ts`)                                                                                | Proves                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| projectile: three and four runs compared, a fifth refused, one dropped; later dials change nothing          | 3- and 4-run comparison end to end; the limit of four (disabled, dimmed, a click ignored); dropping keeps the rest intact; recorded runs unaffected by later dials (identical drawing); keyboard-only ticking; game keys with a checkbox focused                                                     |
| pendulum: three and four runs on all four overlays, a stopped run kept out; usable from 1280 down to 430 px | 3- and 4-run comparison on θ–t, ω–t, phase and energy with each run's own theory; a stopped run listed, exportable and never compared; the layout contract (panel and HUD hint inside the window, every control reachable) at 720, 600, 430 px and 1280×480; recorded runs unaffected by later dials |
| keys: Escape reaches the game, the mouse is captured again, a select keeps its keys                         | the real Escape key reaches the page and changes nothing; re-capture after release; a field that keeps its keys still does                                                                                                                                                                           |
| menu at 430 px: it fits the window, and its radio group keeps the arrow keys                                | the menu fits a narrow window; radio arrows are not swallowed by the game keys                                                                                                                                                                                                                       |

The benchmark's history scenario now also records four runs and measures four compared.

## 11. Final results

After the last code change:

| Command            | Result                                                        | Duration        |
| ------------------ | ------------------------------------------------------------- | --------------- |
| `npm run check`    | PASS — 280/280 unit tests, 25 files; typecheck, lint, format  | —               |
| `npm run test:e2e` | PASS — **17/17** (the 13 earlier specs + the 4 closure tests) | 4.3 min (261 s) |
| `npm run build`    | PASS                                                          | 0.24 s          |
| `npm run bench`    | PASS — 13 passed, 3 skipped by design (§8)                    | 7.5 min (449 s) |

- **Unit-test count:** unchanged, because the closure adds browser tests.
- **Closure tests alone:** projectile 1.3 min, pendulum 57 s, keys 3.3 s, menu 0.4 s.
- **No flaky results:** every E2E failure during the closure had a diagnosed cause (§9).

**The regression list of the brief, and what covers it** (all passing):

| Behaviour                                                              | Covered by                                                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| projectile and pendulum experiments                                    | `experiment.spec`, `pendulum.spec`, model and station unit tests                                                                 |
| STOP and RESET                                                         | `experiment.spec`, `pendulum.spec`, `RunHistory.test`, the pendulum closure test                                                 |
| incomplete runs excluded from comparisons                              | the pendulum closure test (new)                                                                                                  |
| history bounded to 20 per station, oldest first, never the current run | `RunHistory.test`                                                                                                                |
| historical records immutable                                           | `RunHistory.test`, `results.test`, both closure tests (identical drawing after the dials move)                                   |
| CSV deterministic, one row per recorded sample, from stored data       | `csv.test`, `history.spec` (two downloads identical; rows = the graph's samples)                                                 |
| New game, Continue and reload clear the history                        | `StationHistory.test` (Continue), `ExperimentSession.test` (a new playthrough forgets every session); a reload starts a new page |
| save format unchanged                                                  | `StationHistory.test` (no run data in the save); no `SAVE_VERSION` change                                                        |
| no unrelated changes or new dependencies                               | the reviewed diff (§13); `package.json` untouched                                                                                |

## 12. Build size

CSS 8.25 → 8.31 kB (the two rules above); JavaScript 806.27 kB and Rapier 4,332.82 kB
unchanged.

## 13. Files changed

- `e2e/history.spec.ts` — four closure tests and their helpers; the comment on why tests release
  the pointer programmatically.
- `e2e/physics-lab.bench.ts` — four runs in the history scenario, and a four-run measurement.
- `src/platform/ui/styles.css` — the dimmed disabled run checkbox, and the HUD hint that wraps in a
  narrow window.
- `docs/phase-6c3-closure-report.md` (this report), `docs/phase-6c3-report.md` (pointer to it),
  `docs/experiments.md`, `docs/development-guide.md`.

There are no new dependencies, no save-format change, and no change to `ExperimentSession`,
`RunRecord`, the models or the game loop.

## 14. Remaining limitations and risks

- **Real Esc releasing the pointer is not verified automatically.** Automated keys cannot reach
  the browser's own Esc handling (§6), so this needs a manual check with a real keyboard.
- **Narrow windows degrade gracefully but are not a supported way to play.** There are no touch
  controls; phone-sized windows are not a target.
- **The absolute GPU frame rate** fell from 300 to about 220 fps between two runs today, for
  reasons outside the code (§8). Its cause was not determined. The history A/B is unaffected.
- **The software first-open hitch** (one 90–250 ms frame when a comparison first appears) was not
  investigated further; GPU rendering does not show it.
- **Colours follow pick order.** Dropping a run moves the later runs into the freed colours; the
  legend and swatches always match the lines.

## 15. Commit

One commit, `phase 6c.3: close history interaction validation`, containing this report. Its hash
is given in the task summary, since a report cannot contain the hash of the commit that adds it.

Nothing was pushed: the repository has no remote.
