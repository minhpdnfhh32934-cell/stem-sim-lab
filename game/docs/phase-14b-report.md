# Phase 14B report — data analysis: a table of runs and a fitted line

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

## 1. Starting state and baseline

HEAD `632fe1d` (phase 14a), clean working tree, no remote.

| Baseline                                            | Result                                       | Duration |
| --------------------------------------------------- | -------------------------------------------- | -------- |
| `npm run check`                                     | **PASS**: 381/381                            | 19 s     |
| `npm run build`                                     | **PASS**                                     | 4 s      |
| `npm run test:e2e`                                  | **FAIL**: 22 passed, 5 failed, 4 did not run | 441 s    |
| the 5 failed tests again (`--project=dev`)          | **PASS**: 5/5                                | 158 s    |
| `npx playwright test --project=dev-timed --no-deps` | **PASS**: 4/4                                | 75 s     |

**The baseline failures were caused by this phase's work, not the baseline code.** While the
suite ran, `src/simulation/experiment.ts` and `ExperimentRuntime.ts` were edited (19:35); the dev
server reloaded the page, and the 5 tests running then found the game back in the main menu
("Phase: menu"). Run again with nothing edited — the two files then held only an optional schema
field and a check that no content used yet — all 5 passed, and so did the 4 timed tests that had
not run: all 31 pass on the baseline code. From then on nothing was edited while e2e ran.

## 2. Audit

- **`RunRecord`** already freezes everything an analysis needs, per run: its inputs (m, k, d, g,
  ζ, L₀), its results (m·g, L, Δl, m·g/Δl), its theory (k among them), its status and end reason.
  No schema, save or `SAVE_VERSION` change was needed; the analysis reads the records only.
- **Completed** runs have results; stopped and failed ones do not. A completed run ended either
  by the model (`model`) or at the time limit (`time-limit`); progression counts only the first.
- **History:** the last 20 runs per station (`RUN_HISTORY_LIMIT`), in memory, not saved.
- **CSV:** one file per run (`runCsv`), `#` metadata lines then samples; left unchanged.
- **Graphs:** one SVG `plot()` in `ResultsPanel` with nice axes (`plot.ts`); it drew polylines
  and vertical marks only, and now also draws points.

## 3. Design

