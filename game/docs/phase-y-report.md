# Phase Y report — the hub's teacher

Phú, 2026-11-09: the hub has a teacher the player talks to. E on him shows a see-through list of
choices beside him (Genshin's look); his lines show in a visual-novel box along the bottom. Choices:
1 Explain a simulation, 2 Help solve a problem (later), 3 Give a test. Answers to the open
questions (memory `teacher-npc-spec`): no pause while doing a test, no time limit, answers can be
changed, several papers at once, feedback written in advance, voice yes, THPT true/false, four
levels, scores kept, a teacher in the spirit of Mark Rober drawn in the player characters' style
(an original character: not his likeness or name). Phases: Y-1 the teacher and the conversation,
Y-2 explaining a simulation (he follows the player, points at the parts), Y-3 lessons at the
board, Y-4 the question bank, Y-5 paper tests. **Nothing is committed.**

## Y-1 — what was built

- **Mr. Quang** (`src/content/npcs.json`, schema `gameplay/npc/npc.ts`): an engineer-teacher, 1.82 m,
  short side-parted brown hair and a short beard, a blue hoodie with an orange emblem, jeans and
  sneakers — drawn by the character page's actor (the players' own body and anime style), moved
  to `platform/render/body/actor.ts` and made allocation-free per frame (it draws the world's
  people every frame now). English "Mr. Quang", Vietnamese "Thầy Quang".
- **His day** (data, `schedule` in the JSON; `gameplay/npc/schedule.ts`, pure): at the reception
  counter (idle, then reading), beside the Chemistry door looking in, at the periodic table, at the
  DNA display, beside the Biology door, a coffee on a ring bench, at the wave display, beside the
  Physics door, reading on another ring bench — round and round (about 5 minutes). He walks the
  hub's free floor (the task path's nav grid), sits down onto a bench and stands up again, and
  waits when the player is in his way (0.8 m). He glances at the player within 3.5 m.
- **A body**: a kinematic capsule in physics (`placeAgent`), so the player cannot walk through him;
  aim rays pass it (his E target is the box around him).
- **Talking** (`NpcSystem`, `state.session.conversation`, never saved): E on him — he stops, turns
  to the player (seated, only looks round) and greets them (the first time he introduces himself,
  then other greetings in turn); the player's view turns to him, a little to the right so he stands
  left of his choices; the player stands still. On: his choices, numbered; the three later phases
  build are shown disabled, "Coming soon" (no fake features); Goodbye says a farewell and ends the
  talk; Esc ends it at once (no pause). Choices are registered by the phase that builds them
  (`npcs.provide(behavior, run)`).
- **The box** (`platform/ui/DialogueView.ts`): name tag, the line written out (45 characters/s),
  ▼ when whole; click / E / Space / Enter: the line whole, then on; Auto (goes on by itself once
  the line is read) and Skip. Game keys wait while it is open (no hotbar slot changes).
- **Voice** (`platform/ui/speech.ts`): the browser's speech reads each line in the game's language,
  a man's voice where there is one (Edge: NamMinh / Andrew…; Windows: An, David, Mark); silent when
  the browser has no voice for the language (an English voice never reads Vietnamese). A new
  volume in Settings → Sound, "Teacher's voice" (with the overall volume and the mute).
- His shadow: a contact shadow, not a shadow-map caster — a person always moves a little
  (breathing), and a caster would have every light's map drawn again each frame.
- Debug panel: a `Talk:` line (the conversation, where people are).

Not in Y-1 (moved to Y-2, with following the player through doors): his walks into the labs. The
door system is the player's; letting a person open doors and cross into another scene is the same
work as following the player there, so it is built once, there.

## Y-1 test results

| Check                                         | Command                                                                                                                                                                                                                                      | Result                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Typecheck, lint, format, unit                 | `npm run check`                                                                                                                                                                                                                              | PASS — 283 files, 3817 tests   |
| The teacher's day, his conversation, his body | `npx vitest run src/gameplay/npc`                                                                                                                                                                                                            | PASS — 15 tests (in the check) |
| In the real app (Edge, SwiftShader)           | `npx playwright test e2e/teacher.spec.ts e2e/pause.spec.ts e2e/sound.spec.ts e2e/vietnamese.spec.ts e2e/doors.spec.ts e2e/topics.spec.ts e2e/draw-calls.spec.ts e2e/room-sleep.spec.ts e2e/character-page.spec.ts --project=dev --workers=1` | 35 PASS, 1 FAIL (below)        |

The FAIL: `room-sleep.spec.ts` "five wakes and sleeps of the bay" — its GL buffers reached the
level every run settles on (1005 here; 993 another time) only in the fifth cycle. Rerun twice
alone with a probe of the resident scenes: PASS both, the hub never resident in that test (the
teacher not drawn there). First-draw order, as the test's own note says — **flaky, not counted as
PASS**; not caused by the teacher.

