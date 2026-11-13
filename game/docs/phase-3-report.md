# Phase 3 report — Physical interaction: grab / drop / throw

Date: 2026-10-21 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D`

## 1. Audit and baseline

- Root `C:/Users/ADMIN/Desktop/SimLab 3D`, branch `main`, clean tree, HEAD `531518e`, no remote.
- Baseline: `npm run check` **PASS** (96/96), `npm run test:e2e` **PASS** (4/4: 3 dev + 1 production).
- Existing pieces reused: look-at targeting with oriented boxes and behaviours
  (`InteractionSystem`), device-independent `InputState` (keyboard only), `PhysicsSystem` owning all
  Rapier bodies (dynamic bodies already simulated), `World` entities with live `Pose`s, HUD prompt
  from the primary action, the `movable` item flag reserved for "pick up later".
- Gaps found: no occlusion in targeting (a non-interactable solid did not hide what was behind
  it), no mouse-button input, nothing could hold a body.

## 2. Architecture

```
Interaction (intent)            Physics (simulation)
  grab behaviour ─► Hands ──────► ObjectHolder.grab / release
  InteractionSystem owns the     PhysicsSystem drives the held body,
  hold state + input routing     clamps it at static surfaces, restores it
        ▲  LineOfSight.castRay ◄──────── one Rapier ray per frame
