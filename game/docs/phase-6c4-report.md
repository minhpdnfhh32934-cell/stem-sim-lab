# Phase 6C.4 report — measurement uncertainty

Each experiment now has a measuring instrument with a resolution d set on the control desk:

- **Projectile:** a tape measure reads the range R.
- **Pendulum:** a timer reads the period T.

A completed run gets a **reading** (the simulated value rounded to the nearest multiple of d)
and two numbers about it:

- **Standard uncertainty u = d/√12**, from the resolution alone.
- **The bound d/2**, the largest rounding error.

These sit beside the **theory** and the **simulated value**, which are unchanged and never
rounded. Each run keeps its own d, so its history record, comparison and CSV show that run's
own reading and u.

```
dials (v₀, θ, g · L, θ₀, g)  ─► model ─► simulated value (unrounded, the true value here) ─┐
dial d (instrument)  ── never reaches the model ───────────────────────────────────────────┤
                                                    reading = nearest multiple of d ◄──────┘
                                                    u = d/√12 · bound d/2
```

## 1. Baseline

- **Start:** `aab4bb5` "phase 6c.3: close history interaction validation". The working tree
  was clean (no changes, no untracked files, no stash). The repository has no remote.
- **Read before the design:** `docs/phase-6c3-report.md` and
  `docs/phase-6c3-closure-report.md`. Also the experiment and simulation code:
  - definition schema, runtime, session, `RunRecord`, CSV;
  - results model and panel;
  - station system, desk screen, behaviours;
  - content.
- **Baseline results, before any change:**

  | Command            | Result                         | Duration        |
  | ------------------ | ------------------------------ | --------------- |
  | `npm run check`    | PASS — 280/280 tests, 25 files | —               |
  | `npm run build`    | PASS                           | —               |
  | `npm run test:e2e` | PASS — 17/17                   | 4.4 min (264 s) |

## 2. Definitions and assumptions

| Quantity                   | Meaning here                                                           | Source                                    |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| theory                     | the model's closed form for the run's own inputs                       | `predict`, frozen in the record (6C.3)    |
| simulated value            | the run's result; **taken as the true value of the measured quantity** | the runtime; never rounded or overwritten |
| reading                    | the simulated value as an instrument of resolution d displays it       | `quantize(simulated, d)`                  |
| standard uncertainty **u** | the standard deviation of the reading's rounding error, from d alone   | `resolutionUncertainty(d)` = d/√12        |
| bound                      | the largest possible rounding error                                    | `resolutionBound(d)` = d/2                |

**What is measured.** One quantity per experiment (the schema takes a list):

| Experiment | Measured quantity      | Instrument          | d presets (dial)         |
| ---------- | ---------------------- | ------------------- | ------------------------ |
| projectile | range R, m (`range`)   | tape measure        | 0.001 · **0.01** · 0.1 m |
| pendulum   | period T, s (`period`) | timer (period mode) | 0.001 · **0.01** · 0.1 s |

- **v₀, θ, g, L and θ₀ are not measured.** They are the inputs the player sets. Giving them
  readings would treat a set value as an observation.
- **Flight time, maximum height, impact speed and amplitude are not read.** Pushback: one
  measured quantity per experiment shows the whole model. Each extra one needs its own
  instrument dial, and more panel and CSV space, without adding a new idea. The schema and code
  take any number, so adding one is a content change (tested with lists in
  `measurement.test.ts`).
- **Pendulum: the exact period and the small-angle period stay separate.**
  - The two rows of the results table are unchanged, one against T₀ = 2π√(L/g) and one against
    the exact T = 4√(L/g)K(sin(θ₀/2)).
  - Both rows share one simulated period, and the timer reads that one value once.
  - The gap between the small-angle T₀ and the period is the small-angle approximation: a
    **model error** (1.7 % at 30°), not measurement uncertainty, and it is not mixed into u.
  - Example at L 1 m, 30°: T − T₀ = 0.0349 s. That is 1.2 u at d = 0.1 s, where the timer cannot
    tell the two theories apart, and 121 u at d = 0.001 s. This is an observation for the
    reader; no verdict is computed.

