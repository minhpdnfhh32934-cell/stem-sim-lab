# Phase P3.11 — The Physics Lab ceiling lighting balance

The Physics Lab's ceilings (main room, projectile range, pendulum bay) are painted near-white but
rendered as a flat dark grey, darker than their walls. They now read as lit: level with the walls
and below the lamp panels, at every graphics quality.

The change is one material setting. It adds no light, no geometry, no texture and no draw call.

## 1. Verdict

**PASS WITH LIMITATIONS.**

- `npm run check`, `npm run build`, the Physics Lab and pixel e2e specs (including a new ceiling
  check) and the full e2e suite pass (§5).
- The GPU and SwiftShader costs are within noise, and the bundle grows 67 bytes.
- The limitations are in §9:
  - the visual check was done on headless GPU screenshots, not by a person on a real display;
  - the glow is uniform, with no falloff around the lamps.

## 2. Baseline

| Item               | Result                                                             |
| ------------------ | ------------------------------------------------------------------ |
| Branch / HEAD      | `main` / `1fbd6e8` (P3.10), clean tree                             |
| `npm run check`    | **PASS** 879/879, 46 files                                         |
| `npm run test:e2e` | **PASS** 45/45, 0 failed, 0 skipped (9.8 min, 3 workers, no retry) |
| `npm run build`    | **PASS** — JS 968.40 kB (968,403 bytes), CSS 21.74 kB              |
| Power              | AC throughout (`PowerOnline` True at every bench)                  |

**The problem, measured.**

- Luminance (0–255, Rec. 709 on sRGB) was sampled at fixed screen points of headless GPU
  screenshots (RTX 5070, 1280×720), in two views:
  - "up": from the middle of the lab, looking up at its north wall;
  - "overview": the lab from its west end, as a player first sees it.

| View, quality        | Ceiling |     Walls | Lamp panels | Floor |
| -------------------- | ------: | --------: | ----------: | ----: |
| up, Low and Medium   |     113 | 167 / 190 |         228 |   175 |
| up, High             |     137 | 170 / 200 |         230 |   196 |
| overview, Low/Medium |     113 |   167–179 |         228 |   177 |
| overview, High       |     137 |   170–210 |         230 |   190 |

- The ceiling paint (`#f7f8fa`) is the whitest in the room, yet it rendered about 35 % darker
  than the walls.
- Every sampled ceiling point gave the same value: the ceiling was uniformly dark.
- The cause is in `WorldRenderer.setLighting`. In enhanced scenes a downward-facing surface
  receives only the hemisphere light's ground colour (`#a9a8a4` × 1.25). The sun and the fill
  light point down or sideways, and the lamp panels are emissive boxes that light nothing.
- High was lighter (137) only because of its image-based room light.

## 3. Implementation

- **`src/platform/render/WorldRenderer.ts`:**
  - In enhanced scenes the ceiling material gets an emissive term in its own colour,
    `emissiveIntensity` `CEILING_GLOW` = 0.2: a soft glow of its own, standing in for the lamps'
    light and the bounce off the walls.
  - The constant is documented with the measurement that set it.
  - Basic scenes (every room outside the Physics Lab) are unchanged: no glow.
- **Calibration** (temporary probes, reverted). The values tried, measured at all three qualities:

  | Glow | Ceiling, Low and Medium | Ceiling, High | Walls, floor, lamps      |
  | ---: | ----------------------: | ------------: | ------------------------ |
  |    0 |                     113 |           137 | (baseline)               |
  |  0.2 |                     174 |           184 | unchanged at every point |
  | 0.35 |                     196 |           202 | unchanged at every point |

  0.2 brings the ceiling level with the walls (167–210) at every quality and keeps it well below
  the lamps (228–230). 0.35 crowds the lamps and flattens the room. One value works at every
  quality, so no per-quality setting was added.

- **Tests:**
  - **`e2e/settings.spec.ts`** gets a new test, "Physics Lab ceiling: lit level with its walls
    and darker than its lamps, under Low, Medium and High". It continues into the lab looking up
    from the middle, then switches quality through the pause menu as a player does. At each
    quality it reads screen pixels: two ceiling points, a wall point and a lamp point. Each
    ceiling point must be ≥ the wall − 10 and ≤ the lamp − 20.
  - **`e2e/support.ts`:** the 1×1-screenshot `pixel()` helper moved here from `world.spec.ts`,
    which now imports it. Its behaviour is unchanged.
