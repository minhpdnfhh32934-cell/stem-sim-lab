# Phase 6C.5 report — results and desk-screen fixes

Two issues that predate 6C.4, and that its closure deferred, are fixed. Nothing else changes:
the measurement model, physics, `RunRecord`, the save format, the CSV, the history architecture
and the dependencies all stay as they were.

## 1. Baseline

- **Start:** `081cc46` "phase 6c.4: add scientific measurement uncertainty". The tree was clean
  (no stash, no remote).
- **Before any change:**

  | Command            | Result                         | Duration |
  | ------------------ | ------------------------------ | -------- |
  | `npm run check`    | PASS — 304/304 tests, 26 files | —        |
  | `npm run build`    | PASS                           | 0.27 s   |
  | `npm run test:e2e` | PASS — 19/19                   | 272 s    |

## 2. Issue A — "Read the results" with no current run

**Root cause.** `StationSystem` wrote one rule twice, in Phase 6B (`5f3af83`), before runs were
kept:

- **The guard:** the `view-results` action refused, with "No results yet: run the experiment
  first.", whenever there was no current run.
- **The command:** `case 'view'` returned early on the same condition.

Since 6C.3 keeps a history, this hid the kept runs once RESET cleared the current run, and the
refusal message was false.

**Fix.** One shared rule, `hasResults(session)`: a current run **or** a kept run. The guard and
the command both use it.

- **Nothing else changed:** the HUD and results panel already handled the case. Since 6C.3 the
  panel shows "No current run: set up the apparatus and press RUN, or tick a recorded run."
  with the run list.
- **With neither:** the existing refusal remains the empty state; no data is invented.
- **Checklist:** its "viewed" step still counts only a completed current run.

**Continue.** The history is session-only by design (6C.3), and the save format must not
change. After Continue there is therefore nothing to read, and the monitor refuses with its
reason (tested). The brief's "Continue → saved history remains accessible" cannot hold without
saving the history, which is out of scope. Within a session, history survives leaving and
returning (a scene change), and that is tested.

**Tests:**

- **`StationHistory.test.ts`** (the real game, headless, both stations):
  - refused before any run;
  - the current run read;
  - RESET: no current run, history intact, readable;
  - out to the hub and back: readable;
  - reading changes nothing;
  - after Continue: refused, at both stations.
- **`e2e/results-view.spec.ts`** (the real app, both stations, through Continue):
  - the prompt's refusal, and nothing opening, with no runs;
  - the panel on the current run;
  - after RESET, the panel with "No current run…" and the kept run, which ticks to `recorded`
    with its own reading;
  - after a reload and Continue, refused again.

## 3. Issue B — desk-screen overlap

**Root cause.** The desk's status screen is a canvas texture (`ExperimentView.paintStatus`), not
DOM or CSS. Text sat at fixed positions, without measurement:

- values at 14 of 100 units;
- the "(run: …)" note at 40;
- results labels at 56, and their values at 78.

So the note (22–32 units wide) ran into the results, and "Impact speed" (about 23 units) was
wider than its 22-unit slot. The layout dates from 6B (`93620e9`).

**Fix** (structural; no font size, row spacing or canvas size changed):

- **Results column from measured widths** (`resultsColumn`, pure):
  - values start a 2-unit gap after the widest label;
  - the column sits as far right as it fits, from 56 units;
  - it never moves into the settings column, whose measured end is tracked as it is drawn.
- **The "(run: …)" note leaves the rows:**
  - A dial turned since the run shown is drawn in amber.
  - The full-width footer names the run's own settings (`changedSettings`, pure), for example
    "The run shown used g Earth, d 0.01 m. RESET, then RUN with the new settings."
  - It wraps only at word boundaries, and no-break spaces keep each value with its unit.
  - While the dials differ, this replaces the footer's "Next: …" hint; the HUD objective box
    shows the checklist throughout.
- **Unchanged:** the 6C.4 d row, the dials, the buttons and the monitor.