**Assumptions** (shown in the panel and the CSV):

1. **The simulated value is the true value.** It does not hold exactly, but the error is far
   below every d offered:
   - **Range:** the model is exact to floating point (exact constant-acceleration steps, floor
     contact solved within the step).
   - **Period:** within 10⁻⁷ s of the exact theory (RK4 at 1 ms, interpolated zero crossings;
     the model tests require 5·10⁻⁸ s).
2. **The instrument rounds to the nearest mark.** It does not truncate.
3. **Rectangular distribution.** With nothing known about where the true value lies within
   ±d/2 of the reading, every position is taken as equally likely.
4. **Resolution only.** u is not the total uncertainty of a real measurement (§5).

## 3. Equations and units

**Reading** (`quantize`). For a value x and a resolution d > 0:

```
n = ⌊ |x|/d + 1/2 + 10⁻⁹ ⌋          r = sign(x) · n · d   (shown with d's decimal places)
```

- **Ties go away from zero.** Exactly half-way rounds up in magnitude, so −x always reads as
  −r(x).
- **The 10⁻⁹-step tolerance** keeps binary rounding from moving a decimal tie. 1.005 is stored
  as 1.00499999999999989…, so 1.005/0.01 = 100.49999999999999 and naive rounding would read
  1.00 instead of 1.01. Only values within a billionth of a step of half-way are affected.
- **The reading is the double nearest the decimal shown:** `Number((n·d).toFixed(dec(d)))`.
  For example 0.3, not the 0.30000000000000004 that 3 × 0.1 gives. A zero reading is +0,
  never −0.
- **Decimal places of d** are taken from d as written: 0.001 → 3, 0.25 → 2, 5 → 0, 1e-7 → 7.

**Standard uncertainty.** If the rounding error e = r − x is uniform on [−d/2, d/2], then
Var(e) = (1/d)∫ e² de = d²/12, so

```
u = d/√12 ≈ 0.2887 d        (0.00029 · 0.0029 · 0.029 for d = 0.001 · 0.01 · 0.1)
```

u is reported to two significant digits ("0.0029 m"). Rounding up a decade keeps two digits
("0.0010"), and large values never switch to exponent notation ("290").

**Bound.** |e| ≤ d/2, reported separately as "Largest rounding error d/2". It is never called
u, and never written as "±" next to the reading, where it could be taken for a coverage
interval.

**Units.**

- The reading, d, u and the bound are all in the measured quantity's SI unit: m or s.
- Nothing is converted. A resolution must be in its result's unit.
- The supported units are `READING_UNITS = ['m', 's']`, both linear scales with a step in the
  same unit.
- Angles are refused: a result in rad would need a degree protractor, so a conversion this
  model does not do.

**Edge behaviour** (all unit-tested):

| Case                                              | Behaviour                                             |
| ------------------------------------------------- | ----------------------------------------------------- |
| exact multiple of d                               | read as itself (2001 multiples × 7 resolutions)       |
| just below / just above half-way                  | down / up (10⁻⁶ of a step either side)                |
| exactly half-way (also hidden by binary rounding) | away from zero: 2.5 → 3, 1.005 → 1.01, −1.005 → −1.01 |
| negative values                                   | symmetric: r(−x) = −r(x)                              |
| zero, or within half a step of it                 | 0 (never −0); −0.005 → −0.01 (half-way)               |
| d = 0, negative, NaN, ±∞                          | `RangeError`, in every function                       |
| x NaN or ±∞; more than 2⁵³ steps                  | `RangeError`                                          |
| incomplete run                                    | no reading at all                                     |

**No propagation.** Each experiment reads its quantity directly, so nothing is propagated.
Timing N oscillations and dividing by N would give u(T) = d/(N√12); that is not modelled, and
the timer is modelled as reading T itself.

## 4. Raw vs displayed vs uncertainty

- **The simulated value is never rounded or overwritten.**
  - The record's results are frozen (6C.3), and `readings()` only reads them; a test checks the
    result is still the exact double afterwards.
  - The CSV writes it in full (`# Result range (Range) = 7.068502397133463 m`).
  - The table shows it to 3 decimals, a display format only. The panel says the simulated
    value is kept unrounded, in full in the CSV.
