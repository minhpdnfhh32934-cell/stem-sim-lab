# Architecture — SimLab

Status: **0.7.0** (in review on `feat/0.7`). Sections marked _(planned)_ describe the target
design from `MASTER_PROMPT.md` and are filled in as each phase lands.

## 1. Overview

```
┌──────────────────────────── Tauri 2 window (WebView2 on Windows) ───────────────────────────┐
│  React UI (main thread): layout, panels, rendering (Canvas 2D / PixiJS / three.js)          │
│        │ state: Zustand stores               │ postMessage                                   │
│        ▼                                     ▼                                               │
│  Science Card · graphs (uPlot) · KaTeX   Web Workers: simulation engines (fixed timestep)   │
│        │ invoke()                                                                            │
└────────┼─────────────────────────────────────────────────────────────────────────────────────┘
         ▼
  Rust backend (src-tauri): AI gateway (`AIProvider`: Gemini + Claude, keys in OS keychain), SQLite,
  .stemsim files, heavy numeric kernels (planned)
```

Principles:

1. **Deterministic engines own every number.** The LLM only extracts and explains (§2 of
   MASTER_PROMPT).
2. **Physics runs separately from rendering.** Physics steps at a fixed timestep in a worker, and
   the UI interpolates between states _(Phase 1)_.
3. **Lazy loading.** Physics, Chemistry and Biology modules, RDKit.js and molecule data load only
   when needed _(Phase 1+)_.
4. **Works without AI.** The sample library and the manual scene builder never depend on the LLM.

## 2. Frontend (Phase 0: done)

| Area          | Where                             | Notes                                                                                                |
| ------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Entry         | `src/main.tsx`, `src/app/App.tsx` | Loads CSS tokens, mounts `AppShell` + global `TooltipLayer`.                                         |
| Layout        | `src/app/layout/`                 | `AppShell` = TopBar · LeftSidebar · Stage + Timeline + BottomPanel · Inspector · StatusBar.          |
| Resizing      | `Splitter.tsx`                    | Pointer + keyboard (arrows / Home / End / Enter = reset), ARIA `separator`.                          |
| Layout state  | `layoutStore.ts`                  | Sizes clamped to `LAYOUT_LIMITS`, persisted (`stemsim.layout`). Presentation flag not persisted.     |
| Settings      | `src/app/settings/`               | Theme (system/light/dark), language, font scale; persisted (`stemsim.settings`).                     |
| Workspace     | `src/app/workspaceStore.ts`       | Subject, problem text, active tool, playback. From Phase 1 it mirrors the engine worker.             |
| Theme         | `src/app/theme/`                  | CSS variables; `data-theme` on `<html>`; `--font-scale` drives rem sizes.                            |
| i18n          | `src/app/i18n/`                   | Tiny typed i18n (no dependency). `MessageKey` is a union of dotted keys, so typos fail to compile.   |
| Shortcuts     | `src/app/shortcuts/`              | Pure table + matcher (unit tested) + one `keydown` listener. IME-safe (Telex/VNI).                   |
| Design system | `src/ui/`                         | IconButton, Tabs, Section, Badges, EmptyState, TooltipLayer, Logo.                                   |
| Catalog       | `src/app/catalog.ts`              | MVP topic list (names only, no scientific data).                                                     |
| Learner UI    | `src/app/learner/`, `levels.ts`   | Home screen, onboarding phases, Basic/Advanced (`uiMode`), Level → Subject → Topic (3b.4).           |
| Learning      | `src/learn/`                      | Challenges + predict–observe–explain checked with `solve()`, progress/badges, break reminder (3b.5). |

### Why these choices (Phase 0)

- **Own i18n instead of i18next.** Vietnamese has no plural forms, and we only need two locales.
  About 60 lines with full type safety, versus about 40 KB of dependency.
- **Own splitter instead of react-resizable-panels.** It is a small, accessible component, and we
  need only three splitters.
- **System fonts** (Segoe UI on Windows) instead of bundled web fonts. They have full Vietnamese
  support, add 0 KB to the installer, and render natively.
- **Plain CSS with tokens instead of Tailwind.** It has no build plugin and makes theming with
  variables straightforward.
- **Okabe–Ito chart palette.** It stays readable for color-blind users (`--chart-1..7`).

### Startup and rendering details

