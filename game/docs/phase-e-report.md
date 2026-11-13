# Phase E — the free circuit bench

Phú (2026-11-11): in the Physics Lab, a bench where students build circuits freely, a cabinet
beside it with every part of school electricity work, parts taken from it and plugged into a blank
board, and a circuit that behaves as a real one — overloaded, it heats, smokes and burns, so the
consequences are learnt by trying. Agreed scope (Phú's answers): the bench beside the electricity
stations (the room may grow if needed); leads by "E on one socket, E on the other"; fire may
spread and does not go out by itself — only an extinguisher or a call to 114 on the player's own
phone (a new phone item) puts it out.

Steps: **E-1** the bench, cabinet, parts, leads and the DC solver (this report); **E-2** heat and
its consequences (smoke, burning, blown fuses, a burnt-out lamp, fire spreading, the extinguisher,
the phone and 114); **E-3** capacitor, inductor, diode and LED, motor, buzzer, guided tasks.

## E-1 — bench, cabinet, parts, leads, the circuit solved

- **Where:** against the Physics Lab's south wall between the range doorway and the Ohm's-law
  bench (x −0.68…1.68): the parts cabinet (`circuit-cabinet`, 0.8 × 1.9 × 0.5 m, two doors,
  drawn as the reagent cabinet under its own prop `parts-cabinet`) and the bench
  (`circuit-table`, 1.4 × 0.9 × 0.8 m) with the board (`circuit-trainer`) on it. The room was
  not enlarged.
- **The board** (`item.circuitBoard`): 7 × 4 spring sockets 12 cm apart and a built-in bench
  supply, 0–12 V in 0.5 V steps, current-limited at 3 A, its red + and black − posts at the
  front. Aimed at its panel: E raises the voltage, F lowers it; its display shows the terminal
  voltage and the current, `CC` when it limits.
- **The parts** (`item.circuit`, 37 in the cabinet, each a real item picked up with E): cells
  1.5 V (r 0.15 Ω) ×2, 4.5 V (0.5 Ω), 9 V (1.5 Ω); switches ×2; 0.25 W resistors 10, 22, 47,
  100, 220 Ω and 1 kΩ ×2 each, a 10 Ω 5 W power resistor; rheostats 20 Ω 2 A and 100 Ω 1 A;
  lamps 2.5 V 0.75 W, 6 V 3 W, 12 V 6 W ×2 each; fuses 0.5, 1, 2 A ×2 each; ammeters 0–3 A
  (0.1 Ω) ×2 and voltmeters 0–20 V (10 MΩ) ×2. Internal resistances are typical values for
  fresh alkaline cells; fuse resistances typical of 5 × 20 mm fast fuses.
- **Building** (`gameplay/circuit/CircuitSystem`, the only rule authority): holding a part, the
  aimed edge between two neighbouring sockets is shown (blue, red if taken) and E plugs it in;
  the part leaves the world (its placement is not spawned while it is on a board, as a carried
  one) and is drawn on the board. With empty hands: E on a socket starts a lead, E on another ends
  it (F gives up); a click on a socket takes its last lead off; on a part, E works it (a switch
  opens or closes, a rheostat slides up a tenth, F down; a cell or meter is turned round) — a part
  with nothing to work comes off with E — and a click takes any part off into the hands. The board
  is saved in its entity state (`circuit`, JSON): no save format change.
- **The circuit** (`simulation/circuitSolver.ts`, pure): nodal analysis of two-terminal parts
  (resistors, sources with internal resistance, a current-limited supply, filament lamps), each
  connected group solved on its own; a lamp's hot resistance follows the empirical tungsten-lamp
  law P ∝ V^1.6 (R ∝ V^0.4), never under a tenth of its rated resistance (cold tungsten), by
  fixed-point iteration. Leads 0.02 Ω, a closed switch 0.005 Ω, the supply 0.01 Ω.
  Checked against hand solutions: a cell on a load, series–parallel division, a balanced
  Wheatstone bridge, two cells in parallel (Millman), the supply's current limit on a short, a
  lamp at its rating and at half (P ∝ V^1.6), a lamp with a series resistor.
- **Drawn** (`render/circuitView.ts`, `render/props/circuit.ts`): sockets, posts, the supply's
  panel, knob and display, each part's model (a knife switch's blade and a rheostat's slider
  posed), leads as coloured arcs, lamps glowing by their light output (∝ (P/P_rated)^2.125, i.e.
  ∝ V^3.4) with a halo, meters showing their reading at their resolution (1 mA, 0.01 V; `OL` past
  the range; − when wired the wrong way round).
