# Phase P3.5 report — graphics quality and environment lighting

Date: 2026-10-26 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase p3.5.

**Verdict: PASS WITH LIMITATIONS.**

- A typed graphics quality setting (Low / Medium / High) is in place. It is stored apart from the
  save, applied in one place, at once.
- Environment lighting was tried with a generated room and no asset. It is kept for High only.
- `npm run check`, `npm run build` and the full e2e run pass.
- GPU and SwiftShader benchmarks were run.

Limitations:

- The visual judgement comes from headless captures on the real GPU, not from a person at a
  display.
- The environment light's GPU cost could not be resolved at 300 frames a second.

**Decision: KEEP WITH LIMITATIONS** (§9).

## 1. Repository and baseline

HEAD `025b4fe` (phase p3.4) on `main`; clean tree, `git diff --check` clean. Baseline:

- `npm run check` PASS 458/458.
- `npm run build` PASS (JS 939.56 kB, CSS 21.70 kB).
- **E2E.** The baseline run started in this phase was stopped: I began editing source while it
  ran on the dev server, which would have reloaded its pages. The baseline evidence is therefore
  the full run at the end of P3.4, on the same tree as `025b4fe`: **44/44 PASS**.
- The two dev servers that run left behind were stopped.

## 2. Renderer audit (before the change)

- **Renderer**: `THREE.WebGLRenderer` (WebGL2), three 0.186:
  - `antialias` from config (true), pixel ratio min(device, 2);
  - default sRGB output and colour management;
  - no `powerPreference`, no `preserveDrawingBuffer`;
  - PCF shadow map;
  - ACES tone mapping at exposure 1.05 in enhanced scenes, none in basic.
- **Lights**:
  - a hemisphere light and a sun (directional) in every scene;
  - in enhanced scenes, the sun casts the one shadow (1024²), and a directional fill light without
    shadow is added (P3.3);
  - no ambient, point or spot lights.
- **Materials**:
  - `MeshStandardMaterial` for rooms, items and apparatus (the P3.4 palette in
    `render/looks.ts`);
  - `MeshBasicMaterial` for screens, labels, pointer and protractor; `LineBasicMaterial` for the
    trail;
  - no Physical or Shader materials.
- **Scene**: a colour background (`#151a20`); no fog, environment, skybox, PMREM or HDR.
- **Settings**: language and frame-rate cap. Each is stored under its own key in
  `persistence/settings.ts` and shown by the one shared `SettingsPanel` in the main and pause
  menus.

## 3. Graphics quality

- **Type**: `GRAPHICS_QUALITIES = ['low', 'medium', 'high']`, `GraphicsQuality`, default `'medium'`
  (`persistence/settings.ts`).
- **Persistence**: `simlab.settings.graphicsQuality`, beside the language and the cap. It is never
  in the save, the RunRecords or IndexedDB.
  - An unknown value gives medium and a warning.
  - Unreadable storage gives medium and a warning.
  - Unwritable storage keeps the choice until the tab closes, with a warning; the UI never claims
    it was saved.
  - The three settings now share one load and save pair. Every warning is worded as before, and
    the existing tests pass unchanged.
- **Game**: `game.graphicsQuality` and `setGraphicsQuality()`. The setter publishes
  `GraphicsQualityChanged`.
- **What each preset means**: one table, `platform/render/quality.ts`. Only `WorldRenderer` reads
  it, in `applyQuality()`. That runs on every scene load and on `GraphicsQualityChanged`, so a
  change applies at once with no reload. Materials follow by themselves: three recompiles what a
  light or environment change affects.

| Preset | Sun shadows | Room light (environment) | Meaning                             |
| ------ | ----------- | ------------------------ | ----------------------------------- |
| Low    | off         | none                     | for slower machines: no shadow pass |
| Medium | on          | none                     | the P3.4 look, the default          |
| High   | on          | 0.25                     | steel and brass reflect a soft room |

- **Scope.** The presets concern enhanced scenes (the Physics Lab). Basic scenes look the same
  under every preset.
- **Default: Medium.** It is the look tuned and measured as the norm. It adds nothing that costs
  software rendering, and a simulator meets every kind of machine.
- **Settings UI.** A "Graphics quality" ("Chất lượng đồ hoạ") radio group after the FPS limit,
  with a help line. It uses the existing `radio()` helper and the `menu-choice` field, so the
  P3.2 tokens and focus style apply. It wraps at 360 px. Vietnamese labels: Thấp / Trung bình /
  Cao.
- **Developer panel**: `FPS: <n> (cap <c>, graphics <q>)`.

## 4. Environment lighting

- **Asset: none.** It is three's `RoomEnvironment`, a scene of boxes and area lights built in code
  and shipped with three. No HDRI file, no network, no dependency.
- **Processing.** Prefiltered once by `PMREMGenerator.fromScene` the first time High is used in an
  enhanced scene. The texture is kept for the session and disposed with the renderer. The source
  scene and the generator are disposed right away. Nothing is done per frame, and no draw call is
  added.
