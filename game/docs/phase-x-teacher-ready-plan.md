# Phase X — teacher-ready simulations (plan and progress)

Phú, 2026-11-08: the hub will later have a teacher the player talks to, who explains a
simulation in depth and walks the player through exercises. So every simulation must be clear to
someone who knows nothing, and built so the teacher can be called in to point at each part and
explain its principle step by step. First fix what is hard to understand (change how it is shown,
make it bigger…), then build every missing simulation of the three subjects. Work through to the
end without asking; one report at the end. Nothing is committed without Phú's word.

## 1. What the station gallery showed (GPU, 1280×720, High, 2.2 m in front of each apparatus)

`GALLERY=1 npx playwright test -c playwright.bench.config.ts --project=gpu -g gallery`
(`e2e/gallery.bench.ts`): 50 stations, 50 pictures.

- The apparatus is small (true to size: a syringe, a circuit board, a 20 cm calorimeter) and
  stands on a bench behind the control desk, whose upright display hides much of it. From the
  desk the player sees dials and a status screen, not the physics.
- Nothing is named in the scene: the parts of an apparatus are not labelled.
- What the model computes but no eye can see (forces, fields, currents, molecules, particles) is
  shown on the monitors' graphs only.

## 2. The fix for every station: the Explain view (the teacher's hook)

One mechanism for all experiments (data per experiment, no code per experiment):

- **Key H** (or the "Explain" action) at a station — its apparatus, its desk or its board — opens
  the Explain view: the camera glides to a close view framing the apparatus (big on screen, true to
  size), the player stands still, the mouse is free.
- **Labels**: each part of the apparatus carries a tag with its name and one-line role, a leader
  line to the part; a label follows its part when it moves (a named mesh of the bench model) or
  stays at a point of the apparatus (an offset in its frame).
- **Principle panel** (right): what the experiment shows in one sentence, then numbered steps of
  the principle; each step lights the parts it is about (their tags) and may say what to watch.
  Prev / Next; RUN / RESET from the panel so the run is watched up close.
- Data: `explain` in each experiment's JSON: `parts` (id, anchor: `{ part }` a mesh name or
  `{ at }` a point in the apparatus' frame, name, role) and `steps` (text, parts), English with its
  Vietnamese beside it (`localized`). Validated with the content; a test asks every experiment for
  an `explain` with parts and steps, each step's parts existing.
- The teacher later drives the same system (`explain.open(experiment)`, `explain.step(i)`,
  `explain.focus(part)`): nothing new to invent for it.

## 3. Then, per subject, what the Explain view alone does not make clear

Listed from the gallery and each experiment's model as the Explain data is written; fixed one by
one (bigger apparatus, a hidden quantity drawn in the scene — force arrows, field lines, current
direction, particles — never an invented result).

## 4. Missing simulations to build (from the comparison with the KNTT programme and Phú's list)

Physics: AC generator.
Chemistry: separation (model exists), precipitation (model exists), pH measurement (model exists);
enthalpy of neutralisation; halogen displacement; equilibrium and Le Chatelier; Daniell cell;
electrolysis; corrosion; saponification; Maxwell–Boltzmann distribution; collision theory at the
particle level; atoms (Bohr model, electron configuration, orbitals, periodic table); molecules
(3D shapes, VSEPR, bond polarity); reactions (verified library, equation balancing).
Biology: mitosis and meiosis (root-tip slides); DNA → mRNA → protein, point mutations;
Hardy–Weinberg and genetic drift; logistic growth and Lotka–Volterra; diffusion; plasmolysis and
its reversal; fermentation; heart rate and blood pressure; tropisms; DNA extraction; chromosome
mutation slides.

Theory simulations (orbitals, VSEPR, Maxwell–Boltzmann, population models, DNA → protein) are
done at a 3D simulation table in the lab: the model drawn in 3D above it, its settings and graphs
in 2D (the all-3D rule).

## 5. Progress

- 2026-11-08: gallery taken and reviewed (§1). Plan written. Next: the Explain view (§2).
- 2026-11-08: the Explain view built: `ExplainSystem` (gameplay; H, Esc, steps; the teacher's
  door: open/show/close), `explainFraming.ts` (close camera on the labelled parts, inside the
  room, optional per-experiment `view`; labels projected each frame), `ExplainView` (panel,
  labels with leader lines, the H hint), schema `explain` (+ `view`), strings, H in Controls.
  Tests: `ExplainSystem.test.ts` (4), `e2e/explain.spec.ts` (pendulum) PASS.
- Explain data for the existing experiments: delegated to one builder agent (only experiment
  JSONs and `.name` lines in apparatus models); pendulum written by hand as the reference.
