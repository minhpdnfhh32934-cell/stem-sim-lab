# Phase T report — the high-school curriculum and the Physics wing

Contract: `docs/phase-t-curriculum-contract.md` (approved, all (a)). Plan of T-1:
`docs/phase-t1-physics-wing-plan.md` (approved, P1–P3 (a)), drawing `docs/plans/physics-wing.svg`.

## 1. T-1a — the Physics wing rebuilt, the stations moved with their present controls (2026-11-05)

### What changed

- **Rooms.** The Physics Lab 18 × 11.4 m (was 14) and **4 m high** (was 3.5: from the 3.5 m
  ceiling the key's cone could not reach the bench tops of an 18 m room's corners, 76.6° off its
  axis against the 75° allowed). A new **Waves & Optics room** (`waves-optics`, 10 × 11.4 × 3.5 m),
  east of the lab through a 2 m opening; the bay and the range keep their size. The scene lists
  four rooms; the laboratory names the new one.
- **Stations.** The 12 that moved (all but the launcher and the pendulum) stand on a lab bench
  against their wall (or on an island), their apparatus on it, their present control desk in front
  (temporary: T-1b replaces it by the instruments). Lab north wall: free fall, Hooke (floor rigs),
  buoyancy; south wall: Ohm's law, electrical power; islands: collisions (north), mechanical
  energy and the inclined plane (south); bay west wall: circular motion; optics room: refraction
  and reflection (east wall), the lens (south wall). The range keeps only the launcher.
- **Planned benches.** 19 benches for T-2 … T-4 with a "PLANNED · …" label (Vietnamese
  "SẮP CÓ · …") on their front, disabled.
- **The teacher's zone.** The old lab bench is the teacher's bench (with the steel ball and the
  desk lamp, moved by a pure shift of (−4, 0, −3.4)), a whiteboard, two cabinets and a sink by the
  hub door's wall.
- **The displays (Phú, 2026-11-05).** Results monitors are see-through glass screens that roll up
  out of a slot when the player comes within 3 m and roll down past 3.4 m; the instruction panels
  are glass panels hung over their station (base 2.05 m, 0.43 m off the wall), tilted 25° down,
  fading in and out at the same distances (`platform/render/reveal.ts`, item `visual.reveal`).
  Drawing only: aiming uses the item's box, actions are unchanged.
- **Light (Phú: every lab clearly lit; the optics room dark as first planned).** The renderer
  keeps 4 shadowed keys and 6 fills for the hub and the wing together: the optics room is a dark
  room (`dark: true`, one dim fill, no key: T-3 adds its switch and door), the bay lost its fill and
  its key moved over its middle and up to 4.6 lux (screenshots: even across the bay).
- **Saves.** `SAVE_VERSION` 7: a v6 save in the wing stands at its hub door and its stations'
  states and moved objects are reset (D6); test. Ended runs kept under a moved station's old id
  come back under its new one (`MOVED_STATIONS`); test.

### Changes to the approved plan

- Ohm's law and electrical power each on its own bench (each still has its desk; they may share
  one after T-1b), so the south wall's planned order shifted (EMF, RC, magnetic force).
- "Induction + generator" moved from a middle island (it stood in the straight aisle from the hub
  door to the optics door) to a third island on the north row.
- Circular motion against the bay's **west** wall: on the east wall it was nearer the pendulum's
  monitor stand than the pendulum, and the game picked it as the active station there.
- The bay's planned benches (resonance, radioactivity) shifted east to make room.
- The teacher's bench axis-aligned (a pure shift of the old bench: the steel-ball tests keep their
  geometry), a small sink instead of a sink bench (the walk to the range).
- No light switch in the optics room yet: a switch is door trim, only beside a door; it comes
  with the room's door in T-3.
- Reach: from a desk the instruction panel and the monitor must be within the player's 2.2 m, so
  desks stand against their bench and wall monitors 1.3 m up; the player's stands are 1.9 m from
  the wall (2.15 m at the floor rigs, 2.05 m at the whirl). Found by the first full e2e
  (21 failures), fixed in the layout, not in the tests.
- The inclined plane's results monitor stands beside its bench's west end (x 4.6), not on the
  bench's back: the ramp's aiming box (1.95 × 1.65 m, every angle) covered any screen behind it.
- The player reads the Hooke board from x 7.3: under the board (x 6.75) the air track on its
  island is nearer than the spring, and the game makes the nearest apparatus the active station.

### Tests

Unit: every test that pinned the old layout moved to the new one (zones regenerated from one
stand table, sweeps, lights, residency, hold, inventory, physical lab fixture moved with the
bench, station tests, continue poses); new: `reveal.test.ts`, the v6 → v7 migration, moved
stations' history.

- `npm run check`: **PASS** — 194 files, 3185 passed, 1 skipped.
- e2e: the station specs converted through the moved placements (a script mapping each point by
  its nearest moved placement; stands by rule), the rest edited by hand.
  - `npm run test:e2e` (full, 2 workers, SwiftShader): **FAIL** — 94 passed, 2 failed:
    `production.spec.ts` and `renderer.production.spec.ts`, each waiting 5 s for the first
    toast ("Preparation Room") after New game.
  - The same two alone, `npx playwright test e2e/production.spec.ts e2e/renderer.production.spec.ts`:
    PASS (3/3). With `--repeat-each=4`: **FLAKY** — 3 of 12 failed with 2 workers, 12/12 passed
    with `--workers=1`.
  - Timed (temporary instrumentation, removed): New game → toast took 1.2–2.8 s, once 7.7 s on
    the first, cold run. So the failures are a cold-start spike past the 5 s wait under two
    SwiftShader pages; whether T-1a made it more likely is not measured (no run at the previous
    commit). The tests are not loosened.
  - `npx playwright test e2e/hooke.spec.ts e2e/inclined-plane.spec.ts` after their fixes: PASS.
    Screenshots (SwiftShader, a temporary spec, deleted): the lab from the hub door, its north row,
    the optics room, the bay, the range, the teacher's zone; panels and screens near and far.

### Limitations

- The control desks are still there (T-1b).
- The optics room is dimly lit by one fill and has no switch or door yet (T-3).
- The bay has no fill light (the budget): its key alone, moved to the middle.
- The glass is a tint and an edge, not refraction.
- Between the collisions island and the north wall the active station is whichever apparatus is
  nearer: a player under the Hooke board (x < 7.2) gets the collisions station's task.
