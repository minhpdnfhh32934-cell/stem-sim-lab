# Phase 14D report — the spring laboratory validated

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase 14d.

Verdict: **PASS WITH LIMITATIONS** — modes A–E checked against the physics, four defects fixed with
regression tests, check / build / full e2e pass; manual play was a scripted browser session, and
the real GPU was checked for one run, not for the swing seen on screen.

## 1. Starting state and baseline

HEAD `5649bbb` (phase 14c), clean working tree, nothing staged or untracked.

| Baseline                                          | Result                                       |
| ------------------------------------------------- | -------------------------------------------- |
| `npm run check`                                   | **PASS**: 410/410, 35 files                  |
| `npm run build`                                   | **PASS**; entry chunk 914.72 kB              |
| `npm run test:e2e`                                | **FAIL**: 28 passed, 1 failed, 4 did not run |
| `oscillation.spec` alone, again (`--project=dev`) | **FAIL** again, same line                    |

The failure was `oscillation.spec.ts:128`: the page 850 px wider than the 430 px window. A probe
(§4) showed `innerWidth` 430 but the canvas still 1280 px wide right after `setViewportSize`, and
no overflow 100 ms later: the renderer follows the window's `resize` event a moment later under
software WebGL, and the test measured at once. A test race, not a layout fault (it passed in 14C
by timing). The known STOP race at `experiment.spec.ts:51` did not occur in either full run.

## 2. Audit, modes A–E

The model and measurement were read against the conventions (downward positive; x from L₀;
Δl = m·g/k; y = x − Δl; v = y′; pull −k·x, size k·x shown; m·y″ + c·y′ + k·y = 0;
c = 2ζ√(km); ω₀, T₀, ω_d, T_d) — all as stated. Copies of the model and `measureOscillation`
were then run over **every preset combination the stand allows** (1086 of 2592; the rest refused):
none reached the 60 s limit (slowest 24.9 s), none passed Δl ± |y₀|, ζ = 1 and 2 never crossed
rest. ζ = 0.05, 0.1: always measurable; ζ = 0.2: 137 of 140 (3 heavy loads with y₀ = 0.02 m reach
rest, 0.1 % of Δl, before a third peak); ζ = 0.5: never (one peak above 2 % of the swing).

| Mode               | Checked                                                                                                                                                                | Result               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A statics          | at rest at once (t = 0.001 s), Δl 0.245 m, k 20.000 N/m; refusals elastic (0.69 m > 0.60 m) and slack, station left configured; the panel showed a swing table — fixed | **PASS** after fix 3 |
| B free oscillation | held at Δl + y₀; y, v, graphs one frame; under/critical/over damped; ends by the model only; STOP stopped, not completed, no progress; ζ = 0 not offered (known)       | **PASS**             |
| C period           | from samples, − to + crossings interpolated, whole cycles only, T vs T_d vs T₀ apart, no 0 division; ζ = 0.2: T 1.0133 s, T_d 1.0139 s (−0.06 %); wording — fixed      | **PASS** after fix 2 |
| D decay            | peaks from samples, about rest, floor 2 %, σ 1.267 vs 1.265 1/s, ζ 0.200, "not measured" below 3 peaks; the theory curve beside the peaks was wrong — fixed            | **PASS** after fix 1 |
| E T² against m     | grouped by k and ζ; damped T against k(1 − ζ²); 199.58 vs 199.5 N/m; no NaN in CSV; 4π²/a from any non-zero slope — fixed                                              | **PASS** after fix 4 |

## 3. Defects fixed

1. **Theory curve beside the peaks.** The panel drew |y₀|/√(1 − ζ²)·e^(−ζω₀t) as "theory envelope"
   with the measured peaks and their fit. Released from rest, y′ = 0 at t = nπ/ω_d, where
   |y| = |y₀|·e^(−ζω₀t) exactly: the peaks lie on that curve, and the touching envelope is
   1/√(1 − ζ²) higher (2.1 % at ζ = 0.2, 15 % at 0.5). Evidence: the fit's A₀ = 0.09994 m against
   |y₀| = 0.1 m and the old curve's 0.10206 m. Fix: `envelope0` = |y₀|, legends "fitted / theory
   through the peaks", the note explains both curves. Model unchanged.
2. **Reference frame in words.** The Vietnamese note said the period is timed when the mass goes
   **up** through rest ("đi lên") and a peak is its **highest** point; with y downward the code
   times y going − → + (the mass moving down) and its peaks are maxima of y (the mass at its
   lowest). English "upward crossing", "top" were ambiguous the same way; the CSV line too. Fixed
   in EN, VI and CSV. "Not measured" now says what gives more swings (smaller ζ, larger |y₀|).
