# Phase A contract — target outlines, guided tasks and the floor path (2026-11-02)

Status: **APPROVED** by Phú, 2026-11-02, with the decisions of §11.
Direction (Phú, 2026-11-02): every experiment is done in 3D; 2D only to set instrument
parameters and to read and analyse results; while the player holds a tool, every object it can act
on now has a glowing outline; entering a lab shows tasks on the right, and a chosen task draws a
path on the floor to each place, until it is done or cancelled. Phase A builds that infrastructure
on the one experiment that is already physical: the dilution in the Chemistry Lab.

## 1. Objective

The player in the Chemistry Lab can pick a task from a panel on the right and be led — by a path on
the floor and an outline on the next object — through the dilution by hand, step by step, to the
end or until they cancel; and, with or without a task, whatever tool they hold shows them every
object it can act on now.

## 2. Scope

| #   | Part                | Layer                 | What                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Targets of the held | gameplay              | `InteractionSystem.targetsOf(held)`: the entities the held object can act on now — a "with held" action available and not blocked (fill, deliver, load…), a receiver whose `pourRefusal` is null, a seat whose set-down rule accepts it. Asked of the existing rule authorities; never decided again elsewhere.                                          |
| A2  | Outline             | platform/render       | An inverted-hull outline (a slightly grown back-face shell, one shared unlit material, a slow pulse) on each target of A1 while something is held, and on the current task step's object. Every preset. No post-processing pass.                                                                                                                         |
| A3  | Tasks as data       | content + game        | `src/content/tasks.json` (lab pack), validated with Zod and cross-checked: a task belongs to a room; its steps name an object (placement id), an instruction (EN + VI), and when it is done (a matcher on existing events or on the experiment's own procedure/setup step).                                                                              |
| A4  | TaskSystem          | gameplay              | Tracks the active task from events only: start, next step, done, cancel, and the step a refusal leaves it on. It changes no world state, refuses nothing, and never reads a hidden value.                                                                                                                                                                |
| A5  | Floor path          | world (pure) + render | A navigation grid per room from its bounds, door openings and the static placements' footprints (`layout.ts` prisms), cleared by the player capsule's radius; A* on 0.1 m cells, string-pulled; recomputed only when the target or the player's cell changes, at most 4 times a second. Drawn as a ribbon of chevrons on the floor.                      |
| A6  | Task panel          | platform/ui           | On the right when the player is in a lab with tasks: the list, the active task's step and its instruction, Cancel. The top-left objective checklist folds into it (one source of progress, not two).                                                                                                                                                     |
| A7  | Save                | persistence           | `progression.tasks: { active: { id, step } \| null, done: string[] }`. SAVE_VERSION 4 → 5, migration v4 → v5 (no task active, none done) and its test.                                                                                                                                                                                                   |
| A8  | Content             | content               | Chemistry Lab: "Dilution by hand" (the dilution's own procedure as a guided task) and four familiarisation tasks built only from that experiment's tools — the volumetric pipette (fill to the mark, deliver), the wash bottle (squeeze over a neck), the volumetric flask (stopper, turn over), the colorimeter (a sample in the cuvette, the reading). |

## 3. Non-goals (Phase A)

- Migrating titration, reaction rate, heating curve or any Biology experiment (Phases B, C).
- "Reaction" familiarisation tasks: the dilution has no reaction; they come with the experiments
  whose specs define one (titration, reaction rate) in Phase B. No reaction is invented here.
- Tasks in the Physics or Biology labs, the hub or the preparation room (Phase D and later).
- Paths across rooms or through doors: a task's steps are in its own lab.
- The periodic table in 3D, the light switch's rocker position, a larger Chemistry Lab.

## 4. Scientific constraints

- Tasks and outlines only **show**; `StationSystem`, `LiquidSystem` and `InteractionSystem` remain
  the only authorities. A task step can never make a refused action happen.
- No step text states a hidden or computed value (C₂, an endpoint): the player reads it from the
  instrument, as now.
- Familiarisation steps use only the dilution definition's tools, materials and procedure.
- A guided step order is the procedure's order; where the procedure leaves an order free, the task
  says so instead of imposing one.

## 5. Architecture constraints

- Layers as in CLAUDE.md: TaskSystem in `gameplay` (no three.js, no DOM), the navigation grid and
  A* in `world` (pure, deterministic, tested), the outline, path and panel in `platform`.
- Built in `Game.ts` with explicit dependencies; cross-system reactions through `GameEvents`
  (new: `TaskStarted`, `TaskStepCompleted`, `TaskCompleted`, `TaskCancelled`); subscriptions
  released in `dispose()`.
- Content is data; no code branches on a task, item or room id. Text through `Texts` (EN + VI).
- No per-frame allocation: A1 is recomputed when the held object, a container's version or an
  entity state changes, not every frame; A5 at most 4 Hz; outline and path meshes are pooled.

## 6. Files likely touched

New: `src/content/tasks.json`, `src/gameplay/task/TaskSystem.ts` (+ test), `src/world/navGrid.ts`
(+ test), `src/platform/render/outlines.ts` (+ test), `src/platform/render/floorPath.ts`,
`src/platform/ui/TaskPanel.ts`, `e2e/guided-task.spec.ts`. Changed: `InteractionSystem.ts`
(`targetsOf`), `GameEvents.ts`, `Game.ts`, `labPack.ts` / `content.ts` (tasks cross-check),
`saveData.ts` + `SaveSystem.ts` (v5), `WorldRenderer.ts` (mount outline and path), `Hud.ts`
(objective folded into the panel), `strings.json`, `docs/` (data model, interaction, persistence,
phase report).

## 7. Acceptance criteria

1. Holding the 5 mL pipette next to a full stock bottle and an empty flask on the tile: the bottle
   is outlined (fill); after filling, the flask is outlined (deliver) and the bottle is not.
   Holding the wash bottle: the flask on the tile is outlined, the stock bottle is not (its pour is
   refused). Every outlined object is exactly an object whose action would be accepted now.
2. Choosing "Dilution by hand" draws a floor path from the player to the reagent cabinet that does
   not cross a bench, a cabinet or a wall; the next object is outlined; each step done in the world
   advances the task; the last step completes it; Cancel removes path, outline and step at once.
3. A refused action leaves the task on its step with the refusal's own reason; nothing is skipped.
4. Saving mid-task and continuing restores the task at its step; a v4 save loads as v5 with no task.
5. Leaving the lab hides the panel and the path; coming back shows the active task again.
6. All task text exists in English and Vietnamese (the existing translation test covers it).
7. The dilution's results are unchanged (C₂ = C₁V₁/V₂ exactly; the slice tests unchanged).

## 8. Tests

- Unit: `navGrid` (blocked cells from footprints, clearance, a path around a bench, no path when
  enclosed, determinism); `targetsOf` against the rule authorities (each case of criterion 1);
  TaskSystem (start, advance on each matcher, refusal keeps the step, cancel, complete); tasks
  content cross-check (every object, event and procedure step exists); save v4 → v5 migration.
- Game-level (real Rapier, shipped content): the dilution done by hand with the task active ends
  with the task completed and the same C₂ as without it.
- E2E (player-like, `e2e/guided-task.spec.ts`): enter the Chemistry Lab, choose the task, follow
  the path's first leg, see the next object outlined (debug panel lines for the active step, the
  path length and the outlined ids), cancel.
- `npm run check`, `npm run build`, full `npx playwright test`.

## 9. Benchmark

Real GPU, A/B against `69f15d2` with the same bench files: `gpu-fullscreen`, High, vsync on and
`BENCH_UNCAPPED=1`, a new labs-bench row "chem: task active, pipette held (outlines + path)".
Budget: High holds 300 fps with vsync at native 2560×1600; uncapped, ≤ 0.1 ms more per frame in the
Chemistry Lab than the same scene without a task; draws within +15 (outlines are one draw each,
capped at 12 at once; the path one). Low checked for playability on the same scenes.

## 10. Rollback

Each part lands as its own commit (A1+A2, A3+A4+A8, A5, A6, A7). Tasks are opt-in: with no task
active nothing but the outlines (A1+A2) is visible, and outlines alone revert with their commit.
The v5 save is the one change that is not reversible for players' saves: a v5 save does not load in
a v4 build (as every earlier version bump).

## 11. Decisions (Phú, 2026-11-02)

1. Outline: a cool white-cyan glow pulsing slowly (about 1 Hz).
2. The top-left objective checklist folds into the right panel.
3. Task progress is saved: SAVE_VERSION 5, with the v4 → v5 migration and its test.
4. With no task active, the panel shows collapsed as one line ("Tasks (n)") — the Lead's default.

## 12. Amendments made during implementation (reported to Phú)

1. **A8 content.** The four tool tasks (pipette, wash bottle, flask, colorimeter) are not separate
   tasks: the dilution station's rules require the procedure's order (the delivery needs the flask
   on the tile and a filled pipette; a done step stays locked until the bench is cleared), so a
   stand-alone "fill and deliver" task would either be refused or leave the station half set up for
   the dilution. The tools are taught inside "Dilution by hand"; the other two tasks touch no
   station rule: "Get to know the glassware" (take each kind out, look at it, set it down, inspect
   the colorimeter) and "The light switch".
2. **A2 cost.** An outline is two draws per outlined mesh (a stencil mask and the shell), not one;
   the renderer is created with a stencil buffer. The cap is 12 outlined meshes.
3. **Debug panel** (dev only): `Task`, `Guide` and `Outlined` lines, for the e2e spec.
4. **A2 look, after Phú's display QA (2026-11-02).** The additive white-cyan glow washed out to white
   on light surfaces and was hard to find; decision §11.1 is replaced: an amber outline (`#ffc23a`)
   with a narrow dark band inside it, both drawn over the scene (not added light), on smoothed
   normals (no notches at a box's corners); the pulse never below 80 %. Each outlined object also
   gets a small turning diamond above it, about constant on screen, larger over a task step's
   object, faint where something stands in front of it. Cost: 3 draws per outlined mesh (mask,
   amber, dark) and 2 for all markers together.