- The island results monitors' slots hang in the air over the bench (and the incline's beside it).
- No GPU A/B yet for the larger lab and the glass (to measure on Phú's machine).

## 2. Phú's first look at T-1a (2026-11-05): screens, light, knocks, the pick-up, music

Phú, on the real display: the screens' titles ran into their state; a thrown ball made no sound;
the pick-up was unfinished ("bend down, reach out, pick it up"); the teacher's board looked wrong
in colour and light; and music, on the menu and in the game, fitting the theme, chill, subtle.

### What changed

- **Screen titles.** A desk display's title fits beside its state (`STATE: …`), a results
  screen's across its width: at its size, smaller, then on two lines (`fitTitle`,
  `platform/render/ExperimentView.ts`). The long Vietnamese titles ("KHÚC XẠ ÁNH SÁNG VÀ PHẢN XẠ
  TOÀN PHẦN") were the worst; checked in both languages on screenshots.
- **The teacher's corner.** At High it was dark grey: outside the cones of the lab's three lights
  (the key over the middle reaches the west wall only at its edge; the fills light only below
  them). Two fills over the teacher's bench and its cabinets (`LIGHT_SLOTS.other` 6 → 8), and the
  rooms' soft light `INDOOR_AMBIENT` 0.55 → 0.8 (every enhanced room: walls far from a key were
  dim everywhere). A spot on the board was tried and dropped: it drew a visible oval. The board
  itself was measured in the browser (canvas pixels, GPU, High): slightly brighter than the wall,
  as its paint is — the corner, not the board, was dark.
- **Knocks.** `PhysicsSystem` publishes `Impact` (entity, change of velocity, where) when a free
  dynamic body's velocity changes in a step by more than gravity explains, by at least 0.7 m/s;
  quiet 0.08 s after a knock; never for a held or driven body. The sound bank's `impacts` map an
  item's look (`visual.material`) to a knock: metal, glass, hard (satin, plastic, painted), soft;
  louder the harder (gain = speed / 3 m/s, 0.15–1.3). 20 CC0 files from the Kenney Impact Sounds
  pack already downloaded with Phú's permission (`public/audio/impacts`, credited).
- **The pick-up from the floor.** The body leans down and looks at it, steps up to it if it is out
  of an arm's reach, the right hand reaches, opens and closes on it; it is taken then (0.85 s, the
  sequence's `effect`), not before, and comes up in the hand. Objects on a bench are still taken at
  once (deferring every grab broke 54 tests and the e2e flows that grab; not needed for Phú's ask).
- **Music** (`platform/audio/score.ts`, `music.ts`): written as it plays on Web Audio — slow
  chords on a soft pad (two detuned saws, low-passed), a sine bass, a few glass-bell notes drawn
  from the chord with an echo, in a long hall. The menu's mood: D major, 70 bpm, fuller; the labs':
  E minor, 60 bpm, sparser and quieter. A mood change fades over 4 s; it plays through a pause. A
  music volume (default 50 %) beside the others. No file, nothing downloaded.

### Tests

- New: `fitTitle.test.ts`, `score.test.ts`, the ball's knocks (`PhysicsSystem.test.ts`), the
  knock's cue (`cues.test.ts`), the pick-up's crouch, reach and late take (`ActionSystem.test.ts`).
  Updated: the light lists and pool, the hemisphere levels, entity counts (269), the volumes, the
  floor pick-ups in the titration and projectile tests (they wait for the hand).
- `npm run check`: **PASS** — 196 files, 3194 passed, 1 skipped.
- `npm run test:e2e` (full, 2 workers, SwiftShader): **FAIL** — 94 passed, 2 failed: the same two
  production specs as in §1, the same 5 s wait for the first toast after New game. Alone,
  `--repeat-each=3 --workers=1`: PASS (9/9). Still the cold-start flake of §1, not fixed.

### Limitations

- The music is synthesised: whether it sounds chill and fine is Phú's QA by ear. A recorded CC0
  piece can replace a mood later (a file in the bank) if the synth does not satisfy.
- A knock is one sound per impact; a ball rolling makes none (no rolling sound).
- More room lights and more ambient: the GPU cost is not measured; the shading is flatter.
- The pick-up was seen only on SwiftShader at about 8 fps: its smoothness needs the real display.

## 3. Phú's second look (2026-11-05): louder music, pieces by play time, the pick-up's hand, a run's beep

Phú: the music is right but hard to hear; several pieces, one after ten minutes of play, another
after twenty, fitting the time played and as memorable as a game's music can be; picking a ball up
from the floor, the hand drew back once and then reached out again for it; and a sound when an
experiment is run.

### What changed

- **Louder.** Each mood's level 0.55 / 0.32 → 1.1 / 0.9 and the music volume's default 50 → 70 %
  (a player who moved the slider keeps their own). Peaks of the rendered previews: 0.30–0.43 of
  full scale before the music and master volumes.
- **Pieces by play time** (`score.ts`): five lab pieces, each its own key, tempo, chords and theme,
  chosen by the time played in the world this visit — _First Light_ (D major, 66 bpm, from 0 min),
  _Notebook_ (G major, 72, from 10), _Afternoon Bench_ (A minor, 60, from 20), _Equilibrium_ (F
  major, 56, from 35), _Night Shift_ (D♭ major, 50, from 55) — and the menu's _SIMLAB_ (D major,
  70). Each about three minutes in sections of 8 bars (intro, theme, theme an octave up, bells,
  outro), its theme on a new voice, soft keys; after a lab piece 35–65 s of silence, then the piece
  for the time played by then. Original themes written for SimLab, not taken from any game.
- **The pick-up's hand** (`BodyView`): a hand that holds the object while a sequence's keys let go
  of it eases from its grip into the keys and back into its grip, not down to its side (it fell
  back to the hip and the grip then raised it again). Test: from the take until a second after the
  sequence, the right palm stays within 0.1 m of its final grip (without the fix: 0.98 m away).
- **A run's beep:** `ExperimentStarted` → `run-start`, a relay click and two rising beeps (made in
  code), heard from the station's apparatus.

### Tests

- New: the pick-up's hand (`reach.test.ts`), the run's beep (`cues.test.ts`), the pieces
  (`score.test.ts`: the time slots, about three minutes each, the theme in its key and sections,
  the chords, the bells, a silence after each lab piece).
- `npm run check`: **PASS** — 196 files, 3199 passed, 1 skipped.
- `npm run test:e2e` (full, 2 workers, SwiftShader): **FAIL** — 94 passed, 2 failed: the two
  production specs' cold-start wait of §1 again. Alone, `--repeat-each=3 --workers=1`: PASS (9/9).
- Previews for Phú's ears: each piece from two bars before its theme, 75 s, rendered offline by the
  game's own music code (mono, 22 kHz), `test-results/music-preview/*.wav` (not in git).

### Limitations

- The time played is this visit's (not saved): a new visit starts with _First Light_ again.
- Whether the themes stay with a player is Phú's ear; the synthesised voices are simple (sines,
  saws), not recorded instruments.

### Next step

Phú listens (the previews, then in the game) and checks the pick-up and the run's beep on the
300 Hz display; nothing is committed before. Then T-1b: the instruments in the hands replace the
control desks.

## 4. The next experiments, one per subject (2026-11-06, overnight)

Phú (2026-11-05, night): once the rooms' looks are done, unlock and build the next experiments of
all three subjects; skip what is risky; check the experiments myself. Built after U-5, on the same
uncommitted tree; not yet seen by Phú.

