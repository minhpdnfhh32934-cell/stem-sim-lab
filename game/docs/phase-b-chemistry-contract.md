# Phase B contract — Chemistry in 3D: titration by hand (2026-11-02)

Status: **APPROVED** by Phú, 2026-11-02 ("bắt đầu làm phần tiếp theo"), with the decisions of §12.
Implemented (uncommitted): report `docs/phase-labs-report.md` §14.
Direction (Phú, 2026-11-02): every experiment is done in 3D; 2D only to set instrument parameters
and to read and analyse results. Phase A built the outlines, guided tasks and floor path on the
dilution. Phase B moves the Chemistry Lab's remaining experiments to 3D as far as the specs allow:
the acid–base titration becomes physical, the heating curve gets a guided task on its existing 3D
bench, and the reaction rate stays a 2D workspace until its spec defines what is mixed.

## 1. Objective

In the Chemistry Lab the player titrates by hand: clamps the burette, fills it with NaOH, pipettes
the HCl into the conical flask, adds the indicator, stands the flask under the tip, opens the tap,
watches the colour, closes the tap at the colour change and records the burette reading. The run's
values come only from the model (`acid-base.titration`) fed with the volume that left the burette.
The 2D panels keep only the instrument parameters (burette resolution) and the results, graph and
analysis. A guided task leads through it, as "Dilution by hand" does.

## 2. Scope

| #   | Part                      | Layer                 | What                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Titration as physical-lab | content               | `presentation: "physical-lab"`; items from the definition's own apparatus only: retort stand + clamp (fixed), 50 mL burette, 250 mL conical flask, white tile, volumetric pipettes 10/20/25 mL, HCl bottle, NaOH bottles 0.05/0.1/0.2 mol/L, indicator dropper bottles (methyl orange, phenolphthalein). Placements in the lab's titration bench and the cabinet.                                                                                              |
| B2  | Setup steps done by hand  | gameplay (stations)   | The existing setup steps (`clamp`, `fill-*`, `aspirate`, `dispense`, `indicator-*`, `tile`) completed by the world's actions, judged only by `StationSystem` (the dilution's pattern): set the burette into the clamp; pour NaOH into the burette's mouth; fill the pipette from the HCl and deliver it into the flask; drops from the indicator bottle onto the flask; the flask onto the tile under the tip. Each refusal gives the step's own refusal text. |
| B3  | The tap: a driven run     | gameplay + simulation | "Open the tap" on the burette starts the driven run (`driven` mode, §2.9 of the architecture); while open, NaOH leaves at the model's fixed rate Q = 0.25 mL/s and `StationSystem` feeds the volume to `titrationPH`; "Close the tap" stops the flow; the run ends as decision D1 says. The flask's colour is the indicator's colour at the model's pH.                                                                                                        |
| B4  | Reading the burette       | gameplay + platform   | "Record the reading" (D1) completes the run; the burette reading is an instrument reading of that run's volume at the resolution d (`measurement.ts`: nearest multiple of d, u = d/√12, d/2 separately). The burette's level is drawn from the volume left; the HUD never prints µL.                                                                                                                                                                           |
| B5  | Rig split                 | platform/render       | `titration-stand.ts` stops drawing the glassware from the session (the pieces are entities now, drawn by `ContainerView`); it keeps the stand. Indicator appearance registered for the model (pH → indicator colour), the same mapping the 2D rig uses.                                                                                                                                                                                                        |
| B6  | Hidden c_a                | content + tests       | The HCl bottle and its contents carry the material id `hcl` and the label "HCl solution" only; c_a (0.085 mol/L) never enters item data, container state, saves, debug lines or any text before the result (architecture §2.16, with its structured test).                                                                                                                                                                                                     |
| B7  | Guided tasks              | content               | "Titration by hand" (the procedure's own order) and "The heating curve" (the existing bench: read the board, set m, T₀, P in its panel, RUN, read the results). EN + VI.                                                                                                                                                                                                                                                                                       |
| B8  | Save                      | persistence           | No version bump expected: containers, poses and entity states already save (v4/v5). A run in progress is not saved (as now): Continue mid-titration restores the bench with the tap closed and no run.                                                                                                                                                                                                                                                         |

## 3. Non-goals (Phase B)

- Reaction rate in 3D: **blocked by SPEC GAP G15** (the pre-mix concentrations and volumes are
  not defined, so a mixing step cannot be derived). It stays a 2D workspace (D4).
- Heating curve as physical glassware (ice in a beaker set on the plate): ice is a solid with a mass,
  which the liquid bookkeeping (µL) cannot hold; mass of ice is SPEC GAP G18 (D3). It keeps its 3D
  bench (`bench-embedded`: the rig in 3D, m, T₀ and P set in its contextual panel).
- Drop-by-drop flow, a partly open tap, burette rinsing, a pipette filler, concordance checking,
  CO₂ from the air: none is in the definition or the model.
- Refilling the burette during a run; overflow and spill (architecture decision 10).
- Biology (Phase C), Physics tasks (Phase D).

## 4. Scientific constraints

- Every number comes from the model: `titrationPH(inputs, V)` at the volume fed; V is the
  bookkept µL that left the burette, never set by the view. Q is the model's input (0.25 mL/s,
  labelled "fixed in this model", SPEC GAP G3).
