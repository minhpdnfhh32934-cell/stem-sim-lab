# Phase 6A report — World flow and preparation hardening

Doors now put the player at the matching door of the next scene, facing into the room, on
exactly the same spot every time. The clean area has a coherent way back out: return to the
corridor, take the PPE off where it came from, and leave the preparation area — which PPE may not
leave, and which resets the preparation. Procedure status is live, saved progress can no longer
skip steps, and HUD notices are bounded and never contradict the game state.

## 1. Verdict

**PASS.** All objectives are implemented within the existing architecture and verified by unit
and integration tests and by real-browser workflows (headless Microsoft Edge with software WebGL,
SwiftShader — no GPU was exercised). `npm run check`, `npm run test:e2e` and `npm run build` pass
(results in section 10).

## 2. Repository audit

- Branch `main`, HEAD `dd44744` (Phase 5), working tree clean — as reported. No discrepancies.
- Two kinds of room-to-room movement exist: **openings** inside a scene (walked through, Phase 4)
  and **doors** with the `travel` behaviour that load another scene. Only doors needed spawn
  points.
- Every scene had a single `spawn`, so five of the ten doors landed at the wrong door: hub →
  Preparation scene (the Preparation Room spawn instead of the corridor end), Teacher Room →
  Preparation Room (the spawn instead of by the Teacher Room door), and each of the three
  laboratories → hub (the hub's south spawn instead of in front of that laboratory's door). The
  other five landed near the right door only because each scene's spawn happened to sit there.
- The world has a distinct clean-area boundary (the gated corridor → hub door). The roadmap
  (`Desktop\SimLab3D.txt`) defines the way in only; it says nothing about leaving or de-gowning.
  The Teacher Room is the teacher's private room.
- PPE removal already existed (Phase 5 `wear` behaviour: put back at the wardrobe, take off at
  the glove dispenser), with saved `taken` states and equipment — no inventory or character
  refactor was needed.
- Found bugs: (1) `view().status` stayed `entered` forever, so after taking gloves off the HUD
  said "Completed. You have entered the clean area." while the door was shut; (2) progress was a
  set of ids, so a saved id later in the sequence (edited or older save) made that step count as
  done when reached; (3) HUD notices were unbounded (one DOM node and timer per message) and a
  "door is open" notice stayed up after the door closed again.

## 3. Baseline (before any change, commit `dd44744`)

| Command            | Result                                                   |
| ------------------ | -------------------------------------------------------- |
| `npm run check`    | PASS — 144/144 unit tests (13 files)                     |
| `npm run test:e2e` | PASS — 8/8 (7 dev + 1 production), 56.8 s                |
| `npm run build`    | PASS — entry 720.70 kB (gzip 189.67), Rapier 4,332.82 kB |

## 4. Architecture

No new manager or system. Each change sits in the module that already owned the concern:

- **Arrival resolution** is a pure module, `src/world/arrival.ts` (`arrivalPose`,
  `standsInside`, `blockingPlacement`), used by `SceneManager` at runtime and by content
  validation at boot — the same function both times. Doors carry the data
  (`travel` param `arrival`); `SceneChangeRequested` carries it to `SceneManager.load`, the only
  place that places the player. Physics already treats any outside position write as a teleport.
- **Exit rule and reset** live in `ProcedureSystem`, still the single authority for procedure
  rules, as data (`exits` in `procedures.json`) and the existing action guard.
- **Notices**: a DOM-free policy class (`src/platform/ui/NoticeQueue.ts`) inside the existing HUD,
  fed by the existing events.
- Save format unchanged (version 2): nothing new needed storing.

## 5. Doorway transitions

- **Model**: each door's `params.arrival` names a door entity in the target scene. The player
  stands 1 m (`ARRIVAL_DISTANCE`) in front of it, on the face that points into its room (the side
  whose point is inside the room with 0.4 m wall clearance), facing into the room. All 10 doors are
  configured and pair up both ways.
- **Determinism / drift**: computed from placement data only, never from the previous position —
  four round trips land on identical coordinates (unit) and three on identical 2-decimal
  positions and whole-degree facings (E2E).
- **Collision**: content validation rejects an arrival (or a scene spawn) within 0.4 m of a wall
  or of any solid object's footprint, an unresolvable side, a non-door or a door outside the
  target scene. At runtime every door was travelled through: the player stays exactly at the
  arrival point under physics (no depenetration push), is grounded and can walk at once.
- **Not pulled back**: the arrival faces away from the door, which is therefore not targeted
  (asserted for every door); doors only act on a key press.
- **Directionality**: each door names its own arrival, so one-way doors are possible. Without
  `arrival` the scene spawn is used — the documented fallback, and what the developer scene jump
  (F3) does; its button now says it is a debug teleport that bypasses doors and entry rules.

## 6. Preparation and exit