**Skipped as too risky for a night without Phú: T-1b** (the 14 existing physics stations from their
remote desks to the textbook's instruments by hand): it rewrites how every one of them is operated,
and every one of their e2e specs.

Each new station is the bench-station pattern of the physics benches (buoyancy, power, …): its apparatus on a
lab bench, a control desk with its dials, RUN, STOP and RESET, a desk screen, a results monitor and
an instructions board overhead; the layout of the energy station's island, moved. Each model is pure
and deterministic and tested against its analytic solution; each experiment states its simplified
model, its constants and their sources, and what a real lab adds, in English and Vietnamese.

### T-2a Physics — measuring speed with photogates (KNTT Vật lí 10, bài 6)

- **Model** `kinematics.photogate-speed` (`simulation/models/photogateSpeed.ts`): a solid steel ball
  (d = 2 cm) released at rest rolls without slipping down a rail tilted at α, a = (5/7)·g·sin α; two
  photogates whose beams cross the ball's centre line; the timer gives Δt_A, Δt_B and t_AB, every
  beam event solved exactly inside its step (results do not depend on the step). From them v = d/Δt
  at each gate and AB/t_AB between them; v_B² against gate B's distance is a line of slope 2a.
  Refuses a rail it cannot run (angle, gates' order, rail length) with its reason.
- **Tests** (`photogateSpeed.test.ts`): the times against s = ½·a·t² worked by hand at three step
  sizes, d/Δt within 0.1 % of the centre's speed √(2·a·x), the v² slope 2a within 0.1 %, the beams
  blocked only while the ball is in them, the refusals.
- **Station** on the planned speed bench of the Physics Lab (its "Planned" sign removed): bench model
  `photogate-rail` (the rail tilting to the dialled α, gate B at its distance, the ball rolling with
  the run, the timer's lamps lit while a beam is blocked); dials α (5, 10, 15°), gate B (0.5–0.9 m),
  the timer's resolution; the timer reads Δt_A, Δt_B and t_AB to its resolution.

### T-5a Chemistry — solubility and temperature

- **Model** `chemistry.solubility` (written and tested in Phase Labs, registered now): KNO₃, NaCl or
  KCl in 50 g of water at 20–80 °C; the solubility from the CRC Handbook (91st ed.) table, linear
  between its columns (every preset on one); dissolving by Noyes–Whitney with one illustrative time
  constant (60 s); the run ends when the last crystal goes or after 15 min of stirring.
- **Station** on a new island in the Chemistry Lab's free east half: bench model `solubility-station`
  (Phase Labs' draft, with its tests, registered now): hot-plate stirrer, beaker, three jars, balance,
  filter funnel, timer. Dials: the solid, T, the mass weighed, the balance's resolution; the balance
  reads the dried residue. Analysis: residue against mass at one solid and temperature, slope 1,
  crossing 0 at the mass 50 g of water holds.

### T-6a Biology — transpiration with a bubble potometer

- **Model** `biology.transpiration` (Phase Labs, registered now): stomatal and boundary-layer
  conductances in series (Campbell & Norman 1998; the stomata's light response and the conductance
  values illustrative, stated as such), E = g·D/P with the vapour-pressure deficit from the air's
  humidity; the bubble's travel along a 1 mm bore in 5 minutes of timing (shown in 5 s). The leaf
  area (50 cm²) and timing keep the bubble on its 30 cm scale at every preset.
- **Station** on a new island in the Biology Lab's open west half: bench model `potometer` (new):
  shoot in its sealed tube, capillary on its scale with the bubble moving with the run, the lamp lit
  with the dialled light, the fan turning when on. Dials: light (dark to 20 000 lux), humidity
  (30–90 %), fan (off, 1, 3 m/s), the scale's resolution. Analysis: E against D at one light and fan,
  a line through the origin of slope g/P.

### Also changed

- Topics: kinematics + measuring speed, solutions + solubility, a new Biology topic "Water in
  plants" (Trao đổi nước ở thực vật) for transpiration; each lab lists its new experiment last.
- Counts in tests follow the new stations (entities, bodies and colliders, desk controls, overhead
  boards, apparatus extents, glassware); the e2e canvas and draw-calls "lab-ceiling" view moved to
  x 3.967, z 0 (its old spot is now the speed station's desk); `physics-benches.spec.ts` takes a
  scene per bench and plays the three new stations as it plays the others.

### Tests

- `npm run check`: **PASS** — 203 files (with `game/experimentRuns.test.ts`, below).
- e2e, full (2 workers, SwiftShader): **FAIL** — 92 passed, 3 failed, 4 did not run:
  - `physics-benches` measuring speed, real: the run was failed at once. The model kept NaN for
    the times not yet measured; the runtime fails any run whose state is not finite. Its unit tests
    stepped the model directly and missed it. Fixed (0 until measured), and a new test,
    `game/experimentRuns.test.ts`, runs every shipped experiment at its defaults through the
    runtime (25, PASS).
  - `topics`, real: the catalog's lists lacked the new topic and experiments. Fixed.
  - `inventory` (carrying the ball through the hub door): passed when run again — FLAKY.
- Then `topics`, `physics-benches` (10 benches, the three new ones among them) and `inventory`:
  PASS, 18/18; `game` and `grab`: PASS, 4/4.
- Looked at in probe screenshots (SwiftShader): each station drawn, its desk screen showing its
  settings.

### Limitations

- The three stations are desk stations (dials and RUN), as the physics benches are today; done by
  hand with their instruments they wait for T-1b's pattern.
- Not seen on a real display; no GPU frame times.
- Chemistry's and Biology's plans were to be approved before building (Phase T contract §7): these
  two stations are built from models already written and tested, on free floor; Phú to confirm them
  or move them.

### Next step

Phú checks the three stations (and whether Chemistry's and Biology's stand where they should).
Then the next of T-2 (forces, moments, liquid pressure) and T-1b, the stations done by hand.

## 5. T-2, the rest of grade 10's practicals: forces, moments, liquid pressure (2026-11-06)

Phú: "continue in order" — the rest of T-2 in the textbook's order (KNTT Vật lí 10: bài 13, 21,
34). Three desk stations in the pattern of §4, each model pure, deterministic and tested against
its analytic solution worked out by hand.

### Composition of concurrent forces (bài 13)

- **Model** `statics.concurrent-forces`: two spring balances pull a light ring with F1 and F2 at α;
  a third, turned opposite their resultant, holds it on the board's centre mark and reads
  R = √(F1² + F2² + 2·F1·F2·cos α), its direction θ from F1 by tan θ = F2·sin α/(F1 + F2·cos α).
  The run lets the ring go 1 cm towards the third balance and it settles critically damped (a
  stated simplification of the settling; the readings at rest are exact; closed form in time).
  A resultant past the balance's 10 N is refused. Analysis: F3² against cos α, slope 2·F1·F2,
  intercept F1² + F2². Tests: 3 N and 4 N at 90° make 5 N at 53.13°; three more cases by the rule;
  the line; the settling at two step sizes; the refusals.
- **Station** on the planned composition bench of the north wall: bench model `force-board`
  (protractor board, ring, three balances turned to their directions, red indicators at their
  readings). Dials F1, F2 (1–4 N), α (30–150°), the balance's resolution.

### Moment of a force: the lever balance (bài 21)

- **Model** `statics.lever`: masses m1 at d1 left and m2 at d2 right of a pivot; the bar, released
  level, balances when m1·g·d1 = m2·g·d2, else turns to the larger moment and rests on a stop at
  ±10°; its swing (I + m1·d1² + m2·d2²)·θ'' = (M2 − M1)·cos θ − c·θ' integrated at a fixed 0.5 ms
  whatever the runtime's step, the stop exact within a sub-step and inelastic (I of the bar and the
  pivot's damping illustrative). Analysis: M2 − M1 against d2, slope m2·g, zero at d2 = m1·d1/m2.
  Tests: 100 g at 15 cm against 50 g at 30 cm stays level; the stop of the larger moment; the same
  swing at two runtime steps; the line; the refusals.
- **Station** on the planned moment bench beside it: bench model `lever-balance` (post and pivot,
  bar with a hole every 5 cm, pointer and scale, stops, two hangers with 50 g slots, plumb as the bar
  turns). Dials m1, d1, m2, d2; no instrument (the moments are worked out from the set values).

### Pressure in a liquid against depth (bài 34)

- **Model** `fluids.liquid-pressure`: a probe lowered at 5 cm/s to depth h in water, 26 % salt
  water or ethanol (CRC Handbook densities at 20 °C: 998.2, 1197.2, 789.3 kg/m³), a water U-tube
  manometer: p = p0 + ρ·g·h, Δh = (ρ/ρ_w)·h; quasi-static, closed form in time. Analysis: ρ·g·h
  against h, slope ρ·g. Tests: 20 cm of water gives 1958.5 Pa and Δh = 20 cm; the other liquids'
  Δh; the probe's descent; the line; the refusals.
- **Station** on a new island, the free one at x 15, z 2.632 (opposite the planned induction
  bench): bench model `pressure-tank` (glass tank with a depth scale, the probe on its rod, the
  U-tube's columns parting by Δh, the liquid's colour). Dials: the liquid, h (5–25 cm), the
  manometer scale's resolution; the scale reads Δh.

### Also changed

- Topics: dynamics + composition of forces and moment, fluids + liquid pressure; the force board's
  pose no longer makes closures each frame (`for` loops, as the other bench models).
- Counts in tests follow the new stations (Physics wing 88 bodies, 122 colliders, 322 entities; 161
  desk controls; 20 overhead boards; three apparatus extents; the pressure tank's glass).

### Tests

- `npm run check`: **PASS** — 209 files, 3312 passed.
- e2e, full (2 workers, SwiftShader; a first run was stopped at Phú's word after 54 of 102, all
  passed): **FAIL** — 97 passed, 1 failed, 4 did not run (the timed specs wait for the rest). The
  three new stations in `physics-benches` and `topics` passed. The failure was the reflection
  bench, untouched here: its route did not reach its point in time; alone it passed — FLAKY, not
  PASS. Then `game` and `grab` alone: PASS, 4/4.
- Probe screenshots (SwiftShader): each station drawn, its desk screen showing its settings.

### Limitations

- Desk stations, as the others; by hand with their instruments they wait for T-1b.
- The force board's settling and the lever's pivot damping are illustrative (stated in their notes);
  the readings at rest and the moments are exact.
- Not seen on a real display; no GPU frame times.

### Next step

Phú checks the three stations and decides the commit. Then T-3 (grade 11) or T-1b.

## 6. T-3, grade 11's practicals (2026-11-06)

Phú: "continue" — grade 11 in the contract's order (KNTT Vật lí 11): resonance (bài 6), the
frequency of a sound (bài 10), interference (bài 12), standing waves (bài 13), the speed of sound
(bài 15), capacitors (bài 21), EMF and internal resistance (bài 26). Seven desk stations on the
planned benches kept for them (§4's pattern), each model pure, deterministic, closed form or at a
fixed sub-step, and tested against its analytic solution.

**Skipped as risky:** the ripple tank (two-source interference on water: it needs an animated
water surface) and the electric field simulation (charges and field lines: a visualisation more
than a practical). Their planned benches stay.

| Experiment                       | Model                                                                                                                                                           | Station (planned bench)                                                                                                              | Checked against                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Forced oscillation and resonance | `oscillations.resonance`: x″ + 2ζω0x′ + ω0²x = ω0²a·cos ωt from rest, in closed form; the amplitude measured over the last drive period at the run's end (20 s) | pendulum bay, north wall: bench model `resonance-rig` (motor, spring, mass, vane, scale)                                             | the ODE by finite differences; A = a/(2ζ) = 10 cm at resonance; A off it; the peak at f0·√(1 − 2ζ²)          |
| Frequency of a sound             | `waves.sound-frequency`: a fork's tone v0·e^(−t/τ)·sin 2πft on an oscilloscope; T = 1/f spans T/time base divisions                                             | optics room, south wall: `oscilloscope-bench` (fork, microphone, scope drawing the model's own tone)                                 | 440 Hz at 0.5 ms/div spans 4.545 divisions; zeros every half period; a period longer than the screen refused |
| Young's double slit              | `optics.double-slit`: i = λD/a; I/I0 = cos²(πay/λD)·sinc²(πby/λD); a sensor scans the screen                                                                    | optics room, north wall: `double-slit-bench` (laser, slits, screen at D, fringes drawn from the model at their real spacing, sensor) | 650 nm, 1 m, 0.3 mm gives 2.167 mm; the 6th fringe missing (a/b = 6); i ∝ D                                  |
| Standing waves on a string       | `waves.standing-string`: v = √(T/μ), f_n = n·v/(2L); the generator swept to f_n, the n-th mode's response                                                       | optics room, north wall: `string-vibrator` (generator, string drawn as its envelope, pulley, slotted masses)                         | v = 31.32 m/s for 100 g on 1 g/m; f_n ∝ n; four times the mass doubles f_n                                   |
| Speed of sound                   | `waves.resonance-tube`: L1 = λ/4 − e, L2 = 3λ/4 − e, e = 0.6r; v = 331.3·√(1 + t/273.15)                                                                        | optics room, south wall: `resonance-tube-rig` (tube, scale, fork, reservoir)                                                         | 343.2 m/s at 20 °C; λ = 2(L2 − L1) free of e; loudest at L1; a tube too short refused                        |
| Capacitor                        | `electric.rc-circuit`: charge for 5τ, discharge for 5τ, τ = RC                                                                                                  | Physics Lab, south wall: `rc-board` (battery, two-way switch, resistor, capacitor, voltmeter, centre-zero ammeter)                   | τ = 1 s for 1 kΩ and 1000 µF; 63 % at τ; the current reversed and 37 % one τ into the discharge              |
| EMF and internal resistance      | `electric.cell-emf`: I = E/(R + r), U = E − I·r (r illustrative and hidden: found from U against I)                                                             | Physics Lab, south wall: `cell-board` (cell, switch, rheostat, meters)                                                               | 1.5 V, 0.3 Ω into 2 Ω gives 0.652 A, 1.304 V; U against I slope −r through E                                 |

Constants and their sources are in each experiment's note; illustrative values are stated as such
(damping, the vane, the fork's ring-down, the resonance tube's sharpness, the cells' internal
resistances).

### Also changed

- A stale coordinate from U-2 fixed in `RefractionStation.test.ts`: its "at its desk" point was
  the optics room's old one (x 21.35); the room moved 6 m east, and the double-slit station now
  stands near the old point. Now x 27.35.
- Topics: oscillations and waves + four, electricity + two, optics + double slit. Counts in tests
  follow (Physics wing 102 bodies, 136 colliders, 395 entities; 213 desk controls; 27 boards).
- The two south-wall desks (capacitor, EMF) had their fourth dial on top of the second: the layout
  script moved it +0.2 m in x, right for a turned (north) desk, wrong for a moved (south) one. Now
  −0.2 m there (`rc-dial-timer` x 13.333, `emf-dial-ammeter` x 9.867); e2e found it.
- `e2e/grab.spec.ts`: the walk to the teacher's bench held W for 650 ms. With the Physics Lab at 282
  draw calls (166 on 2026-11-05) SwiftShader draws it at 11–12 FPS, and the timed hold stopped 1 cm
  short of the bench's end (x −2.98, three runs alike). Now `walkUntil` (closed loop, x ≥ −2.6).

### Tests

- `npm run check`: **PASS** — 222 files, 3366 passed.
- e2e in two shards (Phú: one extra agent tests in parallel), Edge on SwiftShader:
  - Shard A (warmup, dev and production projects on its spec files): **65 passed, 2 failed** —
    capacitor and cell-emf, their fourth dial over the second (above). After the fix,
    `SIMLAB_DEV_ONLY=1 npx playwright test --project=warmup --project=dev e2e/physics-benches.spec.ts -g "capacitor|cell-emf"`:
    **PASS** (3 passed).
  - Shard B (22 spec files, port 5299): **37 passed, 2 failed**. doors "hub → physics-lab → hub" (a
    1.10 m step against the 1 m cap) and settings "pendulum bay" (the Settings button timed out). The
    settings failure fell while thầy wrote `lab-placements.json` during the run (a broken rule: the
    dev server reloads); the agent's solo rerun ran beside `npm run check` and failed it again, with
    the ceiling test (left on the menu after Continue). Rerun alone,
    `SIMLAB_DEV_ONLY=1 npx playwright test --project=warmup --project=dev e2e/settings.spec.ts e2e/doors.spec.ts`:
    **10 passed**. The doors step is **FLAKY** (1 of 3 runs failed), not PASS.
  - Timed, alone (`npx playwright test --project=dev-timed --no-deps`): game 3 passed; grab failed 3
    of 3 (the walk above). With `walkUntil`: 5 of 6 runs passed; one failed on a `toBeLessThan`
    check whose detail the next run overwrote — **FLAKY**, cause not found.
- Probe screenshots (SwiftShader): each station drawn, its desk screen showing its settings.

### Limitations

- The desk screens print small SI values in exponent form (λ "6.5e−7 m", a "0.0003 m"): correct,
  not friendly; a formatting pass for nm and mm would read better (units stay SI underneath).
- Desk stations, as the others; the ripple tank and the field simulation are not built.
- Not seen on a real display; no GPU frame times.
- The Physics Lab's draw calls went from 166 to 282 in two days (T-1a to T-3: dressing and the new
  stations); on SwiftShader under Low it runs at 11–12 FPS. Merging each station's static parts
  would bring it down; `npm run bench` on the real GPU should check the Low-end budget.

## 7. T-4, grade 12's practicals (2026-11-06)

Phú: finish Physics (while one agent builds Biology in its own worktree). Grade 12 in the contract's
order (KNTT Vật lí 12): specific heat and latent heat (bài 4–6), Boyle and Charles (bài 9–10), the
magnetic force (bài 15–17), induction (bài 16–18) and radioactivity (bài 23, a simulation, D4).
Seven desk stations on the planned benches kept for them, each model pure, deterministic (the
decay counter's randomness from a seed), closed form, and tested against its analytic solution.

**Not built: the AC generator** (e = NBSω·sin ωt): the plan left it no bench; it would want a
rotating coil and a second island. Listed for later.

| Experiment                     | Model                                                                                                                                                                                        | Station                                                                                                            | Checked against                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Specific heat of water         | `thermal.specific-heat`: (m·c + C)·dT/dt = P − k·(T − T0) in closed form (Newton's cooling, D9; k and C illustrative); c worked as the practical does, (E/ΔT − C)/m, comes out a little high | east wall: `joulemeter-calorimeter` (can, lid, stirrer, heater leads, joulemeter, thermometer reading the run's T) | the ODE by Euler steps; without loss c back exactly; with it a few per cent high                                                          |
| Latent heat of fusion          | `thermal.latent-heat`: a heated funnel and a control, both taking the room's heat (illustrative 1.5 W); λ = E/(m₁ − m₂), and E/m₁ without the control (low)                                  | east wall: `ice-funnels` (two funnels of ice, heater, beakers filling with the run's meltwater at its real volume) | 26.98 g and 1.08 g for 36 W, 4 min; λ = 333.6 kJ/kg back from the difference                                                              |
| Boyle's law                    | `gases.boyle`: p·V = p0·V0 while the piston moves slowly from V0 to V; past the gauge's 300 kPa refused                                                                                      | east wall: `boyle-syringe` (60 mL syringe, plunger at the run's V, gauge needle at its p)                          | 60 → 30 mL doubles p; p·V constant along the push; p against 1/V through the origin                                                       |
| Charles's law                  | `gases.charles`: L = L0·(t + 273.15)/(t0 + 273.15) as the bath is heated (or cooled to 0 °C)                                                                                                 | east wall: `gas-column` (bath on a hot plate, capillary, index at the run's L, ruler, thermometer)                 | 10 cm at 20 °C → 12.047 cm at 80 °C; the line's zero at −273.15 °C                                                                        |
| Magnetic force                 | `magnetism.current-balance`: F = B·I·L·sin α, the balance reading F/g (B illustrative, 0.06 T, off the desk)                                                                                 | south wall: `current-balance` (U-magnet on a balance turned to α, wire across the gap, supply and ammeter)         | 2 A, 4 cm, 0.06 T: 4.8 mN, 0.489 g; F ∝ sin α                                                                                             |
| Induction                      | `magnetism.induction`: a point dipole along a coil's axis, the exact flux Φ = μ0·m·a²/(2(z² + a²)^(3/2)); e = −N·dΦ/dt, two pulses peaking at z = ±a/2                                       | island: `induction-coil` (track, coil, magnet at the run's z turned by the pole first, centre-zero galvanometer)   | e against a finite difference of N·Φ; peak 3μ0mNv/(4a²·1.25^2.5); signs swapped by the pole; ∝ N and v                                    |
| Radioactive decay (simulation) | `nuclear.decay-counter`: Poisson counts per interval of mean R0/λ·(e^(−λt) − e^(−λ(t + Δt))) + B·Δt from a seed (`draw`); T½ fitted from ln(N − BΔt)                                         | pendulum bay, north wall: `decay-counter` (lead holder, GM tube, counter whose lamp follows the count rate)        | Poisson mean and variance; same draw same counts; first interval's mean over 400 draws within 4σ; T½ back within 8 % from a strong source |

Constants and sources are in each experiment's note (CRC Handbook for c and λ, CODATA 2018 for μ0,
ENSDF for Pa-234m's 1.159 min); illustrative values are stated as such (the calorimeter's C and
loss, the room's heat to the ice, the gauge's range, B, the magnet's moment and the coil's
resistance, the background).

### Also changed

- `READING_UNITS` adds `m³`, `kg`, `J` and `Pa`: a syringe, a balance read in SI, a joulemeter, a
  gauge (each a linear scale, so u = d/√12 holds); docs follow.
- The magnetic field was first a hidden input; the content check refuses analyses with a hidden
  input (theory withheld), so B is kept off the desk instead and named in the note: find it from
  the slope and compare.
- The desk holds four parameters: the specific heat's heating time is fixed at 5 minutes (shown).
- Three stations moved off their planned benches: the current balance from x 17.2 to 15.6 on the
  south wall (its desk overlapped the Charles station's in the corner); the Charles station 0.1 m
  south (its monitor was past the room); the calorimeter from z −6.4 to −5.6 — at −6.4 its dials
  faced the buoyancy station's bench across a 0.43 m gap the player could not stand in (e2e found
  it: the save's stand there was refused and the player put at the spawn).
- `e2e/game.spec.ts` walks to the teacher's bench by position (`walkUntil`), as grab does since
  T-3; `grab.spec.ts` keeps every refresh of the debug panel during the throw (a MutationObserver)
  instead of polling it.
- The decay counter's seed is `draw`, not `sample`: a save must not read like run data
  (`StationHistory.test.ts`), whose size bound is now per station (32 stations, 4.6 kB).
- Every station has six checklist steps as the others (a second setting before RUN).
- New topics: Thermal physics, Ideal gases, Magnetism, Nuclear physics (EN + VI). Counts in tests
  follow (Physics wing 116 bodies, 150 colliders, 469 entities; 266 desk controls; 34 boards).

### Tests

- `npm run check`: **PASS** — 227 files, 3415 passed.
- e2e (Edge, SwiftShader), `SIMLAB_DEV_ONLY=1 npx playwright test --project=warmup --project=dev --workers=2 e2e/physics-benches.spec.ts e2e/topics.spec.ts e2e/resources.spec.ts e2e/settings.spec.ts`:
  **37 passed, 2 failed** — specific heat (the corner above) and the catalog's topic headings (the
  spec lacked the four new topics). Both fixed; rerun
  `... -g "specific-heat|catalog"`: **PASS** (6).
- Timed, alone (`npx playwright test --project=dev-timed --no-deps`): first run 2 failed — game's
  timed walk (as grab's in T-3) and grab's throw. After the fixes, three runs: game **PASS** 3/3;
  grab passed 2 of 3, the third saw no bounce off the wall — **FLAKY**: the debug panel refreshes at
  4 Hz and the ball's stay by the wall is shorter at the Physics Lab's 12 FPS; reading it every frame
  would need a dev hook the game does not have.
- After the Biology merge (`docs/phase-t6-report.md`): `npm run check` **PASS** — 234
  files, 3467 tests; e2e of the four Biology stations, transpiration, the catalog and the draw-call
  views, `--workers=2`: **PASS** (25).

### Limitations

- Desk stations, as the others; the AC generator is not built.
- The radioactivity station's results are random by design: none is compared with theory exactly;
  its fitted T½ scatters about the true one.
- Desk screens print small SI values in exponent form (as T-3's), more of them now (m³, kg).
- Not seen on a real display; no GPU frame times. The Physics Lab grows again (seven desks): on
  SwiftShader at medium its spawn view draws 2016 calls a frame with the key lights' shadow passes
  (`e2e/draw-calls.spec.ts`), the next task's starting point.

### Next step

Phú checks the seven stations (and where the current balance now stands). Then the Biology
agent's experiments (reviewed by thầy) and the distance-based loading setting Phú asked for.

## 8. Rooms out of sight: not drawn, not on the GPU, back before the door opens (2026-11-06)

Phú: an option in Settings — in the Physics Lab, far from a door, the 3D models and lights beyond
it are neither loaded nor run; walking towards the door brings them back before the threshold, so
the game does not stall on a sudden load.

### The rule (`world/dormancy.ts`, pure, tested)

A room is seen only through a passage from a room that is seen: a doorless opening always shows
it, a shut door never. Awake: the player's room, and every room reached from it through doorless
openings, open doors, or doors the player is within 7 m of (`DORMANCY.wakeM`); a room stays awake
out to 9 m (`sleepM`), so it does not flicker at the edge. The Physics wing's doors open at 2.2 m
(`slider.near`): a room wakes 4.8 m before its door can show it. Passages come from the content:
two rooms leaving the same gap in their shared wall (`leadsInto`), closed by the door leaves
standing in it — the lab's three, to the bay, the optics room and the range, all sliding doors.

### What sleeping does (`platform/render/roomSleep.ts`)

- Everything drawn of the room — its shells and dressing, its decor (now batched per room, which
  also made the darkness of decor exact per room), its entities' views (not what the player holds)
  — moves to a layer no camera and no shadow camera sees: no draw, no shadow pass.
- Its room lights leave their slots (4 key, 8 other) to the rooms awake.
- The GPU buffers only it uses are freed (`BufferGeometry.dispose`; three uploads them again at
  their next draw; the arrays stay in memory). **Textures are kept**: freed, SwiftShader prepared
  them again only when they were first sampled over the screen — a ~300 ms frame the moment the
  room appeared (measured: with textures freed 300, 317 ms; geometry only, ≤ 133 ms). A room's
  textures are few (labels, floor tiles).
- Waking (within 7 m, the door still shut): its objects are compiled and drawn into one pixel, a
  few a frame — the warm-up a neighbour scene gets when attached — then shown. A door opening on a
  room still waking shows it at once (a slow frame rather than an empty room). The warm-up's
  "first draws" now count every texture of a material, not only its `map`.
- Judged four times a second, never per frame. Simulation, physics and every game system run in
  every room as before: only what is drawn changes.
- Settings: "Draw only rooms you can see" / "Chỉ vẽ các phòng bạn có thể nhìn thấy", on by default
  (`simlab.settings.roomSleep`, a browser preference, outside the save). The debug panel shows
  `Asleep:` (and the rooms waking).

### Measured (SwiftShader, `e2e/draw-calls.spec.ts`; draws include the shadow passes)

| View                                  | Before (draws / GL buffers) | After                     |
| ------------------------------------- | --------------------------- | ------------------------- |
| physics-lab spawn, medium             | 2016 / 2465                 | 1136 / 1770               |
| physics-lab lab-ceiling, high         | 1257 / 1496                 | 558 / 1109                |
| physics-lab lab-ceiling, low          | 202 / 567                   | 141 / 420                 |
| physics-lab pendulum, medium          | 1226 / 1420                 | 764 / 1247                |
| physics-lab range-lane, medium        | 1814 / 2111                 | 1348 / 1575               |
| biology-lab, chemistry-lab, hub spawn | 357, 295, 182               | unchanged (one room each) |

`e2e/room-sleep.spec.ts`, in the lab 7.6 m from the bay's door: asleep, 565 GL buffers; walking to
4.6 m wakes the bay (861 buffers, as with the setting off) with the door still shut; the longest
frame of the walk 99.9 and 116.7 ms in two runs against a median of 50 ms (before the texture fix:
250, 267, 300 ms). Setting off: 300 draws, 861 buffers at that stand; on: 153, 565. **SwiftShader
numbers, not a GPU's**; `npm run bench` on the real GPU not run.

### Tests

- Unit: `world/dormancy.test.ts` (7: the wing's passages from content, the rule and its gap),
  `platform/render/roomSleep.test.ts` (7: layers, shared buffers kept, the wake after the warm-up,
  asleep again while waking, a door opening on a room waking, the setting off, a spawn in a room
  asleep), `Game.test.ts` (the setting's warning when storage fails).
- `npm run check`: **PASS** — 236 files, 3481 tests (one run had `quality.test.ts`'s Hooke-run test
  time out under load; alone and in the next full run it passed — FLAKY under load, as before).
- `e2e/room-sleep.spec.ts` (3): the bay asleep and woken on the walk, the setting off and on in the
  pause menu, and three wakes and sleeps leaving the same GL objects (874 buffers asleep and 1023
  awake in the second and third cycles alike; the first draws everything once) — **PASS**.
- `e2e/resources.spec.ts` now runs with the setting off: with it on, what is drawn depends on where
  each walk stops (the lab's arrival from the hub is near the 7 m at which the range wakes: 159 or
  308 draws). Its own leak check is the cycles above.
- Full suite, in two shards at once (Phú: one agent tests in parallel), Edge on SwiftShader:
  - A: `npx playwright test --project=warmup --project=dev --project=production --workers=1` on 21
    spec files (physics benches, draw calls, room sleep, the older experiments, production):
    **81 passed** (41.1 min).
  - B: `SIMLAB_DEV_PORT=5299 SIMLAB_PREVIEW_PORT=5298 SIMLAB_DEV_ONLY=1 npx playwright test --project=warmup --project=dev --workers=1`
    on the other 22: **39 passed** (30.7 min).
  - Timed, alone, three times (`npx playwright test --project=dev-timed --no-deps`): **4 passed** each
    time (game ×3, grab).
  - An earlier full run, stopped halfway by Phú's pause, had failed `resources` (above) and
    `titration-physical` (the burette did not fill with both shards loading the machine; alone it
    passed, and in the full run above) — FLAKY under load, not PASS.

### Found by Phú: dark rooms after a visit to the other labs

Phú, on his display: back in the Physics wing after the Chemistry and Biology labs, the range, the
bay and the optics room were dark and empty (only the lane's tape and the light's cone). Cause: the
wing, attached again through the hub's door, has its objects on the warm-up's pending layer (31)
while it is warmed; the rooms put to sleep in that time saved that borrowed layer as their own, so
when they woke they went back to it and were never drawn. The first visit (a load, not an attach)
had no pending layer, so it looked right. Fixed: a room put to sleep keeps the layers an object
will have (the warm-up's 30 and 31 never count), and the attach's warm-up leaves a room asleep
asleep. Tests: `roomSleep.test.ts` (a pending object asleep, then woken: layer 0), and
`e2e/room-sleep.spec.ts` "back from the hub": standing 5.2 m from the range's door, 151 draws before
a hub round trip and 88 after it on the old code (**FAIL**, the bug reproduced), 148 after with the
fix (**PASS**); the four other room-sleep tests, doors, transitions and inventory: **PASS** (8),
`npm run check` **PASS** (236 files, 3482 tests).

### Limitations

- Textures of a room asleep stay on the GPU (above).
- Only rooms joined by doors in content sleep; a room seen through a doorless opening stays awake
  with the room in front of it (by design: it can be seen).
- An object rolling out of a room asleep through its shut door cannot happen (doors are shut); an
  object pushed through an open door is judged by where it stood when its room fell asleep.
- The experiment rigs of a room asleep are still posed (cheap: a pose changes nothing unless its
  run's values change); runs go on, as they must.
- Not felt on Phú's display; no GPU numbers.

## 9. The ripple tank: interference of water waves (2026-11-07, Phú: "bắt đầu làm tiếp các thí nghiệm chưa được mở khóa" — not committed)

What was still locked: in the Physics wing, the ripple tank's and the electric field's "Planned"
benches (the AC generator has no bench); in Chemistry, T-5 (§8 of the contract, its plan not yet
drawn up). This step unlocks the ripple tank (contract §2, grade 11 · B12).

### Built

- **Model** `waves.ripple-tank` (`simulation/models/rippleTank.ts`): two dippers S1S2 apart, in
  phase at f, on water h = 5 mm deep. The wavelength is not chosen: k solves the capillary–gravity
  dispersion ω² = (g·k + (σ/ρ)·k³)·tanh(k·h) (Lamb §267; water at 20 °C, σ = 0.0728 N/m,
  ρ = 998 kg/m³, CRC), by bisection. Along S1S2 the paths differ by 2x: maxima at x = m·λ/2,
  A = 2·A0·|cos(k·x)|. Results: the maxima n between the sources, L from the first to the last,
  λ/2 = L/(n − 1), λ, v = λ·f (0.22–0.25 m/s over 10–25 Hz: the speed changes with f, as real
  ripples do). The run: a probe crosses S1S2 in 6 s. Refused: sources closer than one wavelength.
  Equal sources, no damping, no reflection from the sides.
- **Station** on the optics room's planned bench (x 23.6, z −5.3; the sign removed): item
  `ripple-tank-bench`, its board, a desk with dials f (10/15/20/25 Hz), S1S2 (4/6/8 cm), ruler d,
  RUN/STOP/RESET, display and monitor (graph: A/A0 along S1S2). Topic: oscillations and waves,
  after the sound frequency (KNTT 11 order).
- **Apparatus** `render/bench/ripple-tank-bench.ts`: the tank on legs, the bar and its motor, the
  stroboscope lamp, a ruler on the floor; the rig draws the water from the model's own k: per texel
  cos(k(r1 − r2)/2) and k(r1 + r2)/2 worked out when f or S1S2 change, one cosine a texel a frame
  while the vibrator runs (384 × 224 texels, ~2 mm each), the ripples drifting at 0.8 Hz as seen
  through a stroboscope slightly off f; still water otherwise.

### Tests

- `npm run check`: **PASS** — 246 files, 3555 tests (`rippleTank.test.ts`: the dispersion's
  shallow √(gh), deep-gravity ω²/g and deep-capillary limits, the minimum speed (4gσ/ρ)^¼ ≈
  0.231 m/s at λ ≈ 17.1 mm, 11 maxima for 6 cm at 20 Hz, the probe's scan, refusals;
  `ripple-tank-bench.test.ts`; counts and lists of the layout tests).
- `npx playwright test --workers=1 e2e/physics-benches.spec.ts -g ripple-tank` (SwiftShader):
  **PASS** — read the board, f 20 → 25 Hz, S1S2 6 → 4 cm, RUN, n = 9, L, v = 0.248 m/s on the
  monitor equal to the theory. `e2e/topics.spec.ts -g "opened from the Home"`: **PASS**, the
  catalog in English and Vietnamese.
- The water's texture dumped while running (20 Hz and 10 Hz): nodal hyperbolas from the two
  sources, as in a real tank.

### Not done, limitations

- Not seen on Phú's display; no GPU numbers. The water texture is recomputed and uploaded every
  frame of a run (6 s; ~86 k cosines and 344 KB a frame).
- The results show the count n with three decimals ("9.000"), as every result.
- Next: the electric field simulation (its planned bench), then the AC generator (needs a bench
  place: Phú's choice) and the Chemistry T-5 plan.

## 10. The electric field of point charges, a simulation (2026-11-07 — not committed)

The second planned bench of the optics room (contract §2, grade 11 · B16–18: "new, simulation").

### Built

- **Model** `electric.point-charges` (`simulation/models/pointCharges.ts`): Q1 and Q2 (0 for
  none) 0.2 m apart; on the axis outside Q1, r from it, E = k·Q1/r² + k·Q2/(r + d)² with
  k = 1/(4πε0) (ε0 CODATA 2018), F = q·E on a 1 nC test charge. Results at the dialled r: E1, E2,
  E, F; the run: a probe from 3 to 25 cm in 6 s, reading E. `chargeField` gives the field in the
  plane for the drawn lines.
- **Station** on the island bench in the middle of the optics room (x 24.25, z 0; the sign
  removed): item `electric-field-display` (a tilted dark screen on a case), its board overhead,
  a desk on the room side with dials Q1 (+2/+5/−5 nC), Q2 (none/+5/−5 nC), r (5/10/20 cm),
  RUN/STOP/RESET, display and monitor (graph: E along the axis). Topic: electricity, first.
- **Apparatus** `render/bench/field-display.ts`: the charges at full size on the screen, red
  positive, blue negative (Q2 hidden when none), field lines traced from the model's own field
  (RK2, 3 mm steps; 16 lines for 5 nC, from the positive charges, or back to the negative ones
  when there are none), an arrow on each, the probe on the axis. Traced when a charge changes.

### Tests

- `npm run check`: **PASS** — 248 files, 3568 tests (`pointCharges.test.ts`: k, 4494 V/m at
  10 cm from 5 nC, the inverse square, superposition on and off the axis, zero between equal
  charges, the scan, refusals; `field-display.test.ts`: radial lines, their count, lines ending
  on −Q2, the probe).
- `npx playwright test --workers=1 e2e/physics-benches.spec.ts e2e/topics.spec.ts -g
"electric-field|opened from the Home"` (SwiftShader): **PASS**, 3 — Q2 +5 nC, r 20 cm: E1
  1123 V/m, E2 280.9 V/m, E 1404 V/m, F on the monitor equal to the theory.

### Not done, limitations

- Not seen on Phú's display. The charges show as "5e−9 C" and the force as "0.000001404 N"
  (SI, the shared number format); the screen is small seen from the desk.
- The AC generator still has no bench; the Chemistry T-5 plan is not drawn up.

## 11. Physics gaps: uniform motion, Newton's second law, the Atwood machine (2026-11-08 — not committed)

Phú compared a topic list with the game (2026-11-08) and chose the physics gaps first: uniform
motion, Newton's laws, pulleys and connected bodies. Two stations, on two new islands at x 0.3 by
the lab's door (south and north rows), each a bench, a desk of four dials, RUN / STOP / RESET, a
display, a results monitor and an instructions board.

### Built

- **Air track: uniform motion and Newton's second law** (`newtons-second-law`, model
  `dynamics.air-track-cart`, bench `air-track-pulley`): a glider on a level air track, pushed off
  at 0.3 m/s by the launcher; a light string over a pulley past the bench's edge to a hanging mass
  m (none, 5, 10, 15, 20 g). With none, it coasts: uniform motion, the same speed at both gates.
  With one, a = m·g/(M + m + μ) (μ = I/r², 0: an ideal pulley). Two gates time the 0.1 m card:
  Δt_A, Δt_B, t_AB, v = L/Δt, AB/t_AB and (v_B² − v_A²)/(2·AB) — a hair over a (each L/Δt is the
  speed at mid-passage, short in v² by a²·Δt²/4, more at the slower gate). Results also give F = m·g,
  F/(M + m), the string's pull M·a. Analysis: a against F/(M + m), slope 1, by glider mass. Dials:
  m, M (0.2–0.4 kg), gate B (0.4–0.7 m), timer d. Layouts a run cannot finish (nothing to move it,
  gates out of order, the glider at the pulley or the mass on the floor before gate B) are refused
  with the reason. In two topics: kinematics and dynamics.
- **Atwood machine** (`atwood-machine`, model `dynamics.atwood`, bench `atwood-machine`): two equal
  masses M (100, 150, 200 g) over a pulley on a 2 m stand, an extra Δm (5–40 g) on the right,
  released by an electromagnet; the right side falls h (0.4, 0.6, 0.8 m) to a pad that stops the
  timer. a = Δm·g/(2M + Δm + μ); t = √(2h/a); a = 2h/t²; g = a·(2M + Δm)/Δm (low by
  (2M + Δm)/(2M + Δm + μ) with a heavy pulley); the two pulls M(g + a), (M + Δm)(g − a); a gate 5 cm
  above the pad gives L/Δt. Analysis: a against Δm/(2M + Δm), slope g, by fall.
- Both models exact at any step (constant acceleration, every event solved); both benches draw what
  moves from the run (the glider and the hanging mass by the same distance, the pulley turning; the
  two masses opposite ways, never past the pad).

### Tests

- `npm run check`: **PASS** — 253 files, 3606 tests (new: `airTrackCart.test.ts`, `atwood.test.ts` —
  against hand formulas at two step sizes, the card-average bias worked out by hand, the refusals;
  `newton-benches.test.ts`; counts: the lab 515 entities, 126 bodies, 160 colliders, 326 desk
  controls, 42 monitors; two tests' spots — the Ohm test now stands at its desk, 2.73 m along; from
  the lab's door the nearest station is now the air track's).
- `npx playwright test --project=dev --no-deps --workers=1 e2e/topics.spec.ts
e2e/physics-benches.spec.ts e2e/draw-calls.spec.ts` (SwiftShader): **PASS**, 54. Played in the
  app: m = 15 g, a from the gates 0.6873 m/s² against 0.6844 (theory, +0.4 %); Atwood g = 9.81 m/s².
- `npx playwright test --project=dev-timed --no-deps --workers=1 e2e/game.spec.ts`: **PASS**, 3.

### Not done, limitations

- Not seen on Phú's display. Models are teaching models: level frictionless track, light
  inextensible string, ideal pulley by default; no random error.
- An experiment in two topics is listed twice in the catalog (by design); `physics-benches.spec`
  takes the first.