Seen in the app (the dev preview, real GPU): Mr. Quang behind the counter, his greeting written
out in the box, his choices beside him in English and Vietnamese, the voice reading in both (the
preview's Windows voices: An, David), Goodbye and Esc. **Not seen yet:** his walk and his sitting
on a bench in the app (the unit tests check where he is; the preview pane was hidden, so no frames
were drawn) — to look at on the 300 Hz display.

## Y-1 known limitations

- The browser decides the voice: Edge has natural voices (online); offline, Windows' own. Speech
  starts only after a key press or click (the browser's rule), which talking with E always is.
- He did not walk into the labs in Y-1: Y-2 does.
- One person; several would each need their own day and their own capsule (supported, untested).

## Y-2 — explaining a simulation

- **Choice 1 is built** (`explain-simulation`): "Of course! Which simulation? Lead the way — I'll
  follow you. When we're there, press E on it." The talk ends and he follows the player.
- **Following** (`NpcSystem`: his day, following, lecturing, walking back): he keeps 1.6 m from
  the player, walking at 1.5 m/s and hurrying at 2.8 m/s when more than 4 m behind; his path on the
  scene's free floor is planned again when the player has moved 0.8 m, at most once a second.
- **Through doors**: his way to the player's scene goes through the door pairs (breadth first).
  At a door he stands where a player coming through it would; a shut door is asked to open
  (`DoorRequested`, once, never one already opening — a request would shut it) and he waits until
  it is open (at most 4 s), then walks through in 1.3 s, both scenes drawn. A door whose far side
  is not drawn is crossed at once: out of sight, he comes in through the door behind the player.
- **Talked to while following**: "I'm right behind you…" — Follow me, or Never mind ("All right.
  I'll be in the hall if you need me.": he walks back).
- **E on a station** — its apparatus or a part naming it (desk, dials, buttons): while he follows,
  its first action is "Ask Mr. Quang to explain this" (`interaction.addOffer`: another system's
  action put first on a target, hands empty). Only a station with an Explain view.
- **The lecture**: the Explain view opens (its camera on the apparatus); he walks to stand 1.35 m to
  the apparatus' right — beside it, not between it and the camera — and says, from the
  experiment's own Explain data: its name, its summary, each part ("{name} — {role}": he points at
  it with the arm on its side and looks at it, its label lit), each step of the principle (the view
  shows that step, its parts lit). The Explain panel steps aside: its words are his now. Nothing
  is made up: the lines are the Explain data; only the words around them are in `npcs.json`
  (English and Vietnamese).
- **After**: "That's the principle. Would you like me to work an example on the board?" — "Yes, on
  the board" (Y-3: shown disabled, "Coming soon"), or "No, thank you": "Good. Come and find me
  whenever you have a question!", the view closes and he walks back to his day (out of sight, he is
  back at once). Esc, H or Close during the lecture end it the same way.
- While a conversation is open (a lecture too) E only goes on with it: the HUD's prompt is hidden.
- His body and his E target go with his scene the moment it is released (`SceneDetached`), not a
  frame later.
- Debug panel: `Talk:` also gives his mode, his scene and the part he points at.

## Y-2 test results

| Check                                                   | Command                                                                                                                                                                                                                                                                    | Result                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Typecheck, lint, format, unit                           | `npm run check`                                                                                                                                                                                                                                                            | PASS — 283 files, 3820 tests   |
| The teacher: day, talk, follow, lecture, back           | `npx vitest run src/gameplay/npc`                                                                                                                                                                                                                                          | PASS — 14 tests (in the check) |
| In the real app (Edge, SwiftShader), one worker at once | `npx playwright test e2e/teacher.spec.ts e2e/explain.spec.ts e2e/doors.spec.ts e2e/pause.spec.ts e2e/vietnamese.spec.ts e2e/sound.spec.ts e2e/draw-calls.spec.ts e2e/room-sleep.spec.ts e2e/character-page.spec.ts e2e/practice-rooms.spec.ts --workers=1 --reporter=line` | PASS — 62 tests (20.7 min)     |

New unit tests: he follows the player round the counter and stops 1.2–2.2 m from them; into the
Physics Lab (the hall out of residence) he comes in through its door; E on the drop tower's height
dial offers "Ask Mr. Quang to explain this"; the lecture says the experiment's own Explain words
line by line, he points at each part, the view shows each step; the board is offered disabled;
"No, thank you" closes the view and he walks back to his day in the hall. Talked to while
following: Follow me / Never mind. Closing the Explain view ends a lecture.

New e2e (`teacher.spec.ts`, second test): the player talks to him at the counter, chooses 1, walks
across the hall and through the Physics Lab's door (the game's own door, no developer jump); the
debug panel shows him following in the lab; E on the Atwood machine starts the lecture (the
panel hidden, his words in the box); on the first part he points at the pulley, its label lit;
Esc ends it and he walks back. Screenshot `test-results/teacher-3-lecture.png` (SwiftShader).

**Not seen yet on the real GPU / 300 Hz display**: his walk behind the player, his crossing
through a door, the pointing arm — the e2e screenshot (software renderer) shows him beside the
Atwood machine, his right arm raised towards the pulley.

## Y-2 known limitations

- Doors do not see him: a leaf closing as he crosses can pass through him. A door stays open while
  the player is near it, and he asks a shut one to open, so it is rare.
- Out of sight he does not walk: when the scene he is in is not drawn he is through its door at
  once (following), or back at the counter at once (going back).
- His place by a station is worked out from the apparatus' pose and the free floor; at some
  stations it may fall where the camera sees him in front of a part — to look at per station.
- The browser's voice reads formulas symbol by symbol; the lines are the Explain data as written.
- The dialogue box can cover labels low on the screen.
- The board ("Yes, on the board") is Y-3.

## Y-2b — his key card at doors, his footsteps (Phú, 2026-11-09)

Phú: a door already open, the teacher walks through; a shut one, he taps his card on its reader
like the player, with all the sounds.

- His walk is its own module now (`gameplay/npc/walker.ts`, `Walker`): paths on the free floor,
  the doors on the way, the card, his feet. At a door that is **open** (or being opened) he walks
  to it and through. At a **shut** (or closing) one he walks to its reader (`handPoint`, where the
  player taps theirs), faces it and taps his card as the player's own `door-open` action does:
  1.5 s, a black key card in his right hand, his arm out to the reader, the door asked to open at
  0.85 s (`DoorRequested`, the same as the player's) — once; then through when it is open. Three
  taps that leave a door shut and he goes through anyway (a scene that would not come).
- Sounds: the reader's beep comes from the reader on the side of whoever tapped it (the cues now
  remember the leaf asked to open), then the door's own opening sounds; and his **footsteps**:
  `NpcFootstep` each time a foot comes down (the player's `Gait`, per person), on the floor of the
  room he is in, where he is; his legs swing in step with what is heard.
- He never takes the clean area's entrance (a procedure's entrance: the player's own way in, by
  its steps): following the player out, he waits inside.
- His body and target go with his scene when it is released (unchanged from Y-2).

## Y-3 — worked examples on the board

- **Data, checked against the model**: each experiment may have `examples` (schema in
  `simulation/experiment.ts`, details in `docs/experiments.md`): a question, the inputs it sets,
  what it asks for — the model's own predictions — and the steps: what the teacher says, the
  formula he writes, and a check expression (`simulation/expression.ts`, a small parser) that
  must come to the model's prediction within 10⁻⁶. `workExample` writes the board's lines
  (title, "Given", "Find", each formula, "Answer") with the numbers from the inputs and the
  model; `checkExample`, part of `checkExperimentAgainstModel`, refuses an example that does not
  agree (content with one does not load; the content tests check every bundled example). The
  first check found a real convention: free fall's velocity is negative (up positive) — the
  example says so instead of hiding it.
- **The teacher at the board**: after the lecture, "Yes, on the board" (now enabled when the
  experiment has examples and its lab a board — an item tagged `board`). The Explain view closes,
  the board is wiped, the camera frames it, and he goes to it. For each line he says, he stands
  before the place it goes and writes it, letter by letter (16 a second), his right hand where the
  pen is (`gameplay/npc/board.ts`, shared with the renderer so the ink is under the pen); then he
  steps aside and faces out to talk. E: the line (and its writing) whole, then on. At the end:
  "Shall we do another one?" — another example (the board wiped), or "I understand now" — thanks,
  and he walks back. Esc ends it the same way. The writing stays on the board.
