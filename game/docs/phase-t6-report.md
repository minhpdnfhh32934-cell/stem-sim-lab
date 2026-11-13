# Phase T-6 report — Biology's next experiments (built in parallel, for the lead's review)

Phú (2026-11-06): "con agent thì bắt đầu làm các thí nghiệm của môn Sinh … làm song song nhưng không
được làm giảm chất lượng và kiểu thiết kế". Built by a second agent in the worktree
`SimLab-3D-bio` (branch `agent/biology-labs`), on the lead's T-3 tree (staged there as the
baseline); this work is unstaged, for the lead to review, polish and take as `git diff` plus the new
files. Contract: `docs/phase-t-curriculum-contract.md` §8 (the Biology candidates); pattern: the
bench stations of `docs/phase-t-report.md` §4–§6 (T-6a transpiration above all). Not yet seen by
Phú or by the lead.

## 1. What was built

Four desk stations in the Biology Lab, each the transpiration island's layout moved to free floor
(lab bench with its apparatus, control desk with its dials, RUN, STOP and RESET, desk screen,
results monitor, instructions board overhead). Each model is pure and deterministic (seeded
randomness only, every state value finite from `init`), refuses what it cannot run with its reason,
and is tested against reference solutions worked independently of it; each experiment states its
simplified model, its constants and their sources, what is illustrative and what a real lab adds,
in English and Vietnamese.

| Experiment (grade, KNTT)                              | Model                                                                                                                                                                                                                                                                                                                     | Station (bench at)                                                                                                                                                                                                                                                                                                                                                         | Checked against                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests for biological molecules: unknown samples (10)  | `biology.food-tests` (`foodTests.ts`): six unknown samples A–F, each one pure substance in water (protein, glucose, starch, water, oil, sucrose: which is which is in the model only); iodine, Benedict's (only when heated), biuret, Sudan III, by the textbook's rules; the colour develops over an illustrative 2 min  | x −12.4, z −3.0 (west, between the plant shelf and the photosynthesis bench): `food-test-rack` (six alike bottles, hot plate, beaker bath, tube whose liquid turns from the reagent's colour to the outcome — Benedict's through green, yellow, orange to brick red; Sudan III's red layer; the plate's ring glowing when the bath is on). Dials: sample, test, water bath | a 6 × 5 table written out from the textbook rules (sucrose negative with Benedict's, every test negative cold for Benedict's); each sample found by one test alone, water and sucrose by none; linear development at five step sizes                                                                          |
| Respiration of germinating seeds: a respirometer (11) | `biology.seed-respiration` (`seedRespiration.ts`): O₂ uptake r = m·r₂₀·Q₁₀^((T − 20)/10); over KOH the drop shows the O₂, over water O₂ − CO₂ = r(1 − RQ); RQ 1 for starch (C₆H₁₂O₆ + 6 O₂), 0.7 for fat (tripalmitin, 102/145 = 0.703); boiled peas the control; a drop past the 1 mL pipette refused                    | x −12.3, z 6.1 (south-west): `respirometer` (glass bath, seeds tube over the absorber, control tube of beads, two 1 mL pipettes on a scale, thermometer; the seeds' drop moving 0.2 m per mL; seeds and absorber drawn as set). Dials: seeds, bath T, absorber, the pipette's graduation (the instrument, mL)                                                              | 10 g at 20 °C: 0.4167 mL in 10 min by hand; ×√2, ×2, ×½ at 25, 30, 10 °C; RQ = 1 − V_water/V_KOH gives 0.7 back; the boiled control 0 everywhere; the end at the measuring time at six step sizes; 35 °C refused (1.18 mL past the pipette)                                                                   |
| Mendel's laws: a dihybrid cross in peas (12)          | `biology.genetics` (`genetics.ts`, written and tested in Phase Labs, registered now): segregation and independent assortment, seeded meiosis bits, Pearson's χ² with p in closed form                                                                                                                                     | x 1.5, z 4.2 (east, south of the door): `seed-tray` (tray of pods, four Petri dishes whose heaps are the run's class counts, a drawn seed for ⌈N/160⌉ counted; round seeds smooth, wrinkled angular). Dials: P₁, P₂ (seven genotypes), N (16, 100, 556, 1000), sample                                                                                                      | (Phase Labs' tests) all 81 crosses against the Punnett square; 9:3:3:1, 1:1:1:1, 3:1; χ² tail against the incomplete gamma series and NIST's critical values; Mendel's own 315 : 101 : 108 : 32; fairness of the generator; 1 rejection in 20 at p ≤ 0.05                                                     |
| Estimating a population: mark and recapture (12)      | `biology.mark-recapture` (`markRecapture.ts`): a jar of beans, its size N a hidden input (437, never shown); a catch of C drawn one bean at a time without replacement (seeded, exactly hypergeometric); Lincoln–Petersen M·C/R (0 with a "no estimate" class while R = 0), Chapman's estimate and Seber's standard error | x 1.5, z −2.5 (east, north of the door): `bean-jar` (jar of beans, tray of 100 places: the catch laid out, marked red from the front, unmarked from the back). Dials: M (30, 50, 80), C (30–100), catch no.                                                                                                                                                                | the hypergeometric pmf (χ² over 4000 catches); its mean and variance; Chapman exactly unbiased when M + C ≥ N (summed over the exact pmf); Lincoln–Petersen high in small samples; N̂_C ± 2·SE holding N in 92–98.5 % of 2000 catches; catching the whole jar gives R = M and M·C/R = N; refusals never name N |

Answers stay hidden as in `cell-emf`: the food samples' contents are only in the model; the jar's
N is a hidden input, so the mark-and-recapture station shows no theory at all (no analysis — a
scatter of Chapman's estimate against C instead); the respirometer shows V and the rate, never the
RQ (the student works it out from two runs; the note states the substrates' RQs as the textbook
does). Units: the respirometer's pipette reads mL (in `READING_UNITS`); the other three have no
instrument (counts and colours are exact, as the notes say).

**SPEC GAP, stated in the notes:** the seeds' respiration rate r₂₀ = 0.25 mL O₂/(g·h) (illustrative,
of the size school respirometers show; the same for both seeds so only RQ tells them apart) and
Q₁₀ = 2; the food tests' development time. The teaching points (germinating against boiled, the
temperature trend, RQ from two runs; which test finds which molecule) do not depend on them.

