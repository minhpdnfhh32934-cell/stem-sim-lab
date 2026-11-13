# Phase 5 report — Preparation Room, PPE, hand washing and cleanroom entry

The way into the laboratories is now a playable procedure: read the entry rules, open the
wardrobe and put on a lab coat and safety goggles, wash hands at the corridor basin step by step,
rub in hand sanitizer, put on gloves — only then does the door to the clean area (SIMLAB Hub)
open. Every rule is data (`src/content/procedures.json`), every refusal gives a reason, progress
and worn equipment are saved.

> The entry sequence is a **simplified, illustrative teaching sequence**, not a certified
> cleanroom, laboratory-safety or infection-control protocol; its timings (2 s per rubbing
> motion, 3 s sanitizer) are shortened game timings.

## 1. Verdict

**PASS.** The full flow is played end to end in a real browser with mouse and keyboard
(`e2e/preparation.spec.ts`), out-of-order actions and early entry are refused with reasons (unit
and E2E), the state machine is covered by integration tests against the real game, save format
v2 has a tested migration from v1, and `npm run check`, `npm run build` and `npm run test:e2e`
pass. Rendering was verified with software WebGL (SwiftShader) only — no GPU was exercised.

## 2. Repository audit

Read before coding: `Game.ts` (composition root), `InteractionSystem` + `behaviors.ts`,
`EntityStates`, `World`/`SceneManager`, `PhysicsSystem`, `WorldRenderer`, `Hud`, `DebugPanel`,
`content.ts` validation, `saveData.ts`/`SaveSystem.ts`, the Phase 4 rooms (Preparation Room +
cleanroom corridor in one scene, hub door at the corridor end) and all tests. Findings that
shaped the design:

- The corridor → hub door is the only route from the Preparation scene to the labs, so gating
  that one `travel` action gates the clean area without new scene or door machinery.
- Interaction already had generic actions with `isAvailable`; it lacked a way to _refuse with a
  reason_. Adding guards there avoids a second interaction manager.
- Items opt into behaviours by id; adding `faucet`, `wear`, `use` behaviours keeps code free of
  content ids. The storage cabinet in the Preparation Room became the wardrobe (same slot).
- Save v1 had no place for equipment or procedure progress → v2 with a migration.
- Existing tests that walked through the hub door had to move to the ungated Teacher Room door
  (the gate is intended); no assertion was weakened.

## 3. Baseline (before Phase 5, commit `bf380e1`)

| Command            | Result                                                   |
| ------------------ | -------------------------------------------------------- |
| `npm run check`    | PASS — 125/125 unit tests (12 files)                     |
| `npm run test:e2e` | PASS — 6/6 (5 dev + 1 production)                        |
| `npm run build`    | PASS — entry 695.78 kB (gzip 182.40), Rapier 4,332.82 kB |

## 4. Architecture decisions

- **One rule authority.** `ProcedureSystem` (`src/gameplay/procedure/`) is the only place that
  knows procedure rules. It plugs into interaction as an **action guard**
  (`InteractionSystem.addGuard`) — interaction stays generic and never imports procedure code.
- **Refusal is first-class.** `InteractionAction.blocked()` (an action's own precondition, e.g.
  "Open the wardrobe first.") and guards both produce a reason; `perform` publishes
  `ActionBlocked` and does nothing. `blockedReason()` lets the HUD show the reason _before_ a press.
- **Equipment** is a small service over `player.equipment` (saved), changed only by the `wear`
  behaviour, announced by `EquipmentChanged`. Items say where they are worn (`wornOn`); visuals
  derive from that, never from item ids.
- **Steps are data**: `wear` (item worn), `state` (an entity state holds), `perform` (an action
  on an item, optionally timed, optionally with `requires` conditions). Content validation
  checks every step against what is actually placed in the scene and the behaviours'
  `actionIds`.
- **Strict order, live entry check.** Steps complete in order; entry also re-checks required
  equipment at the door, so taking gloves off closes it again.
- **Gloves last.** The prompt sketched PPE before hand washing; gloves are put on _after_ hand
  hygiene here (gloves first and then washing is wrong practice). The coat and goggles come
  first. The order is data, so it can be changed without code.
- **Visible state, not just text.** Wardrobe slides open (render, targeting box and physics
  collider move together), garments disappear from their hook when worn, the faucet shows a water
  stream while running, first-person hands show coat sleeves, bare/gloved hands, foam, wetness,
  the rubbing motions and raised hands after disinfection; goggles frame the view.
- **No per-frame allocation** in the new render/HUD paths: hand state is recomputed on events,
  the animation writes into preallocated poses, and the HUD timer bar reads an allocation-free
  `timerFraction()`.
- **Subagents** were not used: the work is one tightly coupled change (interaction, procedure,
  content, save, render, tests) where splitting would have cost more coordination than it saved.

## 5. Implemented features

