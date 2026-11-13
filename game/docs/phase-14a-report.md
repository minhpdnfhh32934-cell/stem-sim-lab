# Phase 14A report — Hooke's law

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

Phase 14A was built in two steps on the same uncommitted work. The first version loaded the spring
quasi-statically: the load grew over 2 s and the spring followed it, x = F/k at every instant, so
the mass slid down at an even pace. Its **revision** makes the run dynamic — the mass is let go,
falls, bounces and comes to rest — and widens the masses and springs. This report describes the
revised station; §1 and §7 keep the checks of both steps.

## 1. Starting state and baselines

HEAD `54a5d06` (phase 14), clean working tree, no remote. The brief expected `e7dec42`, one
commit older: Phase 14 had been committed since, so the work continued on the real HEAD.

| First baseline (before Phase 14A)              | Result                                           | Duration |
| ---------------------------------------------- | ------------------------------------------------ | -------- |
| `npm run check`                                | **PASS**: 362/362 unit tests, 31 files           | 21 s     |
| `npm run build`                                | **PASS**                                         | 5 s      |
| `npm run test:e2e`                             | **FAIL**: 25 passed, 1 failed, 4 did not run     | 306 s    |
| `experiment.spec.ts:51 --project=dev`, retry 1 | **DID NOT START**: the web server's build failed | 8 s      |
| the same, retry 2                              | **PASS**: 1/1                                    | 110 s    |

**The baseline failure** was the projectile test's STOP step: the 3.3 s flight on the Moon
completed before STOP took effect. Nothing had reloaded and no app file had changed. The 6F report
already documents this step as timing-sensitive under SwiftShader. The 4 tests that did not run
belong to the `dev-timed` project, which waits for `dev` to pass.

**The retries:** Playwright starts every web server, even for one project, and the production
one first runs `npm run build`, which typechecks every file. Retry 1 stopped there: `tsc` failed on
a new test of this phase, written before the code it tests. Retry 2 ran with this phase's three
new files (`spring.ts`, `spring.test.ts`, `HookeStation.test.ts`) set aside; they were put back
right after.

| Revision baseline (the first version, uncommitted)  | Result                                       | Duration |
| --------------------------------------------------- | -------------------------------------------- | -------- |
| `npm run check`                                     | **PASS**: 374/374                            | 20 s     |
| `npm run build`                                     | **PASS**                                     | 4 s      |
| `npm run test:e2e`                                  | **FAIL**: 26 passed, 1 failed, 4 did not run | 327 s    |
| `experiment.spec.ts:51 --project=dev`               | **PASS**: 1/1                                | 111 s    |
| `npx playwright test --project=dev-timed --no-deps` | **PASS**: 4/4                                | 72 s     |

The failure was the same STOP step (the flight had completed, t = 3.307 s). Run again on its own
it passed, and the 4 timed tests passed on their own: all 31 pass on the baseline code.

## 2. Audit

- **New apparatus kind:** the experiment engine (definition, pure model, session, station kinds)
  takes a new kind of apparatus as a geometry field, a case in `StationSystem` and a drawing in
  `ExperimentView`. `docs/experiments.md` named "spring" as the example.
- **Reused as they are:** the dials and the RUN, STOP and RESET buttons, the desk status screen,
  the results monitor, the results panel (theory, simulated and difference; instrument reading
  with d and u; graphs), the run history (up to 20 runs, each with its settings and results), the
  comparison of up to 4 runs (overlaid lines), CSV export, the checklist, saving the configuration,
  and the "run completed" progression.
- **Already there for the revision:** the runtime steps every model on a fixed step whatever the
  frame rate; a dial can step through presets and shows each one's label; a refused RUN shows its
  reason on the desk, in the prompt and as a notice. No engine change was needed.
- **Not available:** there is no view with one table of all runs and a slope fitted across them.
  None was added (§8).
- **Found during integration:** the main room now holds two stations. `activeStation` returned the
  first station in the player's room, so at the Hooke desk the HUD would have shown the free-fall
  checklist. It now returns the nearest station (§4).
- **Found by the revision:** the first drawing scaled a unit-length tube along the spring, which
  flattened the wire at short lengths; the coil is now laid out at its length instead (§4).

## 3. Model

`mechanics.spring` (`src/simulation/models/spring.ts`) is pure and deterministic, in SI units, and
keeps two things apart:

- **Static equilibrium (Hooke's law) — the theory.** At rest the spring's pull balances the
  weight: k·Δl = m·g, so Δl = m·g/k, L = L₀ + Δl and k = m·g/Δl. Δl is the extension from the
  natural length L₀ and never the spring's whole length; both appear, as separate results.
- **The motion (dynamics) — the run.** The mass is held with the spring at L₀ and let go at rest
  (x = 0, v = 0). It obeys m·x″ + c·x′ + k·x = m·g, with x the extension (downward positive) and
  viscous damping c = 2ζ·√(k·m). It falls (x″ = g at release), swings past Δl to
  Δl·(1 + e^(−πζ/√(1−ζ²))) ≈ 1.73·Δl, comes back up past Δl and oscillates about it, each swing
  smaller.
- **Damping:** ζ = 0.1, a tenth of critical damping, for every m and k, so every load rings for
  about as many swings. With the default's c (0.63 N·s/m) fixed instead, 5 kg on 200 N/m would
  take about 2 minutes to settle and 0.05 kg on 5 N/m would barely swing past rest. It is a
  simplified viscous term, not the air and metal of a real spring.
- **Integration:** semi-implicit Euler (the new velocity moves the mass) on the experiment's fixed
  1 ms step, which the render frame rate does not change. At the stiffest setting ω·dt = 0.063,
  far inside the method's stability (ω·dt < 2).
- **End of the run:** by itself, once the energy left in the oscillation is that of a swing below
  0.1 % of Δl. The results are read then: L, Δl and k = m·g/Δl, within 0.1 % of the theory, and the
  ruler's reading of Δl. The default 0.5 kg on 20 N/m lasts about 11 s; the longest run allowed,
  about 12 s; the time limit is 30 s.
- **Time scale:** T = 2π√(m/k) = 2π√(Δl/g), so the period follows from the rest extension alone:
  1.0 s for the default (Δl = 0.245 m), 1.2 s for the largest allowed Δl (0.35 m), and 0.1 s for
  the smallest (2.5 mm, 0.05 kg on 200 N/m), a short buzz. Shown in real time, never sped up.
- **Variables:** x (m), v (m/s), L (m), the spring's pull k·x (N), the weight m·g (N) and
  m·g/x (N/m), which is 0 at x = 0, so 0/0 never happens.
- **Inputs:** g = 9.81 m/s² and ζ = 0.1 are fixed and shown; L₀ = 0.20 m comes from the stand.
- **Elastic limit:** 0.60 m, a property of the stand. RUN is refused when the lowest point of the
  first swing (the theory's `peak`) would pass it, not only the rest extension: 1 kg on 20 N/m
  rests at 0.49 m but swings down to 0.85 m. The reason is shown: "This load is beyond the elastic
  limit of the spring: let go, the mass would stretch it to 0.85 m (0.49 m at rest), more than the
  0.60 m it can take. Lower m or use a stiffer spring."

## 4. Station and learning

- **Where:** the Physics Lab's main room, north-east, opposite the free-fall tower.
- **The apparatus:** a stand and its arm, the spring, a weight with a red pointer, and a ruler
  beside the spring. The ruler is zeroed where the pointer rests with nothing hanging, so it reads
  the extension; 1 cm marks over 0.7 m, labelled every 5 cm, in metres.
- **The spring as drawn:** a coil of 16 turns whose pitch follows the length, its wire kept round
  however far it stretches (each ring laid in the helix's own frame), the weight hanging at its
  end. Its vertices are rewritten in place when the length changes: no allocation, no extra loop.
  No physics body, like the pendulum's bob. Before RUN and after RESET the mass is held at L₀;
  STOP freezes it where it is.
- **The rest of the station:** the desk with three preset dials — m 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2,
  3, 5 kg; k 5, 10, 20, 50, 100, 200 N/m; d 0.001, 0.005, 0.01 m — showing the values in use;
  RUN, STOP and RESET; a status screen; the results monitor; and a board with the instructions.
  The preset steps keep each dial a few clicks from end to end: 8 for m, 5 for k.
- **Results:** the weight m·g, and at rest L, Δl and k = m·g/Δl, each against the theory, plus the
  ruler's reading of Δl with d, u = d/√12 and d/2.
- **Graphs:** the spring's pull F = k·x against Δl, whose slope is k, with the rest Δl marked; and
  Δl against time, where the oscillation and its decay show. Comparing runs overlays the
  force–extension lines: two springs, two slopes.
- **Catalog:** the topic **Dynamics** / Động lực học, between Kinematics and Oscillations. The
  catalog shows "Hooke's law — Physics Laboratory", its objective, and "Run completed" once a run
  of it ends by itself; the progression semantics are unchanged.
- **Both languages:** every text, including the board, the note and the refusal.
- **HUD:** the HUD objective and the debug panel show the nearest station in the player's room.
  The debug panel follows the player. The objective is redrawn on its usual events: entering a
  room, or a change at a station (a dial, a run, its board read for the first time). So walking
  to the other station switches it at the first such event there. The stand is at x = 4.2: at
  x = 3.75, level with the tower, both would be exactly as far from the lab's door. At the door
  the tower is still the nearer station, as before.

## 5. Files

| File                                                                                                          | Change                                                                       |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/simulation/models/spring.ts`, `index.ts`                                                                 | the model (dynamic since the revision), registered                           |
| `src/gameplay/item.ts`, `src/game/content.ts`                                                                 | `springStand` geometry; a control's station may be a spring stand            |
| `src/gameplay/experiment/behaviors.ts`                                                                        | the `spring-stand` behaviour                                                 |
| `src/gameplay/experiment/StationSystem.ts`                                                                    | the `spring` kind; elastic-limit refusal at the peak; nearest active station |
| `src/platform/render/ExperimentView.ts`, `WorldRenderer.ts`                                                   | the spring rig with its coil laid out in place; the ruler takes a mark step  |
| `src/content/experiments.json`, `items.json`, `rooms.json`                                                    | the definition; the stand and the board; 11 placements                       |
| `src/content/topics.json`, `laboratories.json`, `strings.json`                                                | the Dynamics topic; the lab's lists; one Vietnamese refusal                  |
| `spring.test.ts`, `HookeStation.test.ts`, `e2e/hooke.spec.ts`                                                 | new tests (§6)                                                               |
| `content.test.ts`, `catalog.test.ts`, `PhysicsSystem.test.ts`, `hold.test.ts`, `game`/`grab`/`topics.spec.ts` | numbers of the shipped content (§6)                                          |
| `docs/experiments.md`, `docs/data-model.md`, `README.md`, this report                                         | documentation                                                                |

## 6. Tests

- **Unit, 19 new.**
  - `spring.test.ts` (10):
    - at rest Δl = m·g/k from L₀, and k·Δl = m·g;
    - the first swing's lowest point: 2·Δl undamped, ≈ 1.73·Δl at ζ = 0.1, Δl at ζ = 1;
    - the acceleration: g at release, 0 at rest, −c·v/m moving through rest;
    - a run: it falls, swings past rest and back, every swing smaller than the one before, and
      rests within 0.1 % of Δl;
    - at rest within 0.1 % of k·Δl = m·g from 0.05 kg on 200 N/m to 5 kg on 200 N/m, ending by
      itself well inside the time limit;
    - only damping takes the swing: undamped, it keeps reaching 2·Δl;
    - the lowest point reached is the theory's `peak`, the one the stand checks;
    - 2 ms, 1 ms and 0.5 ms steps agree with 0.1 ms to 0.1 % of Δl;
    - every sample is finite and lies on F = k·x and L = L₀ + x;
    - m·g/x is 0 at x = 0, never NaN.
  - `HookeStation.test.ts` (9):
    - ready at once, the mass held at L₀;
    - the dials across 0.05–5 kg and 5–200 N/m, with their limits;
    - a run: the drawn spring is the model's every frame, it oscillates past rest, comes to rest
      within 0.1 %, a completed run recorded once, the ruler's reading;
    - the same results at 30 and 144 frames per second;
    - STOP freezes the mass, RESET lifts it back, and a stopped run is not a completed one;
    - the elastic-limit refusal, on the peak as well as at rest, and its lifting;
    - two springs kept as two runs in the history;
    - the nearest station is the active one;
    - the configuration survives save and Continue.
- **E2E, 1** (`hooke.spec.ts`, rewritten for the revision), in order:
  1. The catalog lists it, not yet run.
  2. Continue from a save in the lab, read the board; 1 kg on 20 N/m is refused with its reason.
  3. 2 kg on 100 N/m (beyond the first version's 1 kg and 50 N/m); RUN; read live off the debug
     panel, the extension rises and falls back; STOP freezes it; RESET leaves no run.
  4. A run to rest: Δl at rest and k within 0.1 %; then 2 kg on 200 N/m.
  5. The monitor: weight, Δl, k and the ruler against the theory; both graphs; the note.
  6. The history holds the stopped run and both completed ones; runs 2 and 3 compared (two
     slopes); run 2's CSV holds the motion: from 0, past 1.5·Δl, back above Δl, at rest, F = k·x.
  7. After a reload, the catalog marks it "Run completed"; no console error.
- **Not applicable:** a cm↔m conversion; the interface shows metres only.
- **Existing tests pinning the shipped content**, updated with the new numbers and no assertion
  removed:
  - the topic list (`content.test.ts`, `catalog.test.ts`, `topics.spec.ts` in both languages);
  - the Physics Lab's body and collider counts (18/41 → 20/43: the stand and its desk) in
    `PhysicsSystem.test.ts`, `game.spec.ts` and `grab.spec.ts`;
  - its entity count (56 → 67: 11 placements) in `hold.test.ts`.
- **One test made order-independent:** `content.test.ts` "rejects unknown, other-subject …" now
  finds its two topics by id instead of by position, with the same assertions.

## 7. Verification

| First version                                                            | Result                                                | Duration |
| ------------------------------------------------------------------------ | ----------------------------------------------------- | -------- |
| `npm run check`                                                          | **PASS**: 374/374 unit tests (362 + 12), 33 files     | 17 s     |
| `npm run build`                                                          | **PASS**; entry chunk 863.97 → 891.22 kB; Rapier same | 4 s      |
| `npx playwright test e2e/hooke.spec.ts e2e/topics.spec.ts --project=dev` | **PASS**: 6/6                                         | 35 s     |
| `npm run test:e2e`                                                       | **PASS**: 31/31 (30 + 1), first full run, no retry    | 375 s    |
| `git diff --check`                                                       | clean                                                 | —        |

**One failure during the first version's development:** `PendulumStation.test.ts` expects the
free-fall tower to be the active station at the lab's spawn point. With the stand first placed
level with the tower, the two were exactly as far from it, and the test failed. The stand was moved
(§4); the test is unchanged.

| Revision                                              | Result                                                 | Duration |
| ----------------------------------------------------- | ------------------------------------------------------ | -------- |
| `npx vitest run spring.test.ts HookeStation.test.ts`  | **PASS**: 19/19, first run                             | —        |
| `npm run check`                                       | **PASS**: 381/381 unit tests (374 − 12 + 19), 33 files | 19 s     |
| `npm run build`                                       | **PASS**; entry chunk 891.22 → 881.59 kB; Rapier same  | 5 s      |
| `npx playwright test e2e/hooke.spec.ts --project=dev` | **PASS**: 1/1, first run                               | 60 s     |
| `npm run test:e2e`                                    | **PASS**: 31/31, first full run, no retry              | 388 s    |
| `git diff --check`                                    | clean                                                  | —        |
| `npm run bench`                                       | **NOT RUN**: it has no Hooke scenario; visible window  | —        |
| Manual gameplay / real-GPU check                      | **NOT RUN**: SwiftShader screenshots only              | —        |

The entry chunk shrank: the coil no longer uses three.js's `TubeGeometry` and `CatmullRomCurve3`,
which are no longer in the bundle. Each command ran on its own, after the previous one finished.

## 8. Limitations

- **One measurement is one run.** The run list is the table of measurements: a row per run with
  its number, m, spring and d, and its m·g and L. Δl and k are in each run's own results, and L₀,
  g and ζ in its inputs. There is no single table with every column, and no slope fitted across
  runs (Phase 14B). The slope of each run's line is k, and up to four runs can be overlaid.
- **Ideal model.** Linear, massless and elastic spring; vertical motion only; uniform g; damping a
  viscous term with the same ζ for every load. No noise: the only difference from the theory a
  student sees is the swing left when the run ends (below 0.1 %) and the ruler's resolution d.
- **STOP mid-swing** keeps the data so far (history, CSV) but gives no results: a stopped run is
  incomplete, as in every experiment, because a moving mass is not at rest.
- **No period or amplitude measurement:** the oscillation shows in the motion, the Δl–t graph and
  the CSV, but is not analysed (Phase 14C).
- **Small extensions ring fast:** 0.05 kg on 200 N/m stretches 2.5 mm with T = 0.1 s, a buzz
  rather than a visible bounce. That is the physics; nothing is slowed down.
- **One elastic limit** (0.60 m) is assumed for every spring.
- **The weight** is drawn the same size for every mass.
- **The HUD objective** changes station at the first event there, not as the player walks (§4).
- **Not solid:** the spring and the weight have no body, so the player can walk through them.
- **Units:** the interface shows SI metres only, with no centimetre display.
- **Not reviewed:** the Vietnamese is unreviewed by a native speaker. The visual check was done on
  SwiftShader screenshots only; nothing ran on a real GPU or by hand.

## 9. Next step

Phase 14B, the analysis of collected data: a table of a station's runs with a least-squares slope
— for Hooke's law, k from several (Δl, m·g) points at rest, against each run's own m·g/Δl. Then
Phase 14C, the spring's oscillation itself: the period against T = 2π√(m/k) and the decay of the
swings, from the samples this revision already records.