- **The reading is derived, not stored.** It comes from the record's own result and the d
  frozen in that record's own inputs, so it cannot come from the current dials.
  - Tested: d changed after the run; a write to the record's frozen inputs throws.
  - In E2E: run 1 reopened while the dial reads 0.001 m.
- **No uncertainty for incomplete runs.**
  - A stopped, failed or still-running run has no reading.
  - The rule is tested on its own: a completed record relabelled `stopped` gets none.
  - The panel shows nothing; the CSV says `# Measurements: none (the run did not complete)`.
- **Examples:**
  - **Projectile** (v₀ 8 m/s, 45°, Earth, launch height 0.59 m): R = 7.068502397133463 m.
    - d = 0.1 m: 7.1 m, u 0.029 m, d/2 0.05 m.
    - d = 0.01 m: 7.07 m, u 0.0029 m.
    - d = 0.001 m: 7.069 m, u 0.00029 m, d/2 0.0005 m.
  - **Pendulum** (L 1 m, θ₀ 30°, Earth): T = 2.0409898895 s.
    - d = 0.1 s: 2.0 s.
    - d = 0.001 s: 2.041 s.

## 5. Included and excluded sources

**Included:** the instrument's resolution, through the rounding of its display.

**Excluded.** These are named in the panel's note and on a `# Measurement … not included:`
line of the CSV:

| Source                                                                                         | Why not modelled                                                                                                 |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| judging where the ball landed; tape calibration, alignment, parallax                           | no data on them in this lab; inventing values is forbidden                                                       |
| the timer's calibration; when a light gate triggers; a person's reaction time with a stopwatch | the same                                                                                                         |
| the simulation's own step error                                                                | far below every d (§2); the Difference column shows it                                                           |
| scatter between repeated runs (Type A)                                                         | the simulation is deterministic: repeats are identical, so there is nothing to evaluate, and nothing is invented |
| air resistance, a real launcher's variability                                                  | not in the model at all (an approximation, not an uncertainty)                                                   |

No random noise and no percentage is added anywhere.

## 6. RunRecord, save and CSV changes

**`RunRecord`: no type change.** d is a parameter of the experiment (`resolution`), so a run
snapshots it into its frozen `inputs` like every dial. The record therefore keeps its
measurement configuration. Readings are a pure function of the record.

**Definition** (`experiment.ts`): `instruments[] {result, quantity, name, resolution,
excludes}`. Validation refuses each of these:

- an unknown result;
- a second instrument on one result;
- an unsupported unit;
- a missing resolution parameter, or one in another unit, or with min ≤ 0.

`checkExperimentAgainstModel` also refuses a resolution the model reads, so d can never change
the physics.

**Content:**

- **`experiments.json`:** a `resolution` parameter (symbol d, presets 0.001/0.01/0.1, default
  0.01) and one instrument in each experiment.
- **`rooms.json`:** a fourth dial on each desk, between the g dial and RUN: "Raise/Lower tape
  resolution d" at x −1.15 and "Raise/Lower timer resolution d" at x 2.45.
- **`items.json`:** one sentence about the d dial on each instructions board.

**Save: format unchanged** (`SAVE_VERSION` 2).

- d is saved like any dial, as `param.resolution`.
- A save from before 6C.4 has no such key and gets the default.
- 0, negative, out-of-range and non-number values are ignored, so the default is used.
- All of this is tested through the real save and Continue path.

**Results panel:**

- The middle column is renamed **Simulated** (it said "Measured", which now names something
  else). Its CSS classes are kept.
- A completed run gets, under the table:
  - "Range R, read with: Tape measure";
  - Reading, Resolution d, Standard uncertainty u = d/√12, Largest rounding error d/2;
  - a note stating the rounding rule, the rectangular assumption, that u is not the total
    uncertainty, and the exclusions.
- A comparison adds a reading row: each run's own reading and u, under the d row each run
  already had as a setting.
