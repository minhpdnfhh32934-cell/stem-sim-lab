# Experiment UX architecture (phase UX-W, design)

Status: **design, approved by the Lead (internal review, 2026-10-31); not implemented**. The workspace design for each subject is in
[experiment-workspace-design.md](experiment-workspace-design.md). Nothing here changes a model, a
definition's science, an experiment id, the save or the run history.

## Why

Every Chemistry and Biology station today is the Physics bench station with other apparatus: a 3D
control desk with up to four preset dials, RUN / STOP / RESET, a desk display, a wall results
monitor and an instruction board ([experiments.md](experiments.md), "Adding a bench experiment").
The player walks between a desk and a monitor to work a burette or a microscope. That suits a
launcher or a pendulum; it does not suit preparing a solution or focusing a microscope.

Three subjects, three ways of working, one SimLab:

| Subject   | Verb                          | The player should feel                                   |
| --------- | ----------------------------- | -------------------------------------------------------- |
| Physics   | Manipulate                    | "I am operating a physical apparatus."                   |
| Chemistry | Construct + Process + Measure | "I am preparing and carrying out a chemical procedure."  |
| Biology   | Prepare + Observe + Analyse   | "I am preparing a specimen, observing and analysing it." |

The question each design answers: _if this were real laboratory software, how would a designer let
a student do this experiment?_ Only then is it mapped onto the architecture.

## Audit of the current UX

What every station shares today (all 14 shipped experiments): the 3D apparatus on a bench, a
control desk (`control-desk`, `control-dial` ×≤4, `run-`/`stop-`/`reset-button`,
`station-display`), a `results-monitor` on a wall that opens the results panel, an instruction board
with the checklist. Parameters are preset lists stepped one value at a time (E / F on a dial).

| Experiment          | Subject   | Current UX                        | Copies physics                                        | Desired UX (mode)          | Reason                                         |
| ------------------- | --------- | --------------------------------- | ----------------------------------------------------- | -------------------------- | ---------------------------------------------- |
| free-fall           | Physics   | 3D drop tower + desk              | (is physics)                                          | keep — `physical-3d`       | spatial mechanics, timing gates in space       |
| projectile-motion   | Physics   | 3D launcher, ball, lane + desk    | (is physics)                                          | keep — `physical-3d`       | the ball's flight is the experiment            |
| pendulum            | Physics   | 3D pendulum + desk                | (is physics)                                          | keep — `physical-3d`       | a swing seen in space                          |
| hookes-law          | Physics   | 3D spring stand + desk            | (is physics)                                          | keep — `physical-3d`       | extension seen against the ruler               |
| inclined-plane      | Physics   | 3D ramp + desk                    | (is physics)                                          | keep — `physical-3d`       | angle and slide in space                       |
| ohms-law            | Physics   | 3D circuit board + desk           | (is physics)                                          | keep — `physical-3d`       | real meters and a board in front of the player |
| refraction          | Physics   | 3D ray-optics board + desk        | (is physics)                                          | keep — `physical-3d`       | rays on a board, angles on a protractor        |
| acid-base-titration | Chemistry | burette stand + 4 dials + monitor | desk, dials, RUN, wall monitor                        | `2d-workspace`             | procedural + quantitative                      |
| reaction-rate       | Chemistry | colorimeter + 4 dials + monitor   | desk, dials, RUN, wall monitor                        | `2d-workspace` (graph-led) | kinetics: vessel + graph                       |
| heating-curve       | Chemistry | hot plate + 4 dials + monitor     | desk, dials, RUN, wall monitor                        | `bench-embedded`           | heating apparatus + live graph                 |
| microscope          | Biology   | digital microscope + 4 dials      | desk, dials (slide, stain, objective, focus as dials) | `microscopy`               | observation through an instrument              |
| osmosis             | Biology   | tube rack + 4 dials + monitor     | desk, dials, RUN, wall monitor                        | `2d-workspace`             | specimen + concentration                       |
| enzyme-activity     | Biology   | gas syringe rig + 4 dials         | desk, dials, RUN, wall monitor                        | `2d-workspace`             | vessel + conditions + graph                    |
| photosynthesis      | Biology   | pondweed + lamp + 4 dials         | desk, dials, RUN, wall monitor                        | `observation`              | plant + environment + live graph               |

