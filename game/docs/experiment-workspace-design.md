# Experiment workspace design

Status: **design, approved by the Lead (internal review, 2026-10-31); not implemented.** The
architecture, the audit and the shared contract are in
[experiment-ux-architecture.md](experiment-ux-architecture.md). The Chemistry and Biology designs
below were proposed by two design agents (Opus) and reviewed by the Lead; where a Lead decision
(next section) differs from a proposal, the decision wins.

**Hard rule.** This is presentation only. Each experiment keeps the objective, apparatus,
materials, procedure, variables, measurements, units and expected result of its agreed
specification (the master prompt's experiment list and the experiment's definition and model). A
piece, material or step that the specification does not give is not added: it is listed as a
**SPEC GAP** (end of this document). References in the tables: **P** a definition parameter, **V**
a model variable (`pose.sample`), **I** / **IN** a declared input, **R** a result, **Inst** an
instrument reading (`measurement.ts`: reading to d, u = d/√12, d/2 apart), **G** a graph, **D** the
definition's description or note, **It** the item's description.

## Presentation of every experiment

Only the presentation is decided here; procedures are the specification's.

| Experiment          | Subject   | Status      | Presentation     | Main interaction                                                     |
| ------------------- | --------- | ----------- | ---------------- | -------------------------------------------------------------------- |
| free-fall           | Physics   | shipped     | `physical-3d`    | direct manipulation of the drop tower, gates and ball                |
| projectile-motion   | Physics   | shipped     | `physical-3d`    | load the ball, aim the launcher, watch the flight                    |
| pendulum            | Physics   | shipped     | `physical-3d`    | set and release the bob, time the swing                              |
| hookes-law          | Physics   | shipped     | `physical-3d`    | hang masses, read the extension on the ruler                         |
| inclined-plane      | Physics   | shipped     | `physical-3d`    | tilt the ramp, release the block                                     |
| ohms-law            | Physics   | shipped     | `physical-3d`    | operate the circuit board and its meters                             |
| refraction          | Physics   | shipped     | `physical-3d`    | turn the ray box, read angles on the protractor                      |
| mechanical-energy   | Physics   | model built | `physical-3d`    | release the cart on the valley track, read the gates                 |
| collisions          | Physics   | model built | `physical-3d`    | launch glider A at glider B on the air track                         |
| circular-motion     | Physics   | model built | `physical-3d`    | whirl the bung, read the radius and period                           |
| buoyancy            | Physics   | model built | `physical-3d`    | lower the cube into the overflow can, read the force sensor          |
| electrical-power    | Physics   | model built | `physical-3d`    | run the board, read meters and calorimeter thermometers              |
| reflection          | Physics   | model built | `physical-3d`    | turn the ray box at the mirror, read the protractor                  |
| converging-lens     | Physics   | model built | `physical-3d`    | slide the screen on the optical bench to the sharp image             |
| acid-base-titration | Chemistry | shipped     | `2d-workspace`   | construct (stand, burette, flask), process (open the tap), measure   |
| reaction-rate       | Chemistry | shipped     | `2d-workspace`   | kinetics: bath, mix, cuvette in the colorimeter, live ln A graph     |
| heating-curve       | Chemistry | shipped     | `bench-embedded` | contextual controls on the 3D hot plate, beaker, thermometer         |
| ph-measurement      | Chemistry | model built | `2d-workspace`   | pour a sample, lower the electrode, read the meter                   |
| dilution            | Chemistry | model built | `2d-workspace`   | pipette stock into the flask, fill to the mark, read the colorimeter |
| solubility          | Chemistry | model built | `2d-workspace`   | weigh, tip in, stir at T, filter and weigh the residue               |
| precipitation       | Chemistry | model built | `2d-workspace`   | tube under the burette, add reagent, observe, filter and weigh       |
| separation          | Chemistry | model built | `2d-workspace`   | procedure strip: dissolve, filter, rinse, evaporate, weigh           |
| microscope          | Biology   | shipped     | `microscopy`     | prepare the slide, place it, objective, focus, observe, measure      |
| osmosis             | Biology   | shipped     | `2d-workspace`   | tissue into solution, soak, weigh; membrane lens                     |
| enzyme-activity     | Biology   | shipped     | `2d-workspace`   | conditions on bath, buffer, extract; gas syringe and live graph      |
| photosynthesis      | Biology   | shipped     | `observation`    | environment around the pondweed; bubbles and capillary over time     |
| transpiration       | Biology   | model built | `observation`    | light, fan, humidity around the shoot; bubble on the capillary       |
| genetics            | Biology   | model built | `2d-workspace`   | choose parents, Punnett board, count offspring, χ²                   |

Spec items 19–21 (plant cell, animal cell, onion epidermis) are specimens of the `microscope`
experiment; spec 11 (series and parallel) is `ohms-law`; spec 5 (friction) is `inclined-plane`;
spec 15 (temperature effects) is covered by `heating-curve` and the bath temperature of
`reaction-rate`.

## Lead decisions on the proposals' contract needs

Chemistry's needs are N1–N16, Biology's E1–E15 (their sections E, kept below).

| Need                                                         | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `set` command (N1, E1)                                       | Yes: a preset value (or a value on the step grid when a parameter has no presets), through `StationSystem`, same milestones and entity state as `adjust`.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Side-effect-free refusal check (E2)                          | Yes: `stations.refusal(stationId, command, parameter?, value?)`, the same texts as the entity guard, logs nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Setup steps and their authority (N6, E5)                     | Yes, as data (`workspace.setup`), checked **inside `StationSystem`** (a pure helper module it uses), which stays the only rule authority for an apparatus. Refused = no change + `ActionBlocked`. RUN gated on every before-run step.                                                                                                                                                                                                                                                                                                                                                            |
| After-run steps (N6, N7)                                     | Allowed only where the definition's text describes them (filter and weigh, stopper and invert). They reveal an instrument reading and change no value.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Setup in the checklist (N7)                                  | A new milestone kind `setup` (`{ kind: 'setup', step }`) so a definition's `procedure` can list setup steps; workspace definitions update their checklists in data.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Saving setup (N13, E6)                                       | Entity states `setup.<step>`, station configuration like `param.<id>`. The save's entity states are free-form (`saveData.ts`), so no `SAVE_VERSION` bump. RESET keeps the setup; `clear` restarts it.                                                                                                                                                                                                                                                                                                                                                                                            |
| Desk, dials, buttons, display, monitor (N16, E14)            | Removed from the room for every non-`physical-3d` station. The apparatus and the instruction board stay as the lab's presence. One control surface per station.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Pre-run preview (N2)                                         | Yes, for visuals only: the model's state at t = 0 for the current settings, flagged `preview`, never recorded, never shown as a number.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Localized model refusals (N3)                                | Later. The generic `station.cannotRun` stays; the presets keep refusals unreachable where the drafts say so.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Shared three-free visuals (N10, Bio §F1)                     | Yes: one module for colour and level maps and one for the specimen painter, imported by the 3D renderers with no behaviour change; a test asserts 2D and 3D give the same colour and level for one sample.                                                                                                                                                                                                                                                                                                                                                                                       |
| Element table (N11)                                          | Yes, only elements in this experiment's material formulas named; symbol, name, Z; standard atomic weights (IUPAC 2021) only where a model uses them.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| bench-embedded anchors (N9)                                  | Yes, for heating-curve, after the 2D layouts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Workspace events, input, Esc (N12)                           | As in the architecture: `WorkspaceOpened` / `WorkspaceClosed`, no `moveIntent`, pointer freed, Esc closes the innermost layer then the workspace.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Inspected milestones (N8, E8)                                | Opening the workspace marks `inspected` of its apparatus; the Brief marks the instruction board's; Analyse sends `view`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Subject look (N14, E9)                                       | From data: the laboratory's `accent` (`laboratories.json`) and a stage surface, set as CSS variables on the workspace root; `data-presentation` selects the layout. No code reads a subject or an id.                                                                                                                                                                                                                                                                                                                                                                                            |
| Records-only scatter (E7)                                    | Yes, in the results panel: x a parameter, y a result, from `RunRecord`s only, no fit (spec 25's activity curve).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Integer results (E12)                                        | Yes: result `format: 'integer'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Run verb (E13)                                               | Optional `workspace.runLabel` (+vi) in data; RUN otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3D behind a workspace (E15)                                  | The lab stays visible at the edges, so it keeps drawing; a lower draw rate behind a full workspace is allowed later, measured first, simulation untouched.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Microscope structures (E11)                                  | Yes, only structures the painter draws, labelled from data; the cheek cell outline is labelled membrane. Anything more is a SPEC GAP for science review.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Microscope protocol per specimen (user decision, 2026-10-31) | Only onion epidermis gets the preparation workflow (spec 21: slide → specimen → stain → coverslip → microscope → focus → observe); specimen and stain lock once the slide is made, "New slide" restarts it. Cheek cells and Elodea do **not** inherit it: their preparation is a SPEC GAP. Until it is specified they appear only as the prepared slides the shipped definition describes (spec 19: "provide a prepared slide"), chosen and placed on the stage, with no preparation steps. Setup steps therefore need a per-material condition (`when: { parameter, values }`) in the contract. |
| Microscope pan                                               | Not offered (it could read as a measured image). Zoom is the objective only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**One shell, three modes.** Both proposals' shells are one host: top bar (where you are: lab ›
bench › experiment, Brief, Exit), library on the left, the stage, the lifecycle bar at the bottom
(stage chips, RUN/STOP/RESET, the refusal line), the notebook on the right (live monitor graph,
runs, and the results panel for Results / Analyse). Controls appear at the selected piece (a
callout); below 1280 px wide the callout docks to the right as a context panel. The layouts are
per presentation: `2d-workspace` (library + stage + notebook), `observation` (the organism as the
hero, lens insets, graph dock), `microscopy` (prep tile ↔ eyepiece field), `bench-embedded`
(callouts on the 3D apparatus, a live curve card). Each subject's identity comes from its lab's
data: Chemistry a bright glass bench and crystal-violet accent, Biology a backlit specimen field
and chlorophyll-green accent, cyan focus rings everywhere.

## Chemistry: the Digital Chemistry Bench

Proposal by the Chemistry design agent, reviewed by the Lead. Construct + Process + Measure.

### C. The Chemistry workspace design

#### C1. Identity: how it differs from Physics and Biology