- **Back from the clean area**: hub "Back to Preparation Room" → 1 m inside the entrance in the
  corridor, facing down it. The preparation stays valid, so the entrance opens again at once.
- **De-gowning** uses the existing interactions where each item came from: gloves off at the
  dispenser, goggles/shield/coat back on their wardrobe hooks (visible again, `taken` false).
  Taking required PPE off closes the entrance (`Entry blocked. Put on: …`) until it is back on.
- **Exit rule (new, data)**: `exits: ["preparation-room/door-teacher"]`. The Teacher Room door
  refuses travel while any PPE is worn ("Take off your PPE before leaving: lab coat, safety
  goggles."), so lab PPE never reaches the teacher's private room and no door action skips the
  removal. Leaving through it resets the procedure (`ProcedureReset`, notice), so entering the
  clean area again needs the whole preparation, hand hygiene included — otherwise re-entry would
  silently skip it. Nothing is removed automatically by any scene change.
- Boundary assumptions (documented in `docs/procedures.md`): preparation area = Preparation Room
  - corridor (one scene); clean area = hub + laboratories; the Teacher Room is outside. The order
    of de-gowning and hand washing after it are not enforced.

## 7. Procedure consistency

- **Live status**: `ready`/`entered` only while the entrance would open now; the HUD objective
  and debug line follow it (`Entry blocked. Put on: nitrile gloves.` instead of "Completed").
- **Strict prefix**: completing a step rewrites `completed` as the exact prefix of steps done;
  stray ids from a save never skip a step and never open the door (tested with an edited save
  through Continue).
- **Interrupted timers**: looking away or leaving cancels; the step only counts after one full,
  uninterrupted run from zero (no resume, no completion while unpressed) — tested.
- **One rule source**: door gating, exit refusal, readiness and status all read
  `ProcedureSystem`; the HUD only displays `view()`/`entryBlock()`; the wardrobe rule stays in the
  `wear` behaviour.
- The 15-step procedure is unchanged.

## 8. Notifications

Policy (`NoticeQueue`, documented in `docs/game-core.md`): one notice per topic key (a newer one
replaces the older: latest refusal, latest step, results replace "Running…"); identical text
coalesces; at most 4 at once, evicting the oldest info/success first and warnings/errors last;
4 s, 6 s for warnings/errors, longer for long texts (≤ 12 s); refusals are withdrawn when the
procedure moves on or the scene changes, and "the door is open" as soon as it no longer is.
Rendering happens on change only; expiry is checked per frame without allocating. Six unit tests.

## 9. Files changed

| Area     | Files                                                                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World    | `src/world/arrival.ts` (new), `SceneManager.ts`                                                                                                                                                     |
| Content  | `rooms.json` (arrival on 10 doors), `procedures.json` (`exits`), `game/content.ts` (arrival, spawn and exit validation)                                                                             |
| Gameplay | `interaction/behaviors.ts` (`travel.arrival`, `arrival` ref), `procedure/procedure.ts`, `ProcedureSystem.ts`                                                                                        |
| Game     | `GameEvents.ts` (`SceneChangeRequested.arrival`, `ProcedureReset`)                                                                                                                                  |
| Platform | `ui/NoticeQueue.ts` (new), `ui/Hud.ts`, `ui/DebugPanel.ts`                                                                                                                                          |
| Tests    | `world/arrival.test.ts`, `ui/NoticeQueue.test.ts` (new); `content.test.ts`, `ProcedureSystem.test.ts`, `Game.test.ts`; `e2e/support.ts`, `e2e/transitions.spec.ts` (new), `e2e/preparation.spec.ts` |
| Docs     | README, CLAUDE.md, architecture, data-model, interaction, procedures, persistence, physics, game-core, development-guide, this report                                                               |

## 10. Tests

| Command            | Result                                                                               |
| ------------------ | ------------------------------------------------------------------------------------ |
| `npm run check`    | PASS — typecheck, ESLint (layer rules), Prettier, 170/170 unit tests (15 files; +26) |
| `npm run test:e2e` | PASS — 9/9 (8 dev + 1 production; +1 spec), 1.6 min                                  |
| `npm run build`    | PASS                                                                                 |

All baseline tests still pass. The one intended behaviour change is asserted where it shows: door
travel into the Teacher Room now lands at its door's arrival point (−1.45, 0, 0) instead of the
scene spawn (−1.5, 0, 0) (`Game.test.ts`).

New and changed tests:

- `src/world/arrival.test.ts`: resolver (four wall orientations, facing, no inside face, no
  room), footprint check (rotation, bodiless objects); **every shipped door** through the real
  game and Rapier (exact arrival and yaw, stays put under physics, grounded, door behind not
  targeted, walkable); 4 round trips without drift; scene spawn without arrival (debug jump);
  autosave + Continue restore the arrival.
- `src/game/content.test.ts`: arrivals named for all doors; arrival not in the target scene / not
  a door / no inside face / blocked; spawns in furniture or against a wall; exits that are the
  entrance or not doors.
- `src/gameplay/procedure/ProcedureSystem.test.ts`: return from the hub (door open both ways),
  live status, exit refused while any PPE is worn and allowed after de-gowning, reset (and no
  reset when nothing was done), edited save with stray ids, interrupted timer without resume,
  save/continue after de-gloving.
- `src/platform/ui/NoticeQueue.test.ts`: the policy above.
- `src/game/Game.test.ts`: door travel now asserts the arrival point (intentional change).

## 11. E2E evidence

Headless Microsoft Edge, SwiftShader software WebGL, dev server (debug panel) unless noted.

- `transitions.spec.ts` (Workflow 1): Preparation Room → Teacher Room → back, three rounds:
  each arrival at `-1.45, 0.00, 0.00` facing −90° and `1.95, 0.00, 1.00` facing 90°, grounded,
  the door come through not offered; then walking works.
- `preparation.spec.ts` (Workflows 2–4): door refused at the start; the full preparation; gloves
  taken off → the door refuses with "Entry blocked. Put on: nitrile gloves." → gloves on → into
  the hub at `0.00, 0.00, 4.95` facing 0°; the autosave holds that position, the equipment and the
  completed procedure; reload + Continue → same spot and equipment; back through the hub door to
  `0.00, 0.00, −10.20` facing 180° with the objective "Completed…"; gloves off at the dispenser;
  the exit refuses "Take off your PPE before leaving: lab coat, safety goggles."; coat and
  goggles back in the wardrobe; through to the Teacher Room with the reset notice; back in the
  Preparation Room the objective is "Step 1 of 15 · Briefing".
- Existing specs pass unchanged in their assertions (`game`, `grab`, `world`, `production`).
- One run of the final suite failed: the full-flow test reached the wardrobe by holding keys
  until "past (−0.9, −0.9)", stopped at (−0.95, −1.09) and was then 2.27 m from the notice board —
  beyond the 2.2 m reach (the board moved to x = −2.2 in Phase 5; earlier runs had overshot
  further). The test now walks in short taps to a fixed spot, (−1.4, −1.5), where the wardrobe,
  its PPE and the board are all within ~1.7 m; no assertion changed. The spec then passed three
  times in a row under three parallel workers, `transitions.spec.ts` likewise, and the full suite
  passed. Shared walking/aiming helpers moved to `e2e/support.ts`.
- Screenshots (git-ignored, `test-results/`), reviewed: `transition-teacher-room.png`,
  `transition-prep-room.png` (arrival by the Teacher Room door facing the room),
  `prep-back-after-exit.png` (coat and goggles back on their hooks, reset notice, Step 1).

## 12. Build and performance

`npm run build` PASS: entry chunk 725.69 kB (gzip 191.31 kB; baseline 720.70 / 189.67, +4.99 kB
for the arrival resolver, validation, notice policy and procedure rules), Rapier chunk unchanged
4,332.82 kB. Vite's "chunks larger than 500 kB" warning is the same as at the baseline.

No new dependency; Rapier stays lazy (production E2E: none at the menu, one load on New game).
Physics counts per scene are unchanged. Added per-frame work: the notice expiry check (a loop over
at most 4 numbers, no allocation). Arrival resolution runs once per scene load.

## 13. Documentation

New: this report. Updated: `README.md`, `CLAUDE.md`, `docs/architecture.md` (door flow),
`docs/data-model.md` (doors and arrival points, spawn clearance), `docs/interaction.md` (travel
params), `docs/procedures.md` (exits, leaving, live status, strict prefix, limitations),
`docs/persistence.md` (no format change, prefix rule), `docs/physics.md` (teleports),
`docs/game-core.md` (debug jump, HUD notices), `docs/development-guide.md` (tests).

## 14. Git

One focused commit on `main` containing this report:
`fix(simlab): harden room transitions and preparation flow`. Nothing was pushed; no earlier
commit was rewritten. The working tree had no unrelated changes before or after.

## 15. Known limitations

- The clearance check uses the default capsule radius (0.3 m + 0.1 m), not the configured one
  (`shortcut:` comment in `arrival.ts`); object footprints ignore height.
- De-gowning order and hand washing after de-gowning are not enforced; re-gloving inside the
  preparation area needs no new hand hygiene (no contamination model).
- Leaving through the Teacher Room door is the only reset trigger; the developer scene jump
  neither checks nor resets anything.
- All arrivals are 1 m from their door; a door that needs a different spot would need a per-door
  override (none does today).
- Raised hands after disinfection are shown, not enforced; timed steps still need continued
  focus.
- Verified with software WebGL only.

## 16. Next recommendation

Start the first complete Physics Lab experiment on top of this flow (the roadmap's Vertical Slice:
take equipment, assemble on the bench, run, graph): the way in and out, saves and notices are now
stable enough to build on. Keep the Teacher Tutorial NPC for after it.