```

- **Interaction owns intent and the hold state** (`InteractionSystem` implements `Hands`).
  Grabbing is a normal behaviour (`grab`), listed by items in data; the grab action asks the hands.
- **Physics owns the simulation** behind two small interfaces defined in gameplay
  (`src/gameplay/interaction/hold.ts`): `ObjectHolder` (grab/release) and `LineOfSight`
  (castRay). Gameplay never imports Rapier and never moves a body or mesh.
- **Player owns input/camera** (yaw/pitch, eye); the hold point is derived from it by one shared
  function (`holdPoint`). **World owns identity**: the held object is the real entity — its pose
  is written by physics and rendered as before; no copy exists.
- No separate GrabSystem, no new system in the update order, no parallel input system.

## 3. Grab

- Data: `"interactions": ["grab", …]` (content validation: item must be `body: "dynamic"`),
  `physical.throwable`. Shipped: steel ball (grab, throwable), microscope (grab, not throwable).
  `movable` was removed — it was the placeholder for this.
- Targeting: unchanged box scan within `config.player.reach` (2.2 m, also the grab distance) plus
  one physics ray that rejects targets hidden behind any collider.
- The Grab action is available only when the hands are free and mass ≤
  `config.player.maxCarryMassKg` (15 kg).
- Controls: **E** grab · **E** drop · **left mouse button** throw (read only while the mouse is
  captured; bindings `interact: KeyE`, `throw: Mouse0`).

## 4. Hold

`NotHolding ⇄ Holding` is explicit in `InteractionSystem` (`heldId`, events `ObjectGrabbed` /
`ObjectReleased`). While holding, targeting pauses, E drops, LMB throws. Physics keeps the body
**dynamic** (gravity scale 0, CCD on, collision groups excluding the player capsule) and each step
sweeps its shape towards the hold point (1 m along the aim, pitch clamped ±50°), clamps the target
at the first static surface and sets velocity = gap / 0.08 s (≤ 8 m/s); angular velocity 0.

## 5. Drop

`release` with zero velocity: gravity scale 1, the item's CCD setting, default collision groups.
The body is already dynamic at its current pose, so it falls and collides from the next step and
does not return to its placement.

## 6. Throw

Velocity = camera aim × `min(throwImpulse / mass, maxThrowSpeed)` (2.5 N·s, 12 m/s), set directly
(deterministic); the steel ball leaves at 10 m/s. Non-throwable objects ignore the throw input.

## 7. Physics integration decisions

- Kinematic-while-held (A) rejected: kinematic bodies ignore walls/fixed bodies and shove dynamic
  bodies with unlimited force. Velocity-driven dynamic body (B) chosen; mass/friction/restitution
  untouched.
- First version pushed into walls: with the hold point behind a wall the drive pressed at 8 m/s
  every step and the ball sank **3.8 mm** into the wall (test failed). Fixed at the cause — the
  static-surface sweep — not by loosening the test; now it rests 2.0 mm off the wall.
- Player safety: collision groups make the capsule and the held body ignore each other and the
  character controller skips it, so a carried object never blocks or pushes the player.
- Scene change policy: the hold is released on `SceneLoading`, before teardown; despawn of a held
  entity clears both sides; an object stuck > 1 m from its hold point for 0.5 s is let go.
- Save policy: the hold is runtime-only and never saved; saving does not drop the object.

## 8. Files changed

| Area          | Files                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New           | `src/gameplay/interaction/hold.ts` (hold point, `ObjectHolder`, `LineOfSight`), `src/gameplay/interaction/hold.test.ts`, `e2e/grab.spec.ts`, this report                            |
| Interaction   | `InteractionSystem.ts` (hands, hold state, input routing, line of sight, forced releases), `behaviors.ts` (`Hands`, `grab`, `check` hook)                                           |
| Physics       | `PhysicsSystem.ts` (grab/release, hold drive with sweep, collision groups, `castRay`, body→entity map, `heldId` stat)                                                               |
| Data / config | `item.ts` (`throwable`, `movable` removed), `items.json`, `config.ts` (holdDistance, throwImpulse, maxThrowSpeed, maxCarryMassKg, `throw` binding), `content.ts` (behaviour checks) |
| Game          | `Game.ts` (wires physics as holder and line of sight), `GameEvents.ts` (`ObjectGrabbed`, `ObjectReleased`)                                                                          |
| Platform      | `BrowserInput.ts` (mouse buttons), `Hud.ts` + `dom.ts` + `styles.css` (Grab / Drop / Throw prompts, LMB label), `DebugPanel.ts` (`Holding:` line)                                   |
| Docs          | `interaction.md`, `physics.md`, `data-model.md`, `architecture.md`, `development-guide.md`, `README.md`, `CLAUDE.md`                                                                |

## 9. Tests

| Command            | Result                                                                             |
| ------------------ | ---------------------------------------------------------------------------------- |
| `npm run check`    | **PASS** — typecheck, ESLint, Prettier, Vitest **111/111** in 11 files (was 96/96) |
| `npm run test:e2e` | **PASS** — **5/5** (4 dev + 1 production; new `grab.spec.ts`)                      |
| `npm run build`    | **PASS**                                                                           |

New unit/integration tests (`hold.test.ts`, 15, real game + Rapier): grab with E; refusals
(static bench, physics refusal, second object, too heavy via config); content check for `grab` on
a static item; steady hold following the aim (< 1 cm, spread < 1 mm); same world object, mass
unchanged; wall (ball ≥ wall + r − 2 mm, player stops at the same spot as without it) and bench
(≥ top + r − 3 mm); player not moved or slowed; drop (falls, lands on the bench at the drop x/z,
not the spawn, sleeps); throw (velocity = aim × 10 m/s exactly, reaches the wall, does not pass
it, bounces, counts unchanged); non-throwable microscope; scene change (released before unload,
no stale binding, counts 6/11 then 7/12, regrab works); despawn; out-of-reach release; save while
holding; occlusion behind a non-interactable screen.

Mutation checks (each made the suite fail, then restored): no player/held collision exclusion,
gravity not restored, hold surviving scene change, no line-of-sight check, no wall sweep, throw
speed ignoring mass.

## 10. E2E verification

Microsoft Edge (installed), headless, software WebGL (SwiftShader) — **no GPU**. `e2e/grab.spec.ts`
drives the real app with keyboard and mouse: walk to the bench, aim at the ball (prompt "Grab"),
E → `Holding: physics-lab/steel-ball`, prompt "E Drop · LMB Throw"; turn → the ball follows to
within 3 cm of the computed hold point; E → it falls and sleeps on the bench at 0.940 m within
5 cm of where it was held, not at its spawn; grab again, aim east, left mouse button → it travels
east, never past the wall, bounces back; physics counts still 7/12; no console errors.
Screenshots: `test-results/grab-holding.png`, `grab-dropped.png`, `grab-thrown.png` (git-ignored).
Existing scenarios (door, experiment, bench/ball/leaks, production lazy loading) pass unchanged.

## 11. Build

`npm run build` **PASS**: entry 691.57 kB (gzip 181.04 kB; Phase 2.1: 686.19 / 179.31), Rapier
chunk unchanged 4,332.82 kB.

## 12. Known limitations

- Moved/thrown object positions are not saved; after Continue objects are at their placements.
- Only the primary action is on E: the steel ball's Inspect is reachable only with full hands.
- No rotation control or precise placement of held objects; orientation is kept as grabbed.
- Held objects follow by velocity, so a heavy object follows as fast as a light one (mass acts in
  collisions); the 15 kg carry limit is the only strength rule.
- The player does not push objects by walking into them.
- A 10 m/s impact sinks ≈ 5 mm into a wall for one step before the bounce (no tunnelling).
- Verified in headless Edge with software WebGL only.

## 13. Technical debt

- Interaction still scans all interactables linearly (plus one ray per frame).
- The hold point uses the previous frame's player position (≤ one frame lag).
- `castRay`/`castShape` results allocate small Rapier objects per call (one ray per frame, one
  sweep per step while holding).

## 14. Verdict

**PASS** — all Definition-of-Done items are met with evidence: grab/hold/drop/throw work through
the existing interaction and physics architecture (unit + browser), held objects stay the real
dynamic world object and respect walls/bench, release restores normal simulation, scene changes
and despawns leave no stale state, Phase 1/2/2.1 behaviour and the free-fall experiment are
unchanged, check/build/E2E pass.

## 15. Recommended next phase

World building for the vertical slice: doorway geometry between rooms, the Preparation Room /
cleanroom layout with real furniture, and a secondary-action input (so Inspect and Grab can coexist)
— then the cleanroom PPE / hand-washing sequence on top of the interaction system.