- Preparation Room: **notice board** (entry rules), **wardrobe** (slides open) holding a
  **lab coat**, **safety goggles** and an optional **face shield**.
- Cleanroom corridor wash station: **faucet** (on/off, water stream), **hand-wash basin**
  (wash), **soap dispenser**, **paper towels**, **hand sanitizer**, **glove dispenser**.
- Behaviours: `faucet` (`running` state), `wear` (garment from a container that must be open, or
  dispenser), `use` (a named action whose meaning comes from the procedure).
- HUD: objective panel (procedure name, "Step n of 15 · stage", instruction, timer bar, green
  when ready/entered), blocked reason under the prompt, notices for refusals (amber), completed
  steps (green), equipment changes, interruptions and readiness; goggles/face-shield view overlay.
- Debug panel: `Equipment:` and `Procedure:` lines (status, n/total, next step id, timer).
- Save v2: worn equipment and procedure progress; Continue restores a half-done entry exactly.

## 6. Procedure state machine

```
not-started ─► in-progress ─► ready ─(travel through the entrance)─► entered
                    ▲            │
                    └────────────┘  required PPE taken off again
```

Steps (stage): read rules (briefing) → lab coat → goggles (gowning) → water on → wet hands →
take soap → rub palms 2 s → rub backs 2 s → rub between fingers 2 s → rub thumbs/fingertips 2 s →
rinse (water must run) → water off → dry (hand washing) → sanitizer 3 s (disinfection) → gloves
(gloving). Timed steps need continued attention: looking away or leaving cancels them. Refusal
reasons: `Entry blocked. Next: …`, `Entry blocked. Put on: …`, `Not yet. Next: …`, a step's own
requirement (`Turn on the water to rinse.`), `Already in progress: keep looking at it.`, `Open
the wardrobe first.` Details: [procedures.md](procedures.md).

## 7. Files changed

New: `src/gameplay/procedure/procedure.ts` (schema), `ProcedureSystem.ts` (+ test),
`src/gameplay/player/Equipment.ts`, `src/content/procedures.json`,
`src/platform/render/HandsView.ts`, `e2e/preparation.spec.ts`, `docs/procedures.md`, this report.

Changed:

| Area        | Files                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Interaction | `InteractionSystem.ts` (guards, `blocked`, `ActionBlocked`, openable target box), `behaviors.ts` (`faucet`, `wear`, `use`, `actionIds`, `check`, placement refs)                                 |
| Content     | `items.json` (wardrobe, PPE with `wornOn`, wash station), `rooms.json`, `content/index.ts`, `game/content.ts` (procedure + placement validation), `gameplay/item.ts` (`ppe`, `wornOn`, `stream`) |
| Game        | `Game.ts` (wiring, update order), `GameState.ts`, `GameEvents.ts`, `core/math.ts` (`rotate`)                                                                                                     |
| Physics     | `PhysicsSystem.ts` (sliding fixed bodies follow `open`)                                                                                                                                          |
| Save        | `saveData.ts` (v2 + migration), `SaveSystem.ts`                                                                                                                                                  |
| Platform    | `WorldRenderer.ts` (hands, water stream, hidden worn items), `Hud.ts`, `DebugPanel.ts`, `styles.css`                                                                                             |
| Tests       | `Game.test.ts`, `content.test.ts`, `persistence.test.ts`, `PhysicsSystem.test.ts`, `e2e/game.spec.ts`, `e2e/production.spec.ts`, `e2e/world.spec.ts` (comment)                                   |
| Docs        | `README.md`, `CLAUDE.md`, `architecture.md`, `interaction.md`, `data-model.md`, `physics.md`, `persistence.md`, `development-guide.md`                                                           |

## 8. Tests

| Command                                 | Result                                |
| --------------------------------------- | ------------------------------------- |
| `npm run check` (typecheck/lint/format) | PASS                                  |
| `npm run check` (unit, Vitest)          | PASS — 144/144 in 13 files (+19)      |
| `npm run test:e2e`                      | PASS — 8/8 (7 dev + 1 production; +2) |
| `npm run build`                         | PASS                                  |

New unit/integration tests:

- `ProcedureSystem.test.ts` (11, real game + Rapier): initial view; door refused with the next
  instruction (and still refused with only gloves missing); full in-order run → ready → entered
  once; out-of-order refusals (gowning before briefing, gloves/wash/sanitizer before water, soap
  before wetting, rubbing before soap) changing nothing; repeated done step not counted twice;
  wardrobe container rule for put on / put back; water required for wetting and rinsing; timed
  step: progress, no restart on a second press, cancelled by looking away and by leaving the
  scene, not completed before its duration; door closes again when gloves come off and
  `ProcedureReady` fires again on re-gloving; save mid-procedure → Continue restores progress,
  equipment and object states; new game resets.
- `content.test.ts` (+4): shipped procedure stages; entrance/equipment/action/condition checked
  against placed objects; duplicate step ids, unknown stages, bad durations; `wear` on non-PPE and
  unknown container placements.