- **Heat model ready for E-2** (`simulation/circuitHeat.ts`, pure, not yet used): a lumped body
  per part, exact exponential steps, smoke/fail/ignite thresholds from data, and lamp wear by the
  life law (life ∝ V^−16).

### Results (E-1)

| Command                                                                                                                                      | Result                        |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `npx tsc --noEmit`                                                                                                                           | PASS                          |
| `npx eslint .`                                                                                                                               | PASS                          |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                                   | PASS                          |
| `npm run test`                                                                                                                               | PASS — 300 files, 3955 tests  |
| `npx playwright test e2e/circuit-bench.spec.ts --project=dev --workers=1`                                                                    | PASS (SwiftShader)            |
| `npx playwright test e2e/circuit-bench.spec.ts e2e/ohms-law.spec.ts e2e/doors.spec.ts e2e/physics-benches.spec.ts --project=dev --workers=1` | PASS — 42 tests (SwiftShader) |

Tests updated for the new placements: entity, body and collider counts of the Physics Lab; the
range doorway's east wall is no longer probed (the cabinet stands against it); the systems list.

### Known limits (E-1)

- Multiplayer: the bench is each player's own (not shared over LAN rooms).
- The teacher does not explain the bench yet; no guided task.
- Not looked at on a real GPU or the 300 Hz display yet.

## E-2 — heat, fire, the extinguisher, the phone and 114

- **Heat** (`CircuitSystem.heat`, every frame): every part with a `circuit.heat` and every lead is
  one lumped body (`simulation/circuitHeat.ts`: exact exponential steps) heated by the power it
  takes — a resistor, fuse or ammeter its V·I, a cell I²r inside it, a switch I² × its contact, a
  rheostat (I/I_rated)² W. Past its thresholds it **smokes**, **fails open** (a resistor burnt
  through, a fuse blown, a cell ruined, a lead melted) or **catches fire** (a 0.25 W resistor, a
  lead's PVC). A lamp **burns out** by the lamp-life law (life ∝ V^−16, 1000 h at its rating:
  2.5 V on 12 V at once, 6 V on 12 V in about a minute). A failed part carries nothing (open), is
  drawn blackened, and stays broken as an object when taken off (entity state `broken`).
- **Data** (items.json, illustrative values named as such): 0.25 W resistors ~85 K over the room
  at their rating (340 K/W), smoke at 230 K, fire at 350 K, burnt open at 450 K — so 10 Ω on 6 V
  (3.6 W, 14×) smokes after ≈ 4 s and flames after ≈ 7 s; the 5 W power resistor runs hot but
  does not flame; fuses melt when their current stays at twice their rating (τ 1 s); the ammeter
  has its own 3.15 A fuse; cells heat by I²r and leak; leads (30 cm of 0.5 mm² copper in PVC:
  1.4 J/K, 35 K/W) fume at 130 K, burn at 300 K, melt at 1060 K. New in the cabinet: a **12 V
  lead-acid battery** (r ≈ 0.02 Ω): a lead across it carries some 300 A — it smokes, burns and
  melts in under a second.
- **Fire** (`gameplay/fire/FireSystem.ts`): starts where a part or lead caught fire, grows to its
  full size in 45 s and **never goes out by itself**. What can burn (`burns`: the parts, the
  board, the bench, the lab benches) near a fire catches after its own exposure time weighted by
  the fire's size, so it spreads board → bench → parts lying there → the Ohm's-law bench beside.
  Past half its size it ruins what it is on (`EntityBurnt`: a board then has its supply dead, every
  part broken, every lead gone) and blackens it (`charred`). Fires are kept in their objects'
  entity states: a reload brings them back burning. At most 16 fires.
- **Putting it out:** the **CO₂ extinguisher** (`co2-extinguisher`, beside the cabinet): picked
  up with E, sprayed with the left mouse button held, 15 s of jet reaching 3 m; a fire in its jet
  loses 0.45 of its size a second. Or the **phone**: P opens it, its keypad (or the number keys)
  dials, Call places the call — **114** sends the brigade, who put every fire out 30 s later
  (shortened for play; the screen counts down); 114 with nothing burning is refused as a false
  call (against the law); 113 and 115 are other services, other numbers do not answer.