- **The board** (`platform/render/boardWriting.ts`): one canvas on the board's face, in a marker
  hand (Segoe Print, falling back to other hand fonts), the title underlined, the answer in red;
  drawn again only when a letter is added.
- **Boards in every lab**: the Physics Lab's whiteboard; new ones in the Chemistry Lab (east wall,
  beside the solubility bench) and the Biology Lab (east wall, past the door).
- Examples: free fall's two written by thầy as the reference; the other experiments' by a builder
  agent following the same rules, every one checked by the content tests (counts and results
  below).
- **The examples' count**: 75 of the 79 experiments have two each (free fall's by thầy, the others
  by the agent, every one passing `checkExample`; read through by thầy on a sample: Ohm's law,
  titration, osmosis, pendulum). Four have none, so their board choice stays disabled: corrosion
  (only the tubes' order is its result; its rates are illustrative), DNA extraction (its
  percentages without a step are illustrative), food tests (its predictions are colour codes),
  tropism (qualitative; its bend and time constant illustrative).
- What the steps state where the model has a convention or an illustrative value: lens distances
  real-is-positive; the electric field positive away from Q1; the lever's M2 − M1 > 0 right end
  down; induction's first pulse negative north pole first; osmosis ΔΨ = Ψ_sol − Ψ_tissue in kPa,
  plasmolysis Ψs in MPa; chemistry's mL × mol/L = mmol; microscope lengths in µm; the
  illustrative constants (magnet moment, calorimeter, friction coefficients, kinetics' k and Eₐ,
  catalase, photosynthesis, osmosis E and τ, heart rate, seed respiration, stomata, agar D) said
  to be illustrative or approximate.
- Experiments whose station hides a value (titration's acid, mark-recapture's N): their examples
  "suppose" other values (0.12 and 0.1 mol/L; N = 500 and 1000), so the hidden one is never shown.
- The HUD's crosshair and the "H Explain" hint are hidden while a conversation (or the Explain
  view) frames the view.
- Content validation, not the experiment runtime, checks the examples (`game/content.ts`): a
  running experiment never depends on its teaching examples.

## Y-2b and Y-3 test results

| Check                                           | Command                                                                                                                                                                                                                                                                                          | Result                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Typecheck, lint, format, unit                   | `npm run check`                                                                                                                                                                                                                                                                                  | PASS — 285 files, 3833 tests |
| The teacher (card, footsteps, board, examples)  | `npx vitest run src/gameplay/npc src/simulation/workedExample.test.ts src/simulation/expression.test.ts src/platform/audio/cues.test.ts`                                                                                                                                                         | PASS (in the check)          |
| Every bundled example against its model         | `npx vitest run src/game/content.test.ts`                                                                                                                                                                                                                                                        | PASS (in the check)          |
| In the real app (Edge, SwiftShader), one worker | `npx playwright test e2e/teacher.spec.ts e2e/explain.spec.ts e2e/doors.spec.ts e2e/pause.spec.ts e2e/vietnamese.spec.ts e2e/sound.spec.ts e2e/draw-calls.spec.ts e2e/room-sleep.spec.ts e2e/character-page.spec.ts e2e/practice-rooms.spec.ts e2e/free-fall.spec.ts --workers=1 --reporter=line` | PASS — 63 tests (23.2 min)   |

The teacher's e2e now goes on from the lecture at the Atwood machine: Skip to the question,
"Yes, on the board", he writes the title, then what is given and asked
(`test-results/teacher-5-board.png`: the whole board above the dialogue box, the marker hand,
the title underlined, Mr. Quang beside it on the right); Esc; going back he taps his card on the
lab's shut door (`teacher-4-card.png`, seen from behind: the debug panel shows the card) and is
back in the hall.

**Not seen yet on the real GPU / 300 Hz display**: the card tap from the side, the writing hand,
the board's look in the labs' light, the Chemistry and Biology boards.

## Y-2b and Y-3 known limitations

- Out of scope, found while testing: the Physics Lab's desk lamp (`physics-lab/lamp`) falls
  through the floor when the lab is attached beside the hub (also in the door e2e with the
  teacher at the counter: not his doing). Not fixed here.
- He writes standing before each line (not stepping along it): a long line is written with his
  arm stretched towards its ends.
- The board's lines are fitted to the width his hand moves over (squeezed or stretched up to
  ±30 %, more to fit the board); the hand font is the system's (Segoe Print on Windows).
- The examples are written in the language chosen when the lesson starts.
- Four experiments have no example (above); the ≥ 10 questions per simulation are Y-4's bank.

## Y-4 — the question bank

- **A bank per experiment** (`content/questions/<id>.json`, schema `simulation/questions.ts`,
  carried by the lab pack, details in `docs/experiments.md`): the skills it tests, each with a
  pre-written study method, and at least 10 questions of every level — Nhận biết, Thông hiểu,
  Vận dụng, Vận dụng cao — and both THPT kinds: multiple choice (four options, one right) and
  true/false (a stem and four statements a–d). Each question names its skills and explains its
  answer (for the marked paper, Y-5).
