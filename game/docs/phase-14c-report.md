# Phase 14C report — the spring laboratory completed

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

## 1. Starting state and baseline

HEAD `e0e8092` (phase 14b), clean working tree, no remote: Phase 14B was committed, nothing of it
was pending.

| Baseline           | Result            | Duration |
| ------------------ | ----------------- | -------- |
| `npm run check`    | **PASS**: 396/396 | 19 s     |
| `npm run build`    | **PASS**          | 4 s      |
| `npm run test:e2e` | **PASS**: 32/32   | 413 s    |

Nothing was edited while the baseline e2e ran.

## 2. Audit and scope

| Mode                      | Before this phase                                          | Added                                                                                       |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A — statics, Hooke's law  | k = m·g/Δl at rest; elastic limit on the first swing       | y₀ = 0 holds the mass at rest (a static measurement); limit and slack checks on Δl ± \|y₀\| |
| B — free oscillation      | released from the natural length; ζ = 0.1 fixed            | start y₀ from rest and damping ζ on two new dials; y and v recorded                         |
| C — period against theory | none                                                       | T measured from the samples over whole swings, against T_d and T₀                           |
| D — decay                 | none                                                       | peaks, ln A against t fitted (σ), logarithmic decrement and ζ, envelopes                    |
| E — T² against m          | 14B fitted one analysis, results only, one parameter group | several analyses, groups of several parameters, quantities measured from samples, `derived` |

Left out: an initial velocity v₀ (a third new dial for little teaching gain; release from rest is
the lab procedure), and an undamped run (ζ = 0 never comes to rest, so a run could not end by
itself; the model handles it and the unit tests use it).

## 3. Model and conventions

`mechanics.spring`, SI, downward positive, the spring's top fixed: x the extension from L₀;
Δl = m·g/k the rest extension; y = x − Δl the displacement from rest (its own variable); v = x′.
m·x″ + c·x′ + k·x = m·g, that is m·y″ + c·y′ + k·y = 0, c = 2ζ·√(k·m), held at y₀ and let go at
rest. The spring's pull on the mass is −k·x; the force graph shows its size k·x. Theory: Δl, L,
k, the start Δl + y₀, the bounds Δl ± |y₀| (the swing's energy never grows), T₀ = 2π√(m/k), and
for ζ < 1 T_d = 2π/(ω₀√(1 − ζ²)), the decay rate ζω₀, the envelope |y₀|/√(1 − ζ²)·e^(−ζω₀t), the
slope 4π²/(k(1 − ζ²)) of T_d² against m and k(1 − ζ²); none of these for ζ ≥ 1. Semi-implicit
Euler on the fixed 1 ms step (unchanged). A run ends by itself at rest (swing under 0.1 % of Δl);
STOP and the time limit (now 60 s) never count as completed.

## 4. Measuring the swing

`simulation/oscillation.ts` (pure): from a run's recorded `displacement` samples (every 10 ms of
simulated time). Upward crossings of rest, interpolated between samples; the period over whole
swings between the first and last, from 2 swings up. Peaks: maxima above rest, refined through
their three samples. Swings under 2 % of the largest are left out, crossings too. Decay: ln A
against t fitted with the shared `fitLine` (moved to `simulation/fit.ts`, re-exported by
`analysis.ts`), σ = −slope, from 3 peaks up; δ = σ·T, ζ = δ/√(4π² + δ²). Each part gives a reason
when the data cannot.

## 5. Interface

- Desk: five dials (m, k, d, y₀, ζ), the buttons moved right, a taller desk display for seven
  rows. The mass is drawn held at Δl + y₀ before RUN.
- Refusals with reasons: beyond the elastic limit ("could stretch it to … m (… at rest)") and a
  swing that would slacken the spring.
- Results panel of an ended run: "The swing, measured from the samples" — T over n whole swings,
  T_d and T₀ (theory, named as such), T − T_d, the peaks read, σ against ζω₀, ζ from the decrement
  against the ζ set; a graph of the peaks with the fitted and the theory envelope; a note on the
  method and on what agreement on an ideal model does and does not show.
- Analysis: a chooser between "Weight against extension at rest" and "Period squared against
  mass"; groups "k 200 N/m · ζ 0.05"; 4π²/a with its standard error against k(1 − ζ²), and a note
  that the measured period is the damped one.
- Graph y–t, compared across runs. A run's CSV adds `displacement_m`, `velocity_m_s` and
  `# Oscillation` lines; no existing column changed. Everything in English and Vietnamese.

## 6. Files