- **After:** a broken part handed back at the cabinet (E while holding it) is swapped for a sound
  one; a burnt board is replaced (E on it, refused while it still burns): its parts go back to the
  cabinet sound, and the soot within 1.5 m is cleaned off.
- **Told:** the HUD explains each event with its numbers ("Resistor 10 Ω, 0.25 W smokes: it takes
  14 W but is rated for only 0.25 W"; a fuse blown at its current; a lamp's voltage against its
  rating), and says what to do (switch off, CO₂, or 114). Too close to a fire: a warning.
- **Seen and heard:** flames, a hot core and smoke as particles over the burning face (no light of
  their own), smoke from hot parts and leads, leads glowing red to yellow towards copper's melting
  point, the CO₂ jet; a crack when something gives way, the roar of flames, a smoke alarm's beep
  over the fire, the jet's hiss, a siren in the brigade's last seconds.
- **Safety rules in play:** nothing on a burning board can be touched (refused, "do not touch
  it"), but its supply can still be turned down — cut the power first; the extinguisher is held low
  and to the right (`heldAside`), so the fire stays in view.

### Results (E-2)

| Command                                                                                                                                                           | Result                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                                                                | PASS                                                                                               |
| `npx eslint .`                                                                                                                                                    | PASS                                                                                               |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                                                        | PASS                                                                                               |
| `npm run test`                                                                                                                                                    | PASS — 301 files, 3967 tests                                                                       |
| `npx playwright test e2e/circuit-bench.spec.ts e2e/circuit-fire.spec.ts e2e/controls.spec.ts e2e/pause.spec.ts e2e/inventory.spec.ts --project=dev --workers=1`   | PASS — 9 tests (SwiftShader)                                                                       |
| `npx playwright test e2e/circuit-fire.spec.ts e2e/circuit-bench.spec.ts e2e/controls.spec.ts e2e/doors.spec.ts --project=dev --workers=1` (before the last fixes) | 7 PASS, 1 FAIL (circuit-fire: the cabinet hid the extinguisher from the test's stand; stand moved) |

Unit tests of E-2 (`gameplay/circuit/consequences.test.ts`, real Physics Lab and Rapier): a 10 Ω
0.25 W resistor on 6 V smokes at ≈ 4.2 s and flames at ≈ 6.9 s (θ∞ = P·R_th, τ = R_th·C); an
ammeter across the 4.5 V battery (≈ 7 A) blows its 3.15 A fuse; a 2.5 V lamp on 12 V burns out at
once; a lead across the 12 V battery smokes, burns and melts; a fire left alone ruins the board,
spreads to the bench and comes back after a load; the CO₂ jet puts a young fire out; 114 brings the
brigade after 30 s, then a call with no fire is a false alarm; the burnt board is replaced; a broken
part handed in comes back sound. Updated: the Physics Lab's counts (+2 placements), the systems
list; `residency.test`'s slice-by-slice attach given 20 s (≈ 4.1 s alone, before and after E-2:
it timed out under a full run).

Looked at in the browser preview (SwiftShader, 800 × 600): smoke then flames on the board, the
HUD's explanations, the fire spread over the board and bench and charred them, a reload bringing it
back, the phone (keypad and number keys), 114 counting down, the brigade putting it out, the board
replaced clean; in e2e screenshots, the CO₂ jet with the extinguisher low right.

### Known limits (E-2)

- Thresholds and times are illustrative (named as such in the data): no fire-safety model; the
  fuse's first-order heat blows it a little sooner near twice its rating than real fuses do; the
  brigade's 30 s is shortened for play; cells do not run flat.
- No firefighters are drawn: their arrival is a siren, a notice, and the fires out.
- Fire harms no one (there is no health): too close, a warning. Fire was not shared over LAN rooms (since Phase F-3 lit and put out are).
- A 114 call waiting is not saved: a reload while the brigade is coming needs a new call.
- Not looked at on a real GPU or the 300 Hz display.

## E-2b — the phone in the bag, fire by graphics level

Phú asked (2026-11-11, after b1cc989): the phone's screen for calling 114 made properly; the phone
kept in the player's inventory — never dropped or thrown, only taken out to use and put away; the
fire drawn differently at each graphics level, simple at Low and very detailed at Ultra, and the
extinguisher and the phone in the hand likewise.

- **The phone** (`gameplay/phone/PhoneSystem.ts`, item `phone`): every game carries it in the last
  hotbar slot (#9; an older save gets it on load). It is a carried-only item: Q on its slot (or P
  anywhere) takes it out, Q or P puts it away; it cannot be dropped, thrown or set down, and it
  never leaves the bag. While out, the number keys dial (0–9), F deletes, E calls or hangs up.
  Calls go to the fire system as before (114, 113/115, other numbers).
- **Drawn in the hand** (`platform/render/phoneView.ts`): a 3D phone held low right in front of
  the view, the body's right hand gripping it; its screen a canvas: status bar with the game clock,
  the number, a keypad lit as keys are pressed, the call (calling, ringing, talking, the
  dispatcher's answer, ended). By preset: Low a plain slab, Medium/High rounded with a camera
  bump, Ultra a glass back, side buttons, lenses and flash, speaker grilles. The old 2D phone panel
  is gone.
- **Fire by preset** (`platform/render/fireView.ts`, `particles.ts`): one particle shader (flame
  tongues swaying, colour by age from white-yellow to orange to dark red, smoke). Low: 45 flame and
  6 smoke particles, no sparks; Medium 110/18; High 170/26 with sparks and tongues; Ultra 260/40,
  22 sparks, glowing ember beds under the flames and a flickering point light. Flames sit on the
  burning object's top face.
- **The extinguisher at Ultra** (`props/labs.ts`, small parts): the shell's seams and foot ring,
  the safety pin and its ring, a knurled valve, the hose's ribs and couplings, the horn's rings.

### Results (E-2b)

Checked with the Phase F runs (docs/phase-f-report.md): `npm run test` 3997 PASS; `e2e/circuit-fire.spec.ts` PASS alone, once FAIL under load (flaky). The phone in the hand and the fire at each preset were looked at on the real GPU (RTX 5070) in the browser pane; not on the 300 Hz display.

Limits (E-2b): the phone has no apps but the dialler; the fire's light exists only at Ultra.

## Cabinet audit — can every part be used? (2026-11-12)

Phú asked whether every part in the circuit cabinet can be used yet. Audited from the content (38
placements in `lab-placements.json`, 26 items with `circuit` in `items.json`) and by running each
one (`gameplay/circuit/cabinet.test.ts`, below).

**Found:** the board, solver, heat model and views handled all eight kinds (cell, switch,
resistor, rheostat, lamp, fuse, ammeter, voltmeter). But **20 of the 38 parts could not be
taken**: the cabinet's open box (`visual.openBox`, the box aimed at while it is open, copied from
the 0.5 m deep reagent cabinet) took the back 23 cm of the cabinet, so the aim stopped on the
cabinet before reaching anything in the back row (z 7.37). The back row held **every cell and the
12 V battery, both switches**, the 100 Ω, 220 Ω and 1 kΩ resistors, a 6 V and both 12 V lamps, the
0.5 A fuses and a 1 A fuse, and a voltmeter.

**Fix** (`items.json`, `circuit-cabinet`): the open box is now a slab against the cabinet's back
(8 cm, behind the parts): `center [0, 0, -0.21]`, `size [0.8, 1.9, 0.08]`. The cabinet is still
aimed at there to hand a part back. No code changed. The bottom shelf's back row is seen past the
shelf over it from about 1 m back from the open cabinet (no crouch in the game).

| Part (placements)                                    | Take (before → after)              | Plug in, leads | Computed and shown                                                                  | Status after |
| ---------------------------------------------------- | ---------------------------------- | -------------- | ----------------------------------------------------------------------------------- | ------------ |
| Cell 1.5 V (2), 4.5 V (1), 9 V (1), 12 V battery (1) | back row: no → yes                 | yes            | EMF with r; I = E/(r + R), V = E − Ir; turned round (E); heats I²r, fails when dead | USABLE       |
| Switch (2)                                           | back row: no → yes                 | yes            | open: no current; closed 5 mΩ; blade drawn open/closed                              | USABLE       |
| Resistor 10, 22, 47 Ω (2 each)                       | front row: yes                     | yes            | Ohm's law; heats by V·I, smokes, burns, opens (0.25 W)                              | USABLE       |
| Resistor 100, 220 Ω, 1 kΩ (2 each)                   | back row: no → yes                 | yes            | as above                                                                            | USABLE       |
| Resistor 10 Ω 5 W (1)                                | front row: yes                     | yes            | Ohm's law; runs hot, does not flame                                                 | USABLE       |
| Rheostat 20 Ω 2 A, 100 Ω 1 A (1 each)                | front row: yes                     | yes            | k·R in tenths (E up, F down), slider drawn; heats (I/I_rated)²                      | USABLE       |
| Lamp 2.5 V (2), 6 V (2), 12 V (2)                    | 2.5 V, 6 V-1: yes; others no → yes | yes            | tungsten law R ∝ V^0.4; glow ∝ V^3.4 with halo; burns out by life ∝ V^−16           | USABLE       |
| Fuse 0.5 A (2), 1 A (2), 2 A (2)                     | 0.5 A, 1 A-1: no → yes; others yes | yes            | its resistance; blows at a current held over its rating                             | USABLE       |
| Ammeter 0–3 A (2)                                    | front row: yes                     | yes            | 0.1 Ω; display to 1 mA, − reversed, OL past 3 A; own 3.15 A fuse                    | USABLE       |
| Voltmeter 0–20 V (2)                                 | voltmeter-2: no → yes              | yes            | 10 MΩ; display to 0.01 V, − reversed, OL past 20 V                                  | USABLE       |

Before the fix: 18 parts USABLE, 20 NOT USABLE (could not be taken; everything after taking was
in place). Not in the cabinet: E-3's capacitor, inductor, diode/LED, motor and buzzer do not exist
as items yet (Planned).

**Science checks** (`cabinet.test.ts`, real Physics Lab and Rapier): every one of the 38 parts is
aimed at on its shelf from in front of the open cabinet and taken, plugged in between holes 21 and
22 by the player, read against the loop worked by hand (supply 0.01 Ω, two leads 0.02 Ω), taken off
and handed back by aiming into the cabinet. Resistors, rheostats (whole track, 0.5 and 0.6 of it):
I = V/(R + R_loop); fuses, ammeters, the switch in series with the 10 Ω 5 W resistor (their
ratings kept at the supply's 0.5 V steps): I = V/(R + R_outside), the ammeter turned round reading
−I, the switch open 0 A; voltmeters: the divider V·R_m/(R_m + R_loop), −V turned round; lamps at
their rated voltage: I·(R_lamp(v) + R_loop) = V with P = P_rated(v/V_rated)^1.6; cells and the
battery against the supply at 0 V: I = E/(r + R_loop) out of +, terminal V = E − I·r. No incident
(smoke, failure, fire) while used within ratings. The meters' display text: `circuitView.test.ts`.
The test fails on the old open box (the first back-row cell is not in view).

### Results (cabinet audit)

| Command                                                                                                                              | Result                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`                                                                                                              | PASS                                                                                                          |
| `npx eslint .`                                                                                                                       | PASS                                                                                                          |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                           | PASS                                                                                                          |
| `npx vitest run --maxWorkers=4`                                                                                                      | PASS — 317 files, 4049 tests                                                                                  |
| `SIMLAB_DEV_ONLY=1 npx playwright test e2e/circuit-bench.spec.ts e2e/circuit-fire.spec.ts --project=dev --workers=1 --reporter=line` | 3 PASS, 1 FAIL — circuit-fire: walking back with the extinguisher did not reach z < 5.9 in 30 s (SwiftShader) |
| `SIMLAB_DEV_ONLY=1 npx playwright test e2e/circuit-fire.spec.ts --project=dev --workers=1 --reporter=line`                           | PASS — 2 tests (with the setup) (SwiftShader); circuit-fire is flaky (as in E-2b), not counted as PASS        |

`e2e/circuit-bench.spec.ts` now runs its lamp flow twice: the 6 V lamp from the front row as
before, and the 12 V lamp from the back row (third shelf, not takeable before) at 12 V: about
0.499 A on the supply's display (I = 12/24.05). Both PASS.

Limits: the bottom shelf's back row needs a step back (about 1 m) to be seen; looked at only in
tests (SwiftShader), not on a real GPU or the 300 Hz display.

### Next

E-3: capacitor, inductor, diode and LED (polarity and reverse breakdown), motor, buzzer; guided
tasks at the bench; the teacher explaining it.