**The genetics model changed:** its state held NaN before the first seed (proportions, χ², p, the
last genotype), which the runtime fails since T-2a. Now 0, 0, 0, p 1 and −1 (no seed); and
`chiSquareTail(0, ν)` returns exactly 1 (Numerical Recipes' erfc fit gave 1 + 3·10⁻⁸). Its test
and the 2D workspace pieces' tests pass unchanged otherwise.

## 2. Skipped, with the reason

- **Fermentation (10):** the CO₂ a yeast flask gives is confounded by CO₂ dissolving in the
  solution (about 0.9 mL per mL of water at 20 °C before any gas is collected), and the yeast's
  rate and its temperature curve have no source here: either the model hides a large real effect or
  it rests on illustrative numbers the teaching point depends on. Left for a plan with sources.
- **Plasmolysis and its reversal (10), mitosis/meiosis and chromosome slides (10, 12):** microscopy
  of cells, needing slide images and (plasmolysis) a sourced spread of the cells' osmotic
  potentials; the existing osmosis station covers the water-potential model.
- **Heart rate and blood pressure (11):** measured on the student's own body; no deterministic model
  to state honestly.
- **Tropisms (11):** growth over days, qualitative; auxin transport is research-grade.
- **DNA extraction (12):** a procedure with no measured quantity.

## 3. Also changed

- Topics: four new Biology topics — "Biological molecules" (Các phân tử sinh học, after Cells),
  "Respiration" (Hô hấp), "Inheritance" (Di truyền học), "Ecology" (Sinh thái học); the Biology
  lab lists the four experiments last.
- Stale points fixed in three station tests (as T-3 fixed `RefractionStation.test.ts`): the
  microscope's, the enzyme rig's and the photosynthesis apparatus' "HUD follows it" points were far
  from their stations (near the door, from an older layout); the new east stations now stand nearer
  them. They now use the points the e2e specs stand at (`stationZones.test.ts`).
- Counts follow the stations: Biology Lab 35 bodies, 42 colliders (+3 each), 110 entities (+13,
  +13, +12, +12: two stations have three dials), 243 desk controls (+8, +8, +7, +7), 31 overhead
  boards, four apparatus extents (all on the bench at 0.900 m), four glassware meshes
  (`bean-jar`, `food-test-rack`, `respirometer`, `seed-tray`), 20 instanced parts per Biology visit
  (+2 respirometer ticks and seeds, +5 seed heaps and pods, +2 marked and unmarked beans).
- Lean stations: each frame merges its glass, its bungs or caps, its legs or tray into one mesh each
  (`mergeGeometries`, as the osmosis rack); repeated parts are `copies`; nothing allocates in
  `pose`. Frame + rig meshes: respirometer 10 + 3, seed tray 3 + 5, bean jar 4 + 2, food-test rack
  6 + 3 (the potometer: 16 + 7).
- e2e: the four stations in `physics-benches.spec.ts` (played like transpiration: Continue at the
  board, two dials, RUN, the results against theory — none to compare for mark and recapture, its
  theory hidden), the catalog's lists in `topics.spec.ts` (EN and VI).

## 4. Tests

All in the worktree, Edge on SwiftShader for e2e (software WebGL: counts only, no timings).

- `npm run check`: **FAIL**, at the format step only — `prettier --check` flags three files under
  `test-results-b/` staged in the worktree's baseline (§5). Its other steps: `npm run typecheck`
  **PASS**, `npm run lint` **PASS**, `npm run test` **PASS** (229 files, 3418 tests, at 10:30).
- After the last two changes (the culling fix and the genotype dials' labels, below), `npx vitest
run` ran while the lead's T-4 e2e loaded the machine: 4 failed (`frameCap` ×2,
  `physicalLab` binding, `quality` Low lights), then `npx vitest run src/game/frameCap.test.ts
src/gameplay/lab/physicalLab.test.ts src/platform/render/quality.test.ts`: **PASS** (51/51) — load-
  dependent, **FLAKY** under load, not PASS; to rerun on an idle machine. Typecheck and lint after
  them: **PASS**.
- e2e, first run:
  `SIMLAB_DEV_PORT=5299 SIMLAB_PREVIEW_PORT=5298 SIMLAB_DEV_ONLY=1 npx playwright test --project=warmup --project=dev --workers=1 --output test-results-bio e2e/physics-benches.spec.ts e2e/topics.spec.ts -g "seed-respiration|mendelian-cross|mark-recapture|food-tests|transpiration|catalog"`:
  **PASS** (10: warmup, the four new stations and transpiration, four catalog tests). Its
  screenshots showed two faults the assertions do not see: the bean tray and the seed dishes drawn
  empty (instanced parts whose count starts at 0 had their bounds taken empty and were culled: now
  `frustumCulled = false`, as the air track's discs) and the genotype dials read as codes ("P₁ 10":
  the symbol dropped, so the desk shows "Yyrr (yellow, wrinkled)").
- e2e after the fixes, the same command with `e2e/draw-calls.spec.ts` and
  `-g "seed-respiration|mendelian-cross|mark-recapture|food-tests|transpiration|catalog|topic|biology-lab/spawn"`:
  **PASS** (12). Screenshots: each station drawn, the beans and seed heaps on their trays, the desk
  screens showing their settings.
- Draw calls, Biology Lab spawn view, medium (`e2e/draw-calls.spec.ts`, SwiftShader): **220**
  without the four stations (their placements removed for the measurement, the baseline's file
  restored byte for byte after), **357** with them: +137, about 34 a station, most of it the
  desk furniture every bench station has (bench, desk, dials, buttons, screen, monitor, board) and
  their shadow pass; the apparatus themselves are 6–13 meshes each.

## 5. Limitations

- Desk stations, as every bench station today; by hand with their instruments they wait for T-1b's
  pattern (Phú's D1).
- The food tests are qualitative and use pure substances; Benedict's semi-quantitative colours and
  real foods are left out (no sourced thresholds).
- The respiration rate and Q₁₀ are illustrative (SPEC GAP above).
- `npm run check`'s format step flags three files under `test-results-b/` that are staged in this
  worktree's baseline (the lead's T-3 shard output): not part of this work; they should not be
  committed.
- Not seen on a real display; no GPU frame times. The Biology Lab went from 220 to 357 draw
  calls at its spawn view (SwiftShader); `npm run bench` on the real GPU should check the Low-end
  budget, and sharing the desks' furniture would bring it down for every station.

## 6. Next step

The lead reviews and polishes the four stations (positions in the Biology Lab, the desk screens'
long genotype labels), Phú checks them, then the full e2e and a commit. Fermentation needs a plan
with a sourced CO₂-solubility and yeast-rate model before it is built.

## Review and merge (thầy, 2026-11-06)

Built by one agent in its own worktree (Phú: an agent builds Biology while thầy finishes Physics),
then reviewed and merged by thầy into the main tree, uncommitted.

- Science reviewed: the seeds' RQ from the respiration equations (tripalmitin 102/145 = 0.703), r₂₀
  and Q₁₀ labelled SPEC GAP; the food tests' textbook rules, the samples' contents only in the model;
  Lincoln–Petersen, Chapman and Seber's standard error with their sources, the jar's N a hidden input
  (no theory, no analysis shown); the Mendel cross as the genetics model already tested. Nothing
  changed.
- Merge: code files three-way (`git merge-file`, base the worktree's baseline); three conflicts, all
  counts or lists, resolved by adding both sides (desk controls 296, overhead boards 38, the
  glassware list). Content merged by meaning: the agent's new items and topics after the same
  neighbours, the Biology Lab's placements and the Biology laboratory's list taken whole (thầy's
  T-4 changed neither).
- `test-results-b/` (thầy's T-3 shard output) had slipped into the worktree's baseline: removed
  there; it never reached the main tree's index.
- Tests after the merge: `npm run check` **PASS** (234 files, 3467 tests); e2e
  `SIMLAB_DEV_ONLY=1 npx playwright test --project=warmup --project=dev --workers=2 e2e/physics-benches.spec.ts e2e/topics.spec.ts e2e/draw-calls.spec.ts -g "seed-respiration|mendelian-cross|mark-recapture|food-tests|transpiration|catalog|topic|draw"`
  **PASS** (25). Biology Lab spawn view at medium: 357 draw calls (SwiftShader).
- Not seen on a real display yet; the long genotype labels on the cross's desk screen are the
  thing to look at.