- **`simulation/analysis.ts`** (no DOM, three.js or Rapier):
  - `fitLine(points)`: ordinary least squares y = a·x + b, intercept free, from sums about the
    means. Returns n, a, b, SSE, R² (null when every y is the same), the slope's standard error
    (null below 3 points) and the measured x range; or `too-few` (under 2 points) or `same-x`
    (every x equal, up to rounding). Non-finite points are left out.
  - `analysisRows(definition, records)`: one row per completed run, oldest first — its group
    value, its point, why it cannot be fitted (`time-limit`, `not-finite`) or null, and its
    table cells.
  - `analysisColumns`, `theorySlope` (the runs' own theory, null unless they agree).
- **Content:** an optional `analysis` block in an experiment definition — `x` and `y` (results),
  `group` (a parameter: one line per value), `columns`, and `slope` (label, symbol, unit, and the
  model prediction it is compared with). Checked at boot against the results, parameters, inputs
  and the model's predictions. Hooke's law has one; no code branches on the experiment.
- **UI** (`ResultsPanel`): an **Analyse the runs** button under the run list; the analysis view
  replaces the run view until **Back to the run** or a run is ticked. It is rebuilt only when the
  panel is drawn (a run ending, a tick, a choice), never per frame; while it shows, the panel no
  longer refreshes for a run in progress.
- **CSV:** `analysisCsv` and `analysisFileName` in `simulation/csv.ts`.
- Per-run m·g/Δl now has the symbol `m·g/Δl` instead of `k`, so that k means only the spring's.

## 4. The fit

a = Σ(x − x̄)(y − ȳ)/Σ(x − x̄)², b = ȳ − a·x̄, SSE = Σ(y − a·x − b)², R² = 1 − SSE/Σ(y − ȳ)²,
SE(a) = √(SSE/(n − 2)/Σ(x − x̄)²). No line below 2 points or when every x is equal; R² undefined
when every y is equal; SE undefined at 2 points, where the panel also says R² = 1 proves nothing.
The intercept is free because forcing it to 0 would hide an offset in the data by tilting the
slope. Nothing non-finite reaches the page or the CSV.

## 5. Interface

- **Group:** a spring chooser ("200 N/m (3 runs)"); the latest run's spring by default.
- **Table:** Fit (a checkbox per run), Run, m (kg), m·g (N), L₀ (m), L (m), Δl (m), m·g/Δl (N/m),
  values to 5 significant figures. A run that cannot be fitted is greyed with the reason; an
  unticked run is greyed. The table scrolls sideways inside the panel on a narrow window.
- **Graph:** the points used, the fitted line over the measured range only, and the theory line
  y = k_theory·x over the same range (dashed), with a legend; axes with symbols and units.
- **Fit:** points used (n of the group's), the equation, k_exp ± SE, b, R², k_theory, and
  k_exp − k_theory with its relative difference. No verdict or pass mark is given.
- **Note:** what least squares, b and R² mean and do not mean, and that k_exp, each run's m·g/Δl
  and k_theory are different quantities.
- **Messages:** no completed run; too few points; every x the same; two points.
- **Export the table and the fit as CSV.** All texts in English and Vietnamese.

## 6. Example (from the e2e, real runs of the model)

On 200 N/m, 0.5, 1 and 2 kg: Δl = 0.02451, 0.04902, 0.098039 m; each run's m·g/Δl = 200.12 N/m;
the fit through the three: k_exp ≈ 200.1 N/m, b ≈ 0 N, R² > 0.9999, against k_theory = 200 N/m
(+0.06 %). Every run ends once its oscillation is below 0.1 % of Δl, and the same small offset in
each run is what moves k_exp off k_theory. On 100 N/m one run: no line, and the reason.

## 7. Tests

- **Unit, 15 new** (`analysis.test.ts`):
  - the fit: an exact line with an intercept; a fit worked by hand (a, b, SSE, R², SE); under
    2 points; every x equal; non-finite points left out; two points; every y equal (R² null);
    far from the origin;
  - Hooke: rows mapped from records (m, m·g, L₀, L, Δl, m·g/Δl); springs kept apart, each slope
    near its own k and no common theory; k_exp told apart from each run's ratio and k_theory;
    stopped runs not listed, a time-limit run listed but not fitted; no run and one run;
  - CSV: rows with their included flag, the fit in `#` lines, no NaN; a missing value empty;
    no fit said.
- **E2E, 1 new** (`analysis.spec.ts`): four runs on two springs; the table and its values; fit,
  equation, k_exp, k_theory, R², points and lines on the graph; a run ticked out (two points),
  another (no line, with the reason) and back; the CSV and its included flags; the other spring
  as its own group; back to the run view, comparison and a run's CSV; a 430 px window with no
  horizontal overflow; no console error.

## 8. Verification

| Check                                            | Result                                    | Duration |
| ------------------------------------------------ | ----------------------------------------- | -------- |
| `npx vitest run src/simulation/analysis.test.ts` | **PASS**: 15/15, first run                | —        |
| `npm run check`                                  | **PASS**: 396/396 (381 + 15), 34 files    | 20 s     |
| `npm run build`                                  | **PASS**; entry chunk 881.59 → 896.56 kB  | 5 s      |
| `npx playwright test e2e/analysis.spec.ts`, 1st  | **FAIL**: the test expected a current run | 64 s     |
| `npx playwright test e2e/analysis.spec.ts`, 2nd  | **PASS**: 1/1                             | 59 s     |
| `npm run test:e2e`                               | **PASS**: 32/32 (31 + 1), first full run  | 416 s    |
| `git diff --check`                               | clean                                     | —        |
| Manual gameplay / real-GPU check                 | **NOT RUN**                               | —        |

The first analysis e2e failed in the test, not the app: every run there ends with RESET, so going
back shows "No current run", which the test had not expected.

## 9. Limitations

- The ideal model gives points almost exactly on a line: k_exp, each run's m·g/Δl and k_theory
  differ by about 0.06 %, so the analysis shows the method more than real scatter. There is no
  measurement noise, by design.
- Only Hooke's law has an analysis; the pendulum (T² against L) needs a T² result first.
- Ticks and the chosen group last while the scene is loaded and are not saved, like the runs.
- One analysis per experiment, one x and one y; no weighted fit or fit through the origin.
- The Vietnamese is unreviewed by a native speaker; checked on SwiftShader only.

## 10. Next step

Phase 14C, the spring's oscillation: the period against T = 2π√(m/k) and the decay of the swings,
from the samples each run already records — and an analysis of T² against m with the same module.
