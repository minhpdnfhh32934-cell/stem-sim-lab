# Phase P3.12 — Frame pacing: drawing physics between its steps (task T1)

Above 60 FPS, SimLab felt choppier than at 60. The cause (measured in the frame-pacing
investigation) is that physics steps at 60 Hz with no interpolation, while the view turns on every
rendered frame (up to 300 Hz on the 300 Hz laptop display). The player's position and physics
bodies were therefore drawn in 1/60 s jumps, and a held object sawed ±5 px against the turning
view.

The renderer now draws physics state blended between its last two steps, and draws a held object
relative to the view. Physics computes exactly what it did before.

## 1. Verdict

**PASS WITH LIMITATIONS.**

- **Fixed:** at Unlimited and 120 FPS the judder is gone, and there is no regression at 60.
- **Not met:**
  - the 90 FPS cap is improved but misses its target;
  - the bundle grew 3.0 kB, against the plan's 1.5 kB estimate.
- `npm run check`, `npm run build` and the full e2e suite pass (§5).
- The user tried it on the real 300 Hz display and confirmed the experience is fine (§11). That
  is the user's own judgement, not an automated test.

## 2. Baseline

| Item               | Result                                                                     |
| ------------------ | -------------------------------------------------------------------------- |
| Branch / HEAD      | `main` / `fe17d12` (docs), clean tree                                      |
| `npm run check`    | **PASS** 879/879, 46 files                                                 |
| `npm run build`    | **PASS** — JS 968,470 bytes (same bundle as P3.11, docs-only commit since) |
| `npm run test:e2e` | not rerun at baseline: last **PASS** 46/46 at `d3251e9`, docs-only since   |
| Power              | AC throughout                                                              |

## 3. Implementation

**`src/core/math.ts`** gains three pure, allocation-free helpers:

- `lerp3`;
- `nlerpQuat` (normalized, the short way round);
- `turnView` (a vector as seen from a view that turned from one yaw/pitch to another; yaw about y,
  then pitch about x, as the camera turns).

**`src/physics/PhysicsSystem.ts`:**

- **Render history.** Each dynamic body entry carries `previousPosition` and `previousRotation`,
  made with the body. The player has `previousPlayer`.
  - `rememberPrevious()` copies them from Rapier just before each `world.step()`.
  - After the step loop, α = clamp(accumulator / `fixedStep`, 0, 1).
  - Each step records the view it held towards (`stepYaw`/`stepPitch`, and the one before).
- **`renderPlayer(out)`** gives the player's feet as drawn: lerp(previous, current, α).
- **`renderPose(id, position, rotation)`**:
  - a free dynamic body: lerp and nlerp(previous, current, α);
  - the held body: its offset from the eye at each of the last two steps, each put into that
    step's view frame, blended by α, then turned into the current view and added to the drawn eye.
    Its rotation is the authoritative one, since it is held steady;
  - a driven or fixed body: false, so the caller draws `entity.pose`. A driver already poses it
    every frame, and blending it again would lag it.
- **Snaps** (previous = current) on:
  - a teleport (`applyTeleport`);
  - a new player (`createPlayer`);
  - a new body (`addEntity`);
  - the end of driving (`stopDriving`);
  - every frame physics doesn't step for (not playing: menus, loading). That also covers scene
    loads.
  - A pause in play passes dt 0, so α freezes and needs no snap.
- **Nothing drawn is written back.** `state.player.position`, `entity.pose`, aiming, holding,
  stations and experiments read the same authoritative values as before.

**`src/platform/render/WorldRenderer.ts`:** the camera position and every dynamic view use the
render poses through two reused buffers. The camera rotation stays the current yaw and pitch.

**Docs:** `docs/physics.md` ("Drawing between steps"), replacing "No interpolation".

**How the held-object drawing was decided.** The first version blended the held body in the
world, like the other bodies. On the GPU it fixed Unlimited but made 60 FPS worse: 0.13 → 6.8 px,
because the held body chases a hold point sampled at frame time while α's phase drifts. Drawing it
relative to the view (above) fixed that: 0.19 px at 60.

## 4. Preservation

- **Physics is bit-identical.** The same frames with and without the render queries give equal
  player positions, body positions and entity poses (unit test, 300 frames of walking and a
  falling ball).
- **Unchanged:** experiment models and results, RunRecord, history, CSV, IndexedDB, the save,
  StationSystem and its pose driver, the player controls, collisions, interactions, FrameClock
  and the RAF.
- **Visual latency.** Positions are drawn one physics step (16.7 ms) behind the simulation at
  every frame rate. Turning (mouse look) is not delayed.

## 5. Tests

