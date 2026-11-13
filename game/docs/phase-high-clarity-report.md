# High clarity — the room light's veil in the pendulum bay

Under High, the Physics Lab's image-based room light (three's `RoomEnvironment`) lit every surface
facing +z from the front. The pendulum bay is seen looking −z, so its back wall and navy sign
carried a veil: 24 % brighter than under Medium, their darks lifted. The room light is now turned
so that its brightest panel shines from above, and the hemisphere light gives way in full, so
High keeps Medium's brightness and adds its reflections.

The rendering change is two constants in `WorldRenderer`. It changes no shader, texture, geometry
or draw call, and no code outside the renderer. A new e2e pixel check guards it. The High
environment intensity stays at the pre-existing 0.08.

## 1. Verdict

**PARTIAL.**

- Met:
  - every brightness target of the brief, in all five views (§6);
  - `npm run check`, `npm run build`, the full e2e suite (with a new pendulum-bay pixel check)
    and `git diff --check` (§8);
  - draw calls and GPU time unchanged (§9).
- Not met cleanly: edge strength.
  - By the brief's metric it is 1–4 % below Medium in all five views, and 3–6 % below the
    pre-run High in three of them (§7).
  - It comes from lighting (no blur was introduced), but it is a measured decrease.
- Real display: the user checked it on the laptop's display, confirmed that it looks fine, and
  kept it (§15). Every image in this report is still a headless GPU screenshot.

## 2. Baseline

| Item               | Result                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD      | `main` / `4343ae6` (P3.12)                                                                                                               |
| Tree               | `quality.ts` (High environment 0.25 → 0.08) and `docs/game-core.md` (its sentence), both uncommitted from the earlier High clarity steps |
| `npm run check`    | **PASS** 892/892, 47 files                                                                                                               |
| `npm run test:e2e` | **PASS** 46/46, 0 failed, 0 flaky (9.7 min)                                                                                              |
| `npm run build`    | **PASS** — JS 971,492 bytes, CSS 21.74 kB                                                                                                |

**The method** (unchanged from the earlier High clarity steps; scripts hash-checked).

- Captures:
  - production build (`playwright.bench.config.ts`, project `gpu-headless`);
  - Edge headless on the real GPU: ANGLE (NVIDIA GeForce RTX 5070 Laptop GPU, Direct3D11);
  - 1280×720, Continue from a fixed save per view, Medium and High.
- Views: lab overview, projectile range, pendulum bay, free-fall desk, the steel ball close up,
  and the P3.11 "up" view.
- The spec was a temporary copy of the P3.11 shots bench, deleted after every capture.
- Captures are deterministic: B0 below reproduced the earlier 0.08 capture's statistics exactly.
- **Far regions** (fixed rectangles):
  - luminance is Rec. 709 on the sRGB values (0–255), sampled at stride 2;
  - mean;
  - dark lift = High's darkest 5 % minus Medium's;
  - High's brightest 5 %;
  - edge = mean |ΔL| to the right and down neighbours.
- **Matte patches:** 17 wall, ceiling and floor patches in four views. Each is converted to
  scene-linear light through the inverse of three's ACES fit and the exposure, and High is
  compared with Medium in %.

**Before this run**: High minus Medium, far regions:

| Environment      | Mean: overview / range / bay / desk | Dark lift: bay / range |
| ---------------- | ----------------------------------- | ---------------------- |
| 0.25 (P3.5)      | +8.2 / +9.8 / +29.9 / +4.7          | +37.1 / +7.2           |
| 0.12             | +4.0 / +5.4 / +17.7 / +2.9          | +19.4 / +3.2           |
| 0.08 (this "B0") | +2.7 / +3.9 / +12.5 / +1.7          | +13.4 / +2.0           |

At 0.08 the bay still failed two of the brief's targets: mean within 8 of Medium, and dark lift
at most 10.

## 3. Investigation

**Confirmed cause: one panel of the generated room, front-lighting +z faces.**