| File                                                                                                             | Change                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/simulation/models/spring.ts`                                                                                | y₀, ζ as inputs; y; bounds, T₀, T_d, decay and slope predictions   |
| `src/simulation/oscillation.ts` (new), `fit.ts` (new), `analysis.ts`                                             | measuring the swing; the fit on its own; analyses, groups, derived |
| `src/simulation/experiment.ts`, `ExperimentRuntime.ts`, `csv.ts`                                                 | `analyses`, `oscillation` schema and checks; the CSVs              |
| `src/gameplay/experiment/StationSystem.ts`                                                                       | slack refusal; the held position in the view                       |
| `src/platform/render/ExperimentView.ts`, `ui/ResultsPanel.ts`                                                    | the held mass; the swing section; several analyses                 |
| `src/content/experiments.json`, `items.json`, `rooms.json`, `strings.json`                                       | dials, display, texts EN/VI                                        |
| tests: `oscillation.test.ts` (new), `spring.test.ts`, `analysis.test.ts`, `HookeStation.test.ts`, `hold.test.ts` | §7                                                                 |
| e2e: `oscillation.spec.ts` (new), `hooke.spec.ts`, `analysis.spec.ts`                                            | §7                                                                 |
| `docs/experiments.md`, `README.md`, this report                                                                  | documentation                                                      |

## 7. Tests

- `oscillation.test.ts` (7, new), on exact known motions: period and decay of a damped swing
  (T to 1e-4, σ to 1e-3), about any rest value, undamped (no decay), too short (< 2 swings, < 3
  peaks), no swing and no data, the floor, a NaN in the data.
- `spring.test.ts` (14, rewritten for the new inputs): statics; bounds; T₀, T_d, ζω₀, the slope
  and none for ζ ≥ 1; the acceleration; a run swings about rest, smaller each time, and rests; the
  measured period within 0.2 % of T_d and σ, ζ within 2 % for three setups; critical and
  overdamped never cross rest; y₀ = 0 at rest at once; rest within 0.1 % from the lightest to the
  heaviest load; undamped keeps its swing; never past Δl ± |y₀|; time-step independence; samples
  on F = k·x; no 0/0.
- `analysis.test.ts` (18): the fit as before; the Hooke rows; T² against m fitted from the
  measured periods, 4π²/a within 0.5 % of k(1 − ζ²); springs and dampings never fitted together;
  a run held at rest or overdamped gives no period and no invented point; the CSVs.
- `HookeStation.test.ts` (9): the held position; the five dials; a swing to rest; the same results
  and samples at 30 and 144 fps; STOP and RESET back to y₀; both refusals; two springs; the save
  keeps y₀ and ζ. `hold.test.ts`: 69 entities (two new dials).
- E2E: `oscillation.spec.ts` (new, in Vietnamese): three runs, the swing section (T against T_d
  within 0.5 %, the theory T_d shown, T₀ shorter, peaks and envelopes), T² against m (4π²/a within
  1 % of k(1 − ζ²)), a 430 px window, no console error. `hooke.spec.ts` and `analysis.spec.ts`
  updated to the new desk and start, with the swing section checked in the first.

## 8. Verification

| Check                                                                | Result                                       | Duration |
| -------------------------------------------------------------------- | -------------------------------------------- | -------- |
| `npm run check`                                                      | **PASS**: 410/410, 35 files                  | 19 s     |
| `npm run build`                                                      | **PASS**; entry chunk 896.56 → 914.72 kB     | 4 s      |
| `npx playwright test` oscillation, hooke, analysis (`--project=dev`) | **PASS**: 3/3, first run                     | 72 s     |
| `npm run test:e2e`                                                   | **FAIL**: 28 passed, 1 failed, 4 did not run | 365 s    |
| `experiment.spec.ts:51 --project=dev`, again                         | **PASS**: 1/1                                | 113 s    |
| `npx playwright test --project=dev-timed --no-deps`                  | **PASS**: 4/4                                | 73 s     |
| `git diff --check`                                                   | clean                                        | —        |
| Manual gameplay / real GPU                                           | **NOT RUN**                                  | —        |

**The full e2e failure** was the projectile test's STOP step again — the 3.3 s Moon flight
completed (t = 3.307 s) before STOP took effect — the timing race the 6F and 14A reports
document under SwiftShader, at the projectile station, which this phase did not touch. Run alone
it passed, and so did the 4 timed tests that had waited on it: 33 of 33 pass. The build's
"chunks larger than 500 kB" warning was there before this phase.

The first full check failed on two lint errors in the new code (a non-null assertion, an
unnecessary template literal), fixed. The 18 unit tests that failed after the model changed were
the old ones encoding the old start (release from the natural length) and the old 14B API; they
were rewritten to the new behaviour, none was dropped or loosened.

## 9. Limitations

- An ideal model: agreement with the theory checks the numerics, not a real spring.
- No initial velocity; no undamped run; the elastic and slack checks use the bounds Δl ± |y₀|,
  exact for y₀ ≥ 0 and cautious for a start above rest.
- Light masses on stiff springs ring at 0.1 s periods in real time.
- One ζ for the whole spring; damping is viscous and the same ratio for every load.
- Swing measurements are computed when the panel is drawn, not stored in the record; they are
  recomputed from the record's own samples, so they never change.
- Vietnamese unreviewed by a native speaker; checked on SwiftShader only.

## 10. Next step

Other mechanics on the same footing: Newton's second law on a cart (F = m·a by the same fit), or
friction on an inclined plane — and the pendulum's T² against L with this analysis.
