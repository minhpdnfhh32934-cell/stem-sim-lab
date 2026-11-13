# Phase X report — teacher-ready simulations

Phú, 2026-11-08: the hub will later have a teacher who explains a simulation and walks the player
through exercises. Every simulation must be clear to a novice and built so the teacher can point
at each part and explain its principle; then every missing simulation of Physics, Chemistry and
Biology is built. Plan and running log: `docs/phase-x-teacher-ready-plan.md`. **Nothing is
committed** (Phú's word is needed).

## 1. What was built

- **Explain view** (key H at a station, or the teacher later): the camera glides to a close view
  of the apparatus, each part carries a label with its name and role, and a panel walks through
  the principle step by step, lighting the parts each step is about. Data per experiment
  (`explain` in its JSON, English + Vietnamese), one mechanism for all. Every experiment (79) has
  one.
- **Chemistry practice room** (`chemistry-annex`, west of the Chemistry Lab): 16 simulation
  tables — pH, precipitation (ions), separation, neutralisation, Le Chatelier (NO₂/N₂O₄), galvanic
  cell, electrolysis, halogens, corrosion, saponification, gas speeds (Maxwell–Boltzmann),
  collision theory, atomic structure, orbitals, molecule shapes (VSEPR), balancing equations.
- **Biology practice room** (`biology-annex`, west of the Biology Lab, doorway at z 3.5): 12
  tables — cell division (mitosis, meiosis), gene to protein (β-globin, sickle cell), population
  genetics (Hardy–Weinberg, drift), logistic growth, predator and prey (Lotka–Volterra), agar
  cubes (diffusion, SA:V), plasmolysis, fermentation, heart rate, tropisms, DNA extraction, human
  karyotypes.
- **Physics**: the AC generator, on the pendulum bay's east wall.
- **Pause menu** (Phú, 2026-11-09): Esc shows the controls at once, beside Resume / Settings /
  Back (stacked below them under 860 px), from the same list as the main menu's Controls dialog
  (`controlGroups`). Checked in the app at 1024×768, 1280×720 and 430 px wide; `pause.spec.ts`,
  `controls.spec.ts`, `history.spec.ts` PASS (one worker). `quality.test.ts`'s all-scenes Low test
  timed out once in the full parallel run (1.3 s alone): given 20 s.
- Every new model is pure and deterministic with its own tests against analytic or reference
  values (exact solutions, conservation laws, stoichiometry, published formulas); illustrative
  constants are named as such in each experiment's note. Details per model in the plan's log.

## 2. Test results

| Check                                            | Command                                                                                                  | Result                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Typecheck, lint, format, unit                    | `npm run check`                                                                                          | PASS — 281 files, 3806 tests                                     |
| New stations in the real app (Edge, SwiftShader) | `npx playwright test e2e/practice-rooms.spec.ts e2e/explain.spec.ts --project=dev`                       | PASS — 29 stations + Explain (3 needed a fix and a rerun, below) |
| Full E2E                                         | `npm run test:e2e`                                                                                       | see §2.1                                                         |
| Visual review, Explain open (real GPU)           | `GALLERY=1 GALLERY_EXPLAIN=1 npx playwright test -c playwright.bench.config.ts --project=gpu -g gallery` | 19 new stations pictured, problems fixed, 9 retaken              |

`e2e/practice-rooms.spec.ts` (new): for every table of the practice rooms and the generator,
Continue from a save at its control desk, RUN, the run completes, and every result the model
computes exactly reads as its theory on the monitor. First run: the stand 0.6 m from the desk's
centre was inside the desk (0.7 m deep) and Continue moved the player to the spawn — moved to
0.85 m. Second run: 28 PASS, 3 FAIL, all three real and explained, none a model error: the
collision table runs for 60 s (the wait was 60 s: now 100 s); the gas box's peak, mean and rms
are readings of its 400-particle sample and scan (421.571 vs 421.993 m/s; 476.114 vs 476.168);
the pH meter's ionization is read from a meter still settling after 30 s (1.309 vs 1.310 %).
Those readings are kept as readings and not compared exactly (named in the spec). Rerun: PASS.

`frameCap.test.ts`: two tests that boot the Physics Lab four and six times timed out (5 s) in the
full parallel run since the content grew (about 1 s alone): given 20 s.

### 2.1 Full E2E

`npm run test:e2e` (Edge, SwiftShader, 3 workers): **144 PASS, 15 FAIL, 4 did not run**
(39.8 min). Rerun with one worker (`npx playwright test --last-failed --workers=1`, which ran the
whole suite): 154 PASS, 4 FAIL. So 11 failed only under load (3 workers on the software renderer,
the new 15-minute practice-room spec beside them) — doors, a draw-call view, osmosis, dilution by
hand, three bench specs reaching the catalog, refraction, settings (Ultra), the character page, a
topics direction — **flaky, not counted as PASS**. The four that failed every time, and what was
done:

- `topics.spec.ts` catalog: its lists predated Phase X. Regenerated from the content (the 51
  entries kept as written, the 29 new experiments and 11 new topics in catalog order).
- `production.spec.ts`: counted the F3 frame-rate overlay (PerfOverlay, Phase V, class
  `debug perf`, shipped and hidden) as a dev tool. Now `.debug:not(.perf)`.
- `draw-calls.spec.ts` biology-lab/spawn: draws flickered 539 ↔ 775 — the beating heart cast a
  shadow, so the shadow cache redrew every frame. The heart and the always-turning molecule no
  longer cast shadows (a real performance bug, fixed).
- `room-sleep.spec.ts`: one run settled its GL counts a cycle later, on the same counts as its
  other runs (first-draw order, not a leak). Five cycles now, the last two compared.

Reruns after the fixes: `npx playwright test e2e/production.spec.ts e2e/topics.spec.ts
e2e/draw-calls.spec.ts e2e/room-sleep.spec.ts --workers=1` — 24 PASS, room-sleep's leak test FAIL
(the case above), then `npx playwright test e2e/room-sleep.spec.ts --workers=1` after the change —
5 PASS; production, topics and draw-calls once more with 2 workers — 21 PASS. The whole suite was
not run again after these fixes.

## 3. Known limitations

- Population models count simulated days, agar diffusion gives its depth in mm (DEVIATION from
  "SI everywhere", stated in each note); the run's own time stays in seconds.
- Not labelled yet (SPEC GAP): the projectile's flight and the standing wave's nodes (they depend
  on the run); titration and dilution glassware picked up by the player (labels stay at the
  stand).
- Light pool: the hub with the Biology Lab now has 3 key and 9 other room lights, over the
  renderer's 4 and 8, like Chemistry and Physics already were (the nearest are kept).
- The new tables' frame times were not measured on the GPU bench.
- Not seen yet by Phú on his 300 Hz display.

## 4. Next step

Phú looks at the practice rooms and the Explain view; then commit in logical parts (Explain,
chemistry room, biology room, generator, tests). Later: the hub teacher drives `ExplainSystem`.