- The legend names d when it differs.
- The desk status screen lists d with the other dials. Its row spacing went from 6 to 5 units,
  so the pendulum's six rows clear the footer.

**CSV: lines added only.** No column, header or existing line changed; still byte-identical per
run:

```
# Parameter resolution (d) = 0.001 m
# Result range (Range) = 7.068502397133463 m; theory range
# Measurement range (Range R) by Tape measure: reading = 7.069 m at resolution d = 0.001 m
# Measurement range: standard uncertainty u = d/√12 = 0.0002886751345948129 m; bound d/2 = 0.0005 m
# Measurement range: not included: judging where the ball landed, the tape's calibration and alignment, parallax
# Measurement model: a reading is its result above (kept unrounded there) rounded to the nearest multiple of d, half-way values away from zero; u is the standard uncertainty of that rounding alone, uniform over ±d/2; not the total uncertainty of a real measurement, and the simulation's own step error is not included either
```

Free fall, which has no instrument, gets no measurement line.

## 7. Tests and results

**Unit and game-level tests** (Node; the game runs headless in `StationHistory.test.ts`): 280 →
**304**.

- **24 new:** `measurement.test.ts` 18; `csv.test.ts` +3; `content.test.ts` +2;
  `StationHistory.test.ts` +1.
- Each formula has an independent reference and an edge case:
  - **Reading:** hand-computed decimals, and 2001 exact multiples at seven resolutions;
    edge cases are ties, negatives and zero.
  - **u:** the RMS of the actual rounding errors of 100 000 values spread over one step, within
    10⁻⁶ of d/√12 at four resolutions; also the closed value √(1/12)/100. Edge case: a tiny
    resolution.
  - **Bound:** the largest of those errors, between 0.9999·d/2 and d/2.