- **Docs:** `docs/game-core.md` (graphics quality: the ceiling's glow, and where it is checked).

## 4. Preservation

**Untouched:**

- every experiment, collider and interaction;
- StationSystem, RunRecord, CSV, IndexedDB and the save;
- FrameClock, the single RAF and the quality presets (`quality.ts`);
- the lights themselves (hemisphere, sun, fill, environment);
- walls, floors, the lamp panels and every item's look.

**On screen:** the sampled wall, floor and lamp points are identical before and after, to the last
level, at all three qualities.

## 5. Tests

| Command                                                                                                | Result                                                                             |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `npm run check`                                                                                        | **PASS** 879/879, 46 files                                                         |
| `npm run build`                                                                                        | **PASS**                                                                           |
| `npx playwright test settings.spec world.spec experiment.spec free-fall.spec pendulum.spec hooke.spec` | **PASS** 9/9 (3.3 min)                                                             |
| `npm run test:e2e` (3 workers, no retry)                                                               | **PASS** 46/46 (45 + the new ceiling test), 0 failed, 0 flaky, 0 skipped (9.7 min) |
| `git diff --check`                                                                                     | clean                                                                              |

**The new e2e check catches both failures** (temporary mutations, reverted):

| Mutation   | Result                                                      |
| ---------- | ----------------------------------------------------------- |
| glow = 0   | fails at Medium: ceiling 113 against wall 167 (needs ≥ 157) |
| glow = 0.6 | fails at Medium: ceiling 216 against lamp 228 (needs ≤ 208) |
| glow = 0.2 | passes at Low, Medium and High                              |

The check runs on SwiftShader, which measured the same ceiling values as the GPU (113 before).

No unit test was added. The change is one material parameter inside `WorldRenderer`, which needs
WebGL, so it is checked where it shows: on screen pixels.

## 6. Performance

The bench was a temporary scenario (deleted): the production build, Edge headless, 1280×720, the
lab overview with the ceiling in view, 5 s, AC.

**RTX 5070 Laptop GPU (ANGLE D3D11), gpu-headless, 300 fps.** Two rounds each:

| Quality |     GPU ms before → after |     CPU ms before → after | Draw calls |
| ------- | ------------------------: | ------------------------: | ---------: |
| Medium  | 2.11 / 2.22 → 2.19 / 2.19 | 1.10 / 1.07 → 1.12 / 1.08 |  265 → 265 |
| High    | 2.22 / 2.29 → 2.32 / 2.32 | 1.18 / 1.15 → 1.14 / 1.15 |  265 → 265 |

The GPU numbers are within noise. That is expected: three.js computes the emissive term in every
standard material already, so this sets a value and adds no shader work.

**SwiftShader** (Medium):

- The first pair of runs, minutes apart, read 26.3 → 21.3 fps.
- Alternating runs on the same tree state then read 23.5 / 22.9 fps before and 23.3 / 23.2 fps
  after: no difference.
- The first pair was drift in the machine's software-rendering speed between runs, not the
  change. The alternating runs are the comparison.

**Resources.** The leak probe (temporary e2e, deleted) looked up at the lab ceiling and did five
Physics Lab ↔ hub round trips:

| Tree   |            Start | After each of the 5 round trips |
| ------ | ---------------: | ------------------------------: |
| before | 476 buf / 17 tex |      531 buf / 22 tex, all five |
| after  | 476 buf / 17 tex |      531 buf / 22 tex, all five |

They are identical: no resource was added and none leaks. The ceiling material is created and
freed per room as before.

## 7. Bundle

| Asset | Before                | After                 | Delta     |
| ----- | --------------------- | --------------------- | --------- |
| JS    | 968.40 kB (968,403 B) | 968.47 kB (968,470 B) | +67 bytes |
| CSS   | 21.74 kB              | 21.74 kB              | 0         |

31,530 bytes are left under the 1,000,000-byte menu limit (`e2e/production.spec.ts`).

## 8. Visual validation

**Method.**

- Headless screenshots on the real GPU (RTX 5070, ANGLE D3D11), 1280×720, through Continue from a
  save, saved in the session's scratchpad (`p311/before`, `p311/after`, and the probe sets
  `p311/probe-0.2` and `p311/probe-0.35`).
- Five views at Low, Medium and High (15 shots each), before and after:
  - "up" and "overview" (measured above);
  - the free-fall desk view;
  - the pendulum bay;
  - the projectile range.

**What the after shots show:**

- In the lab, the bay and the range the ceiling reads as a lit light-grey surface.
- The lamp panels are still the brightest things on it.
- The walls, floor, apparatus and screens look as before; the samples are identical.
- No clipping to white at High, where the ceiling is brightest (184).

**Not done:** nobody looked at a real display, or at other resolutions or display settings.

## 9. Limitations

- **The glow is uniform.** There is no falloff or pool of light around the lamps: the ceiling is
  evenly lit. That is plausible for an indirectly lit lab, but it is not a simulation of the lamps.
  Real lights or light maps were out of scope (cost, and the brief's guardrails).
- **No real-display validation.** Only headless GPU screenshots and pixel samples.
- **Pixel thresholds are tuned to this view.** The e2e check reads four screen points from one
  camera pose, with margins of 10 and 20 levels. A change of camera field of view, HUD layout or
  room content in that view would need the points re-chosen.
- **One quality-independent value.** High ends a little brighter (184) than Low/Medium (174),
  because its room light adds to the glow; both are within the walls' range.

## 10. Git

Committed on request as "phase p3.11", on top of `1fbd6e8`. Not pushed (the repository has no remote).

- Modified: `src/platform/render/WorldRenderer.ts`, `e2e/settings.spec.ts`, `e2e/support.ts`,
  `e2e/world.spec.ts`, `docs/game-core.md`.
- New: this report.
- Deleted again: the temporary shot/bench spec, leak probe and calibration probes.