|          | Physics (keep)                      | Chemistry (this)                                                                                                                                                                                                                                                             |
| -------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metaphor | an instrument rig in space          | a lit glassware bench, seen at eye level                                                                                                                                                                                                                                     |
| Stage    | the 3D room                         | a **bright bench stage**: a light epoxy worktop (`--bench-top` ≈ #dfe4e8), a pale tiled splashback, a soft top light. Liquids and indicator colours read best on light ground, which is why titrations use a white tile.                                                     |
| Chrome   | dark instrument panels, cyan accent | the same SimLab dark chrome (`--panel`, `--ink`, `--font-sans`, radii, `--control-height`) framing the bright stage, with a **chemistry accent `--subject-accent: #a78bfa`** (crystal-violet). The cyan `--accent` stays for focus rings so focus looks the same everywhere. |
| Motion   | mechanical, eased                   | fluid: liquid levels ease to the model value, meniscus curvature, drops falling only while the tap is open (V: `status`), bubbles only while the model boils                                                                                                                 |
| Type     | technical labels                    | the same tokens; formulas in `--font-sans` with real sub/superscripts (they are already in the content strings: H₂O, Ag⁺)                                                                                                                                                    |

Styling key: `data-category="chemistry"` on the workspace root, set from `definition.category` as
a data attribute. No TypeScript branches on it; only CSS reads it (see E, N14). It must not use
`backdrop-filter` (a GPU cost over WebGL); the dim edge is a plain translucent colour, so every
preset looks the same.

#### C2. Layout

Three zones and two bars. The bench stage is always the largest area. Controls appear **at the
piece** (callout), never in a global settings panel.

```
╭─ ◂ Back to lab (Esc) ── CHEMISTRY LAB › West island › Acid–base titration ───── Setup ━━● Run ○ Observe ○ Measure ○ Analyse ○ ── ☰ Procedure 3/6 ─╮
│┌──────┐┌─────────────────────────────────── BENCH STAGE (SVG, 16:9 viewBox) ─────────────────────────────────────┐┌──── NOTEBOOK ─────────┐│
││ ⚗    ││   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ pale splashback, top light ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                        ││ pH against NaOH added ││
││Mater││        ║                                                      ╭─ Burette ─────────────────╮      ││  14┤          ╭────── ││
││ ials ││        ║ 0 ┤ burette                  ┌ magnifier ┐          │ Titrant  NaOH              │      ││    │         │        ││
││      ││        ║ 1 ┤ (scale drawn,            │ 12 ┤▔▔▔▔  │          │ c_b ( 0.05 )(●0.1 )( 0.2 ) │      ││   7┤- - - - -┼ V_eq   ││
││ ⚙    ││       ═╬═  meniscus at V:volume)     │ 13 ┤ ◡    │          │ Read to (● ½ mark)( 1 mark)│      ││    │ ______╯        ││
││Equip ││        ◐ tap                         └───────────┘          │ Q 0.25 mL/s · fixed        │      ││   0┼────────────── V  ││
││      ││        ╎ drop                                               │ Added V  12.40 mL  (live)  │      ││ Runs  #1 #2 #3  ▸     ││
││ ⊞    ││       ╱‾╲  conical flask, tint from V:pH                     │ [ ◐ Open tap · RUN ]       │      ││ Results · Analyse ▸   ││
││Elem. ││  ▭▭▭▭▭▭▭▭▭▭ white tile ▭▭▭▭▭     ◌ empty slot (dashed)     ╰────────────────────────────╯      ││                       ││
││      ││ ══════════════════════════ light worktop ═════════════════════════════════════════════════   ││                       ││
│└──────┘└──────────────────────────────────────────────────────────────────────────────────────────────────┘└───────────────────────┘│
╰─ ● Ready · t 0.0 s ·  [ ▶ RUN ]  [ ■ STOP ]  [ ↺ RESET ]  ·  ⓘ “Put the flask under the burette tip first.” ──────────────────────────────╯
```

| Zone                | Content                                                                                                                                    | 1280×720                                                    | 2560×1600                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------- |
| Top bar (48 px)     | Exit (Esc), location breadcrumb (lab › bench › experiment, so the player knows where they are), the stage chips (C7), the Procedure button | full                                                        | full                                  |
| Library rail        | Materials · Equipment · Elements tabs                                                                                                      | 64 px icon rail; a tab opens a 300 px drawer over the stage | 300 px pinned                         |
| Bench stage         | SVG pieces in slots, empty slots as dashed outlines, callouts                                                                              | ~1150 × 610                                                 | ~1800 × 1450 (viewBox scaled, `meet`) |
| Notebook            | the live monitor graph, the run list, and buttons to Results/Analyse                                                                       | a tab on the right edge; opens a 380 px drawer              | 420 px pinned                         |
| Process bar (56 px) | status and t, RUN/STOP/RESET (the same commands as the piece's own action), the inline refusal line                                        | full                                                        | full                                  |

The 3D lab stays behind the overlay, with a 16 px dimmed edge showing it (no blur). On Exit the
player is where they stood (C8).

#### C3. Libraries

Every list comes from the experiment's `workspace` data, written only from D/It/presets (section
D traces each). Nothing generic is listed.

| Library       | What a card is                                                                                                                                                                                                                   | Effect of choosing it                                                                                                                                                                       | Wrong choice                                                                                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Materials** | A bottle, jar or tube: localized name, formula, concentration or form label, and the shown inputs on its label (I with desk:true). Each card **binds** to parameter presets (`binds: [{parameter, value}]`) or is a fixed input. | Choose, then place into an accepting piece. This sends the `set` command for each bound parameter (E, N1).                                                                                  | Placing into a piece that does not accept it is refused with the step's reason, e.g. "The burette holds the titrant, NaOH, in this experiment." Nothing changes.                                           |
| **Equipment** | The pieces of D/It only, e.g. "50 mL burette (0.1 mL marks)". Sized variants (pipettes 10/20/25 mL; flasks 25…250 mL) are one card with a size choice that binds the parameter.                                                  | Place into its slot (or it starts placed, see D).                                                                                                                                           | Wrong slot is refused with a reason: "The pipette goes to the acid bottle, then the flask."                                                                                                                |
| **Elements**  | A compact 18 × 7 periodic grid. **Only elements in this experiment's material formulas are active and named.** Other cells show only their symbol, dimmed, with no info.                                                         | Focusing an element opens a card: symbol, name, Z, and "**In this experiment:** hydrochloric acid HCl, sodium chloride NaCl…" with "Show these materials", which filters the Materials tab. | An element not in the experiment: "Cu is not in any material of this experiment." There is no add, drag or combine action on elements, ever. Elements are a lens on the material library, not ingredients. |

**Scientific feedback without inventing reactions.** Chemistry outcomes come only from the
model. Precipitation's registry is the only place pairs "react". AgNO₃ + Na₂SO₄ is not refused:
it runs, and the model's own result is the feedback (no solid, Q/Ksp ≤ 0.62, class
"Unsaturated: no solid"). Refusals are about the _procedure_ (wrong vessel, step missing), never
about chemistry the model does not cover.

Element info is limited to symbol, name and Z. The standard atomic weight is shown only where a
model uses it (precipitation, IUPAC 2021, per its NOTES). Anything more (electron configuration,
group facts) is **SPEC GAP** and is not shown.

#### C4. Placement interaction

**Click-to-place with snap slots is the primary method. Drag is an alternative with the same
result.**

1. Select a library card (click / Enter). Slots that accept it glow in the accent. Slots that
   do not are dimmed, and their tooltip and `aria-description` give the reason.
2. Click a glowing slot, or press ←/→ to cycle the accepting slots and Enter to place.
3. Pointer users may drag the card. It snaps to the nearest accepting slot within 48 px.
   Releasing elsewhere returns it with no change.

Why: positions carry no physics in these models, so free placement would pretend they matter.
Snap slots are deterministic, testable, keyboard- and touch-accessible, and each one maps 1:1
to a setup step in data. Pouring and transfers are **contextual actions** on the source piece
("Pipette into flask"), not drags, because a drag gesture cannot convey a volume honestly; the
volume is the bound preset.

#### C5. Contextual control panels (callouts) per apparatus kind

A callout opens next to the selected piece and flips sides to stay on the stage. Only one is
open at a time. Its header answers "what does this control belong to?" with the piece name and
icon. It contains, in this order:

1. Owned parameters, as preset chips (`role="radiogroup"`).
2. Fixed shown inputs (read-only, "fixed in this model").
3. Live readouts.
4. The piece's actions.
5. The instrument reading once the run has completed.

Each parameter is owned by exactly one piece (a validation test, E N15).

| Kind                                                                                               | Controls (bind to)                                                                     | Readouts (bind to)                                                                                            | Visual roles (bind to)                                                                                                                       | Actions                                                           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `burette`                                                                                          | titrant via material (P); reading resolution d (P)                                     | added V (V); flow Q (I)                                                                                       | level ← V `added`; tap open ← `status` running; drops ← running                                                                              | Fill (setup); **Open tap = RUN**, **Close = STOP**                |
| `pipette`                                                                                          | capacity (P)                                                                           | —                                                                                                             | filled / empty from the setup step                                                                                                           | Aspirate from the bottle → Dispense into the vessel (setup)       |
| `vessel` (shape: conical-flask, beaker, volumetric-flask, boiling-tube, evaporating-dish, cuvette) | contents-related parameters only if D puts them there (e.g. form and C of a pH sample) | contents from data (material, volume)                                                                         | level ← role `level` (V or P, plus V `added`); tint ← role `tint` via a shared colour map; solid ← role `solid` (V); crust / precipitate ← V | Place, Pour (setup)                                               |
| `hot-plate`                                                                                        | set power or temperature (P)                                                           | set value (P); shown inputs                                                                                   | plate glow and pilot light ← running (P > 0)                                                                                                 | —                                                                 |
| `balance`                                                                                          | resolution d (P)                                                                       | weighed value: the parameter before a run when D says the solid is weighed, the Inst reading after completion | pan load from data                                                                                                                           | Tare (shown as done, it is in Inst `name`), Weigh (post-run step) |
| `ph-meter`                                                                                         | resolution d (P)                                                                       | reading (V, live; to d after completion); E (V); θ, t_read (I); "calibrated (taken as perfect; not modelled)" | electrode up/down ← running/time; settle countdown ← V `immersionTime` vs I `readTime`                                                       | **Lower electrode = RUN**; **Rinse = RESET** (as D says)          |
| `colorimeter`                                                                                      | mode A/concentration (view only); resolution d (P, concentration mode)                 | A (V); concentration reading (Inst)                                                                           | lamp ← running; cuvette tint ← V `absorbance`                                                                                                | Insert cuvette (setup)                                            |
| `timer` / `stopwatch`                                                                              | resolution d (P)                                                                       | elapsed (V); marks (Inst result)                                                                              | time-lapse badge ← I `timeLapse`                                                                                                             | —                                                                 |
| `thermometer`                                                                                      | —                                                                                      | T (V or P per D)                                                                                              | column height ← same                                                                                                                         | —                                                                 |
| `water-bath`                                                                                       | θ (P)                                                                                  | θ (P)                                                                                                         | —                                                                                                                                            | —                                                                 |
| `filter-funnel`                                                                                    | —                                                                                      | —                                                                                                             | residue ← role (V/R)                                                                                                                         | Filter (setup / post-run)                                         |
| `wash-bottle`                                                                                      | rinses n (P) where D has rinses                                                        | rinse volume (I)                                                                                              | —                                                                                                                                            | Fill to mark = RUN (dilution)                                     |
| `spotting-tile`                                                                                    | —                                                                                      | —                                                                                                             | drop tint ← V `pH` via `INDICATOR_CHART`                                                                                                     | —                                                                 |
| `reagent-rack` (bottles, jars, tubes)                                                              | the bound material parameter                                                           | label inputs (I desk:true)                                                                                    | open cap ← chosen                                                                                                                            | Choose                                                            |

#### C6. Visual state follows the model

Chain: **action → `set`/run command → StationSystem → session/model → `pose.sample` → view
roles → instrument reading → results**.

- Every moving visual reads a declared role. Roles resolve only to V, P or I. A view **never
  computes chemistry**. Colour maps (indicator transmittance, universal-indicator chart, crystal
  violet 10^−A, precipitate colour by product index) and vessel-profile level maps are shared
  pure functions, the same ones the 3D renderers use (E, N10), so 3D and 2D cannot disagree.
- Before a run: levels and contents come from the chosen presets plus the t = 0 model state, if
  the Lead grants a preview (E, N2). Otherwise pre-run liquids show only what the presets set (a
  volume, a material) and **no number is shown as a measurement before a run**.
- Animation only interpolates between model values (levels ease over ≤ 150 ms to the sample).
  Drops, bubbles and stirring are on/off from `status` or from a variable changing. Nothing that
  is not modelled is animated: precipitate settling, spitting and overshoot are left out.
- `prefers-reduced-motion`: drops, bubbles and ease turn off. States still change.

#### C7. Measurement, graph and the run lifecycle

The stage chips are **derived** (no second state machine). They come from `session.state`, the
setup steps and the checklist.

| Stage   | When                                       | What the workspace shows                                                                                                                                                                                                                                     |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Setup   | `idle`/`configured`, a setup step not done | slots, library, step hints (the next step is pulsed once, not looped)                                                                                                                                                                                        |
| Run     | `running`                                  | the process bar's RUN becomes STOP. The piece's action mirrors it. Controls are locked with the existing reason "Stop the run before changing its parameters."                                                                                               |
| Observe | `running` → `completed`                    | live visuals; live readouts in callouts; the live monitor graph (G = `definition.monitor`) draws in the notebook from the run buffers (`plot.ts`)                                                                                                            |
| Measure | `completed`                                | each instrument piece shows its **Inst reading** (reading to d, u = d/√12 labelled "from the resolution only", d/2 separately). This is the format `ResultsPanel` uses. Post-run steps (filter, weigh), where D has them, reveal the reading at their piece. |
| Analyse | after `view`                               | the notebook's "Results · Analyse" opens the existing **ResultsPanel** inside the workspace: results vs theory, runs, compare, CSV, analyses. It is reused, not rebuilt. Opening it sends `view` (milestone `viewed`).                                       |
| Reset   | RESET                                      | the session's known state. **The assembly stays set up** (like today's dials): liquids return to t = 0, readings clear, so repeat trials are one click.                                                                                                      |