| Required test                        | Where (all PASS)                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| SI units                             | `content.test` (a result in rad refused; a resolution in m for a result in s refused); readings carry m / s |
| exact increments                     | `measurement.test` "reads an exact multiple as itself…" (0.3 at 0.1, 2001 × 7 multiples)                    |
| just below / just above a boundary   | "reads just below half-way down and just above it up" (±10⁻⁶ step; 0.0049999 / 0.0050001)                   |
| ties                                 | "reads half-way away from zero, also where binary rounding hides the tie" (2.5, 1.005, 1.0005, 6.535)       |
| negative values                      | "is symmetric for negative values"                                                                          |
| zero                                 | "reads 0 … never −0" (`Object.is`)                                                                          |
| invalid resolutions                  | "rejects a resolution that is zero, negative or not finite" (all four functions); content min ≤ 0; save     |
| NaN and Infinity                     | the same, and "rejects what it cannot read" (also > 2⁵³ steps)                                              |
| uncertainty formula                  | "is d/√12, the spread of a rounding error…" (closed form and measured RMS)                                  |
| the bound                            | the same test (largest measured error)                                                                      |
| significant digits                   | "is reported to two significant digits" (0.00029 … "290", "0.0010", "0.10", "10")                           |
| raw values unchanged                 | "reads the projectile range… stays unrounded"; CSV `# Result` line unrounded                                |
| immutability                         | "keeps each record's own resolution, frozen" (a write to the record's inputs throws)                        |
| configuration snapshot               | the same test, and the CSV determinism test (the d dial changed between exports)                            |
| different resolutions compared       | "compares runs at two resolutions…" (both experiments); CSV "differs only in resolution and reading"        |
| deterministic CSV                    | `csv.test` "is deterministic…"; E2E (the same download twice)                                               |
| CSV metadata consistency             | `csv.test` "adds each reading after the results…" (every number from the run; line order)                   |
| incomplete runs                      | "has none for an incomplete run" (also the rule alone); CSV stopped run: `# Measurements: none`             |
| save backward compatibility          | `StationHistory.test` (saved; missing → default; 0, −0.01, 1, "0.1" → default; Continue path)               |
| resolution never changes the physics | identical samples, results, theory and time at d 0.1 and 0.001; a model reading d refused                   |

**Existing tests updated.** Expectations only; no assertion was removed or loosened:

- **Exact objects of a station's parameters or a run's inputs** now include
  `resolution: 0.01`: `ExperimentSession.test` 3, `StationSystem.test` 4, `PendulumStation.test` 3.
- **`ExperimentSession.test` "does not drift"** builds a definition with its own parameter list.
  It now also drops `instruments`, because validation rightly refuses an instrument whose
  resolution parameter is gone.
- **`hold.test`:** the entity count went 44 → 46 (the two dials).
- **`results.test`:** the run-settings string gains "· d 0.01 s".
- **`content.test`:** the shipped parameter lists gain d.
- **Strengthened:**
  - the CSV stopped-run test now asserts no measurement lines;
  - the determinism test now also turns the d dial between exports.
- **E2E:** seven debug-line patterns (`experiment.spec` 3, `pendulum.spec` 4) expect
  `resolution=0.01` before `step`. The results helpers moved from `history.spec.ts` to
  `support.ts` unchanged, for reuse.

**Mutation checks** (scratch script; `measurement.ts` restored after each): **10/10 caught**:

- the tie tolerance removed; ties sent towards zero;
- u = d/√3; bound = d;
- −0 allowed; no decimal snap;
- incomplete runs read (see §9.9); the current dial used instead of the record's;
- d = 0 accepted; three significant digits.

**E2E** — `e2e/measurement.spec.ts` (new), on the real app through Continue:

| Step of the brief                                             | Projectile                                                                  | Pendulum                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| new run; configure the resolution (the prompt names it)       | "Raise tape resolution d" → d 0.1 m                                         | "Raise timer resolution d" → d 0.1 s            |
| complete; value, unit, u, bound, assumptions                  | 7.1 m · 0.1 m · 0.029 m · 0.05 m; note: rule, ±d/2, "not the total…"        | 2.0 s · 0.1 s · 0.029 s · 0.05 s                |
| change the resolution; run again                              | d 0.001 m → 7.069 m · 0.00029 m · 0.0005 m                                  | d 0.001 s → 2.041 s · 0.00029 s · 0.0005 s      |
| the two records keep different configurations                 | run 1 reopened: d 0.1 m and its reading, dial at 0.001 m                    | the same                                        |
| compare the runs                                              | d row 0.1 / 0.001 m; reading row with each run's own u; legend by d         | the same; one exact-theory mark per run, equal  |
| export the CSV (the downloaded file read back)                | own `# Parameter resolution` and `# Measurement` lines; deterministic       | the same                                        |
| instrument settings change no samples, landing time or period | identical rows, landing row at the theory time, identical trajectory points | identical rows, end at 3T, identical θ–t points |
| both theories kept apart                                      | —                                                                           | the T₀ and T rows, one reading table            |
| Continue or reload clears the history (session-only)          | reload, Continue: d 0.001 m restored; a new shot is #1, alone               | the same; a new swing is #1, alone              |

**Final verification matrix.** Run on the committed tree (the last code change came before
these runs; only this report changed afterwards):

| Check              | Result                                                                                                 | Duration        |
| ------------------ | ------------------------------------------------------------------------------------------------------ | --------------- |
| `npm run check`    | **PASS**: 304/304 unit tests, 26 files; typecheck, lint, format                                        | —               |
| `npm run test:e2e` | **PASS**: **19/19** (the 17 earlier tests and the 2 of `measurement.spec`), 3 workers                  | 4.6 min (277 s) |
| `npm run build`    | **PASS**: CSS 8.38 kB, JS 812.03 kB (6C.3: 8.31 and 806.27 kB), Rapier 4,332.82 kB unchanged           | 0.27 s          |
| mutation checks    | **10/10 caught**                                                                                       | —               |
| `npm run bench`    | **PASS** (`gpu-headless`, `software`): 7 passed, 1 skipped by design; `gpu`, `gpu-native` not run (§8) | 4.2 min (253 s) |

**E2E failures during development** (each diagnosed; no assertion loosened to pass):

1. A heading selector also matched the run list's "Runs" heading (strict mode): scoped to the
   results column.
2. After reload and Continue, "Read the results" did nothing with no current run. This is the
   pre-existing behaviour in §9.8; the check now makes one new run and expects it alone as #1.

**Visual verification** (closure). The results panel comes from `measurement.spec`'s
screenshots in the final full run: `measurement-1` … `-5` at 1280×720, `-3b` and `-5b` at
1699×935. The desk screens and the new dials were captured by a temporary spec, run once and
then deleted, not committed. Starting from a save at each desk it:

- raised d to 0.1 (screenshot of the dial and its prompt);
- ran;
- lowered d to 0.001;
- took a screenshot of the status screen, each screenshot at 1280×720 and at 1699×935.

That status (d changed after a run) is the busiest one, with the "(run: …)" annotation and the
results column both showing.

| Item                               | Result                                                                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| new resolution dial and its prompt | **PASS**: the 4th dial, between g and RUN on both desks. Prompts "E Raise tape resolution d · F Lower tape resolution d" and "… timer resolution d", plus the existing limit notice at 0.1          |
| tighter rows (5 units)             | **PASS**: the pendulum's six rows (L, θ₀, g, d, m, ω₀) clear the footer with a gap; the projectile has five rows; all legible at both sizes                                                         |
| labels, values, units              | **PASS**: "d 0.1 m" / "d 0.001 s", the readings, d, u and d/2 with units in the panel                                                                                                               |
| existing controls                  | **PASS**: the dials, RUN/STOP/RESET and the screen are unchanged; every existing E2E flow passes                                                                                                    |
| history rows                       | **PASS**: "#2 · v₀ 8 m/s · θ 45 ° · g Earth · d 0.001 m" fits one line of the 360 px run column at both sizes                                                                                       |
| overlap or clipping                | **known pre-existing issue** (§9.10): on the desk screen, a "(run: …)" annotation runs into the results column, and "Impact speed" runs into its value. Both drawn by code unchanged since Phase 6B |

**Verdict: PASS WITH LIMITATIONS.** 6C.4 introduces no visual regression. The new d row
inherits the pre-existing desk-screen overlap, which was left alone as the closure brief
requires.

## 8. Performance

**No work per frame or per model step was added.** A reading is computed when the results panel
renders: on a pick, or by the existing 4 Hz refresh while it follows a running run, which has
no reading. It costs a few arithmetic operations per instrument. The desk screen draws one more
row. The bundle grew by 5.8 kB of JavaScript and 0.07 kB of CSS.

`npm run bench -- --project=gpu-headless --project=software`: **PASS, 7 passed, 1 skipped by
design** (the frame-rate sweep runs on `gpu-headless` only), 4.2 min (253 s). One run each; the
numbers below are copied from that run's output.

**GPU**, `gpu-headless`: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)
Direct3D11 vs_5_0 ps_5_0, D3D11)`, 1280×720, pixel ratio 1.00, GPU timer available.

| Scenario                         | fps   | frame mean / p95 / max (ms) | CPU mean / p95 (ms) | GPU mean / p95 (ms) | Draws (6C.3) |
| -------------------------------- | ----- | --------------------------- | ------------------- | ------------------- | ------------ |
| range: idle                      | 300.0 | 3.33 / 3.40 / 3.6           | 0.36 / 0.60         | 2.10 / 2.90         | 73 (71)      |
| range: interacting               | 300.0 | 3.33 / 3.40 / 3.5           | 0.34 / 0.50         | 2.04 / 2.88         | 66 (63)      |
| range: running                   | 300.0 | 3.33 / 3.40 / 3.5           | 0.38 / 0.60         | 2.13 / 2.90         | 74 (72)      |
| range: after landing             | 300.0 | 3.33 / 3.40 / 3.8           | 0.37 / 0.50         | 2.06 / 2.80         | 76 (74)      |
| pendulum: idle                   | 300.0 | 3.33 / 3.40 / 3.5           | 0.43 / 0.60         | 2.05 / 2.83         | 84 (82)      |
| pendulum: swinging               | 300.0 | 3.33 / 3.40 / 3.6           | 0.45 / 0.70         | 2.04 / 2.87         | 84 (82)      |
| pendulum: after the run          | 300.0 | 3.33 / 3.40 / 3.5           | 0.43 / 0.60         | 2.05 / 2.73         | 84 (82)      |
| history closed (monitor in view) | 300.0 | 3.33 / 3.40 / 5.3           | 0.31 / 0.50         | 2.02 / 2.89         | 64 (62)      |
| history open: 2 runs compared    | 300.0 | 3.33 / 3.40 / 3.6           | 0.29 / 0.40         | 2.01 / 2.93         | 64 (62)      |
| history open: 4 runs compared    | 300.0 | 3.33 / 3.40 / 3.5           | 0.29 / 0.40         | 2.06 / 2.94         | 64 (62)      |

- **300 fps in every scenario.** The 6C.3 closure had seen a later fall to about 220 fps,
  environmental and unexplained; it did not recur in this run.
- **CPU and GPU times are within run-to-run noise of 6C.3:** range CPU 0.34–0.38 ms (6C.3
  0.36–0.44), GPU 2.04–2.13 ms (1.92–2.13).
- **Draw calls +2 to +3:** the two new dials, in view and in the shadow pass.
- **The comparison scenarios now include the d and reading rows** (DOM, not WebGL) and cost
  nothing measurable.
- **The frame-rate sweep is unchanged from 6C.3:** T 4.526 s, R 16.001 m, H 4.448 m, v 5.188 m/s
  and 454 samples at 300, 60, 30, 20, 15, 10 and 5 fps. Watching took 4.94–5.12 s at 10 fps and
  above, and 9.68 s at 5 fps.

**Software**, `software`: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)
(0x0000C0DE)), SwiftShader driver)`, 1280×720.

