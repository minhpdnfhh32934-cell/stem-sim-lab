# Phase P3.3 report — lighting, materials and the FPS limit

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase p3.3.

**Verdict: PASS WITH LIMITATIONS.** Both parts are built and verified:

- The FPS limit works. Its frame pacing was measured on the real RTX 5070 Laptop GPU, and its
  independence from the simulation is unit-tested.
- The Physics Lab lighting is improved at no measured GPU cost on that GPU.
- `npm run check`, `npm run build` and the full e2e run pass.

Limitations:

- The lighting was judged from headless screenshots; nobody looked at it on a display.
- The cap was measured in headless Edge, whose frames come at about 300 Hz, not on the laptop's
  own display.

## 1. Repository audit and baseline

HEAD was `e9b5ac0` (phase p3.2) on `main`, with a clean working tree. Baseline:

- `npm run check` PASS 441/441.
- `npm run build` PASS (JS 936.70 kB, CSS 20.98 kB).
- No baseline failure.

## 2. Render and physics before the change

- **One frame loop** (`src/main.ts`): `requestAnimationFrame` → `game.update(dt)`, with
  `dt = min(real elapsed, 0.1 s)`. The renderer (`WorldRenderer`) is a system: it draws inside the
  same `update`.
- **Physics** (`PhysicsSystem`): an accumulator of `dt`, fixed steps of `config.physics.fixedStep`,
  at most `maxSubSteps` a frame, and reset on pause.
- **Experiment runs**: fixed internal steps from `dt`. A paused game passes dt 0 to every system
  (P1).
- **Input** (`InputState`): presses and look deltas accumulate until `endFrame()`, after each
  update.
- **Settings**: the language under its own localStorage key (`persistence/settings.ts`), and one
  shared `SettingsPanel` in the main and pause menus.
- **Developer panel FPS**: frames counted over real time. It counts the frames that run.
- **Lighting**: a hemisphere light and a sun for every scene. Scenes marked `lighting: enhanced`
  (only the Physics Lab) add sun shadows (1024², PCF) on floors and objects, plus ACES tone mapping.
  There is no environment map, rejected in 6B for its software-WebGL cost.
- **Materials**:
  - Rooms: `MeshStandardMaterial` per room, fully rough.
  - Items: one of five presets (`LOOKS`) shared by every room.

## 3. FPS limit — design

- **`FrameClock`** (`src/core/FrameClock.ts`, pure). For each display frame the browser offers, it
  says whether the game runs it and with what `dt`. It is used by the existing loop: there is
  still one `requestAnimationFrame` (`src/main.ts`), and no timer.
- **Skipped frames** are neither updated nor drawn, so both CPU and GPU work drop.
- **Frames that run** get the real time since the last frame that ran, still capped at 0.1 s.
  Physics therefore takes its fixed steps for the real time that passed, and runs advance by real
  time. The simulation does not depend on the cap.
- **No burst, no drift.** The cap keeps to its own beat (`next += interval`), so rounding to display
  frames does not drift the rate up. After a stall it starts from now. A tolerance of 1 ms absorbs
  timestamp jitter.
- **Input** between frames is kept for the next frame that runs (accumulated, as before).
- **Why skip whole frames rather than update every frame and draw fewer.** Drawing happens inside
  `game.update` (the renderer is a system). Splitting the two would be a refactor of the loop, and
  updating at the full display rate would keep the CPU busy, which defeats the point of a cap.
- **Options**: 30, 60, 90, 120 FPS and "No limit" ("Không giới hạn"). No limit removes only the
  game's own cap; the browser still paces frames to the display. A cap above the display rate
  changes nothing.
- **When a change applies**: from the next frame, with no reload. Changing it in the pause menu
  keeps the game paused.
- **Developer panel**: `FPS: <measured> (cap <n|none>)`. The measured number counts frames that
  ran, over real time, as before.

## 4. Persistence

- Stored under its own key, `simlab.settings.frameCap`, as `30`, `60`, `90`, `120` or `0`. It sits
  beside the language and is never in the save or the run history. `SAVE_VERSION` and IndexedDB are
  unchanged.
- **Default: no limit.** That is the behaviour before this phase, and it keeps the frame-time bench
  comparable.