#### C8. Feedback for refused or wrong actions

| Case                                     | Authority                | Message                                                                       |
| ---------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| Material or piece into a wrong slot      | setup guard (E N6)       | the step's localized `refusal`, inline at the slot                            |
| RUN before setup is complete             | setup guard → `runBlock` | the first incomplete step's refusal                                           |
| Dial while running / RUN after completed | StationSystem (existing) | existing `station.stopFirst` / `station.resetFirst`                           |
| Settings the model refuses               | model via StationSystem  | a localized model reason (E N3). Today it is the generic `station.cannotRun`. |
| Chemistry that does nothing              | the model                | its result (no precipitate, unsaturated) is the answer, not a refusal         |

Delivery: inline next to the piece, plus the process bar line, plus `ActionBlocked` → the
existing NoticeQueue, plus `aria-live="polite"`. A refused action changes nothing (as
ProcedureSystem). There is no shaking and no error sound.

#### C9. Keyboard and accessibility

- **Focus order:** Exit → Procedure → library tabs → library cards → bench pieces (slot order,
  left → right, back → front) → the open callout (trapped while open; Esc closes it and returns
  focus to its piece) → process bar → notebook. Esc with nothing open = Exit.
- Pieces are `<g role="button" tabindex="0">` with names such as "Burette, 50 mL, holds NaOH
  0.1 mol/L". Controls get accessible names like "Burette: NaOH concentration c_b". Preset
  chips are native radio inputs, so the arrow keys change the preset (the same command as the 3D
  E/F dial).
- Live values are not announced every frame. Announced: state changes (run started or ended,
  endpoint reached, precipitate formed when V `saturation` reaches 1), refusals, and readings at
  completion.
- Colour is never the only cue. Indicator and precipitate colours also have a text name at the
  vessel (from definition text: indicator preset labels, precipitation result classes). Graph
  series follow ResultsPanel's rule (legend and line style).