| Scenario                         | fps  | frame mean / p95 / max (ms) | CPU (ms) | SwiftShader "GPU" (ms) | Draws |
| -------------------------------- | ---- | --------------------------- | -------- | ---------------------- | ----- |
| range: idle                      | 56.6 | 17.68 / 20.10 / 20.1        | 0.85     | 14.96                  | 73    |
| range: interacting               | 46.2 | 21.63 / 26.70 / 36.7        | 0.82     | 18.91                  | 66    |
| range: running                   | 43.0 | 23.24 / 43.30 / 46.6        | 0.96     | 20.63                  | 74    |
| range: after landing             | 53.0 | 18.87 / 23.30 / 30.0        | 0.81     | 16.09                  | 76    |
| pendulum: idle                   | 55.7 | 17.97 / 20.10 / 23.3        | 1.04     | 15.11                  | 84    |
| pendulum: swinging               | 49.0 | 20.42 / 26.70 / 30.1        | 1.13     | 16.71                  | 84    |
| pendulum: after the run          | 56.1 | 17.83 / 20.10 / 20.1        | 0.86     | 15.01                  | 84    |
| history closed (monitor in view) | 55.9 | 17.90 / 20.10 / 26.5        | 0.72     | 15.16                  | 64    |
| history open: 2 runs compared    | 54.7 | 18.28 / 20.00 / 200.1       | 0.75     | 14.91                  | 64    |
| history open: 4 runs compared    | 55.4 | 18.04 / 20.10 / 63.3        | 0.75     | 15.14                  | 64    |