The final presentation of every experiment, built ones not shipped included, is the table in
[experiment-workspace-design.md](experiment-workspace-design.md#presentation-of-every-experiment).

What stays as it is, for every subject: the deterministic models, the definitions' parameters and
presets, `ExperimentSession`, `ExperimentSystem`, run records and their history store, CSV,
instrument readings and their uncertainty, analyses, the save (station configuration as entity
states), experiment ids, the lab pack, the scene system and Low / Medium / High.

## Physics: keep the 3D station

Physics keeps `physical-3d`: the apparatus is the interface. The audit found nothing to redesign
for this phase; the desk-and-dial layout reads as an operator's console beside a machine, which is
what Physics is. The seven Physics experiments built but not shipped (mechanical energy,
collisions, circular motion, buoyancy, electrical power, reflection, converging lens) ship as 3D
stations with their 3D apparatus. Later improvements (a dial on the apparatus itself, such as the
launcher's angle) are optional and stay `physical-3d`.

## The shared contract

One abstraction, `ExperimentWorkspace`, several presentations. Everything below is data plus
registries; no code branches on a subject or an experiment id.

### Definition (data)

```ts
presentation: 'physical-3d' | 'bench-embedded' | '2d-workspace' | 'microscopy' | 'observation';
// default 'physical-3d': today's station, unchanged
workspace?: {               // required unless physical-3d
  pieces: WorkspacePiece[]; // apparatus in the workspace, each owning its controls
  materials: Material[];    // what the player may use; from the specification only
  setup: SetupStep[];       // the procedure that must be done before RUN (a gate, unlike `procedure`)
}
WorkspacePiece {
  id; kind;                 // kind = a registered piece view: burette, conical-flask, ph-meter…
  label (+vi); slot;        // where it stands in the layout
  controls: ParameterId[];  // the definition's parameters this piece sets (its contextual panel)
  readouts: (Variable | ResultId | InstrumentId)[]; // what it shows, all read from the run
}
Material {
  id; label (+vi); kind;    // solution, solid, indicator, specimen, stain, plant…
  formula?;                 // shown by the periodic table / library, never parsed into chemistry
  sets?: { parameter; value };  // choosing it sets a parameter to one of its presets
}
SetupStep { id; instruction (+vi); done: { piece } | { material; into } | { parameter } }
```

Rules, checked when the lab pack loads: every `controls` id is a parameter of the definition, each
parameter belongs to exactly one piece, every readout is a model variable, result or instrument of
the definition, every `sets.value` is one of that parameter's presets, every `kind` has a
registered piece view, every setup step names a piece or material of this workspace.

**Materials are presets.** Choosing a material sets a parameter to one of its preset values (the
indicator, the slide, the sample). The library offers exactly the materials the definition lists,
each traced to the specification; there is no free combination, so no reaction can be invented. A
periodic-table element that is in none of the listed materials says so ("not used in this
experiment") and adds nothing.

### Rule authority and commands

`StationSystem` stays the only rule authority for an apparatus. It gains:

- `ExperimentCommand` `set` (a parameter to a given value, accepted only if it is one of its
  presets, or on its step grid) next to `adjust`; the workspace never edits a session directly.
- the setup gate: a station with `workspace.setup` starts not ready (`idle`); each `setup`
  command marks a step done (in order, or refused with the step's instruction as the reason); the
  last one makes it ready. RUN while not ready is refused with the next step's instruction.
- `stations.refusal(stationId, command)`: the reason a command would be refused now — the same
  text the 3D guard gives — so a workspace control shows why it is disabled before it is pressed.
  A refused command does nothing and publishes `ActionBlocked`.

Setup progress and parameters are the station's configuration: entity states (`param.<id>`,
`setup.<step>`), saved like today's dials. RESET discards the run, not the setup; a new
`ExperimentCommand` `clear` empties the bench (setup back to step one), refused while running.

### Lifecycle

```
3D lab ── look at the apparatus, [E] Work at the bench ──▶ WorkspaceOpened{stationId}
  workspace (DOM / SVG / Canvas2D overlay; the 3D lab dimmed behind it, the run continuing)
  set up ─▶ adjust ─▶ RUN ─▶ observe (live visual state) ─▶ measure ─▶ analyse (results, history)
  Esc / Exit ──▶ WorkspaceClosed{stationId} ──▶ the same spot in the 3D lab, pointer lock back
```

- **Enter**: an `open-workspace` interaction on the apparatus item (behaviour data, like `bench`),
  guarded as any action. The player stops (no `moveIntent`), the pointer is freed, Esc closes the
  workspace instead of opening the pause menu. One workspace at a time.
- **Exit**: Esc, the Exit button, or leaving the scene. Nothing is lost: the run keeps going, the
  3D apparatus shows the same run (both read `stations.view()`).
- **bench-embedded**: no full overlay; a small contextual panel anchored beside the apparatus'
  projected position, the camera held on it while the panel is open.
- **Save / load**: the workspace being open is never saved; Continue lands in the 3D lab.
  Parameters and setup are entity states; runs and history stay out of the save (unchanged).
- **Measurement, results, history**: the workspace reads the same session, run buffers and
  `RunRecord`s; instrument readings come from `simulation/measurement.ts` unchanged; the analyse
  view embeds the existing results panel (run list, comparison, analyses, CSV), loaded lazily.
- **Validation**: refusals come from the station (setup gate, presets, the model's own refusal);
  the workspace only displays them.

### Views and registries (platform)

- `src/platform/ui/workspace/`: the host (open/close, focus, keyboard, pointer lock), one layout
  per presentation (`WORKSPACE_LAYOUTS`), and the piece views (`WORKSPACE_PIECES`, keyed by piece
  `kind`, like `BENCH_MODELS`). A piece view draws its glassware or instrument in SVG/Canvas2D from
  the station's `BenchPose` (`parameters`, `sample`), so liquid level, colour, precipitate, focus
  blur follow the model's variables; it only assigns, nothing is invented or smoothed.
- Its own lazy chunk, like the results panel: the menu does not download it.
- No second WebGL context. Low / Medium / High change only the 3D world's cost: a workspace looks
  the same on every preset. While a full overlay is open the 3D frame behind it may be drawn at a
  lower rate (Low benefits); the simulation step is unchanged.
- Accessible: every control a real `<button>`/`<input>` with a label, keyboard order following the
  procedure, visible focus, text contrast ≥ 4.5:1, usable from 1280×720 to 2560×1600.

### The 3D room

The lab stays the place: the apparatus is on its bench, recognisable, lit and visible from the
room, and the workspace opens from it. For a workspace experiment the desk, dials, RUN/STOP/RESET
buttons, desk display and wall monitor are removed from the room; its bench keeps the apparatus and
a sign. Physics stations keep all of theirs.

## Dependencies and order

1. Contract (Opus): schema + checks, `set` / `setup` / `clear` commands, `refusal`, setup gate,
   events, the `open-workspace` behaviour — with unit tests. Everything else waits for it.
2. Workspace host + one layout per mode + shared styles (one agent, owns `platform/ui/workspace/`
   host files).
3. In parallel after 2, with separate files: Chemistry pieces and definitions' `workspace` blocks;
   Biology pieces and blocks. Each agent owns its subject's piece files and experiment JSON.
4. Room composition (remove desks for workspace experiments), e2e per experiment, lighting check.
5. Physics' seven built experiments ship as 3D stations (independent of 1–4, after the contract
   to avoid two writers on shared content files).

Acceptance is the user's list (requirements §18): Physics as strong as now; Chemistry and Biology
no longer feel like physics stations; shared lifecycle; save/load, measurement, history and the
presets intact; labs bright and uncluttered.