- Contrast: ink on the dark chrome uses the existing tokens (≥ 4.5:1). On the bright stage,
  labels are dark ink #1b2430 (≥ 12:1 on #dfe4e8). `#a78bfa` is used only for accents on dark
  chrome (≈ 7:1 on #0d1116), never as text on the light bench.
- Sizes: callout min target 32 px (`--control-height` for primary actions). At 1280×720 the
  stage keeps ≥ 560 px height, and drawers overlay rather than squeeze it. At 2560×1600 type
  stays at the token sizes and the stage scales (SVG). This needs checking on both sizes in
  Edge (C9 is a design target, NOT RUN).
- Identical on Low/Medium/High (DOM/SVG only). Per frame: attribute writes on pre-built SVG
  nodes only, text updates at most 10 Hz, no allocation (CLAUDE.md hot-path rule).

### D. Per-experiment workspace specs

Slots are named left → right on the stage. "Setup steps" are data checked by the setup guard
(E N6). Step order is enforced only where one physically needs another (contents need their
vessel). Every row cites its source.

#### D1. acid-base-titration — `2d-workspace`

| Piece                              | Kind                                  | Slot                                | Controls                                                         | Readouts                                      | Visual roles                                                                    | Source     |
| ---------------------------------- | ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- | ---------- |
| Retort stand + clamp               | `retort-stand` (decor, fixed)         | `stand`                             | —                                                                | —                                             | —                                                                               | It         |
| 50 mL burette (0.1 mL marks)       | `burette`                             | `stand.clamp`                       | d ← P:`resolution` (½ mark / 1 mark)                             | V added ← V:`volume`; Q ← I:`flowRate` (desk) | level ← V:`volume` (reads down from 0 mL); tap / drops ← running                | It, Inst   |
| Burette funnel                     | `filter-funnel` (as a filling funnel) | on the burette for "Fill", then off | —                                                                | —                                             | —                                                                               | It         |
| 250 mL conical flask on white tile | `vessel`/conical-flask                | `tile` (under the tip)              | —                                                                | contents: HCl V_a + indicator                 | level ← P:`acidVolume` + V:`volume`; tint ← indicator(P:`endpointPH`) at V:`pH` | It, D      |
| Volumetric pipette                 | `pipette`                             | `rack`                              | capacity ← P:`acidVolume` (10/20/25 mL)                          | —                                             | filled after Aspirate                                                           | D, presets |
| HCl bottle                         | material                              | `shelf`                             | —                                                                | label c_a ← I:`acidConcentration` (desk:true) | —                                                                               | D, inputs  |
| NaOH bottle                        | material                              | `shelf`                             | binds P:`baseConcentration` 0.05/0.1/0.2                         | label c_b                                     | —                                                                               | presets    |
| Indicator dropper bottles          | material ×2                           | `shelf`                             | binds P:`endpointPH` 4.4 (methyl orange) / 8.2 (phenolphthalein) | colour change range (preset label)            | —                                                                               | presets    |

- **Setup steps:** (1) clamp the burette on the stand; (2) fill the burette with NaOH (sets
  c_b); (3) aspirate HCl with the pipette (sets V_a) and dispense it into the flask; (4) add the
  indicator to the flask (sets pH_end); (5) put the flask on the tile under the tip. RUN = "Open
  tap". Refusal example: "Put the flask with the acid and indicator under the burette tip
  first."
- **Measure:** a magnifier over the meniscus, with the drawn scale for reading by eye. On
  completion: Inst V_end (burette, d) with u and d/2. R: `endpoint-volume`,
  `equivalence-volume`, `endpoint-pH`, `acid-concentration`.
- **Graph:** G:`ph-volume`, live with V_eq marked. Compare: as the definition says.
- **SPEC GAP:** no pH probe in the apparatus, so pH is shown **only on the graph** (as "pH in
  the flask (model)"), never as a meter on the bench. Burette rinsing, the pipette filler and
  concordance checking are not in D, so they are not added. The drop rate is fixed (Q, I), so
  the burette has no flow control. The requirement mentions flow/drop rate, but the model has
  none, and it is labelled "fixed in this model".
- **c_a is hidden** (user decision): the HCl bottle reads "HCl solution"; see "Information
  hiding" below.

#### D2. reaction-rate — `2d-workspace`, graph-led (the stage is 55 % and the notebook graph 45 %)

| Piece                                  | Kind             | Slot               | Controls                                     | Readouts                                | Visual roles                         | Source      |
| -------------------------------------- | ---------------- | ------------------ | -------------------------------------------- | --------------------------------------- | ------------------------------------ | ----------- |
| Thermostatted water bath + thermometer | `water-bath`     | `bath`             | θ ← P:`temperature` 20/25/35/45 °C           | θ                                       | —                                    | It, D       |
| Crystal violet flask (in bath)         | material         | `bath.left`        | binds P:`initialConcentration` 2/5/10 µmol/L | —                                       | tint ← V:`absorbance` (after mixing) | D, presets  |
| NaOH flask (in bath, plastic)          | material         | `bath.right`       | binds P:`naoh` 0.1–0.25 mol/L                | —                                       | —                                    | It, presets |
| Mixing beaker                          | `vessel`/beaker  | `bench`            | —                                            | —                                       | tint ← V:`absorbance`                | It          |
| Cuvette                                | `vessel`/cuvette | `colorimeter.slot` | —                                            | —                                       | tint ← V:`absorbance` (10^−A)        | It          |
| Colorimeter, 590 nm                    | `colorimeter`    | `colorimeter`      | —                                            | A ← V:`absorbance`                      | lamp ← running                       | It, D       |
| Timer                                  | `timer`          | `timer`            | d ← P:`timerResolution`                      | t ← V:`elapsed`; t½ mark ← V:`halfTime` | —                                    | It, Inst    |

- **Setup steps:** (1) set the bath θ; (2) put the dye and NaOH flasks in the bath (sets c₀ and
  [OH⁻]₀); (3) put the cuvette in the colorimeter slot. RUN = "Mix and start timer" (D: the
  timer starts at mixing).
- **Measure:** Inst t½ (timer, d). R: `rateConstant`, `halfLife` (with class), and the rest.
- **Graph:** G:`ln-absorbance-time` is the large live panel; G:`absorbance-time` (t½ mark) is
  the second tab. The analyses `order` and `arrhenius` open in ResultsPanel.
- **Reference card** (notebook): k₂₅ and Eₐ ← I (desk:true), with D's "approximate teaching
  values" note.
- **SPEC GAP:** c₀ and [OH⁻]₀ are concentrations **in the mixture**. D gives no stock
  concentrations or mixing volumes, so the flask labels read "gives c₀ = … in the mixture",
  never an invented stock value. The test-tube rack (It) is not used in the procedure, so it is
  not in the library.

#### D3. heating-curve — `bench-embedded` (callouts anchored to the 3D rig)

| Piece (3D anchor)            | Kind            | Controls                                                     | Readouts                                         | Visual (3D rig, unchanged)                                           | Source |
| ---------------------------- | --------------- | ------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------- | ------ |
| Hot-plate stirrer            | `hot-plate`     | P ← P:`power` 200/500/800 W ("net power into the beaker", D) | P                                                | pilot light, plate, stir bar ← running                               | It, D  |
| 250 mL beaker of crushed ice | `vessel`/beaker | m ← P:`mass`; T₀ ← P:`startTemperature`                      | state chip ← V:`state` through R:`state` classes | ice / meltwater / steam ← V:`iceFraction`, `waterMass`, `vapourMass` | It, D  |
| Thermometer −30…110 °C       | `thermometer`   | —                                                            | T ← V:`temperature`                              | column ← V:`temperature`                                             | It     |
| Stopwatch                    | `stopwatch`     | d ← P:`resolution`                                           | Inst t_f, t_b after completion                   | —                                                                    | Inst   |

- **Live curve card:** G:`heating-curve`, anchored beside the bench in screen space, collapsible.
  The reference card holds L_f and c_w ← I (desk:true).
- **No setup steps:** the apparatus starts assembled (It), which meets §6 B.
- **SPEC GAP:** how m is weighed (no balance in It/D) and how ice reaches T₀ (no freezer). The
  controls sit on the beaker, but no instrument for them is drawn.

#### D4. ph-measurement — `2d-workspace`

| Piece                                     | Kind            | Slot          | Controls                                                                      | Readouts                                                                                                                               | Visual roles                             | Source      |
| ----------------------------------------- | --------------- | ------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------- |
| Reagent rack: 4 acid–base pairs           | `reagent-rack`  | `rack`        | pair binds P:`pKa` (−6 / 4.76 / 9.25 / 20)                                    | pair names (preset labels)                                                                                                             | —                                        | presets, It |
| 100 mL beaker, 50 mL sample               | `vessel`/beaker | `meter.stand` | form ← P:`baseFraction` (acid / 1:1 / base); C ← P:`concentration` 0.1…0.0001 | contents name from the form (preset label)                                                                                             | filled once poured                       | It, presets |
| pH meter, glass electrode on an arm       | `ph-meter`      | `meter`       | d ← P:`meterResolution`                                                       | reading ← V:`reading`; E ← V:`potential` (mV mode); θ ← I:`temperature`, t_read ← I:`readTime` (desk:true); settle ← V:`immersionTime` | electrode lowered ← running              | D, It, Inst |
| Wash bottle                               | `wash-bottle`   | `side`        | —                                                                             | —                                                                                                                                      | —                                        | It          |
| Spotting tile, universal indicator, chart | `spotting-tile` | `tile`        | —                                                                             | indicator colour name ("a guide to ~1 pH", D)                                                                                          | drop tint ← V:`pH` via `INDICATOR_CHART` | It, D       |

- **Setup steps:** (1) pour a sample from the rack into the beaker (sets pKa); form and C are
  set on the beaker. RUN = "Lower the rinsed electrode". RESET = "Rinse the electrode"
  (definition step `reset`).
- **Measure:** Inst pH (meter, d). R:`ph` with its class (Acidic / Neutral / Basic) beside the
  number. R: `hydrogen-ion`, `ionization`, `potential`.
- **Graph:** G:`reading-time` (the reading settling towards V:`pH`). The `dilution` analysis
  opens in ResultsPanel.
- **Calibration:** the meter shows "calibrated (taken as perfect; not modelled)" (D). The pH
  4.01/7.00/10.01 buffers and the waste beaker in It are **left out of the library**, because
  offering them would fake a calibration the model does not have.
- **SPEC GAP:** how the dilutions are made (the samples are prepared at the chosen C). No
  glassware is drawn for it.

#### D5. dilution — `2d-workspace`

| Piece                                        | Kind                      | Slot          | Controls                                                | Readouts                                     | Visual roles                                              | Source      |
| -------------------------------------------- | ------------------------- | ------------- | ------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------- | ----------- |
| Crystal violet stock bottle                  | material                  | `shelf`       | binds P:`stockConcentration` 5/10/20/40 µmol/L          | label C₁                                     | —                                                         | It, presets |
| Volumetric pipette + filler                  | `pipette`                 | `rack`        | capacity ← P:`stockVolume` 1/2/5/10 mL                  | —                                            | filled after Aspirate                                     | It, presets |
| Volumetric flask with ring mark, on the tile | `vessel`/volumetric-flask | `tile`        | size ← P:`finalVolume` 25/50/100/250 mL                 | V ← V:`volume`; water added ← V:`waterAdded` | level ← V:`volume` (flask profile); tint ← V:`absorbance` | It, D       |
| Wash bottle (distilled water)                | `wash-bottle`             | `side`        | —                                                       | —                                            | —                                                         | It          |
| Colorimeter 590 nm, 1 cm cuvette             | `colorimeter`             | `colorimeter` | mode A / concentration; d ← P:`concentrationResolution` | A ← V:`absorbance`; C₂ reading ← Inst        | lamp; cuvette tint ← V:`absorbance`                       | It, D, Inst |

- **Setup steps:** (1) put the flask on the tile (sets V₂); (2) aspirate the stock with the
  pipette (sets C₁ and V₁); (3) dispense it into the flask. RUN = "Add water to the mark" (from
  the wash bottle, `fillTime`). The post-run step "Stopper, invert, fill cuvette" (D) reveals
  the colorimeter reading. The model takes the solution as already mixed, so this step gates
  only the display (Lead decides, E N7).
- **Measure:** Inst C₂ (colorimeter, d). R:`absorbance` class (Pale / Best range / Too dark).
- **Graph:** G:`concentration-volume` (V₂ marked). Analyses `dilution-law` and `calibration`.
- **Refusal:** D says A > 2 or < 0.001 and flask ≤ pipette are refused. This needs N3 for a
  real reason (by D's preset ranges, none of these combinations seem reachable; unverified).

#### D6. solubility — `2d-workspace`

| Piece                                | Kind            | Slot        | Controls                                                                          | Readouts                                                                                 | Visual roles                                  | Source      |
| ------------------------------------ | --------------- | ----------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------- | ----------- |
| Jars: KNO₃, NaCl, KCl + spatula      | `reagent-rack`  | `shelf`     | binds P:`solute` 0/1/2                                                            | —                                                                                        | open cap ← chosen                             | It, presets |
| Electronic balance + weighing boat   | `balance`       | `balance`   | m ← P:`soluteMass` 10…120 g (spatula adds to a preset); d ← P:`balanceResolution` | m before the run (shown to d, as the draft rig does); residue Inst after the filter step | heap in the boat ← P before the run           | It, D, Inst |
| Hot-plate stirrer + probe on a stand | `hot-plate`     | `plate`     | T ← P:`temperature` 20…80 °C                                                      | T display                                                                                | glow ← T > 20 °C (room, per the draft rig)    | It, D       |
| 250 mL beaker, 50 g water, stir bar  | `vessel`/beaker | `plate.top` | —                                                                                 | m_w ← I:`waterMass` (desk)                                                               | crystals on the floor ← V:`undissolved`       | It, D       |
| Timer                                | `timer`         | `timer`     | —                                                                                 | stirring t ← V:`labTime`; t_stir ← I:`stirTime` (desk); badge "×30" ← I:`timeLapse`      | —                                             | D           |
| Filter funnel on a conical flask     | `filter-funnel` | `filter`    | —                                                                                 | —                                                                                        | residue ← R:`residue` after the post-run step | It          |

- **Setup steps:** (1) choose the jar (sets the solute); (2) weigh m on the balance (sets m);
  (3) set the hot plate T. RUN = "Tip in and stir". Post-run: "Filter, dry and weigh the
  residue" reveals Inst m_solid on the balance (D: the solid is weighed exactly).
- **Notebook live chips:** c ← V:`concentration`, c/S ← V:`saturation`, S ← V:`solubility`.
  These are model quantities, not instrument readings, and are labelled that way.
- **Graph:** G:`concentration-time`. Analysis `excess-solid`.
- **SPEC GAP:** the solutions are colourless, so they get no tint (D gives none).

#### D7. precipitation — `2d-workspace` (observation-led: a large tube on a white card)

| Piece                                                  | Kind                        | Slot          | Controls                      | Readouts                                                | Visual roles                                                                                                                                                                                                             | Source      |
| ------------------------------------------------------ | --------------------------- | ------------- | ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Rack of 7 labelled boiling tubes (0.02 mol/L; blank)   | `reagent-rack`              | `rack`        | tube binds P:`sample` 0…6     | names (preset labels)                                   | —                                                                                                                                                                                                                        | It, presets |
| Boiling tube under the burette, white backing card     | `vessel`/boiling-tube       | `stand.tube`  | V_s ← P:`sampleVolume` 1…5 mL | V added ← V:`volumeAdded`                               | level ← P:`sampleVolume` + V:`volumeAdded`; turbidity ← V:`precipitatedPercent`; colour ← V:`product` (shared map: white/cream/yellow/white/white/pale blue/red-brown, D); colour **name** shown when V:`saturation` ≥ 1 | It, D       |
| Reagent bottles ×3 (AgNO₃ brown glass, Ba(NO₃)₂, NaOH) | material                    | `shelf`       | binds P:`reagent` 0/1/2       | c_r ← I:`reagentConcentration` (desk)                   | —                                                                                                                                                                                                                        | It, presets |
| 10 mL burette clamped over the tube                    | `burette`                   | `stand.clamp` | —                             | V_r ← I:`reagentVolume` (desk); added ← V:`volumeAdded` | level, tap ← running                                                                                                                                                                                                     | It, D       |
| Filter funnel + analytical balance                     | `filter-funnel` + `balance` | `weigh`       | d ← P:`balanceResolution`     | Inst m (post-run "Filter, dry, weigh")                  | residue ← R:`mass` > 0                                                                                                                                                                                                   | It, Inst    |

- **Setup steps:** (1) put a tube in the stand (sets the sample); (2) fill the burette with a
  reagent (sets the reagent). RUN = "Open the tap" (10 mL at 0.5 mL/s).
- **Results:** R:`product` class ("White: AgCl" …), `saturation` class, `precipitatedPercent`
  class, `amount`, `mass`. The question "which ion does the sample contain?" is the procedure's
  `results` step.
- **Elements:** active cells Na, Cl, K, Br, I, S, O, Cu, Fe, Ag, N, Ba, H (from the formulas
  in the preset labels). Atomic weights are shown here only (the model uses them).
- **Graph:** G:`amount-volume` (V_eq marked). Analysis `gravimetric`.
- **SPEC GAP:** the measuring device for V_s (D/It name none), so it is a control on the tube
  with no glassware drawn. It says the precipitate "then settles", but settling is not modelled,
  so it is **not animated**.

#### D8. separation — `2d-workspace` (procedure strip, left → right)

| Piece                                                  | Kind                                    | Slot      | Controls                                | Readouts                                           | Visual roles                                                                       | Source     |
| ------------------------------------------------------ | --------------------------------------- | --------- | --------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------- |
| Sand–salt mixture                                      | material                                | `shelf`   | salt binds P:`saltMass` 1/2/3/5 g       | m_sand ← I:`sandMass` (desk) "with 5 g of sand"    | —                                                                                  | D, presets |
| 250 mL beaker + glass rod                              | `vessel`/beaker                         | `beaker`  | water V_w ← P:`waterVolume` 10/25/50 mL | —                                                  | mixture and water by the setup steps                                               | It, D      |
| Filter funnel, folded paper, ring stand, conical flask | `filter-funnel`                         | `filter`  | —                                       | —                                                  | sand residue shown from run start (as the draft rig)                               | It, D      |
| Wash bottle (5 mL rinses)                              | `wash-bottle`                           | `side`    | n ← P:`rinses` 0–3                      | V_rinse ← I:`rinseVolume` (desk)                   | —                                                                                  | It, D      |
| Evaporating dish on the hot plate                      | `vessel`/evaporating-dish + `hot-plate` | `plate`   | — (P fixed 150 W, desk:false)           | water ← V:`waterMass`; badge "×20" ← I:`timeLapse` | liquid ← V:`waterMass`; crust ← V:`crystalMass`; bubbles while V:`waterMass` falls | It, D      |
| Top-pan balance (tared)                                | `balance`                               | `balance` | d ← P:`balanceResolution`               | Inst m_rec (dish), Inst m_residue (filter paper)   | —                                                                                  | It, Inst   |

- **Setup steps** (procedure strip, each a click on its piece): (1) mixture into the beaker (sets
  m_salt); (2) add water (sets V_w); (3) stir to dissolve; (4) filter through the paper;
  (5) rinse the sand n times (sets n); (6) put the dish of filtrate on the hot plate. RUN =
  "Heat". Post-run: weigh the dish and the residue.
- **Honesty label** (from D): steps 3–5 are "worked out as a mass balance at the start of the
  run, not shown in time". The strip marks them "computed at run start". No numbers are shown
  for them before the run. R:`undissolvedSalt` class ("Too little water") is the feedback when
  V_w is small.
- **Decantation and distillation:** D says decanting changes nothing in this mass balance and
  distillation is a concept. They appear as notes in the procedure card only, with **no buttons**
  (§17's "where appropriate").
- **Graph:** G:`salt-time` (crystal time marked). Analysis `recovery-line`.
- **SPEC GAP:** no thermometer in It/D, so V:`temperature` appears only in the notebook and
  G:`temperature-time`, not as an instrument. The measuring device for V_w is not named either.

### Chemistry contract needs (decided above)

| #   | Need                                                                                                                                                                                                                                                                                                                                     | Why                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| N1  | A `set` command `{stationId, command:'set', parameter, value}`, accepted only for a preset value, through StationSystem's guard, marking the same milestones (`adjusted`, `adjusted:<p>`) and entity state `param.<p>`. Today there is only `adjust ±1`.                                                                                 | Placing a material or choosing a pipette selects a preset directly.                        |
| N2  | An optional **preview**: the model's `init` state for the current inputs while there is no run, flagged `preview`, never recorded and never shown as a number.                                                                                                                                                                           | Pre-run liquids (flask colour at t = 0) come from the model, not from view maths.          |
| N3  | Localized model refusal reasons: a `predict` error carries a texts key and params; StationSystem passes it to `runBlock`.                                                                                                                                                                                                                | "The model does not cover these settings" is not scientific feedback (dilution's A range). |
| N4  | `workspace.pieces[]`: `{id, kind, shape?, slot, label (localized), owns: [P], shows: [P/I/V/Inst], roles: {roleName: P/I/V}, accepts: [material ids], actions: [...]}`. Each view kind declares its roles, and a test checks that every role resolves to an existing P/I/V.                                                              | Kind views stay generic (`vessel` reused with different variables).                        |
| N5  | `workspace.materials[]`: `{id, label, formula?, form, binds: [{parameter, value}] \| null, labelInputs: [I]}`. A test checks that every bind is a real preset and that the presets of every owned parameter are covered.                                                                                                                 | The library comes from data and binds to presets.                                          |
| N6  | `workspace.setup[]`: `{id, instruction, refusal (both localized), action: place\|transfer\|choose, piece, target, requires: [ids], phase: before-run\|after-run}`, checked by one rule authority as an action guard (refuse = no change + `ActionBlocked`). RUN is gated on all before-run steps. Assembly state persists through RESET. | The §6 G validation.                                                                       |
| N7  | Decide whether setup steps become checklist milestones (a new kind `setup:<id>`, which changes definitions' `procedure`) or stay workspace-only. Also decide on after-run steps that gate only a display.                                                                                                                                | It touches the procedure data and the e2e specs.                                           |
| N8  | Opening the workspace Procedure card marks the `inspected` milestone of the experiment's instruction item.                                                                                                                                                                                                                               | The definition's first step is "read the board".                                           |
| N9  | For `bench-embedded`: per-piece anchor points in the item frame, plus a platform projection to screen (DOM only, hidden when off screen or occluded by distance).                                                                                                                                                                        | Heating-curve callouts sit on the 3D rig.                                                  |
| N10 | A three.js-free shared presentation module (e.g. `src/platform/chem/`): vessel profiles and level-by-volume, indicator transmittance, `INDICATOR_CHART`, crystal-violet tint 10^−A, precipitate colour by product index. The 3D renderers import it with no behaviour change.                                                            | 2D and 3D must agree. Today these live inside three-importing files.                       |
| N11 | An element reference table (symbol, Z, period/group; EN/VI names **only for elements used in chemistry materials**; source IUPAC/CIAAW 2021), plus a test that parses each material formula to elements that are in the table.                                                                                                           | The Elements lens.                                                                         |
| N12 | Events `WorkspaceOpened/Closed {stationId}`. Game input and pointer lock are suspended while it is open. Esc closes it. The player's pose is unchanged.                                                                                                                                                                                  | The lifecycle.                                                                             |
| N13 | Save: the setup/assembly state is configuration, so either it is saved as entity states (`setup.<id>`) or it is rebuilt on entry. The Lead decides. If it is saved: bump `SAVE_VERSION` + migration.                                                                                                                                     | CLAUDE.md save rule.                                                                       |
| N14 | The workspace root carries `data-category` from the definition (CSS only).                                                                                                                                                                                                                                                               | Subject styling without code branches.                                                     |
| N15 | Validation: each parameter is owned by exactly one piece; every shown input is desk:true; pieces' `kind` is in the registry.                                                                                                                                                                                                             | "What does this control belong to?"                                                        |
| N16 | Placement data: do the desk, dials and desk display leave chemistry 2D stations (the apparatus and results monitor stay as lab presence)? Two control surfaces for one session would confuse.                                                                                                                                            | Room, placement and test-count changes.                                                    |

### Risks

| Risk                                                                                                   | Mitigation                                                                                                                         |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Setup steps read as new procedure, beyond the definition's                                             | Every step is traced to D/It (section D); Opus checks the traces. Order is enforced only where physical.                           |
| Preview or pre-run visuals mistaken for measurements                                                   | No numbers before a run; preview is flagged; readings appear only in Measure.                                                      |
| 2D and 3D drift (two drawings of one rig)                                                              | N10 shared maps and profiles; a test asserts the same colour and level for the same sample.                                        |
| Repeat-trial friction                                                                                  | Assembly persists through RESET; a chosen material stays chosen.                                                                   |
| Colour-only distinctions (cream vs pale yellow; indicator tints)                                       | Text colour names from definition text; neutral bench light; no accent light on vessels.                                           |
| SVG cost at 2560×1600                                                                                  | Pre-built nodes, attribute writes only, 10 Hz text, no filters or blur; measure on SwiftShader **and** a GPU, naming the renderer. |
| The c_a "unknown" is visible                                                                           | Content flag (D1), not changed here.                                                                                               |
| Concurrent edits (the `bench/` folder is untracked; `separation-station.ts` vanished during this read) | Implementers branch from a known ref; one e2e at a time.                                                                           |

## Biology: the Digital Biology Workspace

Proposal by the Biology design agent, reviewed by the Lead. Prepare + Observe + Analyse.

### Spec 18–21 against the microscope model and definition

| Spec ask                                                                          | Covered by                                                         | Status                                                                                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 18 specimen selection                                                             | `specimen` (onion, cheek, Elodea)                                  | OK                                                                                                                   |
| 18 slide placement                                                                | nothing (slide is always on the stage)                             | Workspace setup step (§D1); no model change                                                                          |
| 18 focus                                                                          | `focus` Δz presets; run moves the stage to Δz                      | OK (focus is set, then observed by RUN; no live focusing without a run)                                              |
| 18 magnification                                                                  | `objective` 4/10/40 → `magnification`                              | OK                                                                                                                   |
| 18 observation                                                                    | painter at the run's `sharpness`, `contrast`, `fieldOfView`        | OK                                                                                                                   |
| 18 measurement                                                                    | `cellsCounted` n, `measuredLength` FOV/n, `fieldOfView`            | OK                                                                                                                   |
| 18 "no fake controls"                                                             | —                                                                  | Rules out an illumination dimmer (no model input): see SPEC GAP below                                                |
| 19 plant cell: wall, nucleus, cytoplasm, chloroplast                              | painter draws walls, nuclei, cytoplasm fill, chloroplasts (Elodea) | OK                                                                                                                   |
| 19 plant cell: membrane, vacuole                                                  | not drawn, not in data                                             | **SPEC GAP** (what the picture should show at 40–400× for onion/Elodea needs science review; not invented here)      |
| 20 animal cell: membrane, nucleus, cytoplasm                                      | cheek: outline (drawn in the wall ink), nucleus, cytoplasm         | OK, but the outline must be labelled "membrane", not "wall" (data, §E)                                               |
| 20 "organelles appropriate to the level"                                          | —                                                                  | **SPEC GAP** (no list given)                                                                                         |
| 21 slide → specimen → stain → coverslip → microscope → focus → observe, performed | stain is a dial; no slide, coverslip or stage step                 | Setup steps (§D1). Preparation for cheek cells and Elodea: **SPEC GAP** (21 is onion only; 19 says "prepared slide") |
| User req.: "adjust illumination"                                                  | lamp only switches on with a run                                   | **SPEC GAP**: no illumination parameter. The lamp is shown as an indicator, never a control                          |

### C. The Biology workspace design

#### C1. Identity: "Prepare · Observe · Analyse"

|             | Physics            | Chemistry                                      | **Biology**                                                                                                                                                                                                                     |
| ----------- | ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metaphor    | apparatus in space | glass bench, liquids                           | **specimen under light**: the organism/specimen is the hero, inside a round viewing frame (eyepiece, lens, chamber) with its environment arranged around it                                                                     |
| Left column | —                  | periodic table / materials / equipment shelves | **Specimen library** (microscopy), **Materials** (only the definition's presets made tangible)                                                                                                                                  |
| Shapes      | technical, square  | glassware perspective                          | circles and soft radii (`--radius-xl`), circular insets ("lenses") for magnified views                                                                                                                                          |
| Accent      | cyan `--accent`    | (chemistry's)                                  | a chlorophyll green, data-driven (§E): `--lab-accent: #6cc79a` (9.3:1 on `--bg`, 8.2:1 on `--surface-raised`); primary button `#236b4d` with `--ink-strong` text (6.0:1). Cyan stays for focus rings (shared SimLab affordance) |
| Light       | —                  | —                                              | the observed area is the brightest thing on screen (backlit field `#f3f1ea`, bright-field look); chrome stays dark SimLab glass                                                                                                 |

Same type scale, spacing, focus ring, `menu-button` and panel styles as `styles.css`: only the
accent and the frame shapes differ, so it is one ecosystem.

#### C2. Shell (shared by the three biology modes)

The workspace floats over the dimmed 3D lab (12 px inset at 1280×720, 24 px from 1600 wide;
`rgb(0 0 0 / 55%)` dim, no `backdrop-filter`), so the lab stays visible at the edges. Top bar:
where you are + what you do + exit.

```
╭─ ◂ Biology Lab › Microscope island ───── Observing cells under the microscope ── ⓘ Brief  ✕ Esc ─╮
│ ┌ LIBRARY ───────┐  ┌ STAGE (mode-specific, §C3/C4) ───────────────────┐  ┌ CONTEXT ─────────┐ │
│ │ specimen cards │  │                                                  │  │ appears for the  │ │
│ │ (materials)    │  │   apparatus pieces in named slots, drawn 2.5D    │  │ selected piece:  │ │
│ │ only presets   │  │   (SVG + one Canvas2D where needed)              │  │ its parameters,  │ │
│ │                │  │                                                  │  │ its readouts     │ │
│ └────────────────┘  │   ◯ lens inset (magnified view, where defined)   │  └──────────────────┘ │
│                     └──────────────────────────────────────────────────┘                        │
│  ● Prepare ── ● Set up ── ◉ Observe ── ○ Measure ── ○ Analyse      t 00:42 ▮▮▮▯   [▶ OBSERVE] [■] [↺] │
╰─────────────────────────────────────────────────────────────────────────────── Analyse ▸ drawer ─╯
```

- Columns: library 220–280 px (`clamp`), context panel 280–360 px, stage takes the rest.
  At 1280×720 the stage is ≈ 600×560; at 2560×1600 everything scales with `clamp()`, the stage
  caps at 1800 px wide and centres (no stretched UI).
- Library hides when the definition lists no materials (genetics keeps it: the plant library).
- The **lifecycle rail** (bottom) is the only fixed control strip: the run commands and the
  setup/procedure progress. No other global settings panel.
- **Analyse drawer** (right, 45 % width) hosts the existing `ResultsPanel` (runs, compare, CSV,
  analysis, uncertainty): reused, not rebuilt. Opening it sends the `view` command (milestone
  `viewed`).
- **Brief** (ⓘ) shows the station's instruction board text (marks `inspected:<board item>`, §E).

#### C3. Microscopy layout (`microscope`)

```
╭─ ◂ Biology Lab › Microscope ── Observing cells ───────────────────────────── ⓘ  ✕ ─╮
│ SPECIMENS        │  ┌── microscope (SVG profile) ──┐    ╭──── eyepiece field ────╮ │ CONTEXT │
│ ◐ Onion epid.    │  │  eyepiece ┐                  │   ╱  cells, blurred at S,   ╲│ Objective│
│ ◐ Cheek cells    │  │  nosepiece ◉ 4× 10× 40×      │  │   inked at C, scale bar   │ 4× 10× 40×│
│ ◐ Elodea leaf    │  │  stage ▭ clips  [slide slot] │  │   ⟷ count line (n)        │ M 100×   │
│ STAINS           │  │  focus knob ⟳ Δz 50 µm       │   ╲  "100×  ▬ 200 µm"       ╱│          │
│ ▲ Iodine ▲ M.blue│  │  lamp ○ off / ● on (indicator)│    ╰────────────────────────╯ │          │
│ ○ No stain       │  └──────────────────────────────┘    Sharpness ▮▮▮▯ Slightly blurred│
│ ▭ Slide ▫ Cover- │   PREP TILE (white tile, top view: slide, drop, coverslip)          │
│   slip           │                                                                     │
│ ● Slide ─ ● Specimen ─ ● Stain ─ ◉ Coverslip ─ ○ On stage ─ ○ Focus ─ ○ Observe   [▶ OBSERVE] [↺] │
╰────────────────────────────────────────────────────────────────────────────────────╯
```

- The hero switches: **prep tile** (top view of the slide being made) until the slide is on the
  stage, then the **eyepiece field** (a circle, `min(62vh, 46vw)` across). Before a run the field
  is the dark "lamp off" standby, exactly as the 3D monitor (no run → NaN → standby).
- Field picture: the same painter as the 3D screen, moved to a three-free module (§F), drawn at
  the run's `fieldOfView`, `contrast`, `magnification`, blur from `sharpness` (`blurLevel`),
  specimen/stain from the run's own parameters. Repainted only when those change (as today).
- **Zoom = objective only** (real magnification, the `objective` parameter). No digital zoom: it
  would show detail the objective cannot resolve. **Pan**: optional, presentation-only
  (mechanical stage drag over the seeded tissue, changes no parameter, variable or count);
  default off, reviewer decides (§E risks).
- **Measure** toggle overlays: the field's diameter line with its length `fieldOfView` (µm), the
  scale bar (`scaleBar`), and after a completed run the whole cells counted along the line,
  n = `cellsCounted`, L = `measuredLength`. The count is the model's, the overlay only marks it.
- **Inspect** (only structures the spec names and the painter draws): hovering/clicking a drawn
  structure labels it (wall, nucleus, cytoplasm, chloroplast; cheek outline = membrane). Needs a
  structure map from data + the painter (§E). No annotation tool: the spec does not ask for one.

#### C4. Stage layout for `2d-workspace` / `observation`

A 2.5D bench drawn in SVG (slight top-down perspective, soft floor shadow), pieces in named slots:

```
            back-left        back-centre          back-right      ╭ lens ╮
          ┌─────────┐      ┌─────────────┐      ┌─────────┐       │ 400× │  ← circular inset
          │         │      │  HERO piece │      │         │       ╰──────╯    (membrane, stomata)
          └─────────┘      │ (organism / │      └─────────┘
            front-left     │  vessel)    │       front-right
          ┌─────────┐      └─────────────┘      ┌─────────┐
          │         │        front-centre        │         │
          └─────────┘      ┌─────────────┐      └─────────┘
                           │  instrument │   ← readouts on the instrument itself (LCD, scale)
                           └─────────────┘
   graph dock (bottom-right of the stage, 320×180, expandable): the definition's `monitor` graph, live
```

Slots: `back-left`, `back-centre`, `back-right`, `front-left`, `front-centre`, `front-right`,
`lens`, `graph`. The `observation` mode puts the organism in `back-centre` at 1.4× scale with the
environment pieces around it; `2d-workspace` gives the hero no extra scale.

#### C5. Placement interaction

| Method                       | Use                                                                               | Why                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Click-to-place** (primary) | library item → valid slots/targets glow → click target (or Enter)                 | One gesture = one command; works with keyboard, trackpad, touch; no drop-precision failures           |
| Drag (enhancement)           | same items, same targets; drop = the same place call                              | Feels physical for pointer users; never the only way                                                  |
| Snap only                    | every target is a slot or a preset position (lamp rule marks)                     | Free placement means nothing to the model; snap keeps every state a valid preset                      |
| Contextual click             | click a fixed piece (nosepiece, timer, bath…) → its controls in the context panel | Most biology apparatus is fixed; only the microscope slide prep and the genetics parents are "placed" |

Placing a material that `sets` a parameter sends `set(parameter, value)`; placing a setup item
completes its setup step. Both go through the station's guard; refused → nothing changes.

#### C6. Contextual controls

- Each piece's panel shows: title (piece name), **owned parameters** as segmented preset chips
  (or a knob/slider with detents only at presets), pending vs run values, then its **readouts**.
- A control never appears on a piece that does not own its parameter. Every parameter of every
  definition below has exactly one owning piece (checked in a test, §F).
- During a run, owned controls are disabled with the guard's reason as their tooltip/description
  ("Stop the run before changing its parameters.").
- After a run, changing a control is allowed (as the dials are); the stage keeps drawing the run's
  own inputs, and a banner says "Settings differ from the run shown · Reset and run again"
  (one button = `reset` then `run`, both guarded).

#### C7. Visual state follows the model

Source of every visual: `BenchView.pose` (`status`, `parameters` = run inputs while a run
exists else the dials, `sample` = live model variables, NaN without a run) and, after
completion, the run's results/readings. Pure mapping functions `(pose) → visual state` per piece,
no allocation, DOM written only on change; rAF only while `status === 'running'`, else on
`ExperimentStationChanged`. NaN → the idle look (empty, standby, "—"). Never: values from
theory before a run, random motion, smoothing.

#### C8. Measurement and graph placement

| What                                       | Where                                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Live variables                             | on the instrument piece that shows them (balance LCD, gas syringe scale, capillary scale, stopwatch, counters)                                 |
| Instrument readings (`instruments`)        | on the instrument after completion: reading to d, `u = d/√12` and d/2 in the context panel (from `measurement.ts`), labelled "resolution only" |
| Results with `classes`                     | a result card under the hero ("Sharp", "Gains water", "Near the optimum") with value and theory                                                |
| `monitor` graph                            | graph dock, live during the run                                                                                                                |
| Other graphs, runs, compare, CSV, analyses | Analyse drawer (`ResultsPanel`)                                                                                                                |

#### C9. Run lifecycle

| Phase         | Session state                        | What the player does                                                                              | Commands              |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------- |
| Prepare       | `configured`                         | setup steps (microscope only)                                                                     | place (setup) / `set` |
| Set up        | `configured`                         | choose conditions on their pieces                                                                 | `set`                 |
| Run / observe | `running`                            | watch the pieces and the live graph; STOP available                                               | `run`, `stop`         |
| Measure       | `completed`                          | read instruments and result cards; Measure overlay                                                | —                     |
| Analyse       | any with runs                        | Analyse drawer                                                                                    | `view`                |
| Reset         | `stopped`/`completed` → `configured` | ↺ returns the pieces to their pre-run look (bubble back, cylinder out, syringe at 0); setup stays | `reset`               |

The rail's button label follows the definition's verb where one is natural: OBSERVE (microscope),
SOAK (osmosis), START (enzyme, photosynthesis, transpiration), COUNT (genetics) — from `texts.ui`
keys per mode, never per experiment id. **SPEC GAP**: no verb field in the data; default "RUN".

#### C10. Refused / wrong actions

- Guard reason shown as a callout anchored to the piece (2 s, or until next action), the piece
  does a 4 px shake (none under `prefers-reduced-motion`), and the text goes to an
  `aria-live="assertive"` region. Same reason string as `ActionBlocked`. Nothing changes.
- Wrong-order setup (e.g. coverslip before the specimen): refused with the step's reason
  ("Add the specimen to the slide first.").
- Disabled targets are not hidden: they show why on hover/focus.

#### C11. Keyboard and accessibility

- Focus order: top bar (Brief, Exit) → library → stage pieces in slot order (data order) → context
  panel → lifecycle rail → graph dock → drawer. F6 / Shift+F6 cycles these regions.
- Pieces are `button`s with `aria-label` = name + current state ("Nosepiece, objective 10×, total
  100×"). Preset chips are a `radiogroup`; ←/→ step presets (same as dial ±1).
- Click-to-place by keyboard: Enter on a library item → arrow keys move between valid targets →
  Enter places, Esc cancels.
- Esc closes the innermost layer (callout → drawer → placement) and then the workspace; the
  player is back at the same spot in the 3D lab.
- Run state, refusals and completion announced via live regions; every visual state also has a
  text twin (sharpness class text beside the blur, "Gains water" beside the arrows).
- Contrast: text ≥ 4.5:1, UI lines ≥ 3:1 (values in §C1). Minimum text 13 px at 1280×720.
  Reduced motion: bubbles, seed drops and plunger move in steps.
- Identical on Low/Medium/High (DOM/2D only).

### D. Per-experiment workspace specs

Legend: **P** = parameter (definition), **V** = model variable (live, `pose.sample`), **R** =
result (after completion), **I** = instrument reading, **IN** = declared input, **S** = setup
step. Source column: definition (def), spec item (§n), draft notes (draft).

#### D1. `microscope` — mode `microscopy`

| Piece (kind)                                   | Slot                | Owns                           | Shows                                                                                                                                               | Visual state rule                                                   | Source                                                  |
| ---------------------------------------------- | ------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| Specimen cards (`specimen`) ×3                 | library             | P `specimen` = 0/1/2           | preset label                                                                                                                                        | thumbnail by the painter (low res, no blur)                         | def presets, §18/19/20                                  |
| Stain bottles (`stain-bottle`) ×2 + "No stain" | library             | P `stain` = 1/2 (0 = no stain) | preset label                                                                                                                                        | bottle colour from `INK.nucleus[stain]`                             | def presets, §21                                        |
| Slide (`slide`)                                | library → prep tile | —                              | —                                                                                                                                                   | empty / specimen patch (`PATCH`, `PATCH_SHAPE`) / stained / covered | §21                                                     |
| Coverslip (`coverslip`)                        | library → slide     | —                              | —                                                                                                                                                   | lowered at 45°, then flat                                           | §21                                                     |
| Microscope stage (`microscope-stage`)          | instrument          | —                              | slide on stage or empty                                                                                                                             | clips hold the slide                                                | §18 "slide placement"                                   |
| Nosepiece (`nosepiece`)                        | instrument          | P `objective` 4/10/40          | R `magnification`; IN `eyepiece` M_eye 10×                                                                                                          | turret turned to the run's objective, colour bands from `NOSEPIECE` | def                                                     |
| Focus knob (`focus-knob`)                      | instrument          | P `focus` Δz (15 presets)      | V `offset` (live), IN `focusStart`                                                                                                                  | knob turns (focusStart − offset)/`FINE_PITCH`                       | def                                                     |
| Lamp (`lamp-indicator`)                        | instrument          | — (indicator only)             | on while a run exists                                                                                                                               | —                                                                   | def ("RUN switches on the lamp"); dimmer = **SPEC GAP** |
| Eyepiece field (`eyepiece-field`)              | field               | —                              | V `sharpness`, `contrast`, `fieldOfView`, `magnification`; IN `fieldNumber`                                                                         | painter; blur `blurLevel(sharpness)`; standby without a run         | def, §18                                                |
| Measure overlay (in field)                     | field               | —                              | V `fieldOfView`; R `cellsCounted`, `measuredLength`                                                                                                 | diameter line, scale bar, n tick marks after completion             | def results                                             |
| Result cards                                   | under field         | —                              | R `magnification`, `fieldOfView`, `depthOfField`, `sharpness` (classes), `contrast` (classes), `cellsCounted` (classes), `measuredLength` (classes) | value + theory + class                                              | def                                                     |
| Graph dock                                     | graph               | —                              | `focus-curve` (live), `sharpness-time` in drawer                                                                                                    | —                                                                   | def                                                     |

Setup steps (data, one rule authority, §E), from spec 21's order:

| #   | Step                       | Action                                         | Binds                                             | Refused when                                                        | Source                |
| --- | -------------------------- | ---------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- | --------------------- |
| S1  | Take a clean slide         | place `slide` on the prep tile                 | —                                                 | a slide is already being prepared or on the stage                   | §21 "slide"           |
| S2  | Add the specimen           | place a specimen card on the slide             | `set specimen`                                    | before S1                                                           | §21 "specimen"        |
| S3  | Stain it (or no stain)     | place a stain bottle / "No stain" on the slide | `set stain`                                       | before S2                                                           | §21 "stain"           |
| S4  | Lower the coverslip        | place `coverslip` on the slide                 | —                                                 | before S3                                                           | §21 "coverslip"       |
| S5  | Put the slide on the stage | place the slide on `microscope-stage`          | —                                                 | before S4                                                           | §21 "microscope", §18 |
| S6  | Focus                      | focus knob                                     | `set focus` (existing milestone `adjusted:focus`) | before S5                                                           | §21 "focus"           |
| S7  | Observe                    | OBSERVE = `run`                                | —                                                 | RUN refused before S5: "Put the prepared slide on the stage first." | §21 "observe"         |

- "New slide" (in the context panel of the stage) returns setup to S1; `specimen`/`stain` can
  only change during S2/S3 ("Prepare a new slide to change the specimen.") — this follows spec
  21's order; flagged for the Opus reviewer as the one rule this design adds.
- `objective` is free at any time outside a run (§18 magnification; not part of 21's chain).
- Preparation of cheek cells and Elodea: **SPEC GAP** (spec 21 describes onion only; 19 says
  "prepared slide"). Proposal pending Lead: the same S1–S5 for all three, or S2–S4 skipped
  (a prepared slide) for cheek/Elodea. Not decided here.
- Wet-mount water drop, mounting needle, blotting paper: not in spec → not offered.
- Existing procedure steps stay: `inspected digital-microscope` (opening the workspace, §E),
  `adjusted specimen/stain/objective/focus`, `completed`, `viewed`.

#### D2. `osmosis` — mode `2d-workspace`

| Piece (kind)                             | Slot               | Owns                               | Shows                                                                                                | Visual state rule                                                                                                    | Source                                        |
| ---------------------------------------- | ------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Sucrose solutions (`solution-bottle`) ×4 | library            | P `concentration` 0/0.2/0.5/1      | label                                                                                                | tint none (sucrose is colourless)                                                                                    | def presets                                   |
| Potato cylinders (`tissue-sample`) ×3    | library            | P `initialMass` 2/3/5 g            | label "m₀ 3 g" (a set value, not a reading)                                                          | cylinder length ∝ m₀ (`LENGTH_PER_GRAM`)                                                                             | def presets                                   |
| Boiling tube in rack (`boiling-tube`)    | back-centre (hero) | P `concentration` (via the bottle) | label C; R `solutionPotential`                                                                       | fill to `SOLUTION`; cylinder inside while running/completed; cylinder length ∝ V `mass`                              | def, `osmosis-rack`                           |
| Membrane lens (`membrane-lens`)          | lens               | —                                  | V `direction`, `potentialDifference`, `tissuePotential`                                              | a cell-membrane line; arrows in/out by sign of `direction`, width ∝ abs(`potentialDifference`); hidden without a run | §22 "membrane", "direction of water movement" |
| Timer (`timer`)                          | front-left         | P `soakTime` 30 min/1 h/2 h/4 h    | V `labTime` (mm:ss of lab time), IN `timeLapse` ×240                                                 | counts lab time                                                                                                      | def                                           |
| Balance (`balance`)                      | front-right        | P `balanceResolution` d            | I `finalMass` reading to d, u = d/√12, d/2                                                           | cylinder on the pan after completion; LCD "—" before                                                                 | def instrument                                |
| Result cards                             | under hero         | —                                  | R `finalMass`, `percentChange`, `direction` (classes), `solutionPotential`; IN `temperature` θ 20 °C | —                                                                                                                    | def                                           |
| Graph dock                               | graph              | —                                  | `percent-time` (live); drawer: `mass-time`, `potential-time`, analysis `isotonic`                    | —                                                                                                                    | def                                           |

Setup steps: none (the definition and spec 22 ask for none). Notes: the default C = 0.4 mol/L is
not a preset — the tube's label shows "0.4 mol/L" until a bottle is chosen (as the dial does);
nothing is added to the library for it.

#### D3. `enzyme-activity` — mode `2d-workspace`

| Piece (kind)                                    | Slot               | Owns                            | Shows                                                                                                                                | Visual state rule                                                                    | Source |
| ----------------------------------------------- | ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------ |
| H₂O₂ solutions (`solution-bottle`) ×4           | library            | P `substrate` S₀ 0.05/0.1/0.5/1 | label                                                                                                                                | colourless                                                                           | def    |
| Buffers (`buffer-bottle`) ×5                    | library            | P `pH` 4/6/7/8/10               | label "pH 7"                                                                                                                         | label only (no indicator colour: none in the definition)                             | def    |
| Catalase extract syringe (`dispensing-syringe`) | front-left         | P `enzymeVolume` 0.5/1/1.5/2 mL | label                                                                                                                                | barrel filled to E                                                                   | def    |
| Water bath (`water-bath`)                       | back-left          | P `temperature` 20/30/40/50 °C  | thermometer = the set T (P)                                                                                                          | bath tint warm/cool from T                                                           | def    |
| Reaction vessel (`reaction-tube`)               | back-centre (hero) | —                               | V `substrate` S, `conversion` X; IN `mixtureVolume`                                                                                  | bubble density ∝ V `rate` / the run's max rate; no colour change (none in the model) | def    |
| Gas syringe (`gas-syringe`)                     | back-right         | —                               | V `oxygen` mL on its 100 mL scale                                                                                                    | plunger at `oxygen`                                                                  | def    |
| Stopwatch (`stopwatch`)                         | front-centre       | —                               | V `clock`; IN `collectionTime` 60 s                                                                                                  | —                                                                                    | def    |
| Result cards                                    | under hero         | —                               | R `initialRate`, `windowOxygen`, `windowRate`, `oxygen`, `conversion`, `activity` (classes), `inverseSubstrate`, `inverseWindowRate` | —                                                                                    | def    |
| Graph dock                                      | graph              | —                               | `oxygen-time` (live); drawer: `rate-substrate`, `substrate-time`, analysis `enzyme-amount`                                           | —                                                                                    | def    |

- Spec 25 "show reaction/activity curve; optimal conditions": the activity class shows "Near the
  optimum" per run; an **activity-against-T / -pH curve** across runs exists in no graph or
  analysis today (analyses need a linear fit). **SPEC GAP / contract need**: a records-only scatter
  (§E7); until then, the CSV and run list are the way.

#### D4. `photosynthesis` — mode `observation`

| Piece (kind)                          | Slot                           | Owns                                                            | Shows                                                                                              | Visual state rule                               | Source          |
| ------------------------------------- | ------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------- |
| Lamp on a rule (`lamp-rule`)          | back-left                      | P `distance` 0.05/0.1/0.2/0.4 m (drag with snap to the 4 marks) | V `intensity` lux, `distanceSquared` while a run exists                                            | lamp at d on the rule; glow on while running    | def, §23 light  |
| Heat filter (`heat-filter`)           | between lamp and plant         | —                                                               | —                                                                                                  | fixed (no parameter)                            | def description |
| NaHCO₃ bottles (`solution-bottle`) ×4 | library                        | P `carbonate` 0.002…0.05 mol/L                                  | label                                                                                              | colourless                                      | def, §23 CO₂    |
| Water bath (`water-bath`)             | back-centre (around the plant) | P `temperature` 10/20/30/40 °C                                  | the set T                                                                                          | —                                               | def             |
| Pondweed under a funnel (`plant`)     | back-centre (hero, 1.4×)       | —                                                               | V `bubbles` N                                                                                      | one bubble rises per increment of `bubbles`     | def, §23 plant  |
| Capillary (`capillary-scale`)         | back-right                     | P `resolution` δV 0.01/0.05/0.2 mL                              | V `volume`; I `volume` to δV after completion                                                      | gas column length ∝ `volume`; minor ticks at δV | def instrument  |
| Stopwatch (`stopwatch`)               | front-centre                   | —                                                               | V `elapsed`; IN `duration` 60 s                                                                    | —                                               | def             |
| Result cards                          | under hero                     | —                                                               | R `intensity`, `distanceSquared`, `volume`, `bubbles`, `rate`, `inverseRate`, `limiting` (classes) | limiting factor badge                           | def, §23 rate   |
| Graph dock                            | graph                          | —                                                               | `volume-time` (live); drawer: `bubbles-time`, analysis `light`                                     | —                                               | def             |

Default T = 25 °C is not a preset (as D2's note).

#### D5. `transpiration` (draft) — mode `observation`

| Piece (kind)                                  | Slot                    | Owns                                  | Shows                                                                                                                                                | Visual state rule                                                        | Source                           |
| --------------------------------------------- | ----------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| Lamp (`lamp`)                                 | back-left               | P `illuminance` 0/1000/5000/20000 lux | light meter = the set I (P)                                                                                                                          | glow off at 0                                                            | draft def, §24                   |
| Chamber + leafy shoot (`plant`)               | back-centre (hero)      | —                                     | —                                                                                                                                                    | leaves sway ∝ `airSpeed` (deterministic, from time)                      | draft brief                      |
| Fan (`fan`)                                   | back-right              | P `airSpeed` 0.1/0.5/1/3 m/s          | —                                                                                                                                                    | blades stopped at 0.1, slow/medium/fast                                  | draft                            |
| Hygrometer + humidifier/silica (`hygrometer`) | front-left              | P `humidity` 30/50/70/90 %            | "RH 50 %", IN `temperature` θ 20 °C                                                                                                                  | —                                                                        | draft, §24 env.                  |
| Stomata lens (`stomata-lens`)                 | lens                    | —                                     | V `stomatalConductance`                                                                                                                              | pore opening = (g_s − 0.01)/0.29; without a run: closed (never computed) | draft brief                      |
| Capillary + bubble (`capillary-scale`)        | front-centre            | P `scaleResolution` δx 0.5/1/5 mm     | V `distance`; I `distance` to δx after completion                                                                                                    | bubble's leading edge at x; ticks at δx                                  | draft instrument, §24 water loss |
| Reservoir tap                                 | front-centre (left end) | — (RESET pushes the bubble back)      | —                                                                                                                                                    | —                                                                        | draft                            |
| Stopwatch (`stopwatch`)                       | front-right             | —                                     | V `labTime` mm:ss; IN `duration` 600 s                                                                                                               | —                                                                        | draft                            |
| Result cards                                  | under hero              | —                                     | R `vapourDeficit`, `stomatalConductance` (classes), `boundaryConductance`, `conductance`, `stomatalShare`, `transpirationRate`, `uptake`, `distance` | —                                                                        | draft                            |
| Graph dock                                    | graph                   | —                                     | `distance-time` (live); drawer: `uptake-time`, analysis `deficit`                                                                                    | —                                                                        | draft                            |

No vapour or droplets drawn (draft: water vapour is invisible). Temperature is fixed (draft's
stated deviation), so no temperature control.

#### D6. `genetics` (draft) — mode `2d-workspace`

| Piece (kind)                            | Slot               | Owns                                                                | Shows                                                                                                                                         | Visual state rule                                                                                                                | Source                                          |
| --------------------------------------- | ------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Plant library (`parent-plant` cards) ×9 | library            | `parent1` or `parent2` = genotype code (by the pot it is placed in) | genotype letters + phenotype label                                                                                                            | seed colour/shape from the code (⌊c/10⌋ ≥ 1, c % 10 ≥ 1)                                                                         | draft def presets, §26 traits, parent selection |
| ♀ pot (`parent-plant`)                  | back-left          | P `parent1`                                                         | genotype tag                                                                                                                                  | open pod with the parent's seeds                                                                                                 | draft brief                                     |
| ♂ pot (`parent-plant`)                  | back-right         | P `parent2`                                                         | genotype tag                                                                                                                                  | same                                                                                                                             | draft brief                                     |
| Punnett board (`punnett-board`)         | back-centre (hero) | —                                                                   | 16 cells from `offspringGenotype(parent1, parent2, bits)`                                                                                     | redrawn on parent change only                                                                                                    | draft note 8, §26 probability                   |
| Seed tray (`seed-tray`)                 | front-centre       | —                                                                   | V `yellowRound`, `yellowWrinkled`, `greenRound`, `greenWrinkled`, `counted`, `lastGenotype`                                                   | fill = count/N; expected line at Punnett cells/16; newest seed from `lastGenotype` (empty while NaN); at most one seed in flight | draft brief, §26 offspring                      |
| Seed counter (`seed-counter`)           | front-right        | P `offspring` N 16/80/556/8023; P `sample` S 1…8                    | V `counted`                                                                                                                                   | —                                                                                                                                | draft def, §26 seeded                           |
| χ² card (result cards)                  | under hero         | —                                                                   | R four counts (theory N·p), `chiSquare`, `pValue` (classes), `degreesOfFreedom`, `smallestExpected` (classes), `yellow`, `round`, proportions | counts shown as integers (§E)                                                                                                    | draft                                           |
| Graph dock                              | graph              | —                                                                   | `phenotypes` (live); drawer: `yellow-count`, `round-count`, three analyses                                                                    | —                                                                                                                                | draft                                           |

Rail verb: COUNT. A parent change after a run: the board redraws from the dials, the tray keeps
the run's counts with the "settings differ" banner.

### Biology contract needs (decided above)

| #   | Need                                                                                                                                                                                                                                                                                                                                                             | Why                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| E1  | `ExperimentCommand` `set {parameter, value}` (value must be a preset), guarded                                                                                                                                                                                                                                                                                   | Today only `adjust` ±1 exists; a material or chip selects a value directly                                       |
| E2  | A station-level, side-effect-free check: `stations.block(stationId, action, parameter?, value?) → reason \| null` (same texts as the entity guard, no logging)                                                                                                                                                                                                   | Disable controls and show reasons before the click; the current guard is keyed by a world entity                 |
| E3  | `workspace.pieces[]`: `{ id, kind, slot, label(+vi), owns: paramId[], shows: Binding[] }`, `Binding` = `{ variable }` \| `{ result }` \| `{ instrument: resultId }` \| `{ input }` \| `{ parameter }`; validated: every id exists; every parameter has exactly one owner                                                                                         | Biology needs all five binding kinds (live, after-run, reading, fixed condition, pending setting)                |
| E4  | `workspace.materials[]`: `{ id, kind, label(+vi), sets?: {parameter, value} }`, `value` validated against that parameter's presets; materials without `sets` only if a setup step uses them                                                                                                                                                                      | Specimens, stains, solutions, buffers, plants are presets made tangible; slide/coverslip are spec-21 setup items |
| E5  | `workspace.setup[]`: `{ id, instruction(+vi), place: materialId \| pieceId, onto: pieceId \| slot, after: stepId[], refused(+vi) }`; one rule authority (an action guard like `ProcedureSystem`), also guarding desk dials and `set` for parameters a step owns; RUN refused until the last required step, with that step's reason; a "restart from step" action | Spec 21; the only setup in biology                                                                               |
| E6  | Setup progress persistence: entity states (`setup.<stepId>`) recommended, as it is station configuration (no `SAVE_VERSION` bump if entity states stay free-form). Lead decides                                                                                                                                                                                  | Otherwise Continue restores the stain but not the prepared slide                                                 |
| E7  | Records-only scatter view: `{ x: parameter, y: result, theory?: result's frozen theory }`, no fit, read from `RunRecord`s                                                                                                                                                                                                                                        | Spec 25 "activity curve, optimal conditions" (`activity` against `temperature`, `pH`)                            |
| E8  | Opening a workspace marks `inspected:<apparatus item>`; the Brief marks `inspected:<board item>` (optional `workspace.brief: itemId`); the Analyse drawer sends `view`                                                                                                                                                                                           | Existing checklists start with `inspected` steps                                                                 |
| E9  | `presentation` + per-lab accent as data (e.g. `laboratories.json` `accent: "108 199 154"`) set as `--lab-accent-rgb` on the workspace root                                                                                                                                                                                                                       | Distinct biology look without `if (subject…)`                                                                    |
| E10 | Workspace piece registry by kind: `WORKSPACE_PIECES[kind] = { mount(el, ctx), update(view), dispose() }`, `ctx` = texts, station id, command sender, check (E2); update on `ExperimentStationChanged` and rAF while running                                                                                                                                      | Same pattern as `BENCH_MODELS`                                                                                   |
| E11 | Microscopy structure data: per specimen preset `structures: [{ id, label(+vi) }]` matching what the painter draws (onion: wall, cytoplasm, nucleus; cheek: membrane, cytoplasm, nucleus; Elodea: wall, chloroplast, cytoplasm), and the painter returns hit regions                                                                                              | Inspect structures (§19/20). Vacuole, plant membrane, animal organelles: **SPEC GAP**, need science review       |
| E12 | Result display format for counts (integer), e.g. result `format: "integer"`                                                                                                                                                                                                                                                                                      | Genetics counts read "315.000" today (draft note 6)                                                              |
| E13 | Optional rail verb per presentation or definition (`runLabel`)                                                                                                                                                                                                                                                                                                   | OBSERVE / SOAK / COUNT instead of RUN; falls back to RUN                                                         |
| E14 | Lead decides: desk dials for workspace stations removed, or kept and guarded by E5                                                                                                                                                                                                                                                                               | Two control surfaces must not disagree                                                                           |
| E15 | Lead decides: skip/throttle 3D draws while an opaque workspace covers the canvas (simulation keeps ticking)                                                                                                                                                                                                                                                      | Cost on Low; the run must keep running                                                                           |

### Risks

| Risk                                                                           | Mitigation                                                                                                              |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Live focusing is expected by users, but sharpness exists only during a run     | Focus knob sets Δz; OBSERVE shows the stage travel live (≤ 10 s); "settings differ → reset and run again" in one button |
| Illumination control requested but no model input                              | Lamp is an indicator only; SPEC GAP recorded; never a dead dimmer                                                       |
| Pan/inspect could suggest a measured image                                     | Pan off by default and visual-only; inspect only on structures the painter draws; count overlay shows the model's n     |
| Plant membrane/vacuole and animal organelles asked by spec 19/20 but not drawn | SPEC GAP; needs a science-reviewed change to the painter and data, not a UX invention                                   |
| Setup rule ("prepare a new slide to change the specimen") is new behaviour     | Derived from spec 21's order; Opus reviewer signs off                                                                   |
| Painter cost at 2560×1600 (field ≈ 1000 px)                                    | Repaint on change only (as today); detail floor kept; test op count at the largest size                                 |
| `ctx.filter` blur missing in old Safari                                        | Sharpness class text always shown (as the 3D screen)                                                                    |
| 8023 seeds in 10 s                                                             | ≤ 1 seed in flight, the rest appear in piles (draft brief)                                                              |
| Non-preset defaults (osmosis C 0.4, photosynthesis T 25 °C)                    | Shown as the current value; library holds presets only                                                                  |
| Overlay focus vs pointer lock / pause menu                                     | Workspace releases pointer lock on open; Esc order as §C11; e2e covers open/exit at the same pose                       |

## Information hiding: answers the student must work out

User decision (2026-10-31): the titration's HCl concentration c_a = 0.085 mol/L is the run's
ground truth (simulation, validation, expected result) and is never shown to the student before
they have worked it out — not on a bottle label, tooltip, library card, inventory, contextual
panel, setup, help text or normal debug information. The bottle reads "HCl solution".

Contract (added to wave 2): an input may be `hidden: true` (kept in the model and the run record,
shown nowhere a student sees it), and a result may be an answer (`answer: { proportionalTo: <instrument> }`): its simulated value
stays out of the results table, comparison, monitor, notices and CSV at all times, and "Check my
answer" says only correct, incorrect or incomplete. An experiment with a hidden input shows no
theory column or marks (a theory computed from the hidden input gives it back). An answer is
correct when |x − truth|·R ≤ |x|·d/2, R and d the run's reading and resolution of that instrument,
so a value worked out from the reading always passes. The acid concentration is such a result.
The record keeps every value. The same rule applies to any later "unknown" sample. (User decision,
2026-11-01: these three rules accepted.)

## Deviation map (audit, 2026-10-31)

| Class          | Item                                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORRECT        | The 7 shipped Physics stations: `physical-3d`, matching their specification items.                                                                                                                                                          |
| UX DEVIATION   | All 7 shipped Chemistry and Biology stations use the Physics station (desk, dials, RUN, wall monitor): replaced by waves 2–3.                                                                                                               |
| SPEC DEVIATION | acid-base-titration shows c_a 0.085 mol/L on the desk, in the results panel and CSV (information hiding above).                                                                                                                             |
| SPEC DEVIATION | microscope: spec 21's "the user should actually perform the steps" is not met (prepared slide, stain as a dial).                                                                                                                            |
| SPEC DEVIATION | electrical-power (built, not shipped): the model adds two calorimeters (100 g water cups, thermometers, illustrative heat capacity and loss) that spec 12 (P = VI) does not ask for. To be removed or approved by the user before it ships. |
| SPEC DEVIATION | enzyme-activity: spec 25's activity curve across conditions is missing (records-only scatter, decided above).                                                                                                                               |
| SPEC GAP       | The list above.                                                                                                                                                                                                                             |
| REVIEW GAP     | The 14 built models' group reviews against their specification items were cut off by the usage limit (wave 3): each is reviewed before it ships.                                                                                            |
| BUG            | None open after the content-split fixes (labs-10-wave3).                                                                                                                                                                                    |
| FLAKY          | 6 unit tests time out at 5 s in the full parallel run and pass in isolation (PASS WHEN ISOLATED, resource sensitive): the full suite is not called PASS until stable.                                                                       |
| PERFORMANCE    | Nothing new measured in this phase.                                                                                                                                                                                                         |

## Physics: the 3D station

`physical-3d`, unchanged: the apparatus in the room is the interface ("I am operating a physical
apparatus"). The player walks up to it, aims, loads or releases with E / F, sets values on the
console's dials beside the machine, presses RUN and watches the motion in space; the results
monitor and the instruments read the run. Mechanical, technical, spatial: dark consoles, cyan
accent, measuring scales on the apparatus. The seven built Physics experiments ship this way with
their 3D apparatus (`bench/<x>.ts`, already drawn). Nothing in this phase adds 2D to Physics.

## SPEC GAP list (not filled in; each needs the user or a science review)

| Experiment          | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| acid-base-titration | No pH probe in the apparatus: pH appears only on the graph. Flow / drop rate is fixed in the model (Q is an input, not a control).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| reaction-rate       | No stock concentrations or mixing volumes: the flasks state c₀ and [OH⁻]₀ in the mixture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| heating-curve       | No balance for m and no freezer for T₀: the controls sit on the beaker with no instrument drawn.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ph-measurement      | How the dilution series is made (no glassware given). Calibration buffers exist as items but calibration is not modelled: not offered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| solubility          | The solutions are colourless: no tint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| precipitation       | No measuring device for V_s. Settling is not modelled: not animated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| separation          | No thermometer and no measuring device for V_w.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| microscope          | Illumination: no model input and spec 18 does not list it, so the lamp is an indicator, never a dead dimmer (blocks: an illumination step). Plant membrane and vacuole (spec 19) and animal organelles "appropriate to the level" (spec 20) are not drawn (blocks: Inspect labels for them). Preparation of cheek cells and Elodea (spec 21 covers onion only; blocks: their preparation workflow). Which stains each specimen's protocol allows: the definition offers every specimen × stain as a prepared slide (a stated contrast table), but no specification says which combinations are a protocol (blocks: restricting or confirming stain choices per specimen; the user decided on 2026-11-01 to keep the shipped choices as prepared slides, flagged). |
| enzyme-activity     | The activity curve across runs needs the records-only scatter (decided above).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| transpiration       | Temperature is fixed by the model; no vapour drawn.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| all                 | A run verb per experiment is optional data; RUN by default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Implementation plan

Order follows the dependencies in [experiment-ux-architecture.md](experiment-ux-architecture.md).
Agents: Sonnet implements, Opus owns the contract and reviews; at most three at once; no two agents
on one file; one e2e run at a time.

| Wave | Agent (model)      | Task                                                                                                                                                                                                                                                                   | Owns                                                                                                                                                                                        |
| ---- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Contract (Opus)    | Schema (`presentation`, `workspace`, `setup` milestone, result `format`, `runLabel`), checks at lab-pack load, `set` / `clear` / `setup` commands, `refusal`, the setup gate, `preview`, events, the `open-workspace` behaviour, the piece view interface (types only) | `simulation/experiment.ts`, `ExperimentSession.ts`, `gameplay/experiment/*`, `game/GameEvents.ts`, `game/content.ts`, `gameplay/interaction/behaviors.ts`, `platform/ui/workspace/types.ts` |
| 1    | Visuals (Sonnet)   | Three-free shared visuals: chemistry colour and level maps, the specimen painter, moved out of the 3D renderers with no behaviour change                                                                                                                               | `platform/render/bench/*` (those files), new `platform/labVisuals/*`                                                                                                                        |
| 1    | Physics (Sonnet)   | Ship the seven built Physics experiments as 3D stations (models, definitions, items, placements, registry, station and e2e tests)                                                                                                                                      | their content files, `models/index.ts`, `bench/registry.ts`                                                                                                                                 |
| 2    | Host (Sonnet)      | Workspace host, the four layouts, lifecycle bar, notebook with the results panel, styles, keyboard and Esc                                                                                                                                                             | `platform/ui/workspace/*` (not `pieces/`), `styles.css`, `Hud.ts` wiring                                                                                                                    |
| 2    | Chemistry (Sonnet) | Chemistry piece views and the element table                                                                                                                                                                                                                            | `platform/ui/workspace/pieces/chem-*`, `content/elements.json`                                                                                                                              |
| 2    | Biology (Sonnet)   | Biology piece views, microscopy field, records-only scatter                                                                                                                                                                                                            | `platform/ui/workspace/pieces/bio-*`, `ResultsPanel.ts` (scatter only)                                                                                                                      |
| 3    | Content (Sonnet)   | `presentation` + `workspace` blocks for the 14 Chemistry and Biology experiments, strings, rooms without desks, checklists                                                                                                                                             | experiment JSON, `lab-placements.json`, `items.json`, `strings.json`                                                                                                                        |
| 3    | Lead (Opus)        | Integration, e2e one at a time, Low/Medium/High check, lighting check, report                                                                                                                                                                                          | —                                                                                                                                                                                           |

One Opus review per wave, on: spec traceability (no invented piece, material or step), the
setup gate and save semantics, the visual-honesty rule (every moving visual from P/I/V, nothing
unmodelled animated, no number before a run), measurement display, accessibility. Visual work stays
uncommitted until the user has seen it on their own display.