3. **A static run shown as a swing.** A run held at rest (y₀ = 0) got the oscillation table with
   T_d, ζω₀ and "fewer than 2 whole swings". Now: "No swing … a static measurement" only (when
   the samples never leave rest, `floor` = 0).
4. **4π²/a from a slope ≤ 0.** Panel and analysis CSV computed it for any non-zero slope, so a
   falling or flat line would give a negative or infinite stiffness. Now "not defined" unless
   a > 0. Not reachable with model data inside one group; a guard the analysis asked for.
5. **Test race** (§1): `oscillation.spec.ts` polls the overflow after resizing.

## 4. Files

| File                                                                      | Change                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| `src/simulation/models/spring.ts`                                         | `envelope0` = \|y₀\|, its doc                  |
| `src/platform/ui/ResultsPanel.ts`, `src/content/strings.json`             | fixes 1–4 in the panel, EN and VI              |
| `src/simulation/csv.ts`                                                   | crossing wording; derived only for a > 0       |
| `src/simulation/models/spring.test.ts`, `src/simulation/analysis.test.ts` | regression tests                               |
| `e2e/oscillation.spec.ts`, `e2e/analysis.spec.ts`                         | resize poll, new legend; the static run's note |
| `docs/experiments.md`, this report                                        | documentation                                  |

No save format change, no new dependency, no new feature. CSV columns unchanged; the theory line
`# Theory envelope0` now holds |y₀|, and two `#` lines are reworded.

## 5. Tests

- `spring.test.ts`: `envelope0` = |y₀|; the peaks' fitted A₀ within 0.2 % of it for ζ = 0.1, 0.05,
  0.2 — fails on the old value (2 tests failed when it was put back; checked, then restored).
- `analysis.test.ts` (new): a falling and a flat line give "not defined (a <= 0)", no `/ a =`,
  NaN or Infinity in the CSV.
- `analysis.spec.ts`: run 4 (held at rest) ticked: the note, no oscillation table.
- `oscillation.spec.ts`: overflow polled; the Vietnamese legend "Lý thuyết qua các đỉnh".

| Check                                                              | Result                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `npm run check`                                                    | **PASS**: 411/411, 35 files                                                                           |
| `npm run build`                                                    | **PASS**; entry 916.29 kB                                                                             |
| `npx playwright test` oscillation, hooke, analysis `--project=dev` | **PASS** 3/3 (analysis after one fix of my new assertion: the spec RESETs, so the run must be ticked) |
| `npm run test:e2e`                                                 | **PASS**: 33/33, first run, no retry, 7.2 min                                                         |
| `git diff --check`                                                 | clean                                                                                                 |

The build's "chunks larger than 500 kB" warning predates this phase.

## 6. Browser and GPU

- **Scripted play, SwiftShader** (a throwaway Playwright script, not in the repo, the game's own
  Continue path, no scene jump): A (y₀ = 0), B ζ = 0.2 (y₀ = ±0.1 m), ζ = 0.5, ζ = 1, both
  refusals, RUN then STOP (state `stopped` at t = 1.42 s, nothing marked completed), T² against m
  over two runs, and a 430 px window (panel x 16–414 px, no overflow once the canvas follows). No
  console errors. Numbers in §2.
- **Real GPU**: the desktop app's browser pane reports `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070
Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)`. The Physics Lab at 140–300 fps; the stand, ruler
  and the mass held below rest drawn; the same run (0.5 kg, 20 N/m, y₀ 0.1 m, ζ 0.2) completed by
  the model at t = 4.795 s, k 20.006 N/m — identical to SwiftShader; no console error. The camera
  faced the desk during the run: **the swing itself was not watched on the GPU**, and no frame
  times were measured (`npm run bench` not run).
- The pane's profile now holds the test save used for this.

## 7. Limitations and next step

- Not watched by a person: the swing on a real GPU, the camera, the 3D spring under motion.
- Peaks and crossings are counted on one side of rest only: at ζ ≥ 0.3 (preset 0.5) nothing is
  measurable, and the panel says so. Using both sides would double the data — a feature, not done.
- A run ends at 0.1 % of Δl, not of |y₀|: a small y₀ on a heavy load gives few swings.
- The elastic check uses Δl + |y₀| even for y₀ < 0, where the first lowest point is lower:
  cautious, and the message says "could".
- `analysis.spec.ts` measures its 430 px overflow after a click; the same race is possible there.
- Vietnamese unreviewed by a native speaker.

Next: watch the swing on the GPU by hand (stand at the desk, RUN with ζ 0.1, look at the stand),
then `npm run bench`; then the next mechanics lab.