- **Fallbacks:**
  - A missing value gives no limit.
  - An invalid value (`45`, `60.0`, `-1`, `Infinity`, empty, `none`) gives no limit and a warning.
  - Storage that cannot be read gives no limit and a warning.
  - Storage that cannot be written keeps the choice until the tab closes, with a warning. The UI
    never claims it was saved.
- The language and the cap are separate keys, and neither touches the other (tested both ways).

## 5. Verification of the cap

| What                                                                                                                                                                        | How                                                                      | Result           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------- |
| Rate on 144, 120 and 60 Hz displays for every cap; a cap above the display rate; no cap = every frame                                                                       | `src/core/FrameClock.test.ts` (fake clock with jitter)                   | PASS, within 2 % |
| Simulated time = real time under every cap; no burst after a 2 s stall; a new cap applies at once                                                                           | same                                                                     | PASS             |
| Physics: fixed steps per second of real time are the same under no cap, 30, 60, 90 and 120                                                                                  | `src/game/frameCap.test.ts` (the real game through FrameClock at 144 Hz) | PASS             |
| A Hooke's law run under no cap, 30, 60 and 120 ends by itself (`model`) at the same simulated time, with identical results and sample count, and the completion is recorded | same                                                                     | PASS             |
| A pause under cap 30 holds the run; resuming takes one ordinary step (≤ 1/30 s), no catch-up                                                                                | same                                                                     | PASS             |
| Default, each cap kept on reload, the language untouched, invalid values, throwing storage                                                                                  | `src/game/Game.test.ts`                                                  | PASS             |
| Settings in the main menu and the pause menu, applied at once, kept on reload, Vietnamese, still paused, 360 px                                                             | `e2e/settings.spec.ts` (new test)                                        | PASS             |
| Frames drawn per second, real GPU                                                                                                                                           | temporary bench (§7)                                                     | see §7           |

Under SwiftShader the menu ran at about 19 FPS with no limit, so the e2e test cannot show the cap
lowering the rate. It checks the wiring and that the measured rate stays under the cap. The real
pacing was measured on the GPU (§7).

## 6. Lighting and materials (Physics Lab only)

The changes are in `WorldRenderer`, enhanced mode only, so only the Physics Lab is affected:

- **Bounce light.** The hemisphere's ground colour goes from `#56606b` to a near-neutral `#a9a8a4`
  (sky `#f2f6ff`, intensity 1.25). The ceiling and undersides are lit as by light off the floor; the
  ceiling no longer renders near-black.
- **Fill light.** One `DirectionalLight` (`#dfe8f5`, 0.7, no shadow map) from low on the side away
  from the sun. Walls facing different ways, and the fronts of desks, read apart. It is hidden in
  basic scenes, so it is left out of their shaders.
- **Room surfaces.** Walls are matte paint (roughness 0.92) and the floor has a slight sheen (0.62).
  Basic rooms keep roughness 1.

Not changed:

- item materials (shared by every room);
- shadow-map size and type;
- tone mapping;
- geometry, positions, physics, the scientific models;
- the other rooms.

The hub screenshot is visually identical before and after.

## 7. Screenshots and performance

All numbers come from the project's bench (`npm run bench`, `playwright.bench.config.ts`) in Edge
headless, at 1280×720, on the production build.