- `persistence.test.ts` (+2, round trip extended): a v1 fixture upgrades to the exact v2 data;
  malformed v2 equipment/procedure data is rejected.
- `PhysicsSystem.test.ts` (+2): the wardrobe collider moves with `open` (ray hits it, then the
  wall behind, then its new place) and is built where it was left when the scene reloads.
- Updated: Game tests (procedures system listed, 20 entities, door travel via the Teacher Room).

## 9. E2E evidence

`e2e/preparation.spec.ts` (headless Microsoft Edge, SwiftShader):

1. **Door refused**: walk down the corridor to the hub door → prompt "Enter the clean area
   (SIMLAB Hub)" with "Entry blocked. Next: Read the cleanroom entry rules on the notice board."
   → E shows that warning, the scene stays the Preparation Room.
2. **Full flow** (≈40 s): open the wardrobe; the lab coat is refused before the briefing
   ("Not yet. Next: …", equipment stays empty); read the board; put on coat and goggles (goggles
   overlay present); walk through the doorway to the basin; washing before the water runs is
   refused; faucet on; wet, soap, four timed rubs (timer visible in the debug line and the HUD
   bar), rinse, faucet off, towels, sanitizer (3 s), gloves → `ready 15/15`, objective "Ready:
   Enter the clean area (SIMLAB Hub)." → through the door into the hub. The autosave is v2 with
   all three items worn, 15 steps completed and `entered: true`; after a reload, Continue restores
   the hub and the equipment.

Screenshots (git-ignored, `test-results/`), reviewed by eye: `prep-entry-blocked.png`,
`prep-gowned.png` (white sleeves, goggles frame),
`prep-water-running.png` (stream under the faucet), `prep-rubbing.png` (palms together, timer
bar), `prep-sanitized.png` (bare hands raised before gloving), `prep-ready.png` (blue gloved
hands, green objective), `prep-entered-hub.png` (hub, still gloved, no objective panel).
Hiding a worn garment from its hook is implemented in the renderer but not asserted by any
test or screenshot.

Existing specs: `game.spec.ts` and `production.spec.ts` now turn right and use the Teacher Room
door (the hub door is gated by design; its gate is tested above). `world.spec.ts` initially failed
(left/right wall pixel difference 30 > 20) because the new notice board sat exactly on its left
sample point; the board moved to x = −2.2 and the assertion is unchanged.

## 10. Build and performance

`npm run build` PASS: entry 720.70 kB (gzip 189.67 kB; Phase 4: 695.78 / 182.40, +24.9 kB for
the procedure system, content and hands view), Rapier chunk unchanged 4,332.82 kB and still
lazy (production E2E: menu without Rapier, one load on New game). Physics in the Preparation
scene unchanged: 14 bodies / 28 colliders (the new objects are visual/interaction only; the
wardrobe replaces the cabinet). Per-frame cost added: one timer check in the HUD and the hand
animation (no allocations); procedure rules run only on events and actions. The FPS line read
43–65 in headless software rendering (not a GPU measurement).

## 11. Documentation

New [procedures.md](procedures.md) (model, state machine, refusal reasons, equipment, station
objects, how to add a procedure, limitations). Updated: README (status, docs list), CLAUDE.md
(procedure rule), architecture (layers, systems, frame order), interaction (guards, `blocked`,
new behaviours, behaviour authoring), data model (`procedures.json`, `ppe`, `wornOn`, `stream`),
physics (sliding fixed bodies), persistence (v2, migration table), development guide (tests).

## 12. Git

One focused commit on `main`: `feat(simlab): implement preparation and cleanroom entry flow`.
Not pushed. No earlier commit rewritten.

## 13. Known limitations

- Hygiene is an order of actions, not physics: no hand-contact or contamination tracking (touching
  the door after washing does not count), raised hands after disinfection are shown, not enforced.
- Timed steps need continued focus on the object; there is no hold-to-act input.
- A worn garment's empty hook is still a target ("Put back …"), invisible by design.
- All rubbing sub-steps use the basin's single "Wash hands" action; the objective names the
  motion.
- Hands are placeholder boxes drawn on top of the world; they never clip into walls but also draw
  over very close objects.
- Equipment stays on everywhere; there is no de-gowning when leaving the clean area.
- The developer scene jump (F3 panel, dev builds only) bypasses the gate.
- Notices stack for 5 s each; quick play produces a column of them.
- After the wardrobe moves, physics ray queries see the new collider from the next physics step
  (one frame).
- Verified with software WebGL only.

## 14. Next recommended phase

Use the gated clean area: the first laboratory workflow in the Chemistry or Biology lab that
depends on the PPE (e.g. a procedure-gated bench task reusing `ProcedureSystem` for in-lab steps,
with contamination rules — touching non-clean surfaces invalidates gloves), plus de-gowning on
exit and per-door spawn points so returning from the hub arrives at the corridor end.