- c_a stays hidden until the result (§2.16). The answer check is unchanged: c_a = c_b·V_end/V_a,
  allowing for the reading's rounding.
- If D1 allows overshoot, the definition's `note` and the instrument's `excludes` are corrected to
  say so (the note now says "closes exactly at the endpoint"). Nothing else in the model changes.
- The indicator colour follows the model's pH and the indicator's documented range only.
- Parameters set by objects (c_b by the NaOH bottle, V_a by the pipette, pH_end by the indicator)
  go through the validated `set` path as in the dilution; the burette resolution d stays a 2D
  instrument parameter.

## 5. Architecture constraints

- `StationSystem` is the only authority and the only writer of container state; refusals do
  nothing and give a reason. No code branches on an experiment, item or material id: behaviour
  from registered models, appearances and data (`workspace.drive`, setup `by`).
- Driven mode: no time limit and no no-progress check while driven; STOP keeps its meaning.
- Outlines, tasks and the floor path from Phase A work unchanged (the tap, the clamp and the tile
  become targets of the held object through the existing rules).
- No per-frame allocation; the flow is committed per fixed step like a pour.

## 6. Files likely touched

Content: `experiments/acid-base-titration.json`, `items.json`, `lab-placements.json`,
`tasks.json`, `strings.json`. Gameplay: `StationSystem.ts` (tap, record, clamp seat, drops),
`InteractionSystem.ts` (actions), `liquid.ts` if the drop transfer needs a discrete amount.
Simulation: the titration model's `driven` entry. Platform: `titration-stand.ts`,
`liquidAppearance.ts` (indicator), `ContainerView.ts` (burette level reads down from 0 mL).
Tests: unit (driven titration, refusals, hidden c_a), game-level (a titration by hand to the
endpoint with the same V_end as the 2D run), e2e `e2e/titration-physical.spec.ts`. Docs:
`experiments.md`, the phase report.

## 7. Acceptance criteria

1. The titration is done by hand from the cabinet to the reading; every setup step completes only
   by its world action; a wrong order is refused with the step's refusal text.
2. With the tap open the burette level falls and the flask's level rises at 0.25 mL/s; the flask
   turns the indicator's colour at the model's endpoint pH.
3. Closing the tap at the colour change and recording gives V_end within one resolution step of the
   2D run's endpoint for the same settings; c_a checks as before.
4. (If D1 = player finish) Overshooting gives a larger V_end, a pH past the endpoint and an answer
   check that says so; nothing is adjusted.
5. c_a appears in no surface before the result (structured test).
6. The 2D workspace no longer opens for the titration; its results/graph/analysis panel does.
7. The guided tasks run to the end; outlines show the next object at each step.
8. The dilution's results and tests are unchanged.

## 8. Tests

`npm run check`; game-level titration by hand (real Rapier, shipped content); e2e by hand in the
real app (one at a time); full `npx playwright test`; GPU A/B on the RTX 5070 (labs bench row
"chem: titration tap open").

## 9. Benchmark

High holds 300 fps with vsync at 2560×1600 in the Chemistry Lab with the tap open; draws within
+20 of the current titration bench view; no shader link during the run.

## 10. Rollback

Content switches the presentation; reverting the content commit restores the 2D workspace.

## 11. Decisions for Phú

- **D1 — how the titration ends.** (a) **Recommended:** the player closes the tap and records the
  reading; overshoot is possible and shows in the result (the spec's error list names overshooting).
  (b) The tap closes itself exactly at the endpoint, as the 2D run does now.
- **D2 — the tap.** (a) **Recommended:** open or closed only, at the model's fixed 0.25 mL/s.
  (b) A slow/drop-wise setting: needs a flow value the spec does not give (SPEC GAP), so it is not
  offered without one.
- **D3 — heating curve.** (a) **Recommended:** keep its 3D bench (parameters in its contextual panel), add the guided task.
  (b) Physical ice beakers on the plate: needs a solid-with-mass capability and the ice mass data
  (G18).
- **D4 — reaction rate.** (a) **Recommended:** stays 2D, labelled blocked by G15. (b) Phú supplies
  the pre-mix concentrations and volumes, then it joins a later phase.

## 12. Decisions (Phú, 2026-11-02)

1. D1 (a): the player closes the tap and records the reading; overshoot is possible and shows in
   the result. The definition's note and the instrument's `excludes` are corrected.
2. D2 (a): the tap is open or closed, at the model's fixed 0.25 mL/s.
3. D3 (a): the heating curve keeps its 3D bench; Phase B adds its guided task.
4. D4 (a): the reaction rate stays 2D, labelled blocked by SPEC GAP G15.