| Command                                  | Result                                                 |
| ---------------------------------------- | ------------------------------------------------------ |
| `npm run check`                          | **PASS** 892/892, 47 files (+13)                       |
| `npm run build`                          | **PASS**                                               |
| `npm run test:e2e` (3 workers, no retry) | **PASS** 46/46, 0 failed, 0 flaky, 0 skipped (9.9 min) |
| `git diff --check`                       | clean                                                  |

**New unit tests (13):**

- **`src/core/math.test.ts` (4):**
  - lerp3 endpoints and midpoint;
  - nlerp endpoints, unit length and the short way round for −q;
  - turnView agrees with `directionFromYawPitch` for 16 view pairs, keeps lengths, and leaves an
    unchanged view alone.
- **`PhysicsSystem.test.ts`, "drawing between steps" (9):**
  - at 300 Hz the drawn player moves 2.2 m/s × 1/300 s every frame (to 0.1 mm), while the state
    stands still 4 frames in 5; never ahead, at most one step behind;
  - at 60 Hz frames it draws exactly the step before;
  - a teleport is drawn at once, and the state as it is while not playing;
  - a driven body is left to its driver and drawn from where the driver left it afterwards;
  - physics is identical with and without drawing;
  - a held object is steady in the view while turning:
    - at 300 Hz: < 0.1° (as stepped: 1.15°);
    - at the jittered 60 FPS cap: < 0.1°;
    - at the 90 FPS cap: ≤ 60 % of as-stepped (0.62° against 1.18°);
  - a held object is drawn where it is before any turn.
- **Mutation check** (temporary, reverted). Each break below fails the tests:

  | Break                         | Tests failed |
  | ----------------------------- | -----------: |
  | no previous snapshot          |            3 |
  | α always 1 (the old drawing)  |            3 |
  | teleport not snapped          |            1 |
  | end of driving not snapped    |            1 |
  | driven bodies blended         |            1 |
  | not snapped while not playing |            1 |
  | held offsets not blended      |            1 |
  | held object not turned        |            2 |

  **One survives:** blending the held body in the world passes the unit tests. Its failure at 60
  FPS (6.8 px) showed only with the browser's real frame timing in the GPU probe. The unit tests'
  synthetic 60 FPS jitter doesn't reproduce it, so that case is guarded only by the GPU probe,
  which is not yet in the repository (task T2).

## 6. Measurements

**Method.** A temporary probe (a dev-only `window.game` line, a dev-server Playwright config on the
real GPU, and a spec, all removed after) recorded what each display frame showed: the drawn
player position and the drawn held object.

- Before the fix, drawn and authoritative were the same thing, so the investigation's numbers are
  the "before".
- Conditions: RTX 5070 Laptop (ANGLE D3D11), Edge headless at 300 Hz rAF (the display is 300 Hz),
  1280×720, Medium, dev build, AC.
- Walking forward at 2.2 m/s for 2 s; turning at 1.5 rad/s with the steel ball held, for 1.5 s.

| Cap       | Walking: still display frames | Walking: p99 error against even motion | Held ball: screen range | Largest jump per display frame |
| --------- | ----------------------------: | -------------------------------------: | ----------------------: | -----------------------------: |
| 30        |               89.9 % → 87.5 % |                         33.4 → 32.3 mm |          0.12 → 0.07 px |                 0.10 → 0.02 px |
| 60        |               79.9 % → 74.9 % |                         14.9 → 14.0 mm |          0.13 → 0.19 px |                 0.12 → 0.15 px |
| 90        |               80.0 % → 62.5 % |                         22.2 → 10.5 mm |          10.8 → 4.84 px |                 10.5 → 4.46 px |
| 120       |               79.9 % → 49.9 % |                          14.8 → 4.9 mm |          10.9 → 0.24 px |                 10.5 → 0.10 px |
| Unlimited |              80.1 % → **0 %** |                     14.9 → **0.03 mm** |      10.6 → **0.15 px** |                 10.5 → 0.03 px |