- **Application.** `scene.environment` and `scene.environmentIntensity` (0.25), in enhanced scenes
  on High only.
- **Hemisphere compensation.** The environment also adds diffuse light, so the hemisphere light
  gives way by three times the environment intensity (1.25 → 0.5). The room keeps about Medium's
  brightness.
- **Tuning steps, by the screenshots:**
  - Intensity 0.45 with hemisphere −0.45 washed the room out: near-white walls and faded shadows.
  - 0.25 with −0.5 was still brighter than Medium.
  - 0.25 with −0.75 kept the brightness.

## 5. Material interaction

The P3.4 palette and mapping are unchanged; only `looks.ts`'s comment was updated. On High:

- **Launcher barrel**: reads clearly as brushed steel, with a soft reflected gradient. This is the
  clearest gain.
- **Steel balls** (bench, tower): a soft reflection of the room on top of the highlight.
- **Brass bob and spring mass**: warmer and more golden.
- **Painted frames, plastic desks, rubber dials and pad**: little change. Their roughness keeps the
  reflection diffuse; nothing turns to chrome.
- **Artifact**: the dark navy signs read a little lighter (they reflect the room too). Minor.
- **Measurement** (rulers, tape, protractor, screens): as legible as on Medium. Screens are unlit
  basic materials and do not change.

## 6. Benchmark

Every number comes from `npm run bench` (`playwright.bench.config.ts`, physics-lab scenario,
production build, Edge headless, 1280×720). There are two new environment variables for this:
`BENCH_GRAPHICS` and `BENCH_FRAME_CAP` (P3.4).

**Real GPU: "ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU) Direct3D11", gpu-headless.**

On AC power, headless Edge runs about 300 frames a second. Idle scenario, two rounds each:

| Preset |   FPS | GPU ms (mean) |      CPU ms | Draw calls | Notes                                |
| ------ | ----: | ------------: | ----------: | ---------: | ------------------------------------ |
| Low    | 300.0 |   2.28 / 2.39 | 0.35 / 0.33 |         47 | no shadow pass: 78 fewer draw calls  |
| Medium | 300.0 |   2.35 / 2.35 | 0.55 / 0.55 |        125 | = P3.4 (2.42–2.46 ms the day before) |
| High   | 300.0 |   2.35 / 2.38 | 0.59 / 0.58 |        125 | no extra draw call                   |

At this rate the GPU timer reads about 2.3 ms whatever the preset: it likely includes queued work
of a saturated pipeline (see P3.4). The environment's cost is not resolved here.

**On battery.** Partway through the phase the laptop ran on battery: headless frames were held at
60 Hz and the GPU clocks dropped. Idle, two rounds:

| Preset |  FPS |      GPU ms | Draw calls |
| ------ | ---: | ----------: | ---------: |
| Low    | 60.0 | 2.03 / 2.35 |         47 |
| Medium | 60.0 | 2.13 / 2.49 |        125 |
| High   | 60.0 | 3.06 / 3.05 |        125 |

On battery, High costs about +0.6 to 0.9 ms of GPU time over Medium. These numbers are not
comparable with the AC ones.

**Medium, the default, under a cap**, AC, idle / running:

| Cap |      Frame ms |      GPU ms | Draw calls |
| --- | ------------: | ----------: | ---------: |
| 60  | 16.67 / 16.67 | 0.14 / 1.20 |  125 / 126 |
| 30  | 33.33 / 33.33 | 0.15 / 2.51 |  125 / 126 |

**SwiftShader** ("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))"), uncapped:

| Preset | Power   | Idle FPS | GPU ms | Running FPS |
| ------ | ------- | -------: | -----: | ----------: |
| Low    | AC      |     57.1 |  14.43 |        43.0 |
| Medium | AC      |     43.7 |  19.59 |        28.4 |
| High   | AC      |     14.0 |  67.61 |        14.3 |
| Low    | battery |     44.8 |  18.62 |        33.0 |
| Medium | battery |     33.4 |  25.75 |        25.5 |
| High   | battery |     12.4 |  76.35 |        10.0 |

Under software rendering the environment light triples the frame. That is why it is not in the
default, and the e2e suite, which runs on SwiftShader at Medium, is unaffected.

## 7. Regression

- **Experiments under every preset and cap.** The renderer is a platform system the simulation
  never reads.
  - `src/game/frameCap.test.ts`, unchanged: a Hooke's law run under no cap, 30, 60 and 120 gives
    identical results, simulated time and sample count.
  - New e2e (`settings.spec.ts`): free fall under High at 30 FPS completes with the theory's
    fall time and impact velocity (h 1.5 m, Earth).
- **FPS caps**: Medium at 60 and 30 paces at 16.67 and 33.33 ms on the GPU (§6).
- **Pause**: switching the quality in the pause menu keeps the game paused (e2e).
- **Settings**: unit tests cover the default (medium), each preset kept on reload and announced,
  invalid values, and throwing storage. The e2e test covers the main and pause menus, keyboard
  (Space on a focused radio), Vietnamese and 360 px.