- **Not slower than 6C.3's software run** (range 50.4/45.2/38.6/48.7 fps, pendulum
  50.1/43.7/50.5 fps). The higher numbers here are machine-state variance, not a gain from this
  phase.
- **One long frame (200.1 ms)** starts the 2-run comparison, as in 6C.3 (170 ms): most likely the
  first software rasterisation of the opened panel. The GPU run has none (max 3.6 ms).

**Not run:** the visible-window `gpu` and `gpu-native` projects. They capture the physical mouse,
the user was active (last input about a minute earlier), and the closure brief makes them
optional. `gpu-headless` renders on the same NVIDIA GPU, as its renderer string shows.

## 9. Limitations

1. **The labels are English, not Vietnamese.** The brief asks for "clear Vietnamese labels
   consistent with the current UI", but the current UI is English throughout: menus, HUD,
   prompts, panels and instructions. Vietnamese labels on only the new rows would be
   inconsistent with it. Translating the whole UI is a separate localisation task, and the user
   should decide on it.
2. **One measured quantity per experiment.** Flight time, maximum height, impact speed and
   amplitude have no instrument. The model, schema and UI take a list, so adding one is
   content: a result, a resolution parameter and a desk dial.
3. **Resolution only.** u excludes everything named in §5. It must not be read as the
   uncertainty of a real experiment. The panel and the CSV say so next to every reading.