- **Checked against the models**: numbers are placeholders filled from the question's own inputs
  and the model's predictions; a numeric option or statement carries a check. The validator
  (`checkQuestionSet`, in content validation) refuses a right option the model says is wrong, a
  wrong option the model says is right, a statement marked against its check, options that read
  the same, placeholders naming nothing, inputs out of range — and a question with numbers that
  does not suppose its own value of an input the station hides (the titration's acid): every
  prediction is worked from all the inputs, so it would give the hidden one away. The same rule
  now holds for worked examples.
- **Papers, pure** (`simulation/paper.ts`): `composePaper` draws from the chosen experiments in
  turn (seeded: the same seed, the same paper), only the kinds and levels asked for, choice
  questions first then true/false, each choice question's options in their own order;
  `gradePaper` marks as THPT 2025: 0.25 a choice question; 0.1 / 0.25 / 0.5 / 1 for 1 / 2 / 3 / 4
  true/false statements right; out of 10 (points × 10 / the most), and per skill — the gaps a
  sheet will name. Scoring source: the 2025 THPT exam rules (Bộ GD&ĐT); the scaling to 10 for a
  paper of any length is ours.
- The Vietnamese check of content now also covers the Explain summaries, the worked examples'
  questions and steps, and every bank's texts.
- **A chunk of their own**: the banks are about 2 MB of JSON (1.46 MB built, 322 kB gzipped), as
  much as the lab pack, which every lab visit downloads: they are not in it. `content/questions.ts`
  is imported only by `Game.loadQuestions` — after the lab pack, the first time a test is set
  (Y-5) — and `addQuestionBanks` validates them then. The tests still check every bundled bank.
- **The bank**: all 79 experiments, 12 questions each — 948 in all, 3 Nhận biết, 3 Thông hiểu,
  4 Vận dụng, 2 Vận dụng cao; 8 multiple choice and 4 true/false; 3 to 5 skills each, every one
  with its study advice. Free fall's written by thầy as the reference; the rest by three agents
  at once, one per subject (Phú, 2026-11-09: "3 con agent mỗi con soạn một môn… sau đó thầy kiểm
  tra lại hết").
- **Thầy's review** of all three subjects: every statement and option no check covers
  (conceptual ones) read for its science; every one whose truth depends on its own numbers
  (fringes three times wider, 3 loops and 3 nodes, a launch at 60°, the timer's 1 % …) worked
  again with the models. One error found and fixed: Boyle — a connecting tube's own volume makes
  p·V from the syringe's scale _shrink_ as the air is squeezed (p·(V + V_tube) = const), not grow.
- **A model bug the review found, fixed**: logistic growth's `peakGrowth` — when a run stops
  before N reaches K/2, the fastest growth of the run is on its last day, but the model gave the
  growth on its first (e.g. r 0.2/day, K 500, N₀ 5 over 20 days: 0.99 a day instead of 22.9,
  against a measured 22.9). Now the growth at the run's end; a test checks it against the run.
- Checked and not a bug: the microscope compares the length from counting (FOV/n) with the true
  cell length L on purpose — the counting method's error is what the student sees.
- Two station tests change the content in ways no dial does (a melting point of −20 °C, a dye's
  ε): their fixtures now leave the banks out, which are written for the shipped values.

## Y-4 test results

| Check                                        | Command                                                                                                                | Result                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Typecheck, lint, format, unit                | `npm run check`                                                                                                        | PASS — 288 files, 3845 tests                                                                |
| Every bank against its model, and Vietnamese | `npx vitest run src/game/content.test.ts`                                                                              | PASS (in the check)                                                                         |
| Banks, papers, marking, their own chunk      | `npx vitest run src/simulation/questions.test.ts src/simulation/paper.test.ts src/game/questions.test.ts`              | PASS (in the check)                                                                         |
| Production build                             | `npm run build`                                                                                                        | PASS — `questions` chunk 1,458.58 kB (322 kB gz); `labPack` 1,919.37 kB                     |
| In the real app (Edge, SwiftShader)          | `npx playwright test e2e/practice-rooms.spec.ts e2e/teacher.spec.ts e2e/free-fall.spec.ts --workers=1 --reporter=line` | PASS — 33 tests (14.0 min), the logistic growth station's run against its theory among them |

One full `npm run check` run before the last ones failed `residency.test.ts` "spawns all of it over
several pauses…" once; it passed alone and in both full runs after — **flaky once, not counted as
PASS for that run**; nothing in Y-4 touches scene attaching.

## Y-4 known limitations and decisions for Phú

- Not in the game yet: papers, their writing, their marking sheet (Y-5). Y-4 is the bank, its
  checks, and drawing and marking a paper (pure, tested).
- Some numbers have no prediction to check against (an estimate from a formula of inputs, a χ²
  from Mendel's own counts, a meter reading of a prediction): they are filled from placeholders,
  never typed, but nothing compares them with a model. A few textbook values are typed in stems
  (E° values, molar masses, Ksp(Ag₂SO₄), Mendel's 315/101/108/32) as their models and notes use.
- **SPEC GAP — food tests**: the station asks which sample is the water control, but water and
  sucrose give the same result in all four tests (in reality too: sucrose is not a reducing
  sugar), so the tests cannot answer it. The bank teaches this without naming the bottles. A fix
  (e.g. a hydrolysis step before Benedict's) is a station change for Phú to decide.
- **Naming**: the banks use the 2018 programme's chemical names (chlorine, sodium hydroxide…), the
  experiments' labels the older ones (clo, natri hiđroxit…). One of the two should change.
- Genetics letters follow the station (Y/y, R/r), not the textbook's A/a, B/b.
- Magnetic force (B) and cell EMF (r): the stations show the theory beside the measurement, so
  these values are not hidden inputs; banks and worked examples do not state them, and suppose
  another B where they compute with one. If Phú wants B and r treated as answers to hide, the
  stations' theory display changes too.
- Reading statements ("the timer shows 2.01 s") round the model's theory value; the station's
  instrument reads the run's measured result, which can differ in the last digit.

## Y-5 — paper tests

Phú, 2026-11-09 ("Làm Y-5 luôn"), to the spec in memory `teacher-npc-spec`.

- **Asked for a test** (his third choice, no longer "Coming soon"): his line, and over it a form
  (`TestSetupView`): the simulations that have a question bank, by subject and topic — any
  subjects together, All/None per subject — how many questions (5–40), which kinds (choice,
  true/false) and which of the four levels. It says how many questions the choice can have before
  he is asked ("Only 6 questions match: the test will have 6."); "Write the test" needs at least
  one. The banks load meanwhile (their own chunk). The dialogue box leaves the form's keys to it.
- **He writes it**: the questions are drawn at once (`composePaper`, seeded by the paper's number
  and the clock), then he goes to the first stop of his day — the reception counter — and writes
  on it for 10 s: his right hand on the counter top, moving along lines (`desk` in `npcs.json`:
  0.6 m ahead, 1.12 m up), not raised as at a board. His progress is a bar over his head (two
  sprites facing the camera, drawn only while he works). Talked to meanwhile: "Still writing your
  test… nearly done!". The game is never paused. Done: a notice "Mr. Quang: Your test is ready —
  come and get it!".
- **Handed over** when talked to: the paper goes in the bag as the item `test-paper`, an instance
  under the paper's own id. It is a _virtual_ item (`inventory.virtual`): it stays in the bag
  (Take out refused, with the reason) and is chosen in the hotbar. Bag full: he says so and keeps it.
- **Done** (`PaperView`): chosen, E on nothing holds it up (the HUD says "E Do the test · TEST
  No. 1"). Printed like a THPT paper (Times New Roman): its number, the simulations, the count,
  "No time limit"; PART I multiple choice (A–D in the paper's own shuffled order), PART II
  true/false statements a)–d) with T/F cells. A click circles the answer in blue ink, drawn as a pen
  goes round it; another answer crosses the old one out (kept in the save). No time limit, several
  papers at once; the player stands still while a paper is up. Esc or E puts it down.
- **Handed in**: E on him with the paper chosen ("Hand in the test"). Nothing answered: "Have a go
  first." Else he marks it for 3 s — writing on his desk if he is at it, reading it in his hands
  anywhere else — and says the mark: THPT 2025's points (`gradePaper`), 10 × points / most, written
  with the language's decimal sign (4,4 in Vietnamese). The mark is kept (`progression.scores`),
  also after the paper is thrown away.
- **Read again**: his red ✓/✗ by each question (and each statement), the right answer circled in
  red dashes where it was missed, the mark circled at the top, and his notes: the mark and how many
  questions were wholly right, the points by simulation, the skills done well, the skills to work
  on each with its bank's study advice, and why each missed answer is what it is (the question's
  explanation, its numbers from the model).
- **Thrown away**: E on a waste bin with the paper chosen; out of the bag and the save, the mark
  stays.
- **Save v11**: `progression.papers` (the questions, the option order, answers, what was crossed
  out, the mark) and `progression.scores`; v10 saves upgrade to none of either (migration test).
  The question texts are not in the save: they are read from the banks, in the current language.
- Debug panel: `Papers:` each paper's answered/questions and mark, the one held up, the count of
  marks.

## Y-5 test results

| Check                                          | Command                                                                                                              | Result                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format, unit                  | `npm run check`                                                                                                      | PASS — 289 files, 3849 tests                                                                             |
| The test flow in the game (no browser)         | `npx vitest run src/gameplay/papers/PaperSystem.test.ts`                                                             | PASS (in the check) — set up, written, handed over, done, crossed out, handed in, marked 10, thrown away |
| Save v11 and its migration                     | `npx vitest run src/persistence/persistence.test.ts src/game/progress.test.ts`                                       | PASS (in the check)                                                                                      |
| Production build                               | `npm run build`                                                                                                      | PASS — `index` 547.17 kB (166 kB gz); `questions` 1,458.58 kB; `labPack` 1,919.37 kB                     |
| In the real app (Edge, SwiftShader)            | `npx playwright test e2e/test-paper.spec.ts e2e/teacher.spec.ts e2e/preparation.spec.ts --workers=1 --reporter=line` | PASS — 5 tests and the warm-up (5.9 min)                                                                 |
| The same, after the last CSS change (the mark) | `npx playwright test e2e/test-paper.spec.ts --workers=1 --reporter=line`                                             | PASS — 1 test and the warm-up (1.1 min)                                                                  |

`e2e/test-paper.spec.ts` does the whole flow as a player would, blind (always A, always true):
four simulations of three subjects, 10 questions, the 10 s of writing, the notice, the hand-over,
the paper held up, every question answered and the first one changed, Esc, the hand-in, the mark,
and the marked paper with his notes. Screenshots, looked at: `test-results/paper-1-setup.png` to
`paper-7-notes.png`.

## Y-5 known limitations

- **Not seen in a screenshot**: the pen going round the circle (a CSS motion path on an SVG group);
  the screenshot comes after the 0.55 s stroke. The ink circle itself is seen.
- The only waste bin is in the cleanroom corridor: throwing a paper away is tested in the unit test
  only, not in the real app.
- The marks list is saved but not shown anywhere yet (only the debug panel counts it). A "my marks"
  page could be the next step.
- A paper keeps the ids of its questions: if a bank later drops one, the paper says "This question
  is no longer asked" and the mark leaves it out (0 of 0 points).
- Some bank skill names are written in plain text formulae ("c_a·V_a = c_b·V_eq"); a content polish.
- Visual: the paper's look, the bar over his head and his hand on the counter wait for Phú's look
  on his 300 Hz display.

## Y-5b — the paper by hand, the ruled icon, H only when looked at, doors attached ahead (Phú, 2026-11-09)

Phú asked, after seeing Y-5: the teacher must really take out a sheet, pick up a pen and write the
test; hold the sheet out; the player looks at it and clicks, their hand reaches out, takes it and
puts it away; handing in, the player's hand gives the sheet to his, he takes it and marks it on it,
then calls the player and holds the marked sheet out to be taken. The paper in the bag drawn as a
landscape sheet with ruled lines. H (Explain) offered only while the crosshair is on that
experiment's bench. Find why a lab door stalls as it opens.

- **Writing on paper**: at his desk (the reception counter) a sheet lies on the counter under his
  hand, a blue pen in his hand (`NpcView.paper` 'desk', `pen`; `NpcActors` draws the sheet, the
  actor the pen). Done, he holds it out over the counter (`NpcErrand.offer`): the sheet hangs
  upright below his right hand, its face to the player, and is a target of its own
  (`<scene>/<npc>/paper`, action "Take the test").
- **A click (or E) takes it**: `InteractionAction.click` lets a left click with empty hands do a
  target's primary action (the prompt shows "E / LMB"). The player's hand plays `take-paper`
  (`content/actions.json`): out to the sheet, grips it — at that moment it is theirs, in the bag —
  brings it up, then to the pocket. `ActionSystem.playOn` plays a sequence on something that is not
  a world entity (an `ActionTarget`: the point where the two hands meet).
- **Handing in by hand**: E or a click on him with the paper chosen; he stops and holds his hand
  out; the player's hand plays `give-paper` (out of the pocket, held out, let go). As it lets go the
  paper leaves the bag and is in his hand (`NpcSystem.takePaper`); he walks to his desk, marks it
  in red (MARK_S 5 s, a red pen, the bar over his head), holds it out again and says so; taken back,
  he says the mark. Talked to while he holds a paper out: "Here — take it from my hand." Busy
  (writing, marking, holding one out), a hand-in gets his busy line.
- **After a load**: a paper he had (not in the bag) is marked if it was not and held out again.
  No save format change: who has it follows from the bag.
- **The paper in the bag**: a flat item is drawn from above, long side across; a `ruled` one shows
  a heading line and ruled lines; a marked test paper a red tick. The hotbar label no longer offers
  "Q Take out" for it.
- **H only when looked at**: the Explain hint shows, and H opens it, only while the crosshair is on
  an apparatus (an interactable of its station, or the column over its footprint up to 2.2 m — some
  apparatus boxes are only their base) or the bench under it, within 4 m, and no solid in front of
  it. Looking elsewhere: no hint; H says "Look at an experiment to have it explained."
- **Doors attached ahead**: the stall was the request itself — the lab behind a closed door was
  only attached when E was pressed (spawned over frames, its shaders compiled, the door waiting
  shut meanwhile). Now the scene behind a closed pair is attached while the player walks up to it,
  so E opens at once (`DoorSystem.prepare`). A pair is _armed_ once the player has been beyond
  PREPARE_M (5 m) of it for ARM_S (0.5 s) since it last opened or since a scene loaded; armed, it
  attaches when the player is within PREPARE_M, has come APPROACH_M (0.5 m) closer than their
  farthest point since, and faces it (within 60°). Walked away again (beyond RELEASE_M 9 m) the
  scene is released. A pair that opened releases the scene behind as it closes, as before. So the
  player just through a door, placed beside one by a load, or backing toward one does not keep two
  scenes. One attach per scene, shared with a request; a failed one is tried again after 2 s.
  `GameOptions.prepareDoorsAhead` (default on); `bootTestGame` turns it off for the tests written
  for the attach-on-request policy; new DoorSystem tests cover attaching ahead (walk up, start
  beside, back up then face, the edge of PREPARE_M, a request during an attach, release, retry, a
  pair that opened). Not done: a player who turns straight back through the door they came by
  still waits for the attach, as before. Not measured yet: how long a lab door now takes to open on
  Phú's GPU.
- **A texture leaked on every lab↔hub trip** (found by `e2e/resources.spec.ts`): each NPC actor's
  skeleton keeps a bone texture, never released when the actor was rebuilt. `Actor.dispose` now
  disposes its skeleton; hub textures stay at 26, lab at 81 over the trips.
- **Hub counts**: the hub has 41 bodies and 54 colliders since Y-1 (the teacher's capsule);
  `e2e/game.spec.ts` and `e2e/world.spec.ts` expected 40/53 and are updated. In
  `e2e/resources.spec.ts` the hub's buffers and vertex arrays may differ between trips by the
  teacher's hand props (cup, phone, book, key card, pen — built hidden with the actor and uploaded
  at their first use in a visit; measured ±8 to ±16 buffers, ±2 vertex arrays, found by recording
  every GL buffer per trip): the test allows ±40 / ±10 there; everything else in the hub, and the
  whole lab, must repeat exactly.

## Y-5b test results

| Check                                               | Command                                                                                                | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Door unit tests                                     | `npx vitest run src/gameplay/door`                                                                     | PASS — 63 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| The dev project in the real app (Edge, SwiftShader) | `npx playwright test e2e/_leak.spec.ts e2e/world.spec.ts e2e/game.spec.ts --workers=1 --reporter=line` | Meant for 3 files, it ran the whole dev project (163 tests, 1.5 h): 158 passed, 2 failed, 3 did not run. FAIL `resources.spec.ts` (hub buffers 762 → 770, the teacher's props: the test is changed, see above; to run again); FAIL `titration-physical.spec.ts` (the burette stayed at 0 mL: failed 2 of 3 runs this phase, passed 1 — flaky, not a PASS, not yet understood). `world.spec.ts` and `game.spec.ts` PASS with 41/54. `e2e/_leak.spec.ts` was a temporary buffer recorder, deleted. |

## Y-3b — the board's long lines broken in two (thầy's check, 2026-11-09)

Phú asked thầy to check the teacher's board lessons and the Explain view closely and fix what is
wrong. Measured over every worked example (79 experiments × 2, English and Vietnamese, on the
1.6 m whiteboard): **155 board lines were squeezed below 70 % of their letters' width**, the worst
to 32 % (the halogens' "Given" line) — unreadable from the room. Long titles (the
experiment's whole name) and "Given" lines (every setting joined with "; ") were the cause.

- `gameplay/npc/board.ts`: `wrapLine` breaks a line longer than a board line holds (squeezed at
  most to 80 %) after a "; " (not too near its start), else at a space; the lines after the first
  are indented. `layoutBoard` lays out all of an example's texts at the line height the whole
  board then has (more lines: smaller letters, more to a line; settled in a few rounds), and says
  where each text starts.
- `NpcSystem`: the board's lines are the laid-out ones; a line said writes every board line of its
  text; he stands before each. `BoardView` gains `title` (lines underlined) and `answer` (the first
  red line), so a title or an answer broken in two keeps its look (`boardWriting.ts`).
- After it, by the board's own width estimate: no line squeezed below 66 %; at most 10 lines on a board. Seen in
  `test-results/teacher-5-board.png` (SwiftShader): "Example 1 · Atwood machine: bodies joined
  over / a pulley", then Given and Find, in the marker hand.
- The Explain view: the e2e (`explain.spec.ts`, the pendulum's close view, parts, steps, H and
  Esc) and the teacher's lecture (`teacher.spec.ts`) pass; every experiment has its Explain data
  and its steps name only its declared parts (checked when the content loads). Not looked at station by
  station this time: `GALLERY=1 GALLERY_EXPLAIN=1 npm run bench -- --project=gpu -g gallery` (real GPU) does that.

| Check                      | Command                                                                                                                                                                                                                              | Result                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board layout               | `npx vitest run src/gameplay/npc`                                                                                                                                                                                                    | PASS — 21 tests (3 new in `board.test.ts`)                                                                                                                                                                       |
| Everything                 | `npm run check`                                                                                                                                                                                                                      | PASS — 292 files, 3870 tests                                                                                                                                                                                     |
| The lesson in the real app | `npx playwright test e2e/teacher.spec.ts:80 --project=dev --workers=1 --reporter=line`                                                                                                                                               | PASS (the board: 4 lines after Given and Find, the title in two). The same test failed once today at the lecture (a line not written out within 5 s, before the board): flaky on SwiftShader, 3 of 4 runs passed |
| Explain, resources         | `npx playwright test e2e/multiplayer.spec.ts e2e/menu.spec.ts e2e/teacher.spec.ts e2e/explain.spec.ts e2e/resources.spec.ts e2e/vietnamese.spec.ts e2e/controls.spec.ts e2e/pause.spec.ts --project=dev --workers=1 --reporter=line` | `explain.spec.ts` PASS; `resources.spec.ts` PASS (with the hub's prop allowance, Y-5b); the failures of that run are in `docs/phase-m-report.md`, all fixed                                                      |

## Y-6 — the learning progress board in the hub (Phú, 2026-11-10)

Phú: "in the hub a chart board shows the student's progress and the knowledge learned, with other
information."

- **Where**: the hub's south wall, left of the door from the preparation room (−5.6, 1.5, 5.97),
  facing the hall; the same 4.4 × 2.6 m display frame as the periodic table opposite
  (`hub-progress-board`, prop `progress-board`). Decor: no body, no action.
- **What it shows** (`game/progressSummary.ts`, pure, from the save alone — nothing invented):
  - the title and totals: experiments done of all, topics learned of all;
  - **experiments done by subject**: Physics, Chemistry, Biology as coloured bars with n/total
    (an experiment counts once a run of it ended by itself: `completedExperiments`);
  - **test marks**: the latest 10 papers' marks out of 10 as bars (green ≥ 8, blue ≥ 5, red
    below), the mean as a dashed line, and "n papers · mean · best";
  - **topics learned**: topics whose every experiment is done (coloured by subject), and how many
    are started;
  - **next step**: the first experiment not done, in the topics' order, with its topic; the guided
    tasks finished of all.
    Without the lab pack loaded it says so instead of counting.
- **Drawn** (`render/progressBoard.ts`): one canvas on the screen (2040 × 1194 px), a glowing
  display (unlit, not tone-mapped); worked out once a second while the hub is resident and drawn
  again only when what it shows changes (marks, experiments, topics, tasks, the language). Long
  names are narrowed or broken in two to stay inside their panel. English and Vietnamese.

## Y-7 — with the teacher following, E on an experiment only asks him (Phú, 2026-11-10)

Phú: while the teacher follows to explain, hide every other interaction with the simulations
(the H key too), so the student points him at one with E alone; for every simulation.

- `InteractionAction.exclusive`: an offered action that, while available, is its target's only
  one — the target's own actions are neither shown nor performed (`perform` refuses them; logged
  at debug). The teacher's "Ask Mr. Quang to explain this" is exclusive: on an experiment's
  apparatus or any part naming it (desk, dials, buttons, board…) the prompt shows only E for it.
  Doors, glassware and everything else keep their actions (the player still walks him there).
- `ExplainSystem.suspended` (the teacher following, `NpcSystem.following`): the "H Explain" hint is
  hidden and H says "The teacher is with you: look at an experiment and press E to ask him."
  Once he lectures, or walks back, everything is as before.

| Check                                   | Command                                                                                                 | Result                                                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The board's summary                     | `npx vitest run src/game/progressSummary.test.ts`                                                       | PASS — 2 tests (a new game; experiments by subject, topics, marks, tasks, the next one)                                                                                         |
| Following: only the ask, H waits        | `npx vitest run src/gameplay/npc src/gameplay/interaction`                                              | PASS — 58 tests (the dial's own actions hidden and refused, H refused with its reason)                                                                                          |
| The board in the real app (SwiftShader) | `npx playwright test e2e/progress-board.spec.ts --project=dev --workers=1 --reporter=line`              | PASS — 2 tests and the warm-up: `progress-board-en.png`, `progress-board-vi.png` looked at (a first run found a name running out of its panel, then a line over another: fixed) |
| The teacher and Explain (SwiftShader)   | `npx playwright test e2e/teacher.spec.ts e2e/explain.spec.ts --project=dev --workers=1 --reporter=line` | PASS — 3 tests and the warm-up; `teacher-ask-only.png`: one prompt, "E Ask Mr. Quang to explain this", no H hint                                                                |

**Not seen yet on Phú's 300 Hz display**: the board's look in the hub's light.

## Y-8 — twenty questions per experiment, from the easiest to the hardest (Phú, 2026-11-10)

Phú: every piece of knowledge gets 20 questions, graded from the hardest to the easiest.

- **Every bank now holds 20** (was 12): 4 recognise, 5 understand, 6 apply, 5 analyse (Nhận biết,
  Thông hiểu, Vận dụng, Vận dụng cao; before: 3, 3, 4, 2) — 79 banks, 1580 questions, 632 new,
  each with its Vietnamese. 8 added per bank (5 choice, 3 true/false), after the existing 12,
  which were not changed. Written by three agents, one per subject (Phú's content budget), under
  the bank rules; thầy read a sample of each subject (the titration's technique and slips,
  solubility, Lotka–Volterra's spraying trap, the dihybrid cross, heart rate) and found them right.
- The hardest level is genuinely multi-step: an input from a result, a graph's slope, two
  settings compared, a trap (Volterra's principle, the χ² degrees of freedom, a wet burette).
- **Rules raised** (`simulation/questions.ts`): `MIN_QUESTIONS` 20 (was 10), and `MIN_PER_LEVEL`
  4 of every level (was: one of each). Content validation refuses a bank short of either.
- Numbers are the model's, as before: placeholders and checks. The agents report a few
  comparison questions that quote, as plain text, the model's own handbook values at other
  settings a question cannot set at once (solubility of KNO₃, KCl, NaCl at 20–80 °C; n(NO₂) at
  25 °C), as two older questions already did. Hidden inputs (the titration's acid, mark-recapture's
  N) are supposed in every numeric question, never shown. Illustrative constants are said to be
  ("in this simulation").
- One skill added (photosynthesis: where it happens, what it uses and makes). Tests that counted
  the old banks updated: `paper.test.ts` (the whole free-fall bank, 13 choice + 7 true/false),
  `PaperSystem.test.ts` (10 analyse questions in two banks), `questions.test.ts`.
- **Not done**: no one has read all 632 new questions; the Vietnamese wording waits for a
  teacher's eye (Phú's).

| Check                                 | Command                                                                                                                                                                                                                                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every bank against its model          | `npx vitest run src/simulation/questions.test.ts src/game/questions.test.ts src/game/content.test.ts src/core/i18n.test.ts`                                                                                                                       | PASS (in the check)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Everything                            | `npm run check`                                                                                                                                                                                                                                   | PASS — 294 files, 3884 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Papers, teacher, board… (SwiftShader) | `npx playwright test e2e/test-paper.spec.ts e2e/teacher.spec.ts e2e/progress-board.spec.ts e2e/draw-calls.spec.ts e2e/explain.spec.ts e2e/preparation.spec.ts e2e/vietnamese.spec.ts e2e/world.spec.ts --project=dev --workers=1 --reporter=line` | 25 passed, 1 failed: `preparation.spec.ts` (after the second gloves the walk back to the door's middle went the wrong way: "did not reach (0, -9.6)"). Alone: FAIL once more, then PASS (`npx playwright test e2e/preparation.spec.ts:82 --project=dev --workers=1`). Today 4 PASS, then 2 FAIL, then PASS: **flaky, not a PASS**. Cause found: `approach` (e2e/support.ts) aimed once and walked straight; a collider pushing the player aside made it miss the point and walk on to the far wall. It aims again every tap now: `npx playwright test e2e/preparation.spec.ts --project=dev --workers=1 --repeat-each=3` PASS, 3 of 3 |

## Y-9 — the Physics Lab's desk lamp no longer falls through the floor (Phú, 2026-11-10)

The out-of-scope bug of Y-2b: `physics-lab/lamp` fell for ever (y −1864 m in the teacher's e2e)
whenever the lab came in beside the hub.

- **Cause**: a neighbour scene comes in a few placements a frame (`SceneManager.attach`) and its
  rooms' floor and wall slabs were built only at `SceneAttached`, after the last slice. Physics
  steps meanwhile: a free (dynamic) body spawned in an early slice — the lamp on its desk — had
  neither its desk (later slice) nor the floor under it, and fell.
- **Fix** (`PhysicsSystem.addEntity` / `attachRooms`): a dynamic body whose room is in the world
  (`World.hasRoom`, new) but has no slabs yet waits, disabled, where it was placed; at
  `SceneAttached`, once the slabs and every placement are there, it is enabled and woken. An object
  carried out of a scene since released (its room no longer in the world) is not held back. A normal
  load is unchanged (its slabs are built at `SceneLoaded`, before physics steps).

| Check                                                            | Command                                                                                                                                                                                | Result                                                                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The lamp, the lab attached beside the hub, frames between slices | `npx vitest run src/world/residency.test.ts -t "lamp stays"`                                                                                                                           | PASS (its centre at 1.1 m, on the desk); with the fix switched off for the run: FAIL, the lamp at y −567.7 m             |
| Everything                                                       | `npm run check`                                                                                                                                                                        | PASS — 294 files, 3885 tests (a first run caught a carried ball held back by the first condition: `World.hasRoom` added) |
| In the real app (SwiftShader)                                    | `npx playwright test e2e/teacher.spec.ts e2e/doors.spec.ts e2e/transitions.spec.ts e2e/resources.spec.ts e2e/world.spec.ts e2e/game.spec.ts --project=dev --workers=1 --reporter=line` | PASS — 10 tests (10.2 min); `teacher.spec.ts` now checks the lamp above 1 m in the lab reached from the hub              |

## Y-10 — formulas written and read as a teacher does (Phú, 2026-11-10)

Phú: the teacher reads `m_A` as "m A", and every symbol as a teacher says it; formulas are
written as a person writes them — a division as a fraction (or ":"), exponents small and raised,
subscripts small and low — on the board, in the dialogue, in the Explain view, on the test
paper, and on the Physics walls; Vietnamese decimals with a comma (0,5).

- **One layout for both** (`core/formula.ts`, pure): `x_Y` a subscript, `x^2` / `x^(…)` an
  exponent, `a/b` between quantities a fraction — its numerator the whole product before it
  (`m·g/(M + m)`), inside brackets too (`√(2h/g)`); a unit over a unit (`m/s`, `J/(kg·K)`) and
  words (`true/false`, `beats/min`) stay written in line; a unit after a number is marked; every
  run keeps its place in the source, so a line written letter by letter shows what is written.
  `decimalComma` gives the Vietnamese 0,5.
- **Read aloud** (`core/formulaSpeech.ts`, used by `Speech`): subscripts as letters ("m A"),
  `·`/`×` "nhân", a fraction "… trên …", `:` "chia", `²`/`³` "bình phương"/"lập phương", other
  exponents "mũ …", an ion's charge "Cu hai cộng", `√` "căn", `=` "bằng", `≈` "xấp xỉ", `−` "trừ"
  between terms and "âm" before one, `→` "tạo thành", Greek letters by name (đen-ta, tê-ta,
  lam-đa…), units after a number by name ("0,4 mét trên giây"), chemical formulas element by
  element ("C O 2"), primes "phẩy"; English alike ("over", "squared", "metres per second").
- **Written** (`render/formulaCanvas.ts`): the teacher's board and every wall sign
  (`WorldRenderer.drawLabel`: the Physics instruction boards' `v = d/Δt`, `Δt_A`, `v_B²`), in
  their own hand or bold face; (`ui/formulaHtml.ts`): the dialogue box (as it is written out),
  the Explain view's summary, steps and part roles, the test paper's stems, options, statements
  and explanations — `<sub>`, `<sup>` and a stacked fraction (`.frac`).
- Not changed: the results panel, CSV, the debug panel (their numbers and symbols stay raw, as
  the project rules ask).

## Rooms out of sight: no lighting pop between rooms (Phú, 2026-11-10)

Phú: with rooms out of sight not drawn, walking into another room showed it before its light was
right.

Found by walking the Physics Lab into the pendulum bay picture by picture with the debug panel:
standing in the doorway's wall (in no room) woke **every** room of the scene — the range and the
optics room too — and put them back to sleep a step later; each wake and sleep gave the room
lights out again **in order**, so the lights of the rooms that stayed moved to other slots, and
each moved key light's shadow map was redrawn (and under Medium's 30 Hz cap, could wait a frame
showing another room's shadows).

- `world/dormancy.ts`: in a doorway, the rooms on both sides of the doorways at hand and those
  awake before; every room only when the player is in no room and near no doorway (a load in a
  wall). The walk again: nothing woken in the doorway.
- `render/roomLights.ts`: a light keeps its slot while rooms wake and sleep around it; only with
  more lights than slots (a third scene) are they given out afresh, the current scene's first.
- `render/shadowCache.ts`: a light that changed itself (moved, another room's in its slot) has its
  map drawn at once, whatever Medium's cap.

| Check                                         | Command                                                                                                                                                                           | Result                                                                                                                                                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout and reading                            | `npx vitest run src/core/formula.test.ts`                                                                                                                                         | PASS — 7 tests (subscripts, exponents, primes, fractions with their products and in brackets, units and words kept, sources kept; Vietnamese and English readings, minus and negative, charges, chemical formulas, degrees)                          |
| Room lights, dormancy, shadows                | `npx vitest run src/platform/render/roomLights.test.ts src/world/dormancy.test.ts src/platform/render/shadowCache.test.ts`                                                        | PASS (new: a light keeps its slot; a doorway wakes its two sides only; a light that moved drawn at once)                                                                                                                                             |
| Typecheck, lint, format, unit                 | `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check src e2e docs CLAUDE.md package.json`, `npm run test`                                                                    | PASS — 297 files, 3898 tests. `npm run check` itself stopped at its format step: Windows would not open `scripts/desktop-app.ps1` (unchanged; "UNKNOWN: unknown error, open" — held by another program, likely an antivirus scan)                    |
| Board, dialogue, Explain, paper (SwiftShader) | `npx playwright test e2e/teacher.spec.ts e2e/explain.spec.ts e2e/test-paper.spec.ts e2e/vietnamese.spec.ts --project=dev --workers=1` (with a temporary wall-sign picture spec)   | PASS — 9 tests; looked at: the Physics wall sign in Vietnamese (`Δt_A`, `t_AB` low, `d/Δt` a fraction, `v_B²`), the test paper, the Explain view                                                                                                     |
| Rooms, doors, resources (SwiftShader)         | `npx playwright test e2e/room-sleep.spec.ts e2e/doors.spec.ts e2e/transitions.spec.ts e2e/resources.spec.ts e2e/shadows.spec.ts e2e/draw-calls.spec.ts --project=dev --workers=1` | 25 passed, 1 failed: `resources.spec.ts` — one program more in the hub's fourth visit (42 → 43, with 16 buffers: a teacher's prop first drawn then, compiled once for the game). The test now allows programs to grow by 2 at most, never back: PASS |

**Not seen yet on Phú's display**: the board's fractions in a lesson (the e2e stops after "Given"
and "Find"), the voice reading on his Vietnamese voice, and the walk between rooms on his GPU (the
pop was not caught on SwiftShader pictures at 2 a second; the causes above were found in the code
and the debug panel).