- High's extra light on a matte surface grows in proportion to the environment intensity. Per
  unit of intensity it was the same at 0.25, 0.12 and 0.08. On the bay's back wall it was 1.05,
  1.08 and 1.04, in scene-linear units in which that wall reads 0.35 under Medium.
- It depends on the way the surface faces:

| Facing          | Extra light per unit intensity (scene-linear) | At 0.08, brighter than Medium by |
| --------------- | --------------------------------------------: | -------------------------------: |
| +z (walls)      |                                      1.0–1.09 |                         +23–24 % |
| up (floors)     |                                     0.17–0.33 |                          +5–10 % |
| down (ceilings) |                                     0.19–0.25 |                           +5–6 % |
| +x              |                                          0.30 |                           +5.7 % |
| −x              |                                          0.13 |                             +3 % |
| −z              |                                     0.05–0.07 |                           +1–2 % |

- The lobe points about 35° above the horizon towards +z. That is `RoomEnvironment`'s largest
  panel (strength 43, 4.4 × 5.4 m, at 31° towards +z) and the ceiling it lights.
- The pendulum bay is seen looking −z, so its back wall and navy sign face that panel: hence
  the bay's +12.5 mean and +13.4 dark lift at 0.08.

**Confirmed second cause: the hemisphere did not give way enough.**

