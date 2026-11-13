# Phase 2 report — Rapier physics, collisions, character controller, movable objects

Date: 2026-10-20 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D`

## 1. Repository audit

- Root `C:/Users/ADMIN/Desktop/SimLab 3D`, branch `main`, working tree **clean**, 6 commits
  (`43e03d6` … `12fc437`), no remote.
- Baseline re-run before any change (matches the Phase 1 report):
  `npm run check` **PASS** (72/72), `npm run build` **PASS** (675.6 kB JS), `npm run test:e2e`
  **PASS** (2/2, Edge).
- No physics existed: movement was clamped by `World.isWalkable` (union of room rectangles), items
  had `physical { massKg, movable, friction, restitution }` but nothing used them.

## 2. Architecture decisions

| Decision                 | Choice                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package                  | `@dimforge/rapier3d-compat` **0.21.0** (released 2026-09-25). API verified from its `.d.ts`; behaviour verified by Node spikes before design.                                                                            |
| Ownership                | New `src/physics/` (only module allowed to import Rapier — ESLint). One `PhysicsSystem` (`GameSystem`) owns one Rapier world for the game's lifetime; bodies follow World/scene events; `dispose()` frees it.            |
| Fixed timestep           | 1/60 s, accumulator capped at 5 steps per frame (excess dropped), frame delta already capped at 0.1 s; steps only while playing; no render interpolation.                                                                |
| Collision representation | Room: one fixed body, 6 cuboid slabs just outside `bounds` (matching the rendered box). Items: the visual primitive (cuboid/ball/cylinder) at the entity pose; `physical.body` = static/dynamic/none.                    |
| Entity transform         | `WorldEntity.pose` = box centre + quaternion, mutated in place by physics for dynamic bodies; renderer and interaction hold references.                                                                                  |
| Player controller        | Kinematic capsule (r 0.3 m, height = character height) + Rapier `KinematicCharacterController` (1 cm skin, slide, snap-to-ground 0.1 m, no autostep, no impulses to objects). Input → `moveIntent` (m/s); physics moves. |
| Mass policy              | `massKg` authoritative (`ColliderDesc.setMass`), density derived; friction/restitution per collider, Rapier average combine.                                                                                             |

Full description: [physics.md](physics.md).

## 3. Implementation

- **PhysicsSystem** (`src/physics/PhysicsSystem.ts`): async `init` (WASM load, world, controller,
  subscriptions); `update(dt)` → teleport check → fixed steps (character move → `world.step()`) →
  write-back of player feet/grounded and awake dynamic poses; `stats()`, `body(id)`,
  `dynamicBodyIds()` for diagnostics; `dispose()`.
- **Measured pitfalls handled**: new colliders are invisible to the character controller until a
  step → a zero-length step after scene build (without it the capsule tunnelled 7.5 cm into the
  bench on the first frame); a teleport needs `propagateModifiedBodyPositionsToColliders()`;
  pushing a grounded capsule into the floor cost 1–6 % speed → gravity only while airborne +
  snap-to-ground; the 1 cm skin is subtracted so feet read y ≈ 0.
- **PlayerSystem** now produces look + `moveIntent` only; `World.isWalkable` removed.
- **Interaction** targets oriented boxes (`rayBox` with quaternions) referencing live poses.
- **Renderer** places entity groups at their pose and copies dynamic poses every frame.
- **Debug panel**: physics active/bodies/colliders/ms per step, grounded/airborne, up to four
  dynamic bodies (focused first) with position, speed and sleep state.
- **Content**: steel ball (dynamic, CCD, restitution 0.6), desk lamp and microscope dynamic; the
  Physics Lab ball placed 0.5 m above the bench so it drops on every load.

## 4. Files changed

| Area          | Files                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Physics (new) | `src/physics/rapier.ts`, `PhysicsSystem.ts`, `PhysicsSystem.test.ts`, `bootFailure.test.ts`                                                                  |
| Core          | `core/config.ts` (+`physics` section), `core/math.ts` (`Quat`, `quatFromYaw`, `rayBox` replaces `rayBoxY`)                                                   |
| Data          | `gameplay/item.ts` (body, damping, ccd, positive sizes, shape checks), `content/items.json`, `content/rooms.json`                                            |
| World         | `world/World.ts` (`Pose`, `entityFromPlacement`, `isWalkable` removed), `world/SceneManager.ts`                                                              |
| Gameplay      | `gameplay/player/PlayerSystem.ts` (intent), `gameplay/interaction/InteractionSystem.ts` (live poses)                                                         |
| Game          | `game/Game.ts` (physics wired between player and interaction; character height), `game/GameState.ts`                                                         |
| Platform      | `platform/render/WorldRenderer.ts`, `platform/ui/DebugPanel.ts`                                                                                              |
| Tooling       | `package.json`/`package-lock.json` (Rapier), `eslint.config.js` (Rapier only in `src/physics`)                                                               |
| Tests         | `core.test.ts`, `World.test.ts`, `PlayerSystem.test.ts`, `InteractionSystem.test.ts`, `Game.test.ts`, `content.test.ts`, `e2e/game.spec.ts`                  |
| Docs          | `docs/physics.md` (new), `architecture.md`, `game-core.md`, `interaction.md`, `data-model.md`, `development-guide.md`, `README.md`, `CLAUDE.md`, this report |

## 5. Physics verification (measured)

| Check                             | Result                                                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ball in free flight               | speed = g·t to 4 decimals; position within the integrator's O(g·h·t) of y₀ − g t²/2                                                                                                    |
| Ball dropped 0.5 m onto the bench | ≥ 1 bounce, never below bench top + r − 5 mm, rebounds lower than the drop, rests at y = 0.940 m (±2 mm), speed < 1e-3 m/s, asleep. Browser: `-0.400, 0.940, -2.000 m 0.00 m/s asleep` |
| Restitution applied               | restitution 1 rebounds > 5 cm; restitution 0 rebounds < ⅕ of that                                                                                                                      |
| Player vs bench                   | stops at bench face + 0.31 m (±1–2 mm) and stays there while input is held; browser: z = −1.29 (face −1.6)                                                                             |
| Player on floor                   | \|feet y\| < 5 mm over 10 s of walking; dropped from 1.2 m lands and reports grounded                                                                                                  |
| Walls / sliding                   | stops at wall − 0.31 m, slides along it at the expected rate                                                                                                                           |
| First frame after load            | no tunnelling when spawned touching the bench and running into it                                                                                                                      |
| Fixed step                        | 60 steps for 1 s of regular and of irregular frame times, identical ball state; a 2 s stall runs 5 steps                                                                               |
| Counts across scenes (browser)    | Physics Lab 7 bodies / 12 colliders, Hub 6 / 11, back to 7 / 12 on every return (2 round trips); listeners stable at 25                                                                |
| Counts across scenes (unit)       | 5 load/unload cycles: 4/9 each load, 0/0 after unload; listener count unchanged                                                                                                        |
| Step cost                         | 0.1–0.2 ms per step in headless Edge (debug panel)                                                                                                                                     |

Mutation checks (each made the suite fail, then restored): bodies never removed (2 failures),
static items without colliders (7), dynamic poses not written back (2), no scene-query refresh
(1, after adding the first-frame test that the first mutation run showed was missing).

## 6. Automated tests

| Command            | Result                                                                                |
| ------------------ | ------------------------------------------------------------------------------------- |
| `npm run check`    | **PASS** — typecheck, ESLint, Prettier, Vitest **92/92** in 10 files (was 72/72 in 8) |
| `npm run test:e2e` | **PASS** — **3/3** in headless Microsoft Edge (2 existing + 1 new physics scenario)   |

Physics tests: 16 in `src/physics/PhysicsSystem.test.ts` (configuration, colliders from data,
gravity, landing/settling, restitution, bench stop, first-frame colliders, floor drift, falling,
teleport, fixed step, pause/dispose, no accumulation, two game-level checks) + 1 boot-failure test.
Tolerances follow Rapier's 32-bit floats (≈1e-4 m, contact ≈2 mm); no assertion was weakened
below the measured behaviour, and existing Phase 1 assertions changed only where physics changed
the behaviour by design (documented in §9).

## 7. Build

`npm run build` **PASS**. JS bundle **675.6 kB → 5,017.5 kB** (gzip 175.7 → 1,848.4 kB). Cause:
the compat package inlines Rapier's 3.08 MB WASM as base64 (`rapier.mjs` 4.34 MB). Not optimized
in this phase; see §12.

## 8. Browser verification

Microsoft Edge (installed), headless, software WebGL (SwiftShader) — **no GPU verified**.
Scenarios run (`e2e/game.spec.ts`):

1. Boot → menu → new game → walk → door focus → travel → scene jump → reload → Continue (Phase 1).
2. Walk to the console, mouse look, run free fall: HUD "Fall time 0.553 s · Impact velocity
   −5.425 m/s" (unchanged analytic result).
3. **Physics**: steel ball comes to rest on the bench and sleeps; walking into the bench stops the
   player at z = −1.29 and holding the key 1.5 s longer does not move it; grounded; counts 7/12 →
   hub 6/11 → 7/12 twice; no console or page errors; no failed systems.

Screenshots (git-ignored, regenerated by the run): `test-results/physics-bench.png` (player
against the bench, ball resting on the bench top), `experiment-done.png`, `door-focused.png`.

## 9. Regression

- Free-fall experiment: `ExperimentRuntime` tests unchanged and passing (analytic to 1e-12); E2E
  result unchanged.
- Scene navigation, door travel, autosave, Continue, backups, migrations: unit + E2E pass.
- Interaction: all Phase 1 tests pass; targeting now also follows moving objects.
- Changed by design: wall stops are now `wall − radius − 1 cm skin` and doors/furniture block
  (old test walked into the now-solid door; rewritten against the clear east wall); position
  assertions use 1e-3 tolerances (32-bit floats); the boot test lists the new `physics` system.

## 10. Git

Committed on `main` following the repository workflow in `CLAUDE.md` ("commit in logical
commits"); not pushed (no remote). See the commit list in the final summary of this phase.

## 11. Known limitations

| Not implemented / not verified    | Reason                           | Impact                                           | Follow-up                                          |
| --------------------------------- | -------------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Grab / drop / throw / push        | Phase 3 scope                    | Dynamic objects can only fall and settle         | Phase 3 interaction physics                        |
| Colliders following visual state  | Not needed for acceptance        | An open cabinet's drawn-out part has no collider | State-driven collider updates                      |
| Stairs/ramps (autostep)           | Flat floors only                 | None today                                       | Enable autostep with such content                  |
| Render interpolation              | Not needed for correctness       | Motion is stepped at 60 Hz                       | Renderer-side interpolation                        |
| Dynamic object positions in saves | Out of scope                     | Objects return to placements on load             | Save section when items can be moved by the player |
| GPU rendering                     | Headless E2E uses SwiftShader    | Real-GPU frame rate unmeasured                   | Manual run on the RTX 5070                         |
| Rooms connected within one scene  | Physics walls match closed boxes | Multi-room scenes need doorway geometry          | World building phase                               |

## 12. Technical debt

- Bundle: +4.34 MB from base64 WASM → move to `@dimforge/rapier3d` (separate `.wasm`) or lazy-load
  physics on the first world scene; measure load time.
- `PlayerEnteredRoom` uses the previous frame's resolved position (≈16 ms late).
- Debug panel `body()`/`dynamicBodyIds()` allocate (4 Hz, dev only) — fine for diagnostics.
- Interaction still scans all interactables linearly (Phase 1 `shortcut:`).

## 13. Verdict

**PASS.** All acceptance criteria are met with evidence: (A) the player cannot pass the lab bench
(unit and browser); (B) the dropped ball falls under gravity, hits the bench and settles on it
(unit trajectory checks and browser rest state); (C) no leaks of bodies, colliders or listeners
across scene changes, no stepping after dispose, single update loop (unit and browser); (D) Phase
1 behaviour, the free-fall experiment and saves still pass. Caveat: browser checks ran on
software WebGL, not a GPU.

## 14. Recommended next phase

**Phase 3 — Real-world interaction (grab, drop, throw).** Depends on Phase 2 physics and the
interaction system.

Scope: a `grab` capability for `movable` dynamic items (hold left mouse within reach); the held
object follows a hold point in front of the camera through physics (so it still collides and
cannot be pushed through walls or the bench); release drops it; a release while moving the mouse
throws it with a capped velocity; held objects cannot be used to lift the player; optional
player pushing of light objects. Input bindings for mouse buttons in config.

Acceptance: pick the steel ball up from the bench, carry it, it cannot pass through walls; drop it
on the floor and it settles; throw it and it bounces off a wall and settles; static/`none` items
cannot be grabbed; unit tests for hold/drop/throw and limits, E2E for pick-up → drop → rest; no
leaks across scene changes. A small separate task can switch Rapier to the non-compat package to
recover bundle size.