- `public/theme-boot.js` is a tiny blocking script. It reads the saved settings and sets
  `data-theme` and `--font-scale` before the bundle loads, so there is no light flash in dark mode.
- Panels are `memo` components with narrow Zustand selectors (`useShallow`). For example,
  dragging a splitter re-renders only the shell, not the panel contents.
- Global shortcuts do nothing while a modal dialog is open, and they never steal Space or Enter
  from a focused control. A key's default action is prevented only when a shortcut actually ran.

## 3. Rust backend (Phase 0: minimal)

- `src-tauri/src/lib.rs`: builder with the `app_info` command (version, OS, debug flag).
- `capabilities/default.json`: `core:default` plus `core:window:allow-set-fullscreen` /
  `allow-is-fullscreen` (presentation mode). New permissions must be added explicitly.
- `files.rs` (Phase 6): `save_file` / `open_text_file` show the native dialog (tauri-plugin-dialog,
  called from Rust only — no JS permission) and read/write only the file the user picked.
- `history.rs` (Phase 6): SQLite (`rusqlite`, bundled) in the app data folder; table `history`
  (topic, subject, title, `.stemsim` snapshot), newest 500 kept. Commands `history_add/update/
list/delete/clear`; the browser build falls back to localStorage.
- CSP in `tauri.conf.json`: `'self'` only, plus `wasm-unsafe-eval` for Rapier/RDKit WASM and
  `blob:` workers. `devCsp` also allows Vite's inline dev preamble and the HMR websocket.
- Release profile tuned for size (`lto`, `opt-level = "s"`, `strip`).

## 3b. AI gateway (Phase 3)

```
Problem text ──► src/ai/pipeline.ts ──► LlmTransport ──► Rust ai_chat ──► AIProvider (Gemini | Claude)
                   │  classify (enum of topic ids, JSON schema)
                   │  extract  (enum of param keys + units, quotes)
                   ▼
            Zod + buildDraft (code): numbers present in text, units, ranges, defaults, missing
                   ▼
    ProblemDialog "Tôi hiểu đề như sau" ──(user confirms)──► sim.open(topic, params, sources)
```

- Rust owns every network call and the API keys (OS keychain via `keyring`). Requests have an id;
  `ai_cancel` aborts them; `tokio::select!` enforces the timeout (default 30 s, retries included).