- P3.5 dimmed the hemisphere by 3 × the environment intensity, set by eye ("it keeps its
  brightness").
- Measured, every patch stayed brighter than under Medium at every intensity.

**Ruled out** (audit of the render path): fog, post-processing, resolution, MSAA, depth
precision. None differs between Medium and High.

**Plausible, not pursued.** Canvas textures (signs, scales, screens) use anisotropy 1, apart from
the floor tape's 4, so they blur at grazing angles. That is the same at every quality, so it
cannot explain a High-only veil.

**Limit of the method.** In the overview and desk views the darkest 5 % are unlit screens
(`MeshBasicMaterial`): 15.4 at both qualities. The dark-lift target is therefore only sensitive
in the bay and the range, whose darkest pixels are lit navy signs.

## 4. Experiments

One variable at a time, each reversible, at environment 0.08.

**E1 — turn the room light** (`scene.environmentRotation.x`, nothing else).

- −55° (the panel nearly overhead) over-corrected: −z walls became the brightest (+12 %).
- −40° balanced +z and −z (+7.7 % and +9.4 %).
- The bay then met its targets (+4.3 mean, +3.3 dark lift).
- Every surface was still 3–11 % brighter than under Medium. The veil was spread evenly rather
  than removed: the desk view rose from +1.7 to +5.7.

**E2 — the hemisphere factor**, with the turn held at −40°.

- Measuring at 3 and 6 gives each patch's factor for Medium's brightness, by the linear model:
  - walls 3.8–5.1, median 4.9;
  - ceilings 4.2–4.6;
  - floors 5.1–9.0;
  - least squares over all 17 patches: 4.8.
- 4.9, measured, landed where the model predicted: within 0.7 points on every patch.

**E2 alone** (factor 4.9, no turn): the check that the turn is needed.

- +z walls stayed +17 % and −z walls fell to −7 %.
- The bay failed both targets (+9.2 mean, +12.2 dark lift).
- One factor cannot remove a light that comes from one side.

Matte patches, High brighter than Medium (scene-linear):

| Patch (facing)            |      B0 | E1 −40° | E2 alone | Final (E1 + E2) |
| ------------------------- | ------: | ------: | -------: | --------------: |
| bay back wall, left (+z)  | +23.9 % |  +7.7 % |  +17.2 % |           0.0 % |
| bay back wall, right (+z) | +23.8 % |  +7.6 % |  +17.1 % |          −0.1 % |
| bay side wall, left (+x)  |  +5.7 % |  +5.7 % |   −1.2 % |          −1.1 % |
| bay side wall, right (−x) |  +3.3 % |  +3.3 % |   −4.3 % |          −4.3 % |
| bay ceiling               |  +5.2 % |  +3.6 % |   +0.2 % |          −1.5 % |
| bay floor                 |  +4.8 % |  +7.0 % |   −1.2 % |          +1.0 % |
| overview far wall (−x)    |  +3.3 % |  +3.3 % |   −4.3 % |          −4.3 % |
| overview left wall (+z)   | +24.4 % |  +7.9 % |  +17.4 % |          −0.2 % |
| overview right wall (−z)  |  +1.3 % |  +9.4 % |   −7.0 % |          +0.2 % |
| overview ceiling          |  +6.0 % |  +4.6 % |   +0.1 % |          −1.4 % |
| overview floor            |  +7.7 % | +10.3 % |   +4.1 % |          +6.0 % |
| range left wall (+z)      | +23.4 % |  +6.7 % |  +16.9 % |          −0.1 % |
| range right wall (−z)     |  +1.7 % |  +9.2 % |   −6.9 % |          +1.2 % |
| range ceiling             |  +5.0 % |  +3.4 % |   +0.1 % |          −1.3 % |
| range floor               | +10.2 % | +11.0 % |   +6.7 % |          +7.3 % |
| desk wall (−z)            |  +1.3 % |  +9.4 % |   −7.0 % |          +1.2 % |
| desk ceiling              |  +5.1 % |  +3.5 % |   −0.0 % |          −1.5 % |

Far regions, High minus Medium: mean / dark lift / High's brightest 5 %:

| View       | Medium mean | B0                    | E1 −40°             | E2 alone             | Final               |
| ---------- | ----------: | --------------------- | ------------------- | -------------------- | ------------------- |
| overview   |       148.3 | +2.7 / 0.0 / 181.8    | +2.7 / 0.0 / 182.6  | −1.5 / 0.0 / 179.6   | −1.5 / 0.0 / 180.6  |
| range      |       155.1 | +3.9 / +2.0 / 189.8   | +3.6 / +2.0 / 180.9 | −1.2 / +0.4 / 186.6  | −1.5 / +0.4 / 176.6 |
| bay        |       163.9 | +12.5 / +13.4 / 192.3 | +4.3 / +3.3 / 183.3 | +9.2 / +12.2 / 188.3 | 0.0 / +2.2 / 178.4  |
| desk       |       154.5 | +1.7 / 0.0 / 209.5    | +5.7 / 0.0 / 209.5  | −3.3 / 0.0 / 209.5   | +0.7 / 0.0 / 209.5  |
| steel ball |       179.8 | +5.7 / +4.0 / 216.6   | +8.0 / +7.1 / 217.6 | +3.8 / +1.0 / 215.7  | +6.3 / +4.9 / 216.6 |

The two changes only work together:

- the turn makes High's extra light the same from every side;
- the factor then removes it.

## 5. Implementation

**`src/platform/render/WorldRenderer.ts`**: two documented constants, applied in
`applyQuality` (on scene load and on a quality change, never per frame).

- `ROOM_LIGHT_TILT = -40 * DEG`: `scene.environmentRotation.x`, which turns the prefiltered room
  light. The texture is the same; it is not regenerated.
- `HEMISPHERE_GIVES_WAY = 4.9`: the hemisphere's intensity is its base (1.25 enhanced, 1.6
  basic) minus 4.9 × the environment intensity. It was 3 ×.
- Under Low and Medium (environment 0) and in basic scenes, the hemisphere is unchanged, and the
  rotation has nothing to turn.

**`src/platform/render/quality.ts`**: the `environment` doc comment no longer says "three times
as much". It names the constant and its purpose: High keeps Medium's brightness. The
pre-existing `environment: 0.08` line is untouched.

**`docs/game-core.md`**: one sentence on the turn and the factor, and a link to this report.

**`e2e/settings.spec.ts`**: a pixel check that High keeps Medium's brightness in the bay (§8).