**Window size.** The canvas has a fixed resolution and is a texture on a 3D plane, so the window
size does not change its layout, and no scrollbar can appear. The brief's 430×860 and 360 px
checks are about the DOM. The results panel and its history rows are unchanged, and their narrow
layouts are covered by the 6C.3 closure tests. The screens were still captured at the three
sizes (§4).

**Tests:**

- **`results.test.ts`** checks the measured results column with generous glyph widths (0.6 em;
  measured ≈ 0.45–0.48 em):
  - values after the widest label, inside the margin, and clear of the settings;
  - the old place when the results are short or absent;
  - footer settings that are the run's own, not the dials'.
- **Visual:** `results-view.spec` saves both desk screens in their busiest state (g and d turned
  after a completed run) at 1280×720, 1699×935 and 430×860.

**Mutation checks** (scratch script, files restored after each): **6/6 caught**:

- the guard back on the current run only; the command back on it; the history ignored;
- the fixed 22-unit label slot; a column allowed over the settings;
- the footer naming the dials instead of the run.

## 4. Visual verification

Inspected screenshots from `results-view.spec` in the real app (software WebGL). The desk screens
were captured at 1280×720, 1699×935 and 430×860, and also enlarged. The panel was captured after
RESET.

| Check                              | Result                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| "Impact speed" and its value       | **PASS**: "Impact speed 8.693 m/s" with a clear gap; all results labels are clear of their values                                             |
| "(run: …)" note                    | **PASS**: gone from the rows; turned dials in amber; the footer names the run's settings on two lines                                         |
| no overlap or clipping             | **PASS**: the pendulum's six setting rows clear the footer (small gap, unchanged from 6C.4); the footer's second line stays inside the screen |
| units with values                  | **PASS**: "3.71 m/s²", "0.001 s", "g Earth", "d 0.01 m" never split                                                                           |
| 6C.4 resolution row                | **PASS**: "d 0.001 m" and "d 0.001 s" in place                                                                                                |
| dials and RUN, STOP, RESET         | **PASS**: unchanged on both desks                                                                                                             |
| history rows and panel after RESET | **PASS**: the kept run listed, ticked and read as recorded with its own d and reading                                                         |
| window sizes                       | **PASS**: the same layout at all three sizes (fixed-resolution texture); no DOM change                                                        |

## 5. Final verification

Run on the committed tree (after the last code change, a behaviour-neutral rename whose build is
byte-identical: same bundle hash):

| Check                                        | Result                                                                              | Duration |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| `npm run check`                              | **PASS**: 308/308 unit tests (304 + 4 new), 26 files; typecheck, lint, format       | —        |
| `npm run test:e2e`                           | **PASS**: 21/21 (the 19 earlier tests and the 2 of `results-view.spec`), 3 workers  | 305 s    |
| `npm run build`                              | **PASS**: JS 812.51 kB (6C.4: 812.03), CSS 8.38 kB and Rapier 4,332.82 kB unchanged | 0.27 s   |
| mutation checks                              | **PASS**: 6/6 caught                                                                | —        |
| `npm run bench` (`gpu-headless`, `software`) | **PASS**: 7 passed, 1 skipped by design (§6)                                        | 254 s    |
| bench `gpu`, `gpu-native`                    | **NOT RUN**: visible windows that capture the physical mouse                        | —        |

## 6. Performance

**No per-frame cost was added.** The desk screen is repainted only when its station changes
(10 times a second during a run, as before). A repaint now measures about ten strings. The
monitor and the results panel are untouched.

`npm run bench -- --project=gpu-headless --project=software`: **PASS, 7 passed, 1 skipped by
design** (the frame-rate sweep runs on the GPU only), 254 s.

**GPU** (`gpu-headless`, RTX 5070 Laptop, D3D11, 1280×720), unchanged from 6C.4:

| Scenario                                     | fps   | CPU mean (ms)             | GPU mean (ms)             | Draws (6C.4)             |
| -------------------------------------------- | ----- | ------------------------- | ------------------------- | ------------------------ |
| range: idle / interacting / running / landed | 300.0 | 0.36 / 0.34 / 0.36 / 0.38 | 2.03 / 1.99 / 2.12 / 2.12 | 73 / 66 / 74 / 76 (same) |
| pendulum: idle / swinging / after            | 300.0 | 0.41 / 0.46 / 0.41        | 2.04 / 2.06 / 2.09        | 84 (same)                |
| history: closed / 2 / 4 runs compared        | 300.0 | 0.31 / 0.31 / 0.30        | 2.01 / 2.05 / 2.03        | 64 (same)                |

The frame-rate sweep was identical at all seven rates: T 4.526 s, R 16.001 m, H 4.448 m,
v 5.188 m/s, 454 samples. Watching took 4.94–5.04 s at 10 fps and above, and 9.23 s at 5 fps.

**Software** (`software`, SwiftShader), fps:

| Scenario                                     | 6C.5, run 1               | 6C.5, run 2               | baseline `081cc46`, same session | 6C.4 report (earlier day) |
| -------------------------------------------- | ------------------------- | ------------------------- | -------------------------------- | ------------------------- |
| range: idle / interacting / running / landed | 43.5 / 38.0 / 34.6 / 43.5 | 44.5 / 39.0 / 33.4 / 42.6 | 45.2 / 38.7 / 34.5 / 43.7        | 56.6 / 46.2 / 43.0 / 53.0 |
| pendulum: idle / swinging / after            | 46.1 / 39.7 / 46.6        | 45.1 / 39.3 / 46.0        | 45.0 / 39.5 / 45.8               | 55.7 / 49.0 / 56.1        |
| history: closed / 2 / 4 compared             | 46.5 / 44.6 / 45.8        | 45.9 / 45.1 / 46.3        | 46.0 / 45.0 / 46.1               | 55.9 / 54.7 / 55.4        |

**Diagnosis of the lower software numbers.** They were lower than the 6C.4 report's in every
scenario, including idle, where 6C.5's code does not run per frame. So the baseline `081cc46` was
built in a temporary git worktree, outside the repository (removed afterwards; only `main`
remains), and benched in the same session. It gave the same numbers. The difference is the
machine's state today: SwiftShader rasterises on the CPU, and the "GPU" time went from 15 to
19 ms in both builds. It is not this change. The long first frame when a comparison opens
(200–247 ms) is the one already seen in 6C.3 and 6C.4.

## 7. Invariants and scope

- **Unchanged:**
  - the measurement model (`simulation/measurement.ts`) and every 6C.4 measurement test;
  - the physics models (`simulation/models`);
  - `RunRecord`;
  - `SAVE_VERSION` 2 and `src/persistence`;
  - the CSV;
  - `package.json`.
- **d still never reaches the physics.** The guard against a model reading it is unchanged and
  still tested.
- **Diff scope:**
  - the history-view rule (`StationSystem.ts`, 2 call sites and 1 helper);
  - the desk-screen painter (`ExperimentView.ts`) and two pure helpers (`results.ts`);
  - their tests, the new E2E spec;
  - docs (this report, a pointer in the 6C.4 report's two follow-ups, `experiments.md`,
    `development-guide.md`, `README.md`).

## 8. Limitations

1. **History after Continue.** The history is session-only (6C.3, by design), so after Continue
   "Read the results" refuses until a new run. Keeping runs across a save would be a save-format
   change, which is out of scope.
2. **The footer note replaces the checklist hint while the dials differ from the run shown.**
   The HUD objective box still shows the checklist step.
3. **At small windows the in-world screen is small.** At 430×860 the layout is intact but the
   text is small, as for any 3D screen seen from the desk. That is distance, not layout.
4. **Glyph widths in the unit test are an estimate** (0.6 em, generous). The real check is the
   screenshots; the code itself measures with the browser's font.
5. **Bench:** the visible-window `gpu` and `gpu-native` projects were not run (they capture the
   physical mouse); see §6.

## 9. Commit

One commit on local `main`, `phase 6c.5: close results and desk-screen UX issues`, with parent
`081cc46` and this report. The hash is in the task summary, since a report cannot contain the
hash of the commit that adds it. Nothing was pushed: the repository has no remote.