**Physics Lab frame times, before → after** (projectile range; the bench's own scenarios):

| Renderer                          | Scenario      | GPU ms (p95)              | Frame ms      | Draws |
| --------------------------------- | ------------- | ------------------------- | ------------- | ----- |
| RTX 5070 Laptop GPU (ANGLE D3D11) | idle          | 2.27 (2.72) → 2.26 (2.67) | 3.34 → 3.34   | 125   |
|                                   | interacting   | 2.16 (2.75) → 2.15 (2.74) | 3.33 → 3.33   | 99    |
|                                   | running       | 2.30 (2.87) → 2.29 (2.84) | 3.35 → 3.34   | 126   |
|                                   | after landing | 2.26 (2.69) → 2.28 (2.69) | 3.33 → 3.33   | 128   |
| SwiftShader (software)            | idle          | 18.54 → 19.61             | 21.92 → 22.93 | 125   |
|                                   | interacting   | 21.18 → 23.62             | 24.37 → 26.87 | 99    |
|                                   | running       | 25.42 → 26.76             | 28.45 → 29.88 | 126   |
|                                   | after landing | 19.70 → 20.61             | 23.19 → 24.01 | 128   |

- **GPU.** On the RTX 5070 the cost is within noise.
- **SwiftShader.** GPU time rose about 5 % (the interacting scenario 11 %, a noisy one). The e2e
  run stayed green with no timeout or retry raised.
- **Draw calls** are unchanged.

**Frames drawn per second with the cap, real GPU.** Measured with a temporary bench, deleted
afterwards. Headless Edge offered about 300 frames a second. Physics Lab, 3 s per cap:

| Cap      | Display frames/s | Frames drawn/s |
| -------- | ---------------- | -------------- |
| No limit | 300.1            | 300.1          |
| 30       | 300.1            | 29.9           |
| 60       | 299.7            | 59.8           |
| 90       | 300.1            | 90.2           |
| 120      | 300.2            | 120.2          |

**Screenshots.** Real GPU, headless, temporary spec deleted. Before and after, saved in the
session's scratchpad (`p33/before`, `p33/after`):

- the Physics Lab: overview, spring desk, projectile lane, pendulum bay;
- the hub, which is basic.

In the after shots:

- the ceiling is a neutral grey instead of near-black navy;
- the lane's far wall is lighter and the two side walls are better balanced;
- a soft sheen lies on the floor under the sun;
- the tape, the spring, the pendulum and the screens read as before.

## 8. Tests

| Command                                                                                                                    | Result                                        |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `npm run check`                                                                                                            | **PASS** 458/458, 41 files (+17 tests)        |
| `npm run build`                                                                                                            | **PASS**                                      |
| `npx playwright test settings.spec pause.spec menu.spec world.spec vietnamese.spec run-history.spec --project=dev`         | **PASS** 12/12                                |
| `npm run test:e2e` (3 workers, no retry)                                                                                   | **PASS** 44/44, 0 failed, 0 skipped (8.9 min) |
| `npx playwright test -c playwright.bench.config.ts --project=gpu-headless --project=software -g "physics lab frame times"` | **PASS**, §7                                  |
| `git diff --check`                                                                                                         | clean                                         |

The existing test for the language under failing storage now also expects the frame-cap warnings.
That test expects every storage read to log a warning when storage throws, and a second setting
adds two.

## 9. Bundle and dependencies

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 936.70 kB | 939.47 kB | +2.77 kB |
| CSS   | 20.98 kB  | 21.70 kB  | +0.72 kB |

No dependency was added. The JS stays under the 1,000,000-byte budget.

## 10. Limitations

- **Headless measurements.** The GPU numbers come from headless Edge, at about 300 frames a second
  with no display. On the laptop's own screen, rAF follows its refresh rate. Caps at or above that
  rate change nothing there, which is correct, but it was not measured.
- **The lighting** was judged from headless screenshots on the real GPU. Nobody looked at it on a
  display, at other resolutions, or with the HDR or colour settings of a real screen.
- **SwiftShader** frames are about 5 % slower in the Physics Lab. This affects e2e speed, not
  results.
- **Item materials** (metal, glass and so on) are shared by all rooms and were not changed. Without
  an environment map, metals still look flat.
- **The cap paces whole frames.** At 30 FPS the game also reads input and steps the world at
  30 Hz: the same simulated motion, in coarser frames.
- **Measured FPS.** The developer panel's FPS is the frames that ran. With no limit it shows the
  browser's pace, not a promise of more.

## 11. Git

- Base `e9b5ac0`; committed as phase p3.3, not pushed.
- `git diff --stat`: 13 files, +331 −21.
- New files: `src/core/FrameClock.ts`, `src/core/FrameClock.test.ts`, `src/game/frameCap.test.ts`
  and this report.
- The temporary specs `e2e/zz-cap.bench.ts` and `e2e/zz-look.bench.ts` were deleted.

## 12. Next

- An environment map on capable GPUs only, chosen by the measured renderer or a graphics-quality
  setting, so metals and glass read as such.
- Item materials per room or per item, starting with the Physics Lab's apparatus.
- A hands-on look at the lighting and the cap on the laptop's display.