- **Unlimited (the game's default):** motion is even on every display frame.
- **At the 30–120 caps,** the still frames and the walking error that remain are the cap's own
  pacing. Each rendered frame is shown on 2–10 refreshes of the 300 Hz display, so even correct
  positions advance in steps. The 90 and 120 caps also alternate frame intervals (10/13.4 ms,
  6.8/10.1 ms).
- **At 90 FPS** the steps sample the turning view unevenly, so the held body's own lag behind its
  hold point varies. That is physics, untouched here; drawing halves it.
- **Frame timing itself** was already excellent and is unchanged: display intervals 3.33 ±
  0.07 ms.

**Other figures:**

- **Draw calls** are unchanged: nothing new is drawn.
- **GPU resources:** none added (two reused vectors in the renderer).
- **CPU:** per step, the previous poses of the player and of four dynamic bodies are copied. Per
  frame, there are one blend per dynamic view and one for the camera.

## 7. Bundle

| Asset | Before                | After                 | Delta                   |
| ----- | --------------------- | --------------------- | ----------------------- |
| JS    | 968.47 kB (968,470 B) | 971.49 kB (971,492 B) | **+3.02 kB** (+3,022 B) |
| CSS   | 21.74 kB              | 21.74 kB              | 0                       |

That is over the plan's own estimate (≤ 1.5 kB). 28,508 bytes are left under the 1,000,000-byte
menu limit.

## 8. Acceptance (from the P3.12 plan)

| Criterion                                    | Result                                           |
| -------------------------------------------- | ------------------------------------------------ |
| held ball ≤ 1 px at 90 / 120 / Unlimited     | 120: 0.24 ✓ · Unlimited: 0.15 ✓ · **90: 4.84 ✗** |
| held ball ≤ 0.2 px at 60                     | 0.19 ✓                                           |
| walking p99 ≤ 2 mm at 120 and Unlimited      | Unlimited: 0.03 ✓ · **120: 4.9 ✗** (cap pacing)  |
| ≤ 1 % still display frames at Unlimited      | 0 % ✓                                            |
| authoritative trajectories bit-identical     | ✓ (unit test)                                    |
| check, e2e, build                            | ✓ (§5)                                           |
| JS ≤ +1.5 kB, no new draw calls or resources | **+3.0 kB ✗** · draw calls and resources ✓       |
| one-step translation lag documented          | ✓ (§4, `docs/physics.md`)                        |

**Rollback:** revert the change. The renderer then reads `entity.pose` and `state.player.position`
again, and physics needs no change. Triggers: an aim/draw mismatch that breaks interaction, an
object sliding after a discontinuity, the lag rejected on the real display, or physics
invariance failing.

## 9. Limitations

- **Real display: judged by the user, not measured.** All numbers are headless at 300 Hz frames.
  The user confirmed on the real 300 Hz display, with a real mouse, that it feels fine (§11); no
  measurement was taken there.
- **Drawn lag behind the simulation.** The player is drawn up to 3.7 cm behind (7.5 cm running),
  while aiming uses the authoritative eye. A crosshair at an object's very edge may focus it a
  frame early while moving.
- **The 90 and 120 caps** keep their uneven pacing on a 300 Hz display. At 90 the held object
  still wobbles 4.8 px; removing it would mean sampling the view per step in physics (it changes
  what physics computes; out of scope).
- **Held objects near a wall.** Turned with the view between steps, a held object pressed against
  a wall can be drawn up to a frame's turn into it (about 2 cm at 1.5 rad/s, 0.8 m).
- **No permanent frame-pacing test.** The GPU probe was temporary; a permanent bench is task T2.
  The one surviving mutation (§5) depends on it.
- **The bundle cost** is double the plan's estimate.

## 10. Git

Committed on request as "feat: add P3.12 physics render interpolation", on top of `fe17d12`. Not
pushed (the repository has no remote).

- Modified: `src/core/math.ts`, `src/physics/PhysicsSystem.ts`, `src/physics/PhysicsSystem.test.ts`,
  `src/platform/render/WorldRenderer.ts`, `docs/physics.md`.
- New: `src/core/math.test.ts`, this report.
- The temporary probe (dev handle, config, spec) is removed; a copy that reads the drawn poses is
  kept in the session's scratchpad for T2.

## 11. Closure

**Real display (the user).** The user tried the dev build on the laptop's 300 Hz display and
confirmed the experience is fine. A manual checklist was provided:

- turning while holding an object;
- walking while turning;
- the 60 FPS and Unlimited caps, with 90 and 120 optional;
- doors, loads, throws and the launcher;
- the feel of the positional lag.

Which items were tried was not reported. This is a human judgement, not an automated or measured
result.

**Automated, rerun on the exact tree committed:**

| Command                                  | Result                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run check`                          | **PASS** 892/892, 47 files                                                        |
| `npm run test:e2e` (3 workers, no retry) | **PASS** 46/46, 0 failed, 0 flaky, 0 skipped (10.0 min)                           |
| `npm run build`                          | **PASS** — JS 971,492 bytes (28,508 under the 1,000,000-byte limit), CSS 21.74 kB |
| `git diff --check`                       | clean                                                                             |

**Scope.**

- The diff touches only the files listed in §10.
- No line in `src/simulation`, `src/persistence`, `src/gameplay`, `src/world`, `src/game`,
  `src/content`, `main.ts`, `e2e` or `package.json`. So experiment models and results, RunRecord,
  history, CSV, IndexedDB, saves and navigation are unchanged.
- No added line writes the player state, an entity pose or a Rapier body. The only removed lines
  are an import and an object literal, both replaced by extended versions.