- **History, progression, physics, pause, history views**: covered by the full e2e run, 45/45.

## 8. Tests

| Command                                                                                                                                                                                         | Result                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `npm run check`                                                                                                                                                                                 | **PASS** 460/460, 41 files (+2 tests)         |
| `npm run build`                                                                                                                                                                                 | **PASS**                                      |
| `npx playwright test settings.spec --project=dev`                                                                                                                                               | **PASS** 3/3 (one new)                        |
| `npm run test:e2e` (3 workers, no retry)                                                                                                                                                        | **PASS** 45/45, 0 failed, 0 skipped (9.0 min) |
| `BENCH_GRAPHICS=<low,medium,high> [BENCH_FRAME_CAP=<60,30>] npx playwright test -c playwright.bench.config.ts physics-lab.bench --project=<gpu-headless,software> -g "physics lab frame times"` | **PASS** (§6)                                 |
| `git diff --check`                                                                                                                                                                              | clean                                         |

The language-storage test now also expects the graphics-quality warnings: every setting read
warns when storage throws. No test harness change was needed in this phase.

## 9. Visual validation and decision

- **Headless screenshots on the real GPU**, saved in the session's scratchpad (`p35/shots`, and
  `p35/shots3` for the final High). Same camera, resolution, lighting and materials for every
  preset; only the quality changed. Eight views:
  - Physics Lab broad (A), projectile station (B), pendulum (C), Hooke close (D);
  - the tower, the bench ball, the launcher and the cart up close.
- **Where the presets differ:**
  - Low differs everywhere: no shadows, so objects sit less firmly on the floor.
  - High differs mainly on steel and brass at station distance: barrel, balls, bob, mass. In the
    broad view the difference is small.
- **Not done:** no look at a real display; no other resolution or HDR. SwiftShader was benchmarked,
  not judged visually.

**Decision: KEEP WITH LIMITATIONS.**

- Environment lighting stays, on **High only**.
- On a real GPU its cost is small: within noise at 300 frames a second, and about +0.7 ms on
  battery. It adds no draw call and no asset, and the code is small (one table, one method, one
  cached texture).
- The visual gain is real but modest: believable steel and brass up close.
- Under software rendering it triples the frame, so it must not be a default.
- Medium (the default) stays the P3.4 look. Low trades shadows for speed: −78 draw calls, and
  about +30 % frames under SwiftShader.

## 10. Bundle and assets

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 939.56 kB | 949.42 kB | +9.86 kB |
| CSS   | 21.70 kB  | 21.74 kB  | +0.04 kB |

The JS growth is three's `PMREMGenerator` and `RoomEnvironment` code. It stays under the
1,000,000-byte budget, but the margin is now about 50 kB. If it gets tight, `RoomEnvironment` and
the PMREM step could be loaded on first use of High (a dynamic import). No binary asset, no
dependency.

## 11. Limitations

- The visual judgement is from headless GPU captures; nobody judged it on the laptop's display.
- The environment's GPU cost on AC is below what the bench resolves at 300 frames a second. The
  measured +0.7 ms comes from the battery runs, with the GPU at lower clocks.
- Power state changed during the phase (battery, then AC). Each comparison above is within one
  power state.
- The environment is a generic room, not a capture of the lab: reflections are plausible, not
  exact. Dark painted signs read slightly lighter on High.
- Switching to High the first time costs one PMREM pass (a one-off). It was not measured
  separately.
- Basic scenes (every room but the Physics Lab) ignore the presets.

## 12. Files changed

| File                                                                                        | Why                                                               |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/persistence/settings.ts`                                                               | graphics quality type, key, load/save; one shared load/save       |
| `src/game/Game.ts`, `src/game/GameEvents.ts`                                                | `graphicsQuality`, `setGraphicsQuality`, `GraphicsQualityChanged` |
| `src/platform/render/quality.ts` (new)                                                      | what each preset turns on                                         |
| `src/platform/render/WorldRenderer.ts`                                                      | `applyQuality()`, the cached room light                           |
| `src/platform/render/looks.ts`                                                              | comment: no environment below High                                |
| `src/platform/ui/settings.ts`, `styles.css`, `src/content/strings.json`                     | the radio group, its help line, Vietnamese                        |
| `src/platform/ui/DebugPanel.ts`                                                             | names the graphics quality                                        |
| `src/game/Game.test.ts`, `e2e/settings.spec.ts`                                             | unit and e2e tests                                                |
| `e2e/physics-lab.bench.ts`                                                                  | `BENCH_GRAPHICS`                                                  |
| `docs/game-core.md`, `persistence.md`, `data-model.md`, `development-guide.md`, this report | documentation                                                     |

## 13. Git

- Base `025b4fe`; committed as phase p3.5, not pushed.
- `git diff --stat`: 16 files, +319 −59, plus `quality.ts` and this report (new).
- The temporary screenshot spec (`e2e/zz-look.bench.ts`) was deleted.