- **`AIProvider` trait** (`src-tauri/src/ai/provider.rs`): builds the chat/models requests and reads
  the answers. Implementations: `ai/gemini.rs` (`responseJsonSchema`) and
  `ai/claude.rs` (forced tool call with `input_schema`, system prompt marked for prompt caching).
  `ai/mod.rs` sends them: retry on 429/5xx with backoff 1 s → 2 s → 4 s or `Retry-After` (max 8 s,
  at most 3 retries; a Gemini _per-day_ 429 is not retried), daily cap counted in
  `ai-usage.json` (`ai/usage.rs`, day = user's local date, cap from Settings, 0 = none).
- **One edition** since 0.5.0: the supervised high-school pilot edition (Cargo features, `VITE_EDITION`,
  second installer and update channel) was removed at the user's request (2026-10-12). The app was
  renamed SimLab the same day; the keychain service stays "STEM Sim Lab" and the identifier
  `vn.stemsimlab.desktop`, so keys and data survive the rename.
- **Kết nối AI** (`AiSettings.tsx`): `ai_test_key` sends one tiny request with the chosen model
  and classifies the answer (`classify_key_test` / `src/ai/keyTest.ts`: 2xx ok, 401/403 or
  `API_KEY_INVALID` bad key, 404 bad model, 429/402/"credit balance" quota, network error offline).
  `ai_key_hint` returns only "••••••••" + the last 4 characters.
- **Cache of confirmed readings** (`src/ai/cache.ts`, localStorage, 100 newest): when the user
  confirms the table, the AI's raw reading (topic + quoted quantities) is stored under the
  normalized problem text. The same problem is then read without any AI call; the code checks and
  the confirmation table still run. "Đọc lại bằng AI" bypasses the cache.
- The web page never sees a key. Without the desktop app (dev/E2E/golden runs) a test key is
  injected by the test runner (`__STEMSIM_TEST_GEMINI_KEY__`, `__STEMSIM_TEST_CLAUDE_KEY__`; Claude
  only from Node); E2E mocks the Gemini server.
- The explanation step (`explain.ts`) runs after the engine; its numbers are checked against the
  engine's answers and the explanation is hidden when it contains any other number.

## 3e. Free fallback provider (step 3b.3b)

- `GroqProvider` (`src-tauri/src/ai/groq.rs`): OpenAI-compatible `chat/completions`,
  `response_format: json_schema` (strict for gpt-oss / Qwen 3.8), reasoning kept out of the answer
  (`include_reasoning: false` / `reasoning_format: hidden`, `reasoning_effort: low`), `<think>` blocks
  stripped. Same body in `groqBody` (`src/ai/transport.ts`).
- `ChatRequest.fallback {provider, model}` (filled by the transport from Settings → "Dự phòng khi
  hết lượt", `fallbackFor` in `src/ai/fallback.ts`). `send_with_fallback` in `ai/mod.rs`: the chosen
  provider first; on `is_quota_error` (429 after retries, 402, "credit balance", RESOURCE_EXHAUSTED)
  the fallback answers and the provider is skipped for 10 min (`AiState.exhausted`). Never on a
  wrong key, unknown model or network error. `ChatResponse.provider/fallback` reach the UI: the
  AI label and "Mô hình AI" line say "dự phòng". The browser transport follows the same rule
  (`isQuotaError`), so E2E covers it with a mocked Groq server.

## 3d. Safety gates (PROMPT_PHAN_2 A3, step 3b.3)

```
first run ──► AgeGate (src/safety) ──► Rust safety_* (safety.json) ──► ai_chat / ai_set_key check
problem ──► moderation.checkInput ──► (blocked: incident kind+time, crisis card) ──► AI ──► outputIsSafe
```

- **Rules in Rust** (`src-tauri/src/safety.rs`), so the page cannot open the AI by itself:
  `status_of` (pure, tested): `adult_terms == TERMS_VERSION` → AI allowed; "under 18" → answered,
  AI off. `ai_chat`, `ai_models`, `ai_test_key` refuse with `notAllowed` while the gate is closed;
  `ai_set_key` needs the 18+ confirmation (`key_gate` in `ai/mod.rs`); deleting a key is always
  allowed. (The pilot's birth year, supervisor PIN and consent were removed in 0.5.0.)
- **Incident log** (`incidents.json`, newest 500): `{at, kind}` only — `inputPersonalData`,
  `inputUnsafe`, `inputCrisis`, `outputUnsafe`, `userReport`.
- **Web side** (`src/safety/`): `safety.ts` (types, `statusOf` mirror, `TauriSafety`, browser copy
  `BrowserSafety` in localStorage for dev/E2E), `safetyStore.ts` (status, gate visibility),
  `moderation.ts` (crisis → personal data → unsuitable; Unicode-aware word boundaries; NFC),
  `AgeGate`, `SafetySettings` (Settings → "An toàn & quyền riêng tư"), `AiContentBar` (AI label +
  report), `CrisisCard`, `PrivacyDialog`. `analyze.ts` runs `safetyBlock` before any AI call and the
  output filter after it; `explain.ts` returns `safe`; prompts get `SAFETY_RULES`. Unit tests run with an open gate (`tests/setup.ts`); E2E storage state has
  `stemsim.safety = {adultTerms: 1}`.

## 3c. Projects, undo, history (Phase 6)

- `.stemsim` = JSON `{format, version, app, savedAt, topicId, physics?{params, sources, problem},
module?{state}}` (Zod schema in `src/app/project/snapshot.ts`). Only **inputs** are stored; results
  are recomputed by the engine. Unknown topics, parameters and wrongly typed fields are ignored.
- Module inputs are exposed through `ModuleView.state` (`bindStore(store, keys, apply?)` in
  `src/modules/binding.ts`): the same binding serves files, history and undo/redo.
- Undo/redo (`src/app/project/undo.ts`): snapshots of the open topic's inputs, changes within
  500 ms grouped (slider drags), 100 steps, reset when another topic opens.
- Overload: `FrameMonitor` → `reportOverload()` lowers the drawing tier one step (`perfStore.degraded`);
  memory watchdog in `src/perf/memory.ts`. See docs/PERFORMANCE.md.

## 3f. Science Studio (`src/studio/`, 0.6.0)

Guided lessons (Predict → Interact → Observe → Explain → Conclude → Report) on top of the existing
engines and data; the studio never computes a measurement of its own. Entry: the "Science Studio"
card on the launch page → screen `'studio'` (`src/app/navigationStore.ts`) → `StudioScreen`,
mounted by `AppShell`.

| Layer            | Files                                                                                                                                                                      | Responsibility                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screen           | `StudioScreen.tsx`, `studio.css`, `ReviewNote.tsx`, `TeacherNote.tsx`                                                                                                      | Subject tabs (Hóa học · Sinh học · Vật lí · Soạn bài), lesson picker, one `SubjectPlugin` per subject; labels for unreviewed and teacher-written text.               |
| Model (pure)     | `scenario.ts`, `session.ts`, `report.ts`, `unverified.ts`, `aiContext.ts`                                                                                                  | Zod scenario schema (the binding names engines/data only); session evidence by origin (engine / learner / AI) and step blockers; Markdown report; AI screen context. |
| State            | `studioStore.ts`                                                                                                                                                           | Zustand store persisted as `stemsim.studio` (chosen tab and lesson, one session per scenario).                                                                       |
| Shared flow      | `flow/PoeFlow.tsx`, `flow/SharedSteps.tsx`, `flow/types.ts`, `flow/AskTeacher.tsx`, `flow/useStudioContext.ts`, `flow/clipboard.ts`                                        | Step bar, navigation and "what is missing" text, Explain / Conclude / Report steps, "Hỏi thầy" prefill and the screen context shared with AI Teacher.                |
| Physics          | `physics/plugin.ts`, `PhysicsSteps.tsx`, `comparison.ts`, `engineRun.ts`, `openInLab.ts`, `usePhysics.ts`                                                                  | Conditions A/B run headless in the scene's own engine; `solve()` is the cross-check and the POE verdict; opens the same run in the lab.                              |
| Chemistry        | `chemistry/plugin.ts`, `bench.ts` (pure state machine), `library.ts`, `evidence.ts`, `card.ts`, `BenchStep.tsx`, `TubeSvg.tsx`, `EvidenceFacts.tsx`                        | One tube, two solutions, mix. What a mix shows comes only from `data/reactions.json`; no record → "chưa có trong cơ sở dữ liệu đã kiểm chứng".                       |
| Biology          | `biology/plugin.ts`, `model.ts`, `match.ts`, `evidence.ts`, `card.ts`, `bioSession.ts`, `useModel.ts`, `ModelStep.tsx`, `StageRecorder.tsx`, `FindParts.tsx`               | Reuses the mitosis 3D view (2D fallback); stage counts come from the model; the part-finding key is the model's own component data.                                  |
| Built-in lessons | `scenarios/*.ts`, `scenarios/index.ts`                                                                                                                                     | Three scenarios, each validated at load; an invalid one is left out.                                                                                                 |
| Authoring        | `authoring/service.ts`, `check.ts`, `choices.ts`, `draft.ts`, `bindingDraft.ts`, `collection.ts`, `fileFormat.ts`, `limits.ts`, `issueText.ts`, `authoringStore.ts`, views | "Soạn bài": every choice comes from an engine or data table; schema + size + engine checks before saving; local only (`teacher.` ids); JSON import/export.           |

Teaching text is `review_status: "pending"` (`docs/DATA_REVIEW.md` items 20–23) and is shown with
its label. Tests: unit tests next to each file (`src/studio/**/*.test.ts(x)`), E2E
`tests/e2e/studio.spec.ts` and `tests/e2e/studio-biology.spec.ts`. Step records: `docs/work-log/`.

## 3g. 3D views (`src/ui/three/`, `src/biology/**`, 0.6.0–0.7.0)

Every biology lesson opens in 3D. A 3D view only **draws** what the lesson's model computed:
counts, sequences, ratios and levels come from the same pure functions as the 2D page; shapes,
sizes, positions and motion are illustrations and are labelled so (`view3d/texts.ts`:
`ILLUSTRATION`, `MOTION`). New 3D wording goes to `docs/DATA_REVIEW.md` (items 26–28, rows M3D,
MEI3D, DOG3D, MUT3D, MEN3D, ENZ3D, TRA3D) with `review_status: "pending"`.

| Layer                   | Where                                                                                                                                                       | Responsibility                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic kit             | `src/ui/three/` (`renderer.ts`, `quality3d.ts`, `useThreeHost.ts`, `loop.ts`, `labels.ts`, `pick.ts`)                                                       | No biology. Quality table per tier, render on demand, damped orbit + arrow keys, tweened camera, `FrameMonitor` → `reportOverload()`, lost-context fallback.   |
| Biology kit             | `src/biology/view3d/` (`Bio3DCanvas`, `Bio3DView`, `SceneKit`, `lessonStore.ts`, `palette.ts`, `sampling.ts`)                                               | Stage layout, 3D / 2D switch, palette with a shape cue per role, `drawScale` / `apportion` (classes add up exactly), shared texts, primitives, disposal.       |
| Division (shared)       | `src/biology/division/division3d/`                                                                                                                          | Stage clock, counts from `runDivision`, chromatid shapes, membrane / spindle / centrosome / nucleus meshes for mitosis and meiosis.                            |
| Dedicated lesson module | `division/mitosis3d/`, `division/meiosis3d/`, `central/dogma3d/`, `central/mutation3d/`, `genetics/mendel3d/`, `enzyme/enzyme3d/`, `transport/transport3d/` | Each: pure `binding.ts` or `timeline.ts` (tested against the model), `layout.ts`, `scene.ts`, `facts.ts`, `camera.ts`, `store.ts`, `Xxx3DView`, `Xxx3DSwitch`. |
| Simple kit views        | `genetics/{HardyWeinberg3D,Drift3D}.tsx`, `ecology/{Logistic3D,LotkaVolterra3D}.tsx`, `scenes3d.ts`                                                         | The four population lessons: one figure per individual or per group (noted). Their dedicated 3D modules are planned for a later update.                        |

Rules: a dedicated module saves its 3D / 2D choice in the lesson store (`view3d`, also written to
`.stemsim` files); the simple kit views keep it in `stemsim.bio3d`. Low tier, no WebGL2 or a lost
context → the 2D page with the reason. Overload lowers smoothness, never accuracy; everything is
disposed on unmount. Tests: pure files next to the code, `view3d/testing.ts` (`expectAllFreed`),
E2E `*3d.spec.ts` and `bio3d.spec.ts` in the `chromium-3d` Playwright project (software WebGL),
budgets in `chromium-3d-perf` (`@perf`).

**Art direction (0.7.1).** One look for all 3D views, applied by the shared path so a lesson gets
it without code of its own:

- `ThreeHost` puts every scene on one stage (`stage.ts`): a dithered radial backdrop from
  `--bg-stage` (`backdrop.ts`; a sky gradient for outdoor rigs), the theme's rim and environment
  strength (`lighting.ts` presets STUDIO / OUTDOOR, `applyStageLook`) and the exposure; it puts
  objects on render layers (`layers.ts`: SHELL for see-through shells, FX for haze and contact
  shadows, GLASS for refracting glass; lights on every layer) and sees/picks all of them. Tone mapping stays Khronos Neutral everywhere (ACES / AgX
  would move the data colours' hue).
- `quality3d.ts` gains the GPU class (`gpuInfo.ts`) and the post-processing flags. Only High on a
  discrete GPU loads `postfx.ts` (lazy chunk), in two halves. HDR half: opaque + GLASS layers
  into a 4× MSAA HalfFloat target with a depth texture → GTAO (half resolution, opaque layer
  only) → bloom (only while a highlight marked `userData.bloom` is visible). Screen half, drawn
  like the direct path: the backdrop (never tone-mapped) → a composite quad that tone-maps the
  HDR surfaces with the renderer's own Neutral + sRGB functions and writes their depth → SHELL +
  FX forward, blended in display space. So the backdrop, membranes and contact shadows have the
  same colours on every GPU (E2E: `mitosis3d.spec.ts`, ΔE_OK ≤ 0.02 between the two paths);
  only opaque parts gain AO and glow. `postfxSupport.ts` turns AO, then bloom, then refraction
  off after 30 animated frames over 20 ms. High on an integrated or software GPU draws like
  0.7.0 High.
- Biology recipes (`view3d/recipes.ts`): membrane / shell, chromosome, backbone + base pair,
  protein blob (`proteinBlob.ts`, `noise.ts`), particles, glassware, liquid, organism, terrain,
  annotation, highlight. Rule 0 "saturation = data": data roles keep their chart token as albedo
  (`palette.ts` `ROLES`, aligned with the 2D charts); structures are muted (`STRUCTURES`,
  `muted()`). Primitives `habitat.ts` and `instancedTokens.ts` serve the habitats and particle
  lessons. Protein blobs are built from a direct indexed icosphere (`icosphere`, same counts as
  three.js detail 7 / 15, several times faster to build).
- Surface shading (`src/ui/three/relief.ts`, no texture, no draw call): `withRelief` bumps the
  normal from one octave of 3D value noise sampled at the object-space position or at a stable
  vertex attribute (`ChromosomeTube`'s `surf`, so the grain stays on a moving chromatid);
  `withEdgeShade` darkens solids towards the silhouette by `--m3d-edge-shade`. Used by the
  mitosis chromatids (+ sheen) and nucleolus, the enzyme blobs (+ seeded lumps and darker
  valleys kept out of the binding sites) and the dogma polymerase / ribosome (protein blobs).
  Never on the large membranes (software frame cost).
- Tags: one look for `LabelLayer` / `TagLayer` and the kit's CSS2D labels (`ui.css`: glass pill,
  ≥ 12 px, tabular numbers, 7 px anchor ring in the part's role colour). When one label column is
  full, its least important labels move to the other column before any is left out (`labels.ts`).
  `LabelLayer.update(…, obstacles)` takes world-space hulls: `avoid` (data a label box never
  covers — the division views pass every condensed chromatid's box) and `regions` (separate
  subjects — the daughter cells once a furrow shows, or the two cells of meiosis II): a part's
  label never goes to a column its leader would reach only across another cell, a box that would
  cover data moves outwards, then to the other column, else it is left out
  (`division3d/labelObstacles.ts`; tests `meiosis3d/labelLayout.test.ts`, `mitosis3d/…`).
- DNA pictures (`src/biology/central/dogma3d/helix.ts`, shared by "ADN → mARN → Protein" and
  "Đột biến điểm"): backbones are continuous Catmull–Rom tubes through the nucleotides'
  positions (`strandTube.ts`: buffers sized once, `build(a, b)` rewrites and uploads only those
  segments, `show` / `twin` draw ranges of one tube; ring frames point away from the helix axis,
  so two tubes sharing a point and its neighbours meet without a seam); base pairs are two
  rounded halves split at the midline (`Writer.half`, base-pair recipe, instance colour = the
  base's token); rungs fade (`rungOpacity`, from `scene.onBeforeRender`) once neighbouring pairs
  are under ~7 px apart. The dogma helix turns about its axis while the polymerase works: the two
  still stretches are one resting tube drawn by two meshes, each turned by `rigidSpan`'s angle;
  only the bubble's tube is rebuilt. Machines (`machines.ts`): RNA polymerase and the large
  ribosome subunit are `proteinShell`s (recipes: seeded blob, opacity 0.55, rim + light-stage
  ink, relief, cut open by a world plane with a darker inner wall); L-shaped tRNA body (one
  merged geometry); a glowing codon frame (HDR on High). During translation the DNA sits under
  one parent scaled/moved by `dnaPlace` (context above the ribosome); every DNA point the scene
  reports (tags, labels, picks, `basePoint`) goes through `placeDna`. Point mutation: two lane
  plates (`laneSpan`), HDR outline hulls (MeshBasic, colour × `highlightIntensity`, `bloom`
  flag), gap rings, rounded brackets (bar + ticks + corner balls), an end cap for a premature
  stop; `ThreeHost.dragging()` keeps the site camera from gliding under the learner's hand.
  Round 2: the end cap follows `prematureStop` (binding.ts: where the stop codon sits, not the
  chain length). The mRNA's bases are their own rung set (`rungs(…, 'mrna')`: own material, never
  faded, LAYER.FX so post-processing AO/bloom never washes out the colour code; the tRNA
  anticodons too); only the DNA's rungs fade. "Theo dõi" in translation zooms towards the
  machinery's focus (`camera.ts` `zoomedCenter`: frame centre at the fitted distance, focus from
  0.55× of it; the view only adjusts while the camera is on the follow track). Name labels keep
  clear of each scene's `labelObstacles()` (world hulls of a few base pairs: strands, mRNA, tRNAs,
  chains) and of every tag shown (`TagLayer.rects()`, passed as `LabelObstacles.rects`), 4 px
  inside the stage (`edge`); the mutation lane names sit outside each plate at its helix, on the
  side its labels do not use.
- Cell division (mitosis + meiosis share `src/biology/division/division3d/`): `looks.ts` builds
  every part's three looks (normal / highlighted / dimmed) for both lessons — chromatids with
  relief, sheen, darker silhouette and a contact shade where sisters touch (`ChromosomeTube`'s
  `shade` attribute through `withVertexShade`: the maternal/paternal colours stay exact); membranes
  as a rimmed front face over a faint Lambert back face (the cell's volume) — on the light stage
  the cell, the nuclear envelope and the plant wall also get a darker outline in a deeper shade of
  their own colour (`withRim`'s `ink`, strength `--m3d-shell-ink`: 1 in light, 0 in dark; the band
  follows the geometric normal so bump/relief never streaks it; a faint share of it tints the
  faces; `setRimAlpha` fades it with the shell; test `division3d/looks.test.ts` keeps the cell
  outline ≥ 1.5 : 1 on the panel and the nucleus outline ≥ 1.5 : 1 on the cell); spindle fibres light
  and see-through on LAYER.FX, fading towards the poles (`fibreGeometry` alpha); a glowing
  centrosome core and chiasma ring (bloom in HDR); the plant wall's fibrous bump in HDR.
  `palette.ts` maps the theme tokens once for both (structures muted, data colours exact);
  `tubes.ts` (tube detail, kinetochore, contact shade), `guides.ts` (dashed metaphase-plate ring),
  `dimensions.ts` (chromosomes drawn 1.25 × larger, same ring count). `TwoSphereProfile`
  undulates 1.5 % inwards (seeded table, mirror-symmetric across the furrow); `ChromosomeTube`
  `seams` give a sharp colour change at the model's crossover share. Meiosis framing
  (`meiosis3d/camera.ts`): in Basic mode prophase I and metaphase I frame their chromosomes
  (+25 %), meiosis II is seen nearly from the front (`MEIOSIS2_DIR`); stage-to-stage moves glide
  700 ms and keep their aim through layout changes.

## 4. Planned modules

| Phase | Module                                                                           | Key decisions                                                                                                                       |
| ----- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `core/` units, constants, integrators; `workers/`; `perf/` tier; Science Card UI | RK4, Velocity Verlet, RK45 adaptive, implicit (stiff); accumulator with max substeps.                                               |
| 2     | `physics/` 2D scenes                                                             | Own solvers for textbook problems; Rapier for free sandbox; uPlot graphs; KaTeX solutions.                                          |
| 3     | `ai/` + Rust AI gateway                                                          | Gemini `generateContent` with `responseJsonSchema` / Claude forced tool structured output; Zod; max 2 repair retries → manual form. |
| 4     | `chemistry/`                                                                     | RDKit.js, PubChem conformers bundled offline, curated reaction library with atom mapping.                                           |
| 5     | `biology/`                                                                       | Data-table-driven (NCBI table 1), Monte Carlo compared with theory.                                                                 |
| 6     | degradation ladder, watchdog                                                     | See MASTER_PROMPT §5.                                                                                                               |

## 5. Verified in Phase 0

- `npm run tauri dev` and a debug `tauri build` both open the native window with the full layout
  (checked on Linux/WebKitGTK under Xvfb). The status bar shows the version from the Rust
  `app_info` command, which proves the IPC works.
- Browser checks: tooltips on disabled buttons, Esc closes Settings, Space presses a focused
  control, splitter drag and persistence across reload, dark theme applied before React loads,
  and no horizontal overflow at the 1024×600 minimum window size.

## 6. Testing

- **Vitest + Testing Library (jsdom)**: unit tests next to the code (`*.test.ts`), app-level tests
  in `tests/`.
- **cargo test**: Rust unit tests.
- **Playwright** E2E _(Phase 3)_ and golden problem set _(Phase 2–3)_.
- CI runs format, lint, typecheck, tests and build, plus Rust fmt, clippy and tests on Linux and Windows.