**The final code reproduces the experiment.** The experiments used −0.698 rad and the code
−40° (−0.69813). The final capture differs from E1 + E2 by at most 1 level on under 0.2 % of
channel values, and every statistic is the same. Medium is unchanged: identical pixels, apart
from 3 channel values (±1) in one view.

## 6. Acceptance (the brief's targets, final against Medium)

| Target                                                | Overview                         | Range | Bay           | Desk                                       | Steel ball           | Result  |
| ----------------------------------------------------- | -------------------------------- | ----- | ------------- | ------------------------------------------ | -------------------- | ------- |
| Mean within 8                                         | −1.5                             | −1.5  | 0.0           | +0.7                                       | +6.3                 | met     |
| Dark lift ≤ 10                                        | 0.0                              | +0.4  | +2.2          | 0.0                                        | +4.9                 | met     |
| Brightest 5 % ≤ 200 (unless Medium's region is above) | 180.6                            | 176.6 | 178.4         | 209.5 (= Medium, the unlit station screen) | 216.6 (Medium 214.6) | met     |
| Edge strength: no meaningful regression               | see §7                           |       |               |                                            |                      | partly  |
| Metallic reflections visible and plausible            | —                                | —     | brass bob lit | tower glint gone                           | visible, from above  | see §10 |
| Draw calls, GPU time                                  | 265 draws, GPU within noise (§9) |       |               |                                            |                      | met     |

The P3.11 ceiling, measured on the GPU "up" capture under High, reads ceiling 173.1, wall 167.4
and lamp 228.0. The test needs at least 157.4 and at most 208, so it passes. High's wall now
equals Medium's (167.3).

## 7. Edge strength

Mean gradient of display luminance, in far regions; final High against Medium and against the
pre-run High (B0). The brief's metric samples at stride 2. "Every pixel" is the same measure over
all pixels: it is less swayed by 1-px features that happen to fall on even columns.

| View       | Medium (stride 2) | Final, stride 2 | vs Medium |  vs B0 | Final, every pixel: vs Medium |  vs B0 |
| ---------- | ----------------: | --------------: | --------: | -----: | ----------------------------: | -----: |
| overview   |              5.67 |            5.58 |    −1.6 % | −0.1 % |                        −1.9 % | −0.3 % |
| range      |              3.80 |            3.64 |    −4.3 % | −3.4 % |                        −4.7 % | −3.9 % |
| bay        |              2.48 |            2.43 |    −2.1 % | −5.6 % |                        −1.8 % | −3.6 % |
| desk       |              3.65 |            3.55 |    −2.7 % | −5.3 % |                        −1.2 % | −1.8 % |
| steel ball |             12.81 |           12.64 |    −1.3 % | −0.9 % |                        +0.7 % | +1.4 % |

Where it comes from. The change only alters lighting values; resolution, filtering, MSAA and
post-processing are unchanged, so the edges are not blurred. They are fainter in three ways:

- **Bay and desk: the front-light itself raised them.**
  - A surface lit 24 % brighter has larger steps between its light and dark parts.
  - The earlier High clarity steps, kept after review, moved the same way. The bay's edge read
    2.65 at 0.25, 2.61 at 0.12 and 2.57 at 0.08, while its veil shrank. In these two views the
    metric follows the front-light, not the haze.
- **Desk: a glint is gone.**
  - At B0 the panel drew a thin bright line along the free-fall tower's right edge. Medium has
    none.
  - Tile by tile, the tower's column carries most of the desk change.
- **Range: its far wall is dimmer than under Medium.**
  - The wall faces −x, where one factor over-compensates (−4.3 %), so the sign's text has a
    little less contrast.
  - Here the earlier steps had raised the metric (−3.4 % at 0.25, −0.9 % at 0.08). Its −4.3 %
    is now the lowest of any state: the clearest regression.
- **Overview and steel ball:** close to the 0.08 state.
  - Overview: −1.6 % against −1.5 % at 0.08.
  - Steel ball: −1.3 % against −0.4 % at 0.08 by stride 2; +0.7 % against −0.7 % over every
    pixel.

## 8. Tests

| Command                                                  | Result                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run check`                                          | **PASS** 892/892, 47 files (before and after the new e2e check)                       |
| `npm run build`                                          | **PASS** — JS 971,540 bytes                                                           |
| `npm run test:e2e`, final renderer, before the new check | **PASS** 46/46, 0 failed, 0 flaky (9.8 min); P3.11 ceiling at Low, Medium and High    |
| `npm run test:e2e`, final tree, with the new check       | **PASS** 47/47, 0 failed, 0 flaky (9.7 min); the new check and the P3.11 ceiling pass |
| `git diff --check`                                       | clean                                                                                 |

**New e2e check** (`e2e/settings.spec.ts`, "Physics Lab pendulum bay: as bright under High as
under Medium, no veil from the room light").

- From the bay's view (looking −z), it reads three points under Medium and then High:
  - the back wall above the sign;
  - the back wall beside the rig;
  - the sign's navy.
- It requires each to stay within 6 levels.
- Its catch was verified by swapping only `WorldRenderer.ts`, temporarily, then restoring the
  final file (checksum):

| Renderer               | Wall above the sign | Wall beside the rig | Sign        | Check         |
| ---------------------- | ------------------- | ------------------- | ----------- | ------------- |
| Final                  | 179.1 → 178.4       | 179.1 → 178.4       | 24.1 → 26.3 | passes        |
| Pre-run (HEAD)         | 179.1 → 192.3       | 179.1 → 192.3       | 24.1 → 37.0 | fails (+13.2) |
| Final without the turn | 179.1 → 188.3       | 179.1 → 188.3       | 24.1 → 35.3 | fails (+9.2)  |

- These are SwiftShader values (the e2e renderer). They match the GPU captures to within a
  level.
- The check guards the veil, not the factor's exact value. With the factor back at 3 (E1
  alone) the GPU captures read +4.7 on the wall: within 6.

## 9. Performance

`gpu-headless` frame-times bench, 5 s on the lab overview at High. Production build, ANGLE
(NVIDIA GeForce RTX 5070 Laptop GPU, Direct3D11), 1280×720, on AC power. Pre-run renderer and
final renderer were interleaved three times, swapping only `WorldRenderer.ts`:

| Round | Pre-run: fps / GPU ms / draws | Final: fps / GPU ms / draws |
| ----- | ----------------------------- | --------------------------- |
| 1     | 240.0 / 2.74 / 265            | 204.8 / 2.77 / 265          |
| 2     | 240.0 / 2.67 / 265            | 240.0 / 2.63 / 265          |
| 3     | 240.0 / 2.70 / 265            | 240.0 / 2.75 / 265          |

- GPU time: means 2.70 and 2.72 ms, within the run-to-run spread.
- Draw calls: identical in every run.
- The one 204.8 fps round: the headless compositor's pacing (frame 4.88 ms against a CPU time of
  1.15 ms and a GPU time of 2.77 ms). B0 had shown 204.5 fps earlier in the run.
- By construction the change alters two values the shaders already read, so no program, texture
  or draw changes.
- SwiftShader timing was not measured.

## 10. Visual validation — headless screenshots only

Looked at on crops of the GPU captures (not on the physical display):

- **Pendulum bay:**
  - Under B0 the back wall was lighter and the navy sign greyish, against Medium.
  - In the final capture both match Medium; the brass bob keeps its highlight.
- **Steel ball close up:** reflections are visible. The bright part now sits on top (the panel
  overhead, as the lab's lamps are), rather than facing the viewer.
- **Free-fall tower:** the panel's thin glint along one edge is gone; the column reads as under
  Medium.
- **Range:** the far wall and its sign are slightly darker than under Medium.

Under the ball, the sun's shadow on the floor is a little lighter than under Medium. Floors get
1–7 % more light under High (B0: 5–10 %).

## 11. Limitations

- The real-display check (§15) is the user's judgement by eye. Nothing was measured on the
  physical display.
- One factor cannot fit every facing:
  - −x walls are 4.3 % darker than under Medium;
  - floors are up to 7.3 % brighter;
  - ceilings are 1.5 % darker.
- Edge strength is slightly below Medium's (§7).
- Fixed views on one GPU. The e2e suite checks behaviour and the P3.11 ceiling on SwiftShader,
  not appearance.
- The capture and analysis scripts lived in the session's scratchpad, not the repository. §2
  describes the method so it can be repeated.

## 12. Rollback

Each change reverts on its own, and none touches the pre-existing 0.08:

- **Turn:** delete `ROOM_LIGHT_TILT`, its comment, and the `environmentRotation.x` line in
  `applyQuality`.
- **Factor:** set `HEMISPHERE_GIVES_WAY` to 3, or inline `3 * environment` as before, and restore
  `quality.ts`'s comment.
- **Both:**
  - `WorldRenderer.ts` has no other uncommitted change, so its committed version
    (`git show HEAD:src/platform/render/WorldRenderer.ts`) is its pre-run state;
  - revert the two `quality.ts` comment lines and the `game-core.md` sentence and link;
  - remove the pendulum bay check from `e2e/settings.spec.ts` (it would fail without the turn);
  - delete this report.

## 13. Next step

1. Done: the user looked at High against Medium on the real display and kept the change (§15).
   The suggested views were:
   - the pendulum bay (the veil should be gone);
   - the projectile range's far wall and sign (slightly darker than under Medium);
   - the free-fall tower and the steel ball (reflections).
2. Nothing further is planned.
3. If the range's sign ever reads dim, the one follow-up worth measuring is the factor at 4.5.
   - The linear model predicts:
     - −x walls −2.6 % instead of −4.3 %;
     - ±z walls +1.4 to +3.1 % instead of −0.2 to +1.2 %;
     - floors up to +8.1 %.
   - Cost: one constant and one capture.
   - It was not measured in this run.

## 14. Git

Committed as one commit, `feat: refine high preset lighting clarity`, together with the
environment 0.08 from the earlier High clarity steps. Not pushed.

| File                                   | Content                                                              |
| -------------------------------------- | -------------------------------------------------------------------- |
| `src/platform/render/quality.ts`       | High environment 0.25 → 0.08 (earlier steps) and the doc comment     |
| `docs/game-core.md`                    | the 0.08 sentence (earlier steps), the turn and the factor, the link |
| `src/platform/render/WorldRenderer.ts` | `ROOM_LIGHT_TILT`, `HEMISPHERE_GIVES_WAY`                            |
| `e2e/settings.spec.ts`                 | the pendulum bay check                                               |
| `docs/phase-high-clarity-report.md`    | this report (new)                                                    |

## 15. Closure

**Real display (the user).** The user checked the High-clarity changes directly on the laptop's
display and confirmed that they look fine. Which views were looked at was not reported. This is a
human judgement, not an automated or measured result.

**Automated, rerun on the exact tree committed:**

| Command            | Result                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| `npm run check`    | **PASS** 892/892, 47 files                                                             |
| `npm run test:e2e` | **PASS** 47/47, 0 failed, 0 flaky (10.1 min); the bay check and the P3.11 ceiling pass |
| `npm run build`    | **PASS** — JS 971,540 bytes (28,460 under the 1,000,000-byte limit), CSS 21.74 kB      |
| `git diff --check` | clean                                                                                  |

**Scope.**

- The diff touches only the five files in §14.
- No line in `src/physics`, `src/simulation`, `src/persistence`, `src/gameplay`, `src/world`,
  `src/game`, `src/content`, `main.ts` or `package.json`. So physics, input, experiments,
  `StationSystem`, RunRecord and history, CSV, IndexedDB, saves and navigation are unchanged.
- In `WorldRenderer.ts` only the constants block and `applyQuality` change. The P3.12 render
  interpolation (`renderPlayer`, `renderPose`) is untouched.