4. **Rounding to nearest.** Instruments that truncate (some digital displays) have an error in
   [0, d) with a d/2 bias. That is a different model and is not offered.
5. **No propagation, coverage factor or consistency verdict.** No k = 2 interval and no
   "theory within u" check. Readings stand beside the theory and the reader compares them. N-period
   timing (u/N) is not modelled.
6. **The resolution is set by a dial on the desk.** That is a game abstraction for choosing an
   instrument, like the g dial. The floor tape drawn in the range (marks every 0.5 m) is
   scenery, not the modelled instrument: the reading appears in the results panel only.
7. **The decimal-tie tolerance is 10⁻⁹ of a step.** A value within that of half-way is treated
   as half-way. This is documented and tested; physically it is far below any meaningful
   difference.
8. **Pre-existing behaviour, not changed (out of scope).** Since Phase 6B (`5f3af83`) the
   monitor's "Read the results" does nothing while a station has no current run, which is the
   case after RESET or after Continue. Since 6C.3 keeps a history, a history kept after RESET is
   therefore visible only once the panel is open, or after the next run. The E2E check that a reload clears the
   history works around it by making one new run (it is listed alone as #1). Allowing the panel
   to open with history and no current run would be a one-line change in `StationSystem`
   (`case 'view'`). It is reported here, not made silently. **Fixed in Phase 6C.5**
   ([report](phase-6c5-report.md)).
9. **Mutation note.** One of the ten mutations ("incomplete runs read") was at first not caught.
   It was equivalent under the current `RunData` contract, because results stay null until a
   run completes. A test now checks the rule itself, with a completed record relabelled
   `stopped`, `failed` or `running`.
10. **Pre-existing desk-screen overlap, not changed (follow-up).** Two overlaps on the in-world
    status screen, found in this closure's screenshots:
    - When a dial differs from the shown run's value, its "(run: …)" annotation (at 40 of 100
      units) runs into the results column (at 56 units).
    - "Impact speed" is wider than the 22 units before its value.

    Both are drawn by code from `93620e9` (Phase 6B), which 6C.4 did not change: its only
    change to the screen is the row spacing. The new d row inherits the first overlap. This
    happens on the run-at-one-d, change-d path the measurement workflow invites, until RESET
    clears the run. The results panel, where readings are read, is not affected. A fix (move
    the annotation or narrow the results column) is a layout change, left to a follow-up as the
    closure brief requires. **Fixed in Phase 6C.5** ([report](phase-6c5-report.md)).

## 10. Commit

One commit on local `main`: `phase 6c.4: add scientific measurement uncertainty`. Its parent is
`aab4bb5` and it contains this report. A report cannot contain the hash of the commit that adds
it, so the hash is given in the task summary (`git log -1`). Nothing was pushed: the repository
has no remote.

**Repository audit before the commit:**

- `git status` lists exactly the changes listed in this report: the four new files and the
  modified sources, content, tests, specs and docs. No generated file is in the tree:
  `test-results/` and `dist/` are git-ignored, and the temporary desk-screen spec was deleted.
- `git diff --check` is clean.
- **No test weakened:** no skip, only or fixme added, no test removed. Every removed assertion
  line returns with the new `resolution` value. The moved E2E helpers are identical apart from
  two trailing commas Prettier added.
- **No save-format change:** `src/persistence` is untouched and `SAVE_VERSION` is still 2.
- **No model dependency on d:** `src/simulation/models` is untouched, and `resolution` appears in
  the runtime only in the check that refuses it as a model input.
- **No change outside 6C.4:** no 6C.5 work, no UI translation, no propagation or coverage, and
  no fix of the pre-existing issues in §9.8 and §9.10.