- New stations use a kit: `scratchpad/kit/station.cjs` + a spec (placements: bench, desk, ≤ 4
  dials, RUN/STOP/RESET, display, monitor, overhead board; items; lab and topic lists). After a
  station: update the characterization tests (content.test laboratories + topics, catalog.test,
  apparatusExtents, consoleModel count +8, reveal count +1, quality glass list).
- Chemistry practical row positions (chemistry-lab): row 1 z −8.2 facing north (desk +z):
  x −7.5 (pH), −4.5, 3.5; row 2 z −4.6 facing south: x −7.5, −4.5, 3.5; row 3 z 1.6 facing
  south: x −7, −4, −1, 2.5. Theory simulations: a room of their own (to plan).
- Done: pH measurement (`ph-measurement`, model and bench already existed; registered).
- 2026-11-08: explain data for all 49 existing experiments written by the agent (reviewed by
  spot checks: titration, induction; hidden answers kept). Its SPEC GAPs for §3: physical-lab
  items (titration, dilution) are separate entities and cannot be anchored; projectile flight,
  rays (refraction, reflection) and standing-wave nodes are not objects to label.
- Chemistry practice room (`chemistry-annex`, x −30.25…−10.25, z −11…4, west of the Chemistry
  Lab through an opening at z −4.2; 1 key + 2 fills, the scene's light budget is now full).
  North wall stations (rotY 0, x −27, −23, −19, −15): pH, ions (precipitation), separation,
  neutralisation. Middle row M1 (z −5.2, rotY π, x −23.5, −19.5, −15.5): le-chatelier, …
  Middle row M2 (z −1.0, rotY 0, same x), south wall (z 3.6, rotY π, x −27…−15), west wall
  (x −29.85, rotY π/2, z −6, −2, 2) still free. Kit: `kit/register.cjs` registers a model and
  a bench model.
- New models with tests: `neutralisation` (ΔH −57.1 kJ/mol), `no2Equilibrium` (NBS ΔrH°, ΔrG°).
- Fixed on the way: Low's switched-off light follows the player's room; orbital-module pipes
  and hazard stripes no longer pass a corner.
- Characterization tests (counts, lists) are updated once per batch: run `npx vitest run src`.
- Chemistry practice room stations so far: north wall pH (−27), ions (−23), separation (−19),
  neutralisation (−15); row M1 (z −5.2, rotY π) equilibrium (−23.5), galvanic (−19.5),
  electrolysis (−15.5); row M2 (z −1.0, rotY 0) halogens (−23.5). New models with tests:
  galvanicCell (CRC E°, Nernst), electrolysis (Faraday), halogens (CRC E°).
  Next here: corrosion, saponification (M2 −19.5, −15.5); theory tables on the south wall
  (z 3.6, rotY π, x −27, −23, −19, −15) and west wall (x −29.85, rotY π/2, z −6, −2, 2):
  Maxwell–Boltzmann, collision theory, atoms (Bohr, configuration, periodic table), orbitals,
  VSEPR and polarity, balancing equations.
- Chemistry practicals done (10): + corrosion (M2 −19.5; rates illustrative, order is the
  result), saponification (M2 −15.5; stoichiometry exact, k illustrative). Gallery with Explain
  (`GALLERY=1 GALLERY_EXPLAIN=1 GALLERY_ONLY=<regex>`) checked: framing raised (elevation 0.5 rad,
  nearest 0.8 m) after the pH desk display hid the apparatus; the walking hint hidden in Explain.
- Chemistry theory tables (to build, one model + bench + JSON each; south wall z 3.6 rotY π at
  x −27, −23, −19, −15, west wall x −29.85 rotY π/2 at z −6, −2):
  1 gas-speeds (Maxwell–Boltzmann: v_p, v̄, v_rms from √(RT/M); particles in a glass box, speeds
  from the distribution's quantiles, deterministic);
  2 collision-theory (Arrhenius f = e^(−Ea/RT); second-order A + B → P, [A] = c₀/(1 + k·c₀·t);
  A illustrative, ratios exact; particles box);
  3 atomic-structure (Aufbau filling over the run: electrons per shell K L M N, period, group,
  valence; Cr and Cu exceptions; Bohr shells in 3D);
  4 orbitals (hydrogen: P(r) = r²R²; most probable and mean radius ⟨r⟩ = a₀/2·(3n² − l(l+1));
  nodes; point cloud in 3D);
  5 molecule-shapes (VSEPR: domains, lone pairs, measured bond angles and dipole moments from the
  literature; ball and stick, lone pairs, dipole arrow);
  6 balancing (a verified library; coefficients by the element matrix's null space; masses from
  standard atomic weights; a balance in 3D).
- Theory tables done: gas-speeds (south −27), collision-theory (south −23; added to the
  reaction-kinetics topic), atomic-structure (south −19; model found its own p-block group bug in
  test). New topic `particle-models`. Benches gas-box, reaction-box, bohr-atom (instanced balls,
  allocation-free poses). Next: orbitals (south −15), molecule-shapes (west z −6), balancing
  (west z −2); then Biology (annex), Physics AC generator, then unit + e2e + gallery.
- Chemistry done (17 new in the practice room): + orbitals (south −15), molecule-shapes (west
  z −6; NIST CCCBDB angles, CRC dipoles), balancing (west z −2; exact integer null space, IUPAC
  atomic weights; a two-pan balance with the atoms on its pans, level when balanced). Rigs whose
  hidden parts had a 1 m default scale now start at their drawn size (bounds count hidden parts).
  Characterization updated for the batch (topics, counts, glass, margins, PointsMaterial for the
  orbital cloud); `npx vitest run src` 3727 PASS (frameCap timed out once under load, PASS on rerun).
  Next: Biology annex and its simulations, Physics AC generator.
- Biology practice room (`biology-annex`, Phase X): west of the Biology Lab (x −35.25…−15.25,
  z −7.5…7.5 in the lab's frame, campus x −53.5…−33.5), its doorway in the lab's west wall at
  z 3.5 (2 m wide); 1 key + 2 fills like the chemistry room (the hub + Biology Lab pair is now
  over the renderer's light pool too: 3 keys, 9 others — listed in content.test as chemistry's
  and physics' are). Twelve simulation tables, each a pure model with its tests, a bench model,
  an experiment JSON with its Explain block (English and Vietnamese):
  - north wall (z −7.1): cell division — mitosis and meiosis (exact counts per cell: chromosomes,
    chromatids, DNA in C); gene to protein (the first 11 codons of human β-globin, the standard
    genetic code, sickle-cell Glu6Val, silent, nonsense, frameshift); population genetics
    (Wright–Fisher, seeded, Hardy–Weinberg 2pq, E[H] = 2p₀q₀(1 − 1/2N)^t checked over 300 runs);
    logistic growth (exact solution, K/2 day, rK/4);
  - south wall (z 7.1): predator and prey (Lotka–Volterra, RK4, conserved V checked); agar cubes
    (erfc diffusion edge, SA:V); plasmolysis (Boyle–van ’t Hoff, Ψs = −cRT); fermentation
    (C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂ exact, V = nRT/p, rates illustrative);
  - middle row (z 0): heart rate (Tanaka 208 − 0.7·age, Karvonen target, ECG trace); tropisms
    (Darwin / Boysen-Jensen conditions, gravitropism); DNA extraction (each step's role, shares
    illustrative);
  - west wall (z −2): human karyotypes (46,XX, 46,XY, trisomies 21/18/13, 45,X, 47,XXY; GRCh38
    lengths).
    New topics: genes-and-proteins, evolution, human-physiology, plant-responses; cells,
    membrane-transport, respiration and ecology gain theirs.
- Physics: the AC generator (ε = NBAω sin ωt, Faraday checked by differentiating the flux
  linkage; rms over whole turns) on the pendulum bay's east wall at z −14.4, clear of the
  pendulum's swing zone; topic magnetism.
- Chemistry: + balancing equations (west wall z −2; exact integer null space; IUPAC weights; a
  two-pan balance with the atoms on its pans).
- Units: time stays in seconds in every new model; population models show simulated days beside
  the run's seconds, and agar diffusion its depth in mm (DEVIATION from "SI everywhere": a
  readable unit for those two, noted in each experiment's note).
- `frameCap.test.ts`: its two Physics Lab boot loops get 20 s (about 1 s alone, past the 5 s
  default under a full parallel run since the content grew).
- Clarity fixes (§3), from the GPU gallery with Explain open (`GALLERY=1 GALLERY_EXPLAIN=1`):
  - a label on an instanced part with nothing drawn yet (yeast cells, rabbits, mRNA, bubbles,
    electrons before the run) had an empty box: the close view went off into a wall. It now
    takes the part's origin;
  - a hidden part (a ray before the run, a lone pair a molecule has not got) shows no label;
  - the station's desk display, which stood between the camera and the apparatus, is hidden while
    Explain is open;
  - the optics boards' rays (incident, reflected, refracted) are labelled and lit by their steps;
  - cell division draws few chromosomes large (2n ≤ 8 ×1.8) so a teaching cell reads at a glance;
  - the gene board has its own face-on view (`explain.view`).
  - `explainAnchors.test.ts`: every `{ part }` anchor names an object its bench model draws.
    Still open (SPEC GAP): the projectile's flight and the standing wave's nodes depend on the run
    and are not labelled objects; titration and dilution items picked up by the player keep their
    labels at the stand's points.
- Performance hygiene: the new benches' poses allocate nothing per frame (keys compared as
  numbers, index loops).
